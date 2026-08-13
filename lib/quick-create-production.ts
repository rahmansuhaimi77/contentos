import type { ProductionKnowledgeItem, ProductionPack, ProductionVisualContext, StoryboardScene } from './production-pack-generator';

type QuickCreateInput = {
  brandName: string;
  platform: string;
  format: string;
  language: string;
  objective: string;
  hook: string;
  script: string;
  caption: string;
  cta: string;
  creativePrompt: string;
  request: string;
  targetPhase: string;
};

function visualRules(brandName: string, context: ProductionVisualContext) {
  const rules: string[] = [];
  if (context.primary_color) rules.push(`Primary colour ${context.primary_color}.`);
  if (context.secondary_color) rules.push(`Secondary colour ${context.secondary_color}.`);
  if (context.accent_color) rules.push(`Accent colour ${context.accent_color}.`);
  if (context.font_notes) rules.push(`Typography: ${context.font_notes}.`);
  if (context.visual_style) rules.push(`Visual style: ${context.visual_style}.`);
  if (context.image_rules) rules.push(`Image rules: ${context.image_rules}.`);
  if (context.asset_kinds?.includes('logo')) rules.push(`Use the supplied official ${brandName} logo exactly; never redraw or reinterpret it.`);
  if (context.asset_kinds?.includes('screenshot')) rules.push('Use approved screenshots as the UI source of truth; do not invent unsupported screens.');
  return rules.join(' ');
}

function isInstallTutorial(input: QuickCreateInput) {
  return /install.*kampusride|add to home screen|home screen.*notification|enable notifications?/i.test(`${input.request} ${input.hook}`);
}

function installStoryboard(input: QuickCreateInput, context: ProductionVisualContext): StoryboardScene[] {
  const base = `Public KampusRide onboarding carousel. Mobile-first, clean instructional layout, authentic Malaysian student context, approved KampusRide branding only. ${visualRules(input.brandName, context)} No official IIUM endorsement, no ride availability/fare/safety claims, and no invented app screens.`;
  const scenes: Array<Omit<StoryboardScene, 'image_prompt'>> = [
    {
      scene: 1,
      duration: 'Slide 1',
      visual: 'Simple cover slide with Android and iPhone visual cues and the approved KampusRide app icon.',
      on_screen_text: 'How to Install KampusRide 📱',
      voiceover: 'Tak perlu cari dekat App Store atau Play Store. Install terus dari browser.',
    },
    {
      scene: 2,
      duration: 'Slide 2',
      visual: 'Android phone mockup showing KampusRide opened in Google Chrome. Keep the browser controls recognisable and uncluttered.',
      on_screen_text: 'Android: Open KampusRide in Chrome',
      voiceover: 'Buka KampusRide guna Google Chrome.',
    },
    {
      scene: 3,
      duration: 'Slide 3',
      visual: 'Android Chrome menu tutorial showing the three-dot menu, Install app, then Install. Use callouts/arrows, not fabricated extra UI.',
      on_screen_text: '⋮ → Install app → Install',
      voiceover: 'Tap tiga titik, pilih Install app, kemudian Install.',
    },
    {
      scene: 4,
      duration: 'Slide 4',
      visual: 'iPhone Safari tutorial showing Share, Add to Home Screen, Open as Web App, then Add. Keep the sequence visually obvious.',
      on_screen_text: 'Safari → Share → Add to Home Screen',
      voiceover: 'Untuk iPhone, buka dalam Safari, tap Share, Add to Home Screen, hidupkan Open as Web App, kemudian Add.',
    },
    {
      scene: 5,
      duration: 'Slide 5',
      visual: 'KampusRide notification permission moment with a clear Allow callout. Use an approved real prompt/screenshot when available.',
      on_screen_text: 'Enable Notifications 🔔 → Allow',
      voiceover: 'Lepas install, buka KampusRide dan tap Allow bila notification permission keluar supaya tak terlepas driver offer, ride updates dan trip status.',
    },
    {
      scene: 6,
      duration: 'Slide 6',
      visual: 'Phone Home Screen showing the approved KR app icon installed successfully. Simple positive completion state.',
      on_screen_text: 'Done ✅  From Campus, For You',
      voiceover: 'Siap. KampusRide dah ready dekat Home Screen.',
    },
  ];
  return scenes.map((scene) => ({
    ...scene,
    image_prompt: `${base} ${scene.duration}: ${scene.visual} Preserve on-screen wording: “${scene.on_screen_text}”.`,
  }));
}

function genericStoryboard(input: QuickCreateInput, context: ProductionVisualContext): StoryboardScene[] {
  const base = `Create ${input.format} content for ${input.brandName} on ${input.platform}. Follow the user's explicit request exactly: ${input.request}. Target phase: ${input.targetPhase || 'Unscheduled'}. ${visualRules(input.brandName, context)} Do not substitute a different campaign topic.`;
  const scenes = [
    { scene: 1, duration: 'Frame 1', visual: 'Strong request-led opening visual.', on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: 'Frame 2', visual: 'Explain or demonstrate the main requested idea clearly.', on_screen_text: input.objective, voiceover: input.script },
    { scene: 3, duration: 'Frame 3', visual: 'Clean branded close with the requested next action.', on_screen_text: input.cta, voiceover: input.cta },
  ];
  return scenes.map((scene) => ({ ...scene, image_prompt: `${base} ${scene.visual} On-screen text: “${scene.on_screen_text}”.` }));
}

export function buildQuickCreateProductionPack(
  input: QuickCreateInput,
  _knowledge: ProductionKnowledgeItem[],
  context: ProductionVisualContext = {},
): ProductionPack {
  const install = isInstallTutorial(input);
  const storyboard = install ? installStoryboard(input, context) : genericStoryboard(input, context);
  return {
    strategy: `${input.targetPhase || 'Unscheduled'} Quick Create production. Explicit request is the source of truth.`,
    hook: input.hook,
    angle: install ? 'Public onboarding · Install + notifications' : 'Quick Create · explicit request',
    script: input.script,
    caption: input.caption,
    cta: input.cta,
    creative_prompt: `${input.creativePrompt} PRODUCTION RULE: follow the explicit request exactly: ${input.request}.`,
    storyboard,
    qa_notes: install
      ? [
          'Keep exactly six tutorial slides in the Android → iPhone → notifications sequence.',
          'Do not turn this into a general KampusRide introduction or Telegram comparison.',
          'Use approved KampusRide logo/app icon and real screenshots where available.',
          'Do not claim App Store/Play Store availability while KampusRide is installed as a web app/PWA.',
          'No official IIUM endorsement, guaranteed safety, fares, ratings or ride availability claims.',
        ]
      : [
          'The explicit Quick Create request is the source of truth; do not substitute a canned brand topic.',
          'Use approved brand assets and verified knowledge only.',
          'Keep target phase separate from publish date; creating now does not mean publishing now.',
        ],
  };
}
