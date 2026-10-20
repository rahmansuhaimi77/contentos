// Run: npx tsx scripts/engine-check.mts — exercises the brand engine for every starter pack, offline.
import { resolveProfile, type BrandEngineContext } from '../lib/engine/load.ts';
import { buildPlan } from '../lib/engine/planner.ts';
import { generateCampaign } from '../lib/engine/campaign.ts';
import { buildProduction } from '../lib/engine/production.ts';
const row = (name: string) => ({ id: 'x', name, product: '', audience: '', positioning: '', voice: '', offer: '', proof: '', preferred_cta: '', avoid: '' });
const ctxFor = (name: string, phase?: string): BrandEngineContext => { const { profile, source } = resolveProfile(row(name)); return { brand: row(name), profile, profileSource: source, knowledge: [], growthProfile: phase ? { current_phase: phase, marketplace_need: '', target_launch_start: null, target_launch_end: null } : null, growthCalendar: [], recentHooks: [] }; };
let fail = 0; const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fail++; };

// --- demo mode (no keys)
delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_API_KEY;
const sp = ctxFor('SewaPro');
check(sp.profileSource === 'starter_pack', 'SewaPro resolves to its starter pack');
const spPlan = await buildPlan(sp, { objective: 'Bookings', platforms: ['Facebook page', 'Instagram', 'TikTok'], language: 'Bahasa Melayu', startDate: '2026-10-28' });
check(spPlan.items.length === 30 && spPlan.mode === 'demo', `SewaPro plan: 30 items, mode ${spPlan.mode}`);
check(new Set(spPlan.items.map(i => i.hook)).size >= 20, `SewaPro plan hooks mostly unique (${new Set(spPlan.items.map(i => i.hook)).size}/30)`);
const allSp = JSON.stringify(spPlan.items).toLowerCase();
check(!/partner|broker|finder|supplier|shortlist/.test(allSp), 'SewaPro plan never mentions partners/broker/finder');
check(allSp.includes('deepavali'), 'SewaPro plan carries Deepavali timing guidance');
check(spPlan.items[0].planned_date === '2026-10-28' && spPlan.items[29].planned_date === '2026-11-26', 'Plan dates run 28 Oct → 26 Nov');
const spCamp = await generateCampaign(sp, { objective: 'Bookings', platform: 'Instagram', format: 'Carousel', language: 'BM', count: 3, extra: '' });
check(spCamp.variants.length === 3, 'SewaPro campaign: 3 variants');
const spProd = await buildProduction(sp, { platform: 'TikTok', format: '15-30 sec short-form video', language: 'BM', pillar: 'FAQ', objective: 'x', hook: 'Kenapa minimum 2 hari?', concept: 'minimum 2 hari explanation', cta: 'WhatsApp 014-570 5911' }, {});
check(spProd.pack.storyboard.length === 4 && spProd.pack.caption.includes('minimum 2 hari'), 'SewaPro production uses the minimum-days talking point');
check(spProd.pack.qa_notes.some(n => /broker/i.test(n)), 'SewaPro QA notes carry the no-broker rule');

const kr = ctxFor('KampusRide');
const krPlan = await buildPlan(kr, { objective: 'Awareness', platforms: ['Threads', 'TikTok / Reels'], language: 'BM', startDate: '2026-10-20' });
const krText = JSON.stringify(krPlan.items);
check(krPlan.items.length === 30, 'KampusRide plan: 30 items');
check(!/Post ride anda dalam KampusRide\.?/.test(krText), 'KampusRide pre-launch: live CTA replaced');
check(/Semester 1 first lecture block/.test(krText), 'KampusRide plan carries the academic calendar');
const krLive = ctxFor('KampusRide', 'launch_week');
const krLivePlan = await buildPlan(krLive, { objective: 'Rides', platforms: ['Threads'], language: 'BM', startDate: '2026-10-20' });
check(krLivePlan.items.some(i => /launch_week|Week 1|LRT|Class/i.test(i.pillar + i.hook)), 'KampusRide launch_week phase uses live exemplars');
const seq = await buildPlan(kr, { objective: 'Simulation-only beta recruitment', platforms: ['WhatsApp'], language: 'BM', startDate: '2026-10-20' });
check(seq.mode === 'sequence' && seq.items[0].hook === 'Beta testers wanted — IIUM Gombak.', 'Simulation recruitment mode keeps its fixed 30-day sequence');
const inst = await generateCampaign(kr, { objective: 'Onboarding', platform: 'Instagram carousel', format: 'Carousel', language: 'BM', count: 1, extra: 'CONTENT REQUEST: how to install KampusRide and enable notifications' });
check(inst.variants[0].hook === 'Nak install KampusRide? Senang je 📱', 'Install tutorial mode returns the fixed tutorial');
const instProd = await buildProduction(kr, { platform: 'Instagram carousel', format: 'Carousel', language: 'BM', pillar: 'x', objective: 'x', hook: 'install', concept: '', cta: '', request: 'install KampusRide' }, {});
check(instProd.pack.storyboard.length === 6, 'Install tutorial production has 6 slides');

const generic = ctxFor('Kedai Kek Ani');
check(generic.profileSource === 'brand_brain', 'Unknown brand falls back to Brand Brain profile');
const gPlan = await buildPlan(generic, { objective: 'Sales', platforms: ['Instagram'], language: 'BM', startDate: '2026-10-20' });
check(gPlan.items.length === 30, 'Unknown brand still gets a 30-day plan');

// --- AI path with a simulated Gemini
process.env.GEMINI_API_KEY = 'test-key';
const calls: string[] = [];
globalThis.fetch = (async (url: string, init?: any) => {
  calls.push(String(url).replace(/key=[^&]+/, 'key=***'));
  if (String(url).includes('/models?')) return new Response(JSON.stringify({ models: [
    { name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-9-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-9-flash-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] } ] }));
  if (String(url).includes('gemini-9-flash:generateContent')) return new Response('quota', { status: 429 });
  const body = JSON.parse(init.body); const prompt = body.contents[0].parts[0].text as string;
  const n = /TASK: Plan/.test(prompt) ? Number(prompt.match(/with exactly (\d+) items/)?.[1] || 0) : 0;
  const out = n ? { items: Array.from({ length: n }, (_, i) => ({ day_number: i + 1, pillar: 'Save-worthy tips', platform: 'Instagram', format: 'Carousel', hook: `Hook baru ${i + 1}`, concept: 'Concept', cta: 'Post ride anda dalam KampusRide.' })) }
    : { strategy: 's', variants: [{ hook: 'h', angle: 'a', script: 's', caption: 'c', cta: 'Post ride anda dalam KampusRide.', creative_prompt: 'p' }] };
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(out) + '\n```' }] } }] }));
}) as any;
const aiPlan = await buildPlan(kr, { objective: 'Awareness', platforms: ['Threads'], language: 'BM', startDate: '2026-10-20' });
check(aiPlan.mode === 'ai' && aiPlan.model === 'gemini-9-flash-lite', `AI plan used ${aiPlan.model} (Flash-Lite first)`);
check(!aiPlan.items.some(i => /Post ride anda dalam KampusRide/.test(i.cta)), 'Phase rules still applied to AI output');
check(calls.some(c => c.includes('/models?')) && !calls.some(c => c.includes('image')), 'Model discovered via ListModels; image/embedding models skipped');
const aiCamp = await generateCampaign(sp, { objective: 'x', platform: 'Instagram', format: 'Carousel', language: 'BM', count: 1, extra: '' });
check(aiCamp.mode === 'ai', 'AI campaign path works');
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
console.log(fail); if (fail) process.exit(1);
