import { z } from 'zod';
import type { BrandEngineContext } from './load';
import { phaseKeyFor } from './load';
import { generateJson, SYSTEM_PROMPT } from './ai';
import {
  applyPhaseRules, brandContext, channelFor, currentPhase, exemplarBlock, exemplarsFor, isThreads,
  malaysiaToday, modeFor, talkingPointsFor,
} from './context';
import type { ProductionPack, ProductionVisualContext, StoryboardScene } from '../production-pack-generator';

export type ProductionRequest = {
  platform: string;
  format: string;
  language: string;
  pillar: string;
  objective: string;
  hook: string;
  concept: string;
  cta: string;
  /** Quick Create: the user's own words, which fix the topic. */
  request?: string;
  plannedDate?: string;
};

const SceneSchema = z.object({
  scene: z.number().int(),
  duration: z.string(),
  visual: z.string(),
  on_screen_text: z.string(),
  voiceover: z.string(),
  image_prompt: z.string(),
});

const AiPackSchema = z.object({
  strategy: z.string(),
  hook: z.string(),
  angle: z.string(),
  script: z.string(),
  caption: z.string(),
  cta: z.string(),
  creative_prompt: z.string(),
  storyboard: z.array(SceneSchema).min(1),
  qa_notes: z.array(z.string()).default([]),
});

function assetRules(context: ProductionVisualContext) {
  const rules: string[] = [];
  if (context.primary_color) rules.push(`Primary colour ${context.primary_color}.`);
  if (context.secondary_color) rules.push(`Secondary colour ${context.secondary_color}.`);
  if (context.accent_color) rules.push(`Accent colour ${context.accent_color}.`);
  if (context.font_notes) rules.push(`Typography: ${context.font_notes}`);
  if (context.visual_style) rules.push(`Visual style: ${context.visual_style}`);
  if (context.image_rules) rules.push(`Image rules: ${context.image_rules}`);
  const kinds = context.asset_kinds ?? [];
  rules.push(kinds.includes('logo') ? 'Use the uploaded official logo exactly; never redraw it.' : 'No logo asset uploaded: use the brand name as plain text, never invent a logo.');
  if (kinds.includes('screenshot')) rules.push('Use approved screenshots as UI references instead of inventing screens.');
  if (kinds.includes('vehicle')) rules.push('Use approved vehicle/product photos instead of inventing specific vehicles.');
  if (kinds.includes('visual_reference')) rules.push('Match the mood of approved visual references without copying third-party branding.');
  return rules.join(' ');
}

function visualBase(ctx: BrandEngineContext, visual: ProductionVisualContext) {
  return [ctx.profile.visual.setting, ...ctx.profile.visual.rules, assetRules(visual)].filter(Boolean).join(' ');
}

function qaNotes(ctx: BrandEngineContext, extra: string[] = []) {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  return [...new Set([
    ...phase.qa_notes,
    ...extra,
    ...ctx.profile.claims.never.map((c) => `Never claim: ${c}.`),
    ...ctx.profile.claims.always,
    ...ctx.profile.qa_notes,
    'Founder approves before anything is published.',
  ])];
}

function finish(ctx: BrandEngineContext, pack: ProductionPack): ProductionPack {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const fix = (t: string) => applyPhaseRules(t, phase);
  return {
    ...pack,
    hook: fix(pack.hook),
    script: fix(pack.script),
    caption: fix(pack.caption),
    cta: fix(pack.cta),
    storyboard: pack.storyboard.map((s) => ({ ...s, on_screen_text: fix(s.on_screen_text), voiceover: fix(s.voiceover) })),
  };
}

function demoPack(ctx: BrandEngineContext, req: ProductionRequest, visual: ProductionVisualContext): ProductionPack {
  const points = talkingPointsFor(ctx.profile, `${req.hook} ${req.concept} ${req.request ?? ''}`, 2);
  const body = points.join(' ') || req.request || req.concept;
  const post = `${req.hook}\n\n${body}\n\n${req.cta}`;
  const base = `Vertical 9:16 ${isThreads(req.platform) ? 'supporting image' : 'frame'} for ${req.platform}. ${visualBase(ctx, visual)} Natural light, believable phone-camera look, safe space for subtitles. No invented prices, reviews, availability, badges or endorsements.`;
  const raw: Omit<StoryboardScene, 'image_prompt'>[] = isThreads(req.platform)
    ? [{ scene: 1, duration: 'Optional visual', visual: 'One simple supporting image only if it adds context.', on_screen_text: '', voiceover: '' }]
    : /carousel|static|poster/i.test(req.format)
      ? [
        { scene: 1, duration: 'Slide 1', visual: 'Bold hook on a clean mobile-first layout.', on_screen_text: req.hook, voiceover: '' },
        { scene: 2, duration: 'Slide 2', visual: 'The one supporting point, shown simply.', on_screen_text: body.split('. ')[0], voiceover: '' },
        { scene: 3, duration: 'Last slide', visual: 'Clean CTA card with approved brand assets only.', on_screen_text: req.cta, voiceover: '' },
      ]
      : [
        { scene: 1, duration: '0-3s', visual: 'Open on the situation the hook describes.', on_screen_text: req.hook, voiceover: req.hook },
        { scene: 2, duration: '3-10s', visual: 'Show the problem or moment specifically.', on_screen_text: '', voiceover: body },
        { scene: 3, duration: '10-20s', visual: 'Show the brand solving it in one clear step.', on_screen_text: '', voiceover: '' },
        { scene: 4, duration: '20-25s', visual: 'Clean ending with the CTA.', on_screen_text: req.cta, voiceover: req.cta },
      ];
  return {
    strategy: `Zero-cost production draft: one point (${req.pillar}) for ${req.platform}. Add a Gemini key for fully written AI packs.`,
    hook: req.hook,
    angle: `${req.pillar} — ${req.concept}`,
    script: post,
    caption: post,
    cta: req.cta,
    creative_prompt: `Create a ${req.format} for ${req.platform}. Open with the exact hook "${req.hook}". ${req.concept} ${base} End with one CTA: "${req.cta}".`,
    storyboard: raw.map((s) => ({ ...s, image_prompt: `${base} Scene ${s.scene}: ${s.visual}${s.on_screen_text ? ` Reserve space for "${s.on_screen_text}".` : ''}` })),
    qa_notes: qaNotes(ctx),
  };
}

export async function buildProduction(ctx: BrandEngineContext, req: ProductionRequest, visual: ProductionVisualContext): Promise<{ pack: ProductionPack; mode: 'ai' | 'demo'; model?: string }> {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const mode = modeFor(ctx.profile, `${req.request ?? ''} ${req.hook} ${req.objective}`);

  if (mode?.fixed) {
    const f = mode.fixed;
    const base = visualBase(ctx, visual);
    return {
      mode: 'demo',
      pack: finish(ctx, {
        strategy: `${mode.label}. ${mode.instructions}`,
        hook: f.hook, angle: mode.label, script: f.script, caption: f.caption, cta: f.cta,
        creative_prompt: `${req.format} for ${req.platform}. ${mode.instructions} ${base}`,
        storyboard: f.slides.map((s, i) => ({ scene: i + 1, duration: `Slide ${i + 1}`, visual: s.visual, on_screen_text: `${s.title}\n${s.text}`, voiceover: '', image_prompt: `${base} Slide ${i + 1}: ${s.visual} On-screen: "${s.title}" / "${s.text}".` })),
        qa_notes: qaNotes(ctx, mode.qa_notes),
      }),
    };
  }

  const channel = channelFor(ctx.profile, req.platform);
  const prompt = [
    brandContext(ctx.profile, ctx.brand.name, {
      date: req.plannedDate || malaysiaToday(), phase, knowledge: ctx.knowledge, platforms: [req.platform],
      extraGuidance: mode ? `SPECIAL MODE (${mode.label}): ${mode.instructions}\n${mode.qa_notes.map((n) => `- ${n}`).join('\n')}` : '',
    }),
    '',
    exemplarBlock(exemplarsFor(ctx.profile, phase.key, { limit: 5 })),
    '',
    'CONTENT ITEM TO PRODUCE',
    `Pillar: ${req.pillar}`,
    `Platform: ${req.platform}${channel ? ` (${channel.role}; tone: ${channel.tone})` : ''}`,
    `Format: ${req.format}`,
    `Language: ${req.language}`,
    `Hook (keep it, or sharpen it without changing its meaning): ${req.hook}`,
    `Concept: ${req.concept}`,
    req.request ? `User's request (fixed topic): ${req.request}` : '',
    `CTA: ${req.cta}`,
    req.plannedDate ? `Publishes on: ${req.plannedDate}` : '',
    `Visual rules for every image_prompt: ${visualBase(ctx, visual)}`,
    '',
    isThreads(req.platform)
      ? 'Write a Threads post: script and caption are the post itself. Storyboard: one optional supporting image.'
      : /carousel/i.test(req.format)
        ? 'Write a carousel: one storyboard item per slide (5-8 slides), short on-screen text per slide, caption separate.'
        : /static|poster/i.test(req.format)
          ? 'Write a single static post: one storyboard item with the full on-screen text and a detailed image_prompt.'
          : 'Write a 15-30 second vertical video: 4-6 timed scenes with what to film, on-screen text and voiceover. Prefer scenes a founder can film on a phone in 15 minutes.',
    'Return JSON: {"strategy":"","hook":"","angle":"","script":"","caption":"","cta":"","creative_prompt":"","storyboard":[{"scene":1,"duration":"","visual":"","on_screen_text":"","voiceover":"","image_prompt":""}],"qa_notes":[""]}',
  ].filter(Boolean).join('\n');

  const ai = await generateJson(AiPackSchema, SYSTEM_PROMPT, prompt);
  if (ai) {
    return { mode: 'ai', model: ai.model, pack: finish(ctx, { ...ai.data, qa_notes: qaNotes(ctx, [...(ai.data.qa_notes ?? []), ...(mode?.qa_notes ?? [])]) }) };
  }
  return { mode: 'demo', pack: finish(ctx, demoPack(ctx, req, visual)) };
}
