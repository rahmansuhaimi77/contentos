'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };
type KnowledgeKind = 'product' | 'faq' | 'testimonial' | 'competitor' | 'example' | 'guideline' | 'offer' | 'other';
type KnowledgeItem = { id: string; brand_id: string; kind: KnowledgeKind; title: string; content: string; source_url: string | null; updated_at: string };

const kinds: Array<{ value: KnowledgeKind; label: string }> = [
  { value: 'guideline', label: 'Brand / operating rule' },
  { value: 'product', label: 'Product / service' },
  { value: 'faq', label: 'FAQ / objection' },
  { value: 'offer', label: 'Offer / pricing' },
  { value: 'testimonial', label: 'Testimonial / proof' },
  { value: 'competitor', label: 'Competitor insight' },
  { value: 'example', label: 'Content example' },
  { value: 'other', label: 'Other' },
];

export default function KnowledgePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [kind, setKind] = useState<KnowledgeKind>('guideline');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) { setLoading(false); return; }
      const { data: brandRows, error: brandError } = await supabase
        .from('contentos_brands')
        .select('id,name')
        .order('updated_at', { ascending: false });
      if (brandError) setError(brandError.message);
      const nextBrands = (brandRows ?? []) as Brand[];
      setBrands(nextBrands);
      if (nextBrands[0]) setBrandId(nextBrands[0].id);
      setLoading(false);
    }
    init();
  }, [supabase]);

  useEffect(() => { if (brandId) void loadItems(brandId); }, [brandId]);

  async function loadItems(id: string) {
    setError('');
    const { data, error: loadError } = await supabase
      .from('contentos_knowledge_items')
      .select('id,brand_id,kind,title,content,source_url,updated_at')
      .eq('brand_id', id)
      .order('updated_at', { ascending: false });
    if (loadError) { setError(loadError.message); return; }
    setItems((data ?? []) as KnowledgeItem[]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!brandId || !title.trim() || !content.trim()) return;
    setError(''); setMessage('');
    const payload = { brand_id: brandId, kind, title: title.trim(), content: content.trim(), source_url: sourceUrl.trim() || null };
    const result = editingId
      ? await supabase.from('contentos_knowledge_items').update(payload).eq('id', editingId)
      : await supabase.from('contentos_knowledge_items').insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setMessage(editingId ? 'Knowledge updated.' : 'Knowledge added.');
    resetForm();
    await loadItems(brandId);
  }

  function edit(item: KnowledgeItem) {
    setEditingId(item.id); setKind(item.kind); setTitle(item.title); setContent(item.content); setSourceUrl(item.source_url ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() { setEditingId(''); setKind('guideline'); setTitle(''); setContent(''); setSourceUrl(''); }

  async function remove(id: string) {
    if (!confirm('Delete this knowledge item?')) return;
    const { error: deleteError } = await supabase.from('contentos_knowledge_items').delete().eq('id', id);
    if (deleteError) { setError(deleteError.message); return; }
    await loadItems(brandId);
  }

  if (loading) return <main className="toolShell"><div className="toolCard">Loading Knowledge Base…</div></main>;
  if (!user) return <main className="toolShell"><div className="toolCard"><h1>Sign in first</h1><p>Open ContentOS Studio, sign in, then return here.</p><a className="toolPrimaryLink" href="/">Open Studio</a></div></main>;

  return (
    <main className="toolShell">
      <header className="toolHeader">
        <div><span className="eyebrow">CONTENTOS · KNOWLEDGE BASE</span><h1>Teach ContentOS what is true.</h1><p>Campaigns use these facts, rules, objections and examples as brand memory.</p></div>
        <nav className="toolNav"><a href="/">Campaign Studio</a><a className="active" href="/knowledge">Knowledge Base</a><a href="/assets">Brand Assets</a><a href="/planner">30-Day Planner</a></nav>
      </header>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error globalError">{error}</div>}

      <section className="toolGrid">
        <form className="panel toolForm" onSubmit={submit}>
          <div className="panelHead"><span>01</span><div><h3>{editingId ? 'Edit knowledge' : 'Add knowledge'}</h3><p>Only save information you want future content to rely on.</p></div></div>
          <label className="field"><span>Brand</span><select value={brandId} onChange={(e) => { setBrandId(e.target.value); resetForm(); }}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="field"><span>Type</span><select value={kind} onChange={(e) => setKind(e.target.value as KnowledgeKind)}>{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
          <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Availability rule" /></label>
          <label className="field"><span>Knowledge</span><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} placeholder="Write the fact, rule, objection, pricing note or example clearly." /></label>
          <label className="field"><span>Source URL (optional)</span><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" /></label>
          <button className="generate">{editingId ? 'Save Changes' : '+ Add to Knowledge Base'}</button>
          {editingId && <button type="button" className="toolTextButton" onClick={resetForm}>Cancel editing</button>}
        </form>

        <section className="panel">
          <div className="panelHead"><span>{items.length}</span><div><h3>Saved knowledge</h3><p>{brands.find((b) => b.id === brandId)?.name || 'Brand'} memory currently used by the generator.</p></div></div>
          <div className="knowledgeList">
            {items.length === 0 && <div className="emptyState">No knowledge items yet.</div>}
            {items.map((item) => <article className="knowledgeCard" key={item.id}>
              <div className="knowledgeMeta"><span>{kinds.find((k) => k.value === item.kind)?.label || item.kind}</span><small>{new Date(item.updated_at).toLocaleDateString()}</small></div>
              <h4>{item.title}</h4><p>{item.content}</p>
              {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Source</a>}
              <div className="knowledgeActions"><button onClick={() => edit(item)}>Edit</button><button className="reject" onClick={() => remove(item.id)}>Delete</button></div>
            </article>)}
          </div>
        </section>
      </section>
    </main>
  );
}
