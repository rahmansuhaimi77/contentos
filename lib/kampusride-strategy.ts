import type { BrandBrain, CampaignBrief, GenerationResult } from './types';
import type { PlanItem, PlanKnowledgeItem } from './plan-generator';
import type {
  ProductionInput,
  ProductionKnowledgeItem,
  ProductionVisualContext,
  ProductionPack,
  StoryboardScene,
} from './production-pack-generator';

export function isKampusRide(name: string) {
  return name.toLowerCase().includes('kampusride');
}

type PlannerInput = {
  brandName: string;
  objective: string;
  platforms: string[];
  language: string;
  cta?: string;
};

type Idea = readonly [string, string, string];

const ideas: Idea[] = [
  ['Telegram Reality · Driver', 'Nak close job sampai kena type masa tengah drive?', 'Real driver struggle: pressure to reply, negotiate or secure jobs quickly in Telegram while already driving. Contrast with a structured ride feed and offer flow. Explicitly say drivers should only check/respond when safely stopped.'],
  ['Telegram Reality · Passenger', 'Driver dah confirm… lepas tu tak muncul?', 'Passenger no-show pain: driver confirms then goes silent or fails to show. Explain that KampusRide cannot guarantee this never happens, but selected match, ride status, chat and two-sided ratings create clearer accountability.'],
  ['Telegram Reality · Driver', 'Passenger dah confirm. Tengah on the way… chat hilang.', 'Show the operational pain when a passenger deletes a Telegram message/chat after confirming or while the driver is already on the way. Contrast with one structured trip context, selected match, in-app chat and ride status.'],
  ['Telegram Reality · Passenger', 'Nego 4 driver serentak memang penat.', 'Passenger has to negotiate separately with multiple drivers in scattered DMs. Contrast with one request and all offers/counteroffers in one place.'],
  ['Telegram Reality · Driver', 'Satu job belum settle, 3 chat lain dah masuk.', 'Driver trying to manage several potential jobs across private chats can lose track of which passenger is actually confirmed. Show one ride feed, structured offers and a clear selected match.'],
  ['Telegram Reality · Price', 'Bila semua nego dalam DM, harga pun jadi blur.', 'Explain uncontrolled negotiation: no shared anchor, offers spread across chats and expectations change. KampusRide uses a suggested price guide plus structured offers/counteroffers. Never call the guide a guaranteed fixed fare.'],
  ['Telegram Reality · Both', 'Ride group patut bantu cari ride — bukan bagi ruang spam dan scam.', 'Acknowledge sexual spam, harassment and scam attempts can affect open groups/private DMs. Emphasise privacy, authenticated accounts, in-app chat, trip context and moderation without claiming KampusRide prevents all abuse.'],
  ['Telegram Reality · Both', 'Bila ada masalah ride, siapa sebenarnya accountable?', 'Compare weak ride-specific history/rules in scattered Telegram arrangements with selected match, trip context, ratings, reputation and admin moderation. Keep legal regulation separate from platform rules.'],
  ['Telegram Reality · Passenger', 'Dah pilih seorang driver, yang lain semua masih DM “still need?”', 'Show confirmation ambiguity and awkwardly closing multiple negotiations. KampusRide keeps offers on one request and resolves the selected match more clearly.'],
  ['Telegram Reality · Driver', 'Tak payah camp group sepanjang hari semata-mata takut terlepas job.', 'Driver-side attention fatigue: constantly refreshing the group. Show Driver mode and ride demand feed, but do not promise jobs or earnings.'],
  ['Telegram Reality · Privacy', 'Nak cari transporter tak semestinya kena expose nombor dekat ramai orang.', 'Explain that coordination can stay in-app instead of immediately sharing a personal phone number with multiple strangers.'],
  ['Telegram Reality · Comparison', 'Telegram works. Tapi ride flow boleh jadi lagi kemas.', 'Founder/community angle: do not attack Telegram. It proved the community demand. KampusRide keeps the same peer-to-peer behaviour but structures request → offers → choose → chat → ride → rate.'],

  ['IIUM Life', 'Class 8AM. Hujan. Mahallah jauh. Ride flow jangan tambah stress.', 'Authentic IIUM morning situation. Use mahallah-to-kulliyyah context and show how one structured request reduces the need to juggle chats.'],
  ['IIUM Life', 'Nak ke LRT Gombak: post sekali, then compare offer.', 'Common IIUM external-route situation. Keep the product demonstration simple and do not invent a fixed fare.'],
  ['IIUM Community', 'KampusRide bukan nak ganti culture transporter UIA.', 'Community-first founder message: the ride-helping culture already exists; KampusRide is organising the workflow around it.'],
  ['IIUM Life', 'Pagi passenger. Petang ada gap class, jadi driver.', 'Show dual passenger/driver life naturally within one campus day. Never imply every passenger is automatically eligible as a driver.'],
  ['IIUM Life', 'Exam week: otak dah penuh. Ride jangan penuh dengan 6 chat sekali.', 'Relatable exam-period content blending campus stress with the fragmented Telegram pain point.'],
  ['IIUM Life', 'Balik kampung weekend: luggage banyak, masa pun tight.', 'Campus weekend/balik-kampung context. Focus on clearer request details, route and driver offers rather than generic e-hailing imagery.'],
  ['IIUM Community', 'Komuniti sama. Cara urus ride je lebih tersusun.', 'Warm IIUM community montage: mahallah, kulliyyah, walkway, LRT trip, driver/passenger roles. Avoid official IIUM endorsement.'],
  ['IIUM Life', 'Ta’aruf / semester baru: tak kenal semua tempat lagi? Takpe.', 'New-student context using the IIUM-focused place list. Show practical route selection without claiming institutional partnership.'],
  ['IIUM Life', 'Habis event malam, ramai orang cari ride serentak.', 'Campus-event scenario showing why structured requests/offers are easier than a fast-moving group chat. Do not guarantee supply.'],
  ['IIUM Community', 'Driver student pun ada class, assignment dan hidup sendiri.', 'Humanise drivers as community members. Show flexible participation and respectful passenger expectations, not guaranteed availability.'],

  ['Trust & Accountability', 'Rating bukan jaminan safety — tapi accountability memang penting.', 'Explain two-sided reputation carefully: useful context across rides, not a safety certification.'],
  ['Trust & Safety', 'Female preferred patut jadi preference, bukan fake guarantee.', 'Explain preference transparently and acknowledge supply can be limited.'],
  ['Trust & Rules', '“Ada rules” dengan “fully regulated” bukan benda yang sama.', 'Educational post: KampusRide can have community rules, moderation and platform controls, while legal/regulatory classification is separate and should never be guessed in marketing.'],
  ['Trust & Safety', 'Kalau tengah drive, jangan reply job dulu.', 'Safety-first driver message: never use the app while vehicle is moving. The product should reduce frantic chat pressure, not encourage more phone interaction.'],
  ['Trust & Privacy', 'Private chat + trip context > random DM tanpa context.', 'Show why structured in-app coordination and trip context can reduce ambiguity and unwanted exposure. Avoid claiming complete protection from harassment/scams.'],

  ['Product', 'Satu request. Semua offer. Pilih satu. Ride.', 'Simple full-flow product demo that contrasts directly with scattered Telegram DMs.'],
  ['Driver Growth', 'Ada kereta dan selalu drive sekitar UIA? Offer bila betul-betul free.', 'Driver acquisition grounded in campus life. Keep direct fare proposition but no job/income guarantee.'],
  ['Brand', 'Same IIUM ride community. Less chaos.', 'Brand recap tying together Telegram reality, IIUM culture, privacy, accountability and the structured marketplace flow.'],
];

const videoFormats = ['15-30 sec short-form video', 'UGC / POV video', 'Talking-head explainer', 'Carousel', 'Static ad'];
const threadsFormats = ['Threads text post', 'Conversation starter', 'Mini-story / opinion post', 'Question-led post'];
const passengerCtas = ['Post ride anda dalam KampusRide.', 'Compare offer dalam satu tempat.', 'Cuba KampusRide untuk ride seterusnya.', 'Check KampusRide bila perlukan transporter.'];
const driverCtas = ['Switch ke Driver mode bila anda selamat berhenti dan free.', 'Check ride feed bila anda available.', 'Offer ride bila route dan masa sesuai.'];
const threadsQuestions = [
  'Student UIA — korang pernah kena situasi macam ni?',
  'Passenger — part paling penat dalam transporter flow sekarang apa?',
  'Driver kampus — masalah paling real bila cari job dalam group apa?',
  'Kalau boleh fix satu benda dalam current transporter flow, korang pilih apa?',
];

function threads(platform: string) {
  return /threads/i.test(platform);
}

function driverIdea(pillar: string, concept: string) {
  return /driver/i.test(`${pillar} ${concept}`);
}

export function buildKampusRideThirtyDayPlan(input: PlannerInput, _knowledge: PlanKnowledgeItem[]): PlanItem[] {
  const platforms = input.platforms.length ? input.platforms : ['TikTok / Reels'];
  return ideas.map(([pillar, hook, concept], index) => {
    const platform = platforms[index % platforms.length];
    const isThreads = threads(platform);
    const isDriver = driverIdea(pillar, concept);
    return {
      day_number: index + 1,
      pillar,
      objective: isDriver ? 'Driver acquisition, safer workflow and activation' : input.objective,
      platform,
      format: isThreads ? threadsFormats[index % threadsFormats.length] : videoFormats[index % videoFormats.length],
      hook,
      concept: isThreads
        ? `${concept} Write as a real IIUM observation/conversation, not an ad. Keep the sell soft and end with one useful question.`
        : concept,
      cta: isThreads
        ? threadsQuestions[index % threadsQuestions.length]
        : isDriver ? driverCtas[index % driverCtas.length] : passengerCtas[index % passengerCtas.length],
    };
  });
}

type CampaignInput = { brand: BrandBrain; brief: CampaignBrief };

const campaignBank = ideas.slice(0, 18);

function campaignBody(hook: string, concept: string) {
  const lower = `${hook} ${concept}`.toLowerCase();
  if (/type|drive|driving|tengah drive/.test(lower)) return 'Dalam Telegram, driver yang nak secure job kadang rasa kena reply atau nego cepat walaupun tengah bergerak. Itu workflow yang kita tak patut normalize. KampusRide susun ride request dan offer dalam satu tempat supaya driver boleh review bila selamat berhenti — bukan berlumba menaip masa memandu.';
  if (/chat hilang|delete|deleted/.test(lower)) return 'Bila passenger dah confirm kemudian mesej hilang, driver boleh kehilangan route/context masa dah bersiap atau tengah menuju pickup. KampusRide jadikan request, selected match, chat dan ride status satu flow supaya kurang bergantung pada DM yang berselerak.';
  if (/no.?show|tak muncul/.test(lower)) return 'No-show tetap boleh berlaku di mana-mana platform. Bezanya, KampusRide ada selected match, in-app chat, ride-status flow dan rating/reputation supaya apa yang berlaku tak sekadar hilang dalam private chat. Accountability lebih jelas, bukan safety guarantee.';
  if (/nego|price|harga/.test(lower)) return 'Nego dalam banyak DM mudah jadi tak terkawal: siapa offer berapa, siapa dah confirm, siapa masih counter. KampusRide letak suggested price sebagai guide dan kumpulkan offer/counteroffer pada satu ride request. Passenger masih pilih, driver masih boleh offer — cuma flow lebih jelas.';
  if (/spam|scam|sexual|harass/.test(lower)) return 'Open group dan random DM boleh membuka ruang kepada spam, scam atau sexual harassment. KampusRide tak boleh janji semua abuse akan hilang, tetapi private contact, authenticated account, in-app chat, trip context, reputation dan moderation beri layer accountability yang Telegram ride arrangement tak dibina khusus untuk sediakan.';
  if (/rules|regulated|accountable/.test(lower)) return 'Community ride perlukan rules dan accountability, tapi jangan campur-adukkan platform rules dengan legal regulation. KampusRide boleh ada moderation, suspension, trip context dan audit controls. Status undang-undang pula mesti disahkan berasingan — bukan dibuat claim marketing.';
  return `${concept} KampusRide bukan nak buang culture transporter IIUM. Ia ambil behaviour yang student dan driver dah biasa buat dan susun jadi request → offers → pilih → chat → ride → rate supaya komuniti yang sama kurang chaos.`;
}

export function buildKampusRideCampaignResult(data: CampaignInput): GenerationResult {
  const isThreads = threads(data.brief.platform);
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const [pillar, hook, concept] = campaignBank[index % campaignBank.length];
    const body = campaignBody(hook, concept);
    const isDriver = driverIdea(pillar, concept);
    const question = threadsQuestions[index % threadsQuestions.length];
    const cta = isThreads ? question : isDriver ? driverCtas[index % driverCtas.length] : passengerCtas[index % passengerCtas.length];
    const post = `${hook}\n\n${body}\n\n${cta}`;
    return {
      hook,
      angle: `${pillar} — Telegram reality + IIUM community`,
      script: post,
      caption: post,
      cta,
      creative_prompt: isThreads
        ? `THREADS-NATIVE KampusRide post for the IIUM community. Lead with the exact hook “${hook}”. Write natural BM/Manglish, one specific real Telegram struggle, one KampusRide structural advantage, then one genuine discussion question. Soft sell only. Never claim official IIUM endorsement, guaranteed safety/no-show prevention, guaranteed female driver, or settled regulatory status.`
        : `Create a ${data.brief.format} for ${data.brief.platform}, grounded in real IIUM student/driver life. Open with “${hook}”. Show the Telegram workflow problem specifically, then show how KampusRide structures the same community behaviour through ride request, offers, selected match, in-app chat, ride status and reputation. Use mahallah/kulliyyah/LRT Gombak/campus context where relevant. Natural modest Malaysian student styling. Never encourage phone use while driving; if driver interaction is shown, vehicle must be safely parked/stopped. No fake IIUM endorsement, fares, ratings, user counts, safety guarantees or legal/regulatory claims.`,
    };
  });
  return {
    strategy: 'KampusRide strategy: lead with real Telegram workflow pain, prove the app advantage through structure/accountability, and make every piece feel native to IIUM culture. Treat Telegram as the old workflow — not the enemy — and the IIUM community as the asset KampusRide is organising.',
    variants,
    mode: 'demo',
  };
}

function visualRules(context: ProductionVisualContext) {
  const rules: string[] = [];
  if (context.primary_color) rules.push(`Primary colour ${context.primary_color}.`);
  if (context.secondary_color) rules.push(`Secondary colour ${context.secondary_color}.`);
  if (context.font_notes) rules.push(`Typography: ${context.font_notes}`);
  if (context.asset_kinds?.includes('logo')) rules.push('Use the supplied official KampusRide logo exactly; never redraw it.');
  else rules.push('No approved logo asset: use the KampusRide wordmark as plain text only.');
  if (context.asset_kinds?.includes('screenshot')) rules.push('Use approved real KampusRide screenshots as UI references; do not invent unsupported screens.');
  return rules.join(' ');
}

function productionBody(input: ProductionInput) {
  return campaignBody(input.hook, input.concept);
}

function productionQuestion(input: ProductionInput) {
  if (input.cta?.trim().endsWith('?')) return input.cta.trim();
  if (driverIdea(input.pillar, input.concept)) return 'Driver kampus — part mana paling susah bila cari job dalam group sekarang?';
  return 'Student UIA — pernah kena situasi macam ni bila cari transporter?';
}

function scenesFor(input: ProductionInput, body: string, cta: string, context: ProductionVisualContext): StoryboardScene[] {
  const lower = `${input.hook} ${input.concept}`.toLowerCase();
  const driver = driverIdea(input.pillar, input.concept);
  const problemVisual = /type|drive|driving/.test(lower)
    ? 'Driver safely parked at an IIUM-style campus roadside/parking area, looking at several Telegram ride messages. Make it explicit the vehicle is stationary; never depict typing while moving.'
    : /chat hilang|delete/.test(lower)
      ? 'Driver safely stopped, looking at a phone where a previously confirmed Telegram-style conversation is now missing/deleted; no real personal data.'
      : /no.?show|tak muncul/.test(lower)
        ? 'Passenger waiting at a familiar campus pickup point, checking the time and an unanswered chat. No fear/drama.'
        : /spam|scam|sexual/.test(lower)
          ? 'Abstract phone notification clutter showing unwanted/spam-like messages without explicit sexual content or real identities.'
          : 'POV phone scene showing several scattered Telegram-style ride DMs and negotiation messages, anonymised and fictional.';
  const rules = visualRules(context);
  const base = `Vertical 9:16 authentic Malaysian university UGC frame for KampusRide. IIUM-style campus life: modest student styling, mahallah/kulliyyah/walkway/LRT Gombak context where appropriate, natural daylight, believable smartphone use. ${rules} No official IIUM endorsement or logo unless separately approved. No invented fares, ratings, verification badges, user counts or safety guarantees.`;
  const raw = [
    { scene: 1, duration: '0-3s', visual: problemVisual, on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: '3-8s', visual: 'Show the old Telegram workflow friction clearly: scattered DMs, unclear confirmation or negotiation depending on this topic. Keep all chats fictional/anonymised.', on_screen_text: 'Benda ni memang real dalam group ride', voiceover: body },
    { scene: 3, duration: '8-15s', visual: 'Switch to KampusRide: one ride request with structured offers/counteroffers and a clear selected match. Use approved real screenshot if available.', on_screen_text: 'Satu request → semua offer', voiceover: 'KampusRide susun request, offer dan pilihan dalam satu flow.' },
    { scene: 4, duration: '15-21s', visual: 'Show in-app chat / ride status / reputation context relevant to the issue. If driver is shown with phone, vehicle must be safely stopped.', on_screen_text: driver ? 'Check bila selamat berhenti' : 'Lebih jelas siapa dah match', voiceover: driver ? 'Kalau tengah drive, jangan reply. Check bila selamat berhenti.' : 'Selected match, chat dan status buat expectation lebih jelas.' },
    { scene: 5, duration: '21-25s', visual: 'Warm IIUM-community closing scene: student and/or driver continuing normal campus day, subtle KampusRide CTA.', on_screen_text: cta, voiceover: cta },
  ];
  return raw.map((scene) => ({ ...scene, image_prompt: `${base} Scene ${scene.scene}: ${scene.visual} Reserve clean subtitle space for “${scene.on_screen_text}”.` }));
}

export function buildKampusRideProductionPack(
  input: ProductionInput,
  _knowledge: ProductionKnowledgeItem[],
  context: ProductionVisualContext = {},
): ProductionPack {
  const body = productionBody(input);
  const isThreads = threads(input.platform);
  const cta = isThreads ? productionQuestion(input) : input.cta || (driverIdea(input.pillar, input.concept) ? driverCtas[0] : passengerCtas[0]);
  const post = `${input.hook}\n\n${body}\n\n${cta}`;

  if (isThreads) {
    return {
      strategy: 'Threads-first KampusRide post: one real IIUM/Telegram observation, one structural product advantage, one genuine question.',
      hook: input.hook,
      angle: `${input.pillar} — IIUM Telegram reality`,
      script: post,
      caption: post,
      cta,
      creative_prompt: `THREADS PRODUCTION BRIEF for KampusRide. Natural IIUM student/driver BM/Manglish. Start with “${input.hook}”. Discuss one real Telegram pain point without attacking the community. Explain one KampusRide advantage factually. End with one genuine question. Do not claim guaranteed safety/no-show prevention, official IIUM endorsement, full regulation/APAD approval, guaranteed female drivers, or that all scams/harassment are prevented.`,
      storyboard: [{ scene: 1, duration: 'Optional visual', visual: 'Use one real KampusRide screenshot or simple IIUM-campus lifestyle image only if it adds context.', on_screen_text: '', voiceover: '', image_prompt: `Optional Threads supporting visual for KampusRide. Authentic IIUM-style campus community, modest student styling, natural phone use. ${visualRules(context)} No fake institutional endorsement or claims.` }],
      qa_notes: [
        'Treat Telegram as the old workflow, not the enemy or a dangerous community.',
        'Never imply sexual spam/scams or no-shows are completely prevented by KampusRide.',
        'Keep platform/community rules separate from legal/regulatory status.',
        'Never claim official IIUM endorsement or APAD/licensed e-hailing status without approval.',
        'If driver phone use is discussed, explicitly say to respond only when safely stopped.',
      ],
    };
  }

  const storyboard = scenesFor(input, body, cta, context);
  return {
    strategy: 'KampusRide production strategy: dramatise one real Telegram workflow problem, then demonstrate the specific KampusRide structure that reduces the friction, all inside recognisable IIUM campus life.',
    hook: input.hook,
    angle: `${input.pillar} — IIUM Telegram reality`,
    script: post,
    caption: post,
    cta,
    creative_prompt: `Create a vertical 9:16 ${input.format} for ${input.platform}. Audience: IIUM campus community. Open with exact hook “${input.hook}”. Show the specific Telegram workflow pain realistically, then KampusRide as the same community behaviour made more structured: request → offers/counteroffers → selected match → in-app chat → ride status → rating/reputation. Blend naturally with mahallah, kulliyyah, LRT Gombak, rain/class/exam/event context where appropriate. ${visualRules(context)} Keep styling modest, student-native and non-corporate. Never show a driver typing/using the app while a vehicle is moving. No fake official IIUM endorsement, legal/regulatory approval, fares, ratings, verification badges, user counts, guaranteed safety, guaranteed no-show prevention or guaranteed female matching.`,
    storyboard,
    qa_notes: [
      'Use the real Telegram pain point specifically; do not reduce every comparison to “too many DMs”.',
      'Do not attack or shame the IIUM transporter community — KampusRide is organising the same community.',
      'Never encourage phone use while driving; driver interactions must be shown while safely stopped.',
      'No-show, sexual spam/scams and harassment may be reduced/accountable, but never claim they are eliminated.',
      'Keep platform/community rules separate from legal regulation; no APAD or licensed e-hailing claim without approval.',
      'Never claim official IIUM endorsement, guaranteed safety, guaranteed ride availability or guaranteed female driver.',
      'Keep one clear product advantage and one CTA per content piece.',
    ],
  };
}
