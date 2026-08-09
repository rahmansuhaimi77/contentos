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

export type SavedBrand = BrandBrain & {
  id: string;
  workspaceId: string;
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
  id?: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
  status?: 'draft' | 'in_review' | 'approved' | 'rejected' | 'published';
  review_note?: string;
};

export type GenerationResult = {
  strategy: string;
  variants: ContentVariant[];
  mode?: 'ai' | 'demo';
};

export type SavedCampaign = {
  id: string;
  brandId: string;
  brandName: string;
  objective: string;
  platform: string;
  format: string;
  language: string;
  strategy: string;
  status: string;
  createdAt: string;
  variants: ContentVariant[];
};
