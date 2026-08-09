import type { BrandBrain, CampaignBrief } from './types';

export type PromptKnowledgeItem = {
  kind: string;
  title: string;
  content: string;
};

export function buildCampaignPrompt(
  brand: BrandBrain,
  brief: CampaignBrief,
  knowledge: PromptKnowledgeItem[] = [],
) {
  const knowledgeBlock = knowledge.length
    ? knowledge.map((item, index) => `${index + 1}. [${item.kind}] ${item.title}: ${item.content}`).join('\n')
    : 'No additional knowledge items supplied.';

  return `You are the senior content strategist and direct-response creative director for this brand.

BRAND BRAIN
Brand: ${brand.name}
Product/service: ${brand.product}
Target audience: ${brand.audience}
Positioning: ${brand.positioning}
Brand voice: ${brand.voice}
Current offer: ${brand.offer}
Proof / trust signals: ${brand.proof}
Preferred CTA: ${brand.cta}
Avoid: ${brand.avoid}

VERIFIED BRAND KNOWLEDGE
${knowledgeBlock}

CAMPAIGN BRIEF
Objective: ${brief.objective}
Platform: ${brief.platform}
Format: ${brief.format}
Language: ${brief.language}
Number of variants: ${brief.count}
Extra instructions: ${brief.extra}

Rules:
- Treat the verified brand knowledge as factual constraints, not optional inspiration.
- Never invent price, availability, testimonials, guarantees, numbers or capabilities.
- Make each variant meaningfully different in angle, not just reworded.
- The hook must be short enough to work in the first 1-2 seconds for short-form video.
- Prefer specific customer situations and natural platform-native language.
- Avoid repeating the full audience description in the hook or script.
- Keep Bahasa Melayu natural and Malaysian when requested; use Manglish only where it sounds human.

Return ONLY valid JSON with this exact shape:
{
  "strategy": "short explanation of the campaign angle",
  "variants": [
    {
      "hook": "scroll-stopping opening",
      "angle": "why this angle should work",
      "script": "full spoken/post copy",
      "caption": "platform-ready caption",
      "cta": "specific CTA",
      "creative_prompt": "detailed production prompt for image/video generation including visual direction, shots, setting, lighting, pacing and on-screen text"
    }
  ]
}

The variants array must contain exactly ${brief.count} items.`;
}
