'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const scoreFields = [
  ['visual_hierarchy', 'Visual hierarchy'],
  ['composition_spacing', 'Composition + spacing'],
  ['crop_overflow', 'Crop + overflow safety'],
  ['typography_readability', 'Typography + readability'],
  ['brand_specificity', 'Brand specificity'],
  ['copy_authenticity', 'Copy authenticity'],
  ['conversion_clarity', 'Conversion clarity'],
  ['mobile_quality', 'Mobile quality'],
] as const;

type ScoreKey = typeof scoreFields[number][0];

const emptyScores = Object.fromEntries(scoreFields.map(([key]) => [key, ''])) as Record<ScoreKey, string>;

export default function ManualQaForm({
  websiteId,
  versionId,
  previewUrl,
  onCompleted,
}: {
  websiteId: string;
  versionId: string;
  previewUrl: string;
  onCompleted: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [scores, setScores] = useState<Record<ScoreKey, string>>(emptyScores);
  const [notes, setNotes] = useState('');
  const [reviewedMobile, setReviewedMobile] = useState(false);
  const [reviewedDesktop, setReviewedDesktop] = useState(false);
  const [cropSafe, setCropSafe] = useState(false);
  const [copyVerified, setCopyVerified] = useState(false);
  const [ctaTested, setCtaTested] = useState(false);
  const [noBlockers, setNoBlockers] = useState(false);
  const [exactPreview, setExactPreview] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  function score(key: ScoreKey, value: string) {
    if (value === '' || /^\d{1,3}$/.test(value)) setScores((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const numeric = Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number(value)])) as Record<ScoreKey, number>;
    if (Object.values(scores).some((value) => value === '') || Object.values(numeric).some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      setError('Enter a 0–100 score for every category.');
      return;
    }
    if (!reviewedMobile || !reviewedDesktop || !cropSafe || !copyVerified || !ctaTested || !noBlockers || !exactPreview) {
      setError('Complete every review confirmation before submitting manual QA.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError('Your session has expired. Sign in again.'); return; }

    setWorking(true);
    try {
      const response = await fetch('/api/websites/qa-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          websiteId,
          versionId,
          scores: numeric,
          notes,
          reviewedMobile: true,
          reviewedDesktop: true,
          noKnownHighBlockers: true,
          noUncontrolledCropOrOverflow: true,
          copyAndClaimsVerified: true,
          primaryCtaTested: true,
          confirmation: 'I REVIEWED THIS EXACT PREVIEW',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Manual QA submission failed.');
      onCompleted(payload.message || `Manual QA ${payload.status} at ${payload.overall_score}/100.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Manual QA submission failed.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="manualQa">
      <div className="manualHead">
        <div><span>RM0 OPTION · HUMAN REVIEW</span><h3>Manual rendered QA</h3><p>Use this when the OpenAI API is intentionally disabled. Review the exact recorded preview yourself; this is not a shortcut around the quality gate.</p></div>
        <a href={previewUrl} target="_blank" rel="noreferrer">Open exact preview ↗</a>
      </div>
      {error && <div className="manualError">{error}</div>}
      <form onSubmit={submit}>
        <div className="scores">
          {scoreFields.map(([key, label]) => <label key={key}><span>{label}</span><input inputMode="numeric" value={scores[key]} onChange={(event) => score(key, event.target.value)} placeholder="0–100" /></label>)}
        </div>
        <label className="notes">Review notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record specific polish notes or why this version is release-quality." /></label>
        <div className="checks">
          <label><input type="checkbox" checked={reviewedMobile} onChange={(event) => setReviewedMobile(event.target.checked)} /> I reviewed the exact preview at mobile size.</label>
          <label><input type="checkbox" checked={reviewedDesktop} onChange={(event) => setReviewedDesktop(event.target.checked)} /> I reviewed the exact preview at desktop size.</label>
          <label><input type="checkbox" checked={cropSafe} onChange={(event) => setCropSafe(event.target.checked)} /> I found no uncontrolled crop, clipping or overflow.</label>
          <label><input type="checkbox" checked={copyVerified} onChange={(event) => setCopyVerified(event.target.checked)} /> Customer-facing copy and claims are verified and appropriate.</label>
          <label><input type="checkbox" checked={ctaTested} onChange={(event) => setCtaTested(event.target.checked)} /> I tested the primary CTA / conversion path.</label>
          <label><input type="checkbox" checked={noBlockers} onChange={(event) => setNoBlockers(event.target.checked)} /> I know of no high-severity or blocker defect.</label>
          <label className="exact"><input type="checkbox" checked={exactPreview} onChange={(event) => setExactPreview(event.target.checked)} /> I confirm these scores apply to this exact recorded Website Studio preview.</label>
        </div>
        <div className="submitRow"><small>Every category must be ≥85, with zero pending assets, for a manual pass.</small><button disabled={working}>{working ? 'Recording QA…' : 'Record manual QA'}</button></div>
      </form>
      <style jsx>{`
        .manualQa{background:#fffdf8;border:1px solid #dfdcd4;border-radius:20px;padding:20px;display:grid;gap:14px}.manualHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.manualHead span{font-size:8px;letter-spacing:.13em;font-weight:900;color:#7a6c55}.manualHead h3{margin:5px 0 5px;font-size:19px}.manualHead p{margin:0;max-width:760px;color:#6e726c;font-size:11px;line-height:1.5}.manualHead a{font-size:10px;font-weight:850;color:#355246;text-decoration:none;white-space:nowrap}.manualError{padding:10px 12px;border-radius:10px;background:#f7e7e7;border:1px solid #ead0d0;color:#843a3a;font-size:11px}.scores{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.scores label,.notes{display:grid;gap:6px;font-size:9px;font-weight:800;color:#676e68}.scores input,.notes textarea{border:1px solid #dcd8d0;border-radius:10px;background:#fff;padding:9px 10px;font:inherit;color:#252925}.notes{margin-top:11px}.notes textarea{resize:vertical}.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:13px;padding:14px;background:#f5f2ec;border-radius:14px}.checks label{display:flex;gap:8px;align-items:flex-start;font-size:10px;line-height:1.4;color:#555d57}.checks input{margin-top:2px}.checks .exact{grid-column:1/-1;font-weight:850;color:#2e443b}.submitRow{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:13px}.submitRow small{font-size:9px;color:#777b75}.submitRow button{border:0;border-radius:10px;background:#243b35;color:#fff;padding:10px 13px;font-size:10px;font-weight:850}.submitRow button:disabled{opacity:.55}@media(max-width:850px){.scores{grid-template-columns:1fr 1fr}}@media(max-width:620px){.manualHead{display:block}.manualHead a{display:inline-block;margin-top:10px}.scores,.checks{grid-template-columns:1fr}.checks .exact{grid-column:auto}.submitRow{align-items:stretch;flex-direction:column}.submitRow button{width:100%}}
      `}</style>
    </section>
  );
}
