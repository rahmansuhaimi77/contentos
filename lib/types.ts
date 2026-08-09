export type BrandBrain = {
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  proof: string;
  cta: string;
  avoid: string;
};

export type CampaignBrief = {
  objective: string;
  platform: string;
  format: string;
  language: string;
  count: number;
  extra: string;
};

export type ContentVariant = {
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
};

export type GenerationResult = {
  strategy: string;
  variants: ContentVariant[];
};
