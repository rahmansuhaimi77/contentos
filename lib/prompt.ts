import type { BrandBrain, CampaignBrief } from './types';

export function buildCampaignPrompt(brand: BrandBrain, brief: CampaignBrief) {
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

CAMPAIGN BRIEF
Objective: ${brief.objective}
Platform: ${brief.platform}
Format: ${brief.format}
Language: ${brief.language}
Number of variants: ${brief.count}
Extra instructions: ${brief.extra}

Create content that sounds native to the platform, specific to the audience and commercially useful. Avoid generic AI phrasing, fake claims, invented testimonials and unsupported numbers.

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
