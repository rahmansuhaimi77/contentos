'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type SourceSnapshot = {
  repository?: string;
  commit_sha?: string;
  base_path?: string;
  files?: string[];
  version_id?: string;
  version_no?: number;
  normalizations?: string[];
} | null;

export default function ArtifactImportForm({
  websiteId,
  selectionId,
  selectionStatus,
  templateName,
  sourceSnapshot,
  onImported,
}: {
  websiteId: string;
  selectionId: string;
  selectionStatus: string;
  templateName: string;
  sourceSnapshot: SourceSnapshot;
  onImported: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [commitSha, setCommitSha] = useState('');
  const [basePath, setBasePath] = useState('');
  const [files, setFiles] = useState('index.html\nstyles.css\nscript.js');
  const [label, setLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sourceSnapshot) return;
    if (sourceSnapshot.commit_sha) setCommitSha(sourceSnapshot.commit_sha);
    if (sourceSnapshot.base_path) setBasePath(sourceSnapshot.base_path);
    if (Array.isArray(sourceSnapshot.files) && sourceSnapshot.files.length) setFiles(sourceSnapshot.files.join('\n'));
  }, [sourceSnapshot]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    setError('');
    const cleanFiles = files.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!/^[a-f0-9]{40}$/i.test(commitSha.trim())) {
      setError('Use the exact 40-character Git commit SHA for the adapted artifact.');
      return;
    }
    if (!basePath.trim().startsWith('public/generated/')) {
      setError('The adapted artifact must live under public/generated/ in the ContentOS repository.');
      return;
    }
    if (!cleanFiles.includes('index.html')) {
      setError('The artifact file list must include index.html.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Your session has expired. Sign in again.');
      return;
    }

    setWorking(true);
    try {
      const response = await fetch('/api/websites/import-template-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          websiteId,
          selectionId,
          commitSha: commitSha.trim(),
          basePath: basePath.trim().replace(/\/$/, ''),
          files: cleanFiles,
          label: label.trim() || undefined,
          changeSummary: summary.trim() || undefined,
          pendingAssetCount: 0,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Template artifact import failed.');
      setNotice(`Frozen as Website Studio v${payload.version.version_no} with ${payload.artifact.file_count} files. Deploy that exact version to preview next.`);
      setLabel('');
      setSummary('');
      onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Template artifact import failed.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section style={{ background: '#fffdf8', border: '1px solid #dfdcd4', borderRadius: 20, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 8, letterSpacing: '.13em', fontWeight: 850, color: '#717871' }}>02 · FREEZE ADAPTED ARTIFACT</span>
          <h3 style={{ margin: '5px 0 6px', fontSize: 18 }}>Import the exact Git adaptation.</h3>
          <p style={{ margin: 0, maxWidth: 760, color: '#686d67', fontSize: 11, lineHeight: 1.55 }}>
            After the approved {templateName} code has been adapted in <code>public/generated/…</code>, freeze one exact commit and file list. Website Studio stores the complete bundle immutably before preview or QA.
          </p>
        </div>
        <span style={{ fontSize: 9, color: '#6f756f' }}>{selectionStatus === 'imported' ? `Imported${sourceSnapshot?.version_no ? ` · v${sourceSnapshot.version_no}` : ''}` : 'Approved template'}</span>
      </div>

      {notice && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#e9f1ea', border: '1px solid #d2e1d5', color: '#315e3f', fontSize: 11 }}>{notice}</div>}
      {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#f7e7e7', border: '1px solid #ead0d0', color: '#843a3a', fontSize: 11 }}>{error}</div>}

      <details open={selectionStatus !== 'imported'}>
        <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 850, color: '#3c5148', marginBottom: 12 }}>
          {selectionStatus === 'imported' ? 'Freeze another adaptation version' : 'Artifact details'}
        </summary>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }} className="artifactImportTwoCol">
            <label style={labelStyle}>Exact commit SHA<input style={inputStyle} value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="40-character Git SHA" /></label>
            <label style={labelStyle}>Artifact base path<input style={inputStyle} value={basePath} onChange={(event) => setBasePath(event.target.value)} placeholder="public/generated/client-site-v1" /></label>
          </div>
          <label style={labelStyle}>Files — one relative path per line<textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={files} onChange={(event) => setFiles(event.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }} className="artifactImportTwoCol">
            <label style={labelStyle}>Version label — optional<input style={inputStyle} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. v1 premium adaptation" /></label>
            <label style={labelStyle}>Change summary — optional<input style={inputStyle} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What changed in this adaptation?" /></label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <small style={{ color: '#777b75', fontSize: 9 }}>The importer validates license approval, safe paths, file sizes and standalone bundle normalization.</small>
            <button disabled={working} style={{ border: 0, borderRadius: 11, background: '#243b35', color: '#fff', padding: '11px 14px', fontSize: 11, fontWeight: 850, cursor: working ? 'wait' : 'pointer', opacity: working ? .55 : 1 }}>
              {working ? 'Freezing artifact…' : 'Freeze immutable version'}
            </button>
          </div>
        </form>
      </details>
      <style jsx>{`@media(max-width:720px){.artifactImportTwoCol{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 9, letterSpacing: '.06em', fontWeight: 800, color: '#69706a' } as const;
const inputStyle = { width: '100%', border: '1px solid #dad6cd', borderRadius: 10, padding: '10px 11px', background: '#fff', color: '#262a26', font: 'inherit' } as const;
