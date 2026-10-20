import { z } from 'zod';
import type { BrandEngineContext } from './load';
import { phaseKeyFor } from './load';
import { generateJson, SYSTEM_PROMPT } from './ai';
import {
  applyPhaseRules, brandContext, channelFor, currentPhase, exemplarBlock, exemplarsFor, isThreads,
  malaysiaToday, modeFor, talkingPointsFor,
} from './context';
import type { CampaignBrief, ContentVariant, GenerationResult } from '../types';

const AiCampaignSchema = z.object({
  strategy: z.string(),
  variants: z.array(z.object({
    hook: z.string(),
    angle: z.string(),
    script: z.string(),
    caption: z.string(),
    cta: z.string(),
    creative_prompt: z.string(),
  })).min(1),
});

export function extractContentRequest(extra: string) {
  const match = (extra || '').match(/CONTENT REQUEST:\s*([\s\S]*)$/i);
  return (match?.[1] || '').trim();
}

function visualDirection(ctx: BrandEngineContext) {
  return [ctx.profile.visual.setting, ...ctx.profile.visual.rules].filter(Boolean).join(' ');
}

function guardrailLine(ctx: BrandEngineContext) {
  const never = ctx.profile.claims.never;
  return never.length ? `Never: ${never.join('; ')}.` : '';
}

function finish(ctx: BrandEngineContext, result: GenerationResult): GenerationResult {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  return {
    ...result,
    variants: result.variants.map((v) => ({
      ...v,
      hook: applyPhaseRules(v.hook, phase),
      script: applyPhaseRules(v.script, phase),
      caption: applyPhaseRules(v.caption, phase),
      cta: applyPhaseRules(v.cta, phase),
      creative_prompt: `${v.creative_prompt}${phase.guidance ? ` PHASE (${phase.label}): ${phase.guidance}` : ''}`,
    })),
  };
}

function demoCampaign(ctx: BrandEngineContext, brief: CampaignBrief): GenerationResult {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const request = extractContentRequest(brief.extra);
  const channel = channelFor(ctx.profile, brief.platform);
  const exemplars = exemplarsFor(ctx.profile, phase.key, { avoidHooks: ctx.recentHooks });
  const ctas = [...(channel?.ctas ?? []), ...phase.ctas];

  const variants: ContentVariant[] = Array.from({ length: brief.count }, (_, index) => {
    const e = exemplars[index % Math.max(exemplars.length, 1)];
    const hook = request ? (request.split(/\n|\.(\s|$)/)[0] || request).slice(0, 90) : e?.hook || ctx.brand.name;
    const concept = request || e?.concept || ctx.profile.summary;
    const points = talkingPointsFor(ctx.profile, `${hook} ${concept}`, 1);
    const body = points[0] || concept;
    const cta = e?.cta || ctas[index % Math.max(ctas.length, 1)] || ctx.brand.preferred_cta || '';
    const post = `${hook}\n\n${body}${cta ? `\n\n${cta}` : ''}`;
    return {
      hook,
      angle: `${e?.pillar || 'Brand'} · ${phase.label}`,
      script: post,
      caption: post,
      cta,
      creative_prompt: `${isThreads(brief.platform) ? 'Threads-native text post' : `${brief.format} for ${brief.platform}`}. Open with the exact hook "${hook}". Make one point: ${concept} ${visualDirection(ctx)} ${guardrailLine(ctx)} End with one CTA.`,
    };
  });

  return {
    strategy: `${phase.label}: ${phase.guidance || ctx.profile.summary} (Zero-cost draft from the brand profile. Add a Gemini key for fresh AI writing.)`,
    variants,
    mode: 'demo',
  };
}

export async function generateCampaign(ctx: BrandEngineContext, brief: CampaignBrief): Promise<GenerationResult & { model?: string }> {
  const phase = currentPhase(ctx.profile, phaseKeyFor(ctx));
  const request = extractContentRequest(brief.extra);
  const mode = modeFor(ctx.profile, `${request} ${brief.objective}`);

  if (mode?.fixed) {
    const f = mode.fixed;
    return {
      strategy: `${mode.label}. ${mode.instructions}`,
      variants: Array.from({ length: brief.count }, () => ({
        hook: f.hook, angle: mode.label, script: f.script, caption: f.caption, cta: f.cta,
        creative_prompt: `${brief.format} for ${brief.platform}. ${mode.instructions} Slides: ${f.slides.map((s, i) => `${i + 1}) ${s.title}: ${s.visual} Text: "${s.text}"`).join(' ')} ${visualDirection(ctx)} ${guardrailLine(ctx)}`,
      })),
      mode: 'demo',
    };
  }

  const prompt = [
    brandContext(ctx.profile, ctx.brand.name, {
      date: malaysiaToday(), phase, knowledge: ctx.knowledge, platforms: [brief.platform],
      extraGuidance: mode ? `SPECIAL MODE (${mode.label}): ${mode.instructions}\n${mode.qa_notes.map((n) => `- ${n}`).join('\n')}` : '',
    }),
    '',
    exemplarBlock(exemplarsFor(ctx.profile, phase.key, { avoidHooks: ctx.recentHooks, limit: 8 })),
    ctx.recentHooks.length ? `ALREADY USED RECENTLY (do not repeat):\n${ctx.recentHooks.slice(0, 25).map((h) => `- ${h}`).join('\n')}` : '',
    '',
    'BRIEF',
    `Objective: ${brief.objective}`,
    `Platform: ${brief.platform}`,
    `Format: ${brief.format}`,
    `Language: ${brief.language}`,
    request ? `User's content request (the topic is fixed; follow it): ${request}` : brief.extra ? `Notes: ${brief.extra}` : '',
    `Visual direction for creative_prompt: ${visualDirection(ctx)}`,
    '',
    `Write ${brief.count} meaningfully different variants (different angles, not rewordings).`,
    'Return JSON: {"strategy":"","variants":[{"hook":"","angle":"","script":"full spoken/post copy","caption":"platform-ready caption","cta":"","creative_prompt":"detailed visual/video production prompt with on-screen text"}]}',
  ].filter(Boolean).join('\n');

  const ai = await generateJson(AiCampaignSchema, SYSTEM_PROMPT, prompt);
  if (ai) {
    return { ...finish(ctx, { strategy: ai.data.strategy, variants: ai.data.variants.slice(0, brief.count), mode: 'ai' }), model: ai.model };
  }
  return finish(ctx, demoCampaign(ctx, brief));
}
