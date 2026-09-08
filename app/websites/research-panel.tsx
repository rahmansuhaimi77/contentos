'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import styles from './research-panel.module.css';

type Reference = {
  id: string;
  source_url: string | null;
  source_kind: string;
  inspiration_role: string;
  title: string;
  notes: string;
  inspiration_tags: string[];
  approved: boolean;
};

type Direction = {
  id: string;
  style_name: string;
  creative_concept: string;
  rationale: string;
  mood: string;
  status: string;
};

type Section = {
  id: string;
  section_key: string;
  section_type: string;
  objective: string;
  conversion_role: string;
  status: string;
};

type Run = {
  id: string;
  stage: string;
  provider: string;
  model: string;
  status: string;
  error_message: string | null;
  completed_at: string | null;
  started_at: string;
};

function pretty(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ResearchPanel({ websiteId, briefStatus, onChanged }: { websiteId: string; briefStatus: string; onChanged: () => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [references, setReferences] = useState<Reference[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [refTitle, setRefTitle] = useState('');
  const [refRole, setRefRole] = useState('general');
  const [refNotes, setRefNotes] = useState('');

  useEffect(() => {
    void load();
  }, [websiteId]);

  async function load() {
    if (!websiteId) return;
    setLoading(true);
    const [referenceRes, directionRes, sectionRes, runRes] = await Promise.all([
      supabase.from('growth_website_references').select('id,source_url,source_kind,inspiration_role,title,notes,inspiration_tags,approved').eq('website_id', websiteId).order('created_at'),
      supabase.from('growth_website_directions').select('id,style_name,creative_concept,rationale,mood,status').eq('website_id', websiteId).in('status', ['proposed', 'approved']).order('created_at', { ascending: false }),
      supabase.from('growth_website_sections').select('id,section_key,section_type,objective,conversion_role,status').eq('website_id', websiteId).order('sort_order'),
      supabase.from('growth_website_runs').select('id,stage,provider,model,status,error_message,completed_at,started_at').eq('website_id', websiteId).order('started_at', { ascending: false }).limit(6),
    ]);
    const firstError = referenceRes.error || directionRes.error || sectionRes.error || runRes.error;
    if (firstError) setError(firstError.message);
    setReferences((referenceRes.data ?? []) as Reference[]);
    setDirections((directionRes.data ?? []) as Direction[]);
    setSections((sectionRes.data ?? []) as Section[]);
    setRuns((runRes.data ?? []) as Run[]);
    setLoading(false);
  }

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function callAgent(path: string, action: string) {
    const token = await authToken();
    if (!token) {
      setError('Your session has expired. Sign in again.');
      return null;
    }
    setWorking(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ websiteId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `${action} failed.`);
      await load();
      onChanged();
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${action} failed.`);
      return null;
    } finally {
      setWorking('');
    }
  }

  async function runResearch() {
    if (briefStatus === 'draft' || briefStatus === 'missing') {
      setError('Verify the business brief before running research.');
      return;
    }
    const payload = await callAgent('/api/websites/research', 'research');
    if (!payload) return;
    if (payload.mode === 'planning_only') {
      setNotice('Research packet and preliminary directions created. Live reference discovery needs an OpenAI API connection, so no URLs were fabricated. You can add references manually below.');
    } else {
      setNotice(`Live research completed with ${payload.grounded_reference_count ?? 0} grounded references. Review and approve only the references worth using.`);
    }
  }

  async function addManualReference() {
    if (!refUrl.trim() || !refTitle.trim()) {
      setError('Reference URL and title are required.');
      return;
    }
    try { new URL(refUrl.trim()); } catch { setError('Enter a valid http/https reference URL.'); return; }
    setWorking('manual-reference');
    setError('');
    const { error: insertError } = await supabase.from('growth_website_references').insert({
      website_id: websiteId,
      source_url: refUrl.trim(),
      source_kind: 'manual',
      inspiration_role: refRole,
      title: refTitle.trim(),
      notes: refNotes.trim(),
      inspiration_tags: [],
      approved: false,
    });
    if (insertError) setError(insertError.message);
    else {
      setRefUrl(''); setRefTitle(''); setRefRole('general'); setRefNotes('');
      setNotice('Reference added. Review its principle, then approve it if it deserves to shape the website.');
      await load();
      onChanged();
    }
    setWorking('');
  }

  async function toggleReference(reference: Reference) {
    setWorking(`reference-${reference.id}`);
    setError('');
    const { error: updateError } = await supabase.from('growth_website_references').update({ approved: !reference.approved }).eq('id', reference.id);
    if (updateError) setError(updateError.message);
    else {
      await load();
      onChanged();
    }
    setWorking('');
  }

  async function approveDirection(directionId: string) {
    if (approvedReferences < 3) {
      setError('Approve at least three references before locking a creative direction.');
      return;
    }
    setWorking(`direction-${directionId}`);
    setError('');
    const { error: supersedeError } = await supabase.from('growth_website_directions').update({ status: 'superseded', updated_at: new Date().toISOString() }).eq('website_id', websiteId).neq('id', directionId).in('status', ['proposed', 'approved']);
    if (supersedeError) {
      setError(supersedeError.message);
      setWorking('');
      return;
    }
    const { error: approveError } = await supabase.from('growth_website_directions').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', directionId);
    if (approveError) setError(approveError.message);
    else {
      setNotice('Creative direction approved. The production planner can now translate it into section architecture.');
      await load();
      onChanged();
    }
    setWorking('');
  }

  async function generatePlan() {
    if (!approvedDirection) {
      setError('Approve one creative direction first.');
      return;
    }
    if (approvedReferences < 3) {
      setError('Approve at least three references before generating the production plan.');
      return;
    }
    const payload = await callAgent('/api/websites/plan', 'planning');
    if (payload) setNotice(`Production plan created: ${payload.section_count} sections and ${payload.asset_count} visual asset requirements. Review the architecture before Codex builds it.`);
  }

  const approvedReferences = references.filter((reference) => reference.approved).length;
  const approvedDirection = directions.find((direction) => direction.status === 'approved');
  const proposedDirections = directions.filter((direction) => direction.status === 'proposed');

  if (loading) return <section className={styles.shell}><div className={styles.loading}>Loading research workspace…</div></section>;

  return (
    <section className={styles.shell}>
      <div className={styles.head}>
        <div><span>RESEARCH + PRODUCTION AGENT</span><h3>References first. Composition second.</h3><p>The agent finds principles worth borrowing, proposes three distinct directions, then turns the approved direction into a build specification.</p></div>
        <button disabled={Boolean(working) || briefStatus === 'draft' || Boolean(approvedDirection)} onClick={() => void runResearch()}>{working === 'research' ? 'Researching…' : references.length || proposedDirections.length ? 'Re-run research' : 'Run research agent'}</button>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.gates}>
        <div className={approvedReferences >= 3 ? styles.done : ''}><span>REFERENCES</span><b>{approvedReferences}/{references.length}</b><small>3 approved required</small></div>
        <div className={approvedDirection ? styles.done : ''}><span>DIRECTION</span><b>{approvedDirection ? 'Locked' : proposedDirections.length ? `${proposedDirections.length} options` : 'Pending'}</b><small>human approval required</small></div>
        <div className={sections.length ? styles.done : ''}><span>SECTION PLAN</span><b>{sections.length || '—'}</b><small>review before build</small></div>
      </div>

      <div className={styles.columns}>
        <div>
          <div className={styles.sectionTitle}><div><span>01</span><h4>Reference board</h4></div><small>Approve principles, not whole websites.</small></div>
          <div className={styles.referenceList}>
            {references.length === 0 && <p className={styles.empty}>No references yet. Run live research or add selected references manually.</p>}
            {references.map((reference) => (
              <article className={`${styles.reference} ${reference.approved ? styles.referenceApproved : ''}`} key={reference.id}>
                <div><span>{pretty(reference.inspiration_role)}</span><em>{reference.source_kind}</em></div>
                <h5>{reference.title || 'Untitled reference'}</h5>
                <p>{reference.notes || 'Add a note describing the specific principle worth learning from.'}</p>
                <div className={styles.referenceActions}>
                  {reference.source_url && <a href={reference.source_url} target="_blank" rel="noreferrer">Inspect ↗</a>}
                  <button disabled={Boolean(working)} onClick={() => void toggleReference(reference)}>{reference.approved ? 'Remove approval' : 'Approve reference'}</button>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.manual}>
            <span>ADD MANUAL REFERENCE</span>
            <div className={styles.manualGrid}>
              <input placeholder="https://reference-site.com" value={refUrl} onChange={(event) => setRefUrl(event.target.value)} />
              <input placeholder="Reference title" value={refTitle} onChange={(event) => setRefTitle(event.target.value)} />
              <select value={refRole} onChange={(event) => setRefRole(event.target.value)}><option value="general">General</option><option value="hero">Hero</option><option value="typography">Typography</option><option value="layout">Layout</option><option value="trust">Trust</option><option value="conversion">Conversion</option><option value="motion">Motion</option><option value="visual-storytelling">Visual storytelling</option></select>
              <input placeholder="What principle should we learn from it?" value={refNotes} onChange={(event) => setRefNotes(event.target.value)} />
            </div>
            <button disabled={Boolean(working)} onClick={() => void addManualReference()}>{working === 'manual-reference' ? 'Adding…' : 'Add reference'}</button>
          </div>
        </div>

        <div>
          <div className={styles.sectionTitle}><div><span>02</span><h4>Creative directions</h4></div><small>Compare before committing.</small></div>
          <div className={styles.directionList}>
            {directions.length === 0 && <p className={styles.empty}>Research will propose three distinct directions.</p>}
            {directions.map((direction) => (
              <article className={`${styles.direction} ${direction.status === 'approved' ? styles.directionApproved : ''}`} key={direction.id}>
                <div><span>{pretty(direction.status)}</span><em>{direction.mood}</em></div>
                <h5>{direction.style_name}</h5>
                <strong>{direction.creative_concept}</strong>
                <p>{direction.rationale}</p>
                {direction.status === 'proposed' && <button disabled={Boolean(working) || approvedReferences < 3} onClick={() => void approveDirection(direction.id)}>Approve this direction</button>}
                {direction.status === 'approved' && <b className={styles.locked}>Approved direction</b>}
              </article>
            ))}
          </div>

          <div className={styles.planBox}>
            <span>03 · PRODUCTION PLAN</span>
            <h4>Translate strategy into a Codex-ready page architecture.</h4>
            <p>Requires one approved creative direction and at least three approved references. The planner deliberately refuses to create a generic fallback when the AI provider is unavailable.</p>
            <button disabled={Boolean(working) || !approvedDirection || approvedReferences < 3} onClick={() => void generatePlan()}>{working === 'planning' ? 'Planning…' : sections.length ? 'Regenerate production plan' : 'Generate production plan'}</button>
          </div>

          {sections.length > 0 && <div className={styles.sectionPlan}>
            <div className={styles.sectionTitle}><div><span>04</span><h4>Build architecture</h4></div><small>{sections.length} sections</small></div>
            {sections.map((section, index) => <article key={section.id}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{pretty(section.section_key)}</b><p>{section.objective}</p><small>{pretty(section.section_type)} · {section.conversion_role}</small></div></article>)}
          </div>}

          {runs.length > 0 && <div className={styles.runLog}><span>AGENT RUNS</span>{runs.map((run) => <div key={run.id}><b>{pretty(run.stage)}</b><small>{run.provider} · {run.model} · {pretty(run.status)}</small>{run.error_message && <em>{run.error_message}</em>}</div>)}</div>}
        </div>
      </div>
    </section>
  );
}
