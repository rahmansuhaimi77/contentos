import { z } from 'zod';
import type { BrandEngineContext } from './load';
import { growthWindowFor, phaseKeyFor } from './load';
import { generateJson, SYSTEM_PROMPT } from './ai';
import {
  addDaysIso, applyPhaseRules, brandContext, calendarFor, channelFor, currentPhase, exemplarBlock,
  exemplarsFor, isThreads, modeFor,
} from './context';
import type { BrandProfile, ProfileExemplar } from './profile';

export type PlanItem = {
  day_number: number;
  planned_date: string;
  pillar: string;
  objective: string;
  platform: string;
  format: string;
  hook: string;
  concept: string;
  cta: string;
};

export type PlannerRequest = {
  objective: string;
  platforms: string[];
  language: string;
  startDate: string;
  days?: number;
};

const AiPlanSchema = z.object({
  items: z.array(z.object({
    day_number: z.number().int().min(1),
    pillar: z.string(),
    platform: z.string(),
    format: z.string(),
    hook: z.string(),
    concept: z.string(),
    cta: z.string(),
  })).min(1),
});

const DEFAULT_FORMATS = ['15-30 sec short-form video', 'Carousel', 'UGC / POV video', 'Static ad', 'Talking-head explainer'];
const THREADS_FORMATS = ['Threads text post', 'Conversation starter', 'Mini-story / opinion post', 'Question-led post'];

function formatFor(profile: BrandProfile, platform: string, index: number) {
  const channel = channelFor(profile, platform);
  const formats = channel?.formats.length ? channel.formats : isThreads(platform) ? THREADS_FORMATS : DEFAULT_FORMATS;
  return formats[index % formats.length];
}

function ctaFor(ctx: BrandEngineContext, platform: string, exemplar: ProfileExemplar | null, index: number) {
  if (exemplar?.cta) return exemplar.cta;
  const channel = channelFor(ctx.profile, platform);
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const pool = [...(channel?.ctas ?? []), ...phase.ctas];
  if (pool.length) return pool[index % pool.length];
  return ctx.brand.preferred_cta || 'Hubungi kami untuk maklumat lanjut.';
}

/** Weighted pillar order for N slots, e.g. weights 3/2/1 → 50%/33%/17% of days. */
function pillarSchedule(profile: BrandProfile, days: number) {
  const pillars = profile.pillars.length ? profile.pillars : [{ name: 'General', goal: '', weight: 1 }];
  const total = pillars.reduce((sum, p) => sum + (p.weight || 1), 0);
  const credit = pillars.map(() => 0);
  return Array.from({ length: days }, () => {
    pillars.forEach((p, i) => { credit[i] += (p.weight || 1) / total; });
    const best = credit.indexOf(Math.max(...credit));
    credit[best] -= 1;
    return pillars[best].name;
  });
}

function dateGuidance(ctx: BrandEngineContext, date: string) {
  const windows = calendarFor(ctx.profile, date).map((w) => `${w.label}: ${w.guidance}`);
  const growth = growthWindowFor(ctx.growthCalendar, date);
  if (growth) windows.push(`Growth plan (${growth.title}): ${growth.objective}. Marketplace priority: ${growth.marketplace_need}.`);
  return windows.length ? ` TIMING (${date}): ${windows.join(' ')}` : '';
}

/** Zero-cost planner: rotates the profile's exemplars by weighted pillar, freshest first. */
function demoPlan(ctx: BrandEngineContext, req: PlannerRequest, days: number): PlanItem[] {
  const phaseKey = phaseKeyFor(ctx);
  const pool = exemplarsFor(ctx.profile, phaseKey, { avoidHooks: ctx.recentHooks, seed: Number(req.startDate.replace(/-/g, '')) });
  const byPillar = new Map<string, ProfileExemplar[]>();
  for (const e of pool) byPillar.set(e.pillar, [...(byPillar.get(e.pillar) ?? []), e]);
  const used = new Set<string>();
  const schedule = pillarSchedule(ctx.profile, days);
  const platforms = req.platforms.length ? req.platforms : ctx.profile.channels.map((c) => c.platform).slice(0, 1);

  return schedule.map((pillar, index) => {
    const platform = platforms[index % platforms.length] || 'TikTok / Reels';
    const sameName = [...byPillar.entries()].find(([name]) => name.toLowerCase().includes(pillar.toLowerCase().split(' ')[0]));
    const candidates = [...(sameName?.[1] ?? []), ...pool].filter((e) => !used.has(e.hook));
    const exemplar = candidates[0] ?? pool[index % Math.max(pool.length, 1)] ?? null;
    if (exemplar) used.add(exemplar.hook);
    const date = addDaysIso(req.startDate, index);
    const goal = ctx.profile.pillars.find((p) => p.name === pillar)?.goal ?? '';
    return {
      day_number: index + 1,
      planned_date: date,
      pillar: exemplar?.pillar ?? pillar,
      objective: req.objective,
      platform,
      format: formatFor(ctx.profile, platform, index),
      hook: exemplar?.hook ?? `${pillar}: ${goal}`,
      concept: `${exemplar?.concept ?? goal}${isThreads(platform) ? ' Threads: write as a natural observation or opinion and end with one genuine question.' : ''}${dateGuidance(ctx, date)}`,
      cta: ctaFor(ctx, platform, exemplar, index),
    };
  });
}

function sequencePlan(ctx: BrandEngineContext, req: PlannerRequest, sequence: Array<{ pillar: string; hook: string; concept: string; cta: string }>): PlanItem[] {
  const platforms = req.platforms.length ? req.platforms : ['WhatsApp'];
  return sequence.map((s, index) => {
    const date = addDaysIso(req.startDate, index);
    const platform = platforms[index % platforms.length];
    return { day_number: index + 1, planned_date: date, pillar: s.pillar, objective: req.objective, platform, format: formatFor(ctx.profile, platform, index), hook: s.hook, concept: `${s.concept}${dateGuidance(ctx, date)}`, cta: s.cta };
  });
}

export async function buildPlan(ctx: BrandEngineContext, req: PlannerRequest): Promise<{ items: PlanItem[]; mode: 'ai' | 'demo' | 'sequence'; model?: string }> {
  const days = req.days ?? 30;
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const finish = (items: PlanItem[]) => items.map((item) => ({
    ...item,
    hook: applyPhaseRules(item.hook, phase),
    concept: applyPhaseRules(item.concept, phase),
    cta: applyPhaseRules(item.cta, phase),
  }));

  const mode = modeFor(ctx.profile, req.objective);
  if (mode?.plan_sequence.length) return { items: finish(sequencePlan(ctx, req, mode.plan_sequence)), mode: 'sequence' };

  const dated = Array.from({ length: days }, (_, i) => addDaysIso(req.startDate, i));
  const timing = dated
    .map((d, i) => ({ day: i + 1, d, g: dateGuidance(ctx, d).trim() }))
    .filter((x, i, all) => x.g && (i === 0 || x.g !== all[i - 1].g))
    .map((x) => `From day ${x.day} (${x.d}): ${x.g.replace(/^TIMING \([^)]*\):\s*/, '')}`)
    .join('\n');

  const prompt = [
    brandContext(ctx.profile, ctx.brand.name, { date: req.startDate, phase, knowledge: ctx.knowledge, platforms: req.platforms }),
    '',
    exemplarBlock(exemplarsFor(ctx.profile, phase.key, { avoidHooks: ctx.recentHooks, limit: 14 })),
    ctx.recentHooks.length ? `ALREADY USED RECENTLY (do not repeat or lightly reword):\n${ctx.recentHooks.slice(0, 40).map((h) => `- ${h}`).join('\n')}` : '',
    '',
    `TASK: Plan ${days} days of content starting ${req.startDate}, one item per day.`,
    `Objective: ${req.objective}`,
    `Platforms (rotate across these, following each channel's role and cadence): ${req.platforms.join(', ')}`,
    `Language: ${req.language}`,
    timing ? `DATE-SPECIFIC GUIDANCE (follow it for those days):\n${timing}` : '',
    'Spread pillars by their weights. Every hook must be a specific, scroll-stopping line in the brand language; every concept a 1-3 sentence production brief explaining the angle and what to show. Vary formats. Build towards any upcoming moment several days before it.',
    `Return JSON: {"items":[{"day_number":1,"pillar":"","platform":"","format":"","hook":"","concept":"","cta":""}]} with exactly ${days} items.`,
  ].filter(Boolean).join('\n');

  const ai = await generateJson(AiPlanSchema, SYSTEM_PROMPT, prompt);
  if (ai && ai.data.items.length >= Math.min(days, 7)) {
    const items = ai.data.items.slice(0, days).map((item, index) => ({
      day_number: index + 1,
      planned_date: addDaysIso(req.startDate, index),
      pillar: item.pillar,
      objective: req.objective,
      platform: item.platform || req.platforms[index % req.platforms.length],
      format: item.format || formatFor(ctx.profile, item.platform, index),
      hook: item.hook,
      concept: item.concept,
      cta: item.cta,
    }));
    return { items: finish(items), mode: 'ai', model: ai.model };
  }

  return { items: finish(demoPlan(ctx, req, days)), mode: 'demo' };
}
