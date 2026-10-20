/** Shared production types. Generation itself lives in lib/engine/production.ts. */
export type ProductionKnowledgeItem = { kind: string; title: string; content: string };

export type ProductionVisualContext = {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  font_notes?: string | null;
  visual_style?: string | null;
  image_rules?: string | null;
  asset_kinds?: string[];
  asset_titles?: string[];
};

export type ProductionInput = {
  brandName: string;
  platform: string;
  format: string;
  language: string;
  pillar: string;
  objective: string;
  hook: string;
  concept: string;
  cta: string;
};

export type StoryboardScene = {
  scene: number;
  duration: string;
  visual: string;
  on_screen_text: string;
  voiceover: string;
  image_prompt: string;
};

export type ProductionPack = {
  strategy: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
  storyboard: StoryboardScene[];
  qa_notes: string[];
};
