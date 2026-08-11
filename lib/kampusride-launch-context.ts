import type { GenerationResult } from './types';
import type { PlanItem, PlanKnowledgeItem } from './plan-generator';
import type { ProductionKnowledgeItem, ProductionPack } from './production-pack-generator';

type KnowledgeLike = Pick<PlanKnowledgeItem, 'title' | 'content'> | Pick<ProductionKnowledgeItem, 'title' | 'content'>;

type PlannerInput = {
  brandName: string;
  objective: string;
  platforms: string[];
  language: string;
  cta?: string;
};

type CampaignInput = {
  brand: { name: string };
  brief: {
    objective: string;
    platform: string;
    format: string;
    language: string;
    count: number;
    extra: string;
  };
};

type PrelaunchIdea = readonly [string, string, string];

const PRELAUNCH_MARKER = 'CURRENT LAUNCH PHASE — PRE-LAUNCH';

export function isKampusRidePreLaunch(knowledge: KnowledgeLike[]) {
  return knowledge.some((item) =>
    item.title.toUpperCase().includes(PRELAUNCH_MARKER) ||
    (/current launch phase/i.test(item.title) && /pre[- ]?launch/i.test(item.content)),
  );
}

function isThreads(platform: string) {
  return /threads/i.test(platform);
}

function currentIiumContext(now = new Date()) {
  const ts = now.getTime();
  const newIntakeStart = Date.UTC(2026, 7, 18);
  const newIntakeEnd = Date.UTC(2026, 9, 9, 23, 59, 59);
  const preregEnd = Date.UTC(2026, 9, 2, 23, 59, 59);

  if (ts < newIntakeStart) {
    return 'Semester 1 course registration is already active and new-intake online registration opens 18 August 2026. Use this as a preparation/awareness window, not as an official IIUM partnership claim.';
  }
  if (ts <= preregEnd) {
    return 'Semester 1 course registration and new-intake registration are active. Use new-semester preparation, route familiarity and community education while KampusRide remains pre-launch.';
  }
  if (ts <= newIntakeEnd) {
    return 'New-intake online registration is still active through 9 October 2026. Use first-weeks/new-student context only when relevant and do not invent Ta’aruf dates.';
  }
  return 'Use verified current IIUM academic/event context from the Knowledge Base. Never invent semester, Ta’aruf or campus-event dates.';
}

const prelaunchIdeas: PrelaunchIdea[] = [
  ['App Intro', 'KampusRide ni sebenarnya apa?', 'Introduce KampusRide simply: it organises the existing IIUM transporter behaviour into request → offers → compare → choose → in-app chat → ride → rate. Be transparent that KampusRide is still pre-launch.'],
  ['Why We Built It', 'Kalau Telegram dah ada, kenapa nak buat KampusRide?', 'Respect Telegram for creating the community, then explain the structural gaps KampusRide is designed to fix: scattered DMs, unclear confirmation, negotiation chaos, privacy and weak ride-specific accountability.'],
  ['How-To · Passenger', 'Kalau nak ride nanti, flow passenger macam mana?', 'Step-by-step pre-launch passenger education: create one ride request, receive driver offers, compare profile/vehicle/rating/offer, counter where relevant, select one driver, chat in-app, complete ride and rate. Do not imply the service is live today.'],
  ['How-To · Driver', 'Driver kampus pula guna KampusRide macam mana?', 'Step-by-step driver education: when safely stopped and available, switch to Driver mode, view suitable ride requests, send an offer, respond to counteroffers, wait for passenger selection, then coordinate the selected trip. Never encourage phone interaction while moving.'],
  ['How-To · Offers', 'Satu request, semua offer — apa beza dia?', 'Explain why one request with multiple structured offers is easier to compare than negotiating across multiple Telegram DMs. Keep fare language as offers/counteroffers, not a guaranteed fixed fare.'],
  ['How-To · Price', 'KampusRide control harga ke?', 'Explain that KampusRide can show a suggested price guide and structure offers/counteroffers, while the driver and passenger still agree the final fare. Do not imply price fixing or guaranteed cheapest fares.'],
  ['How-To · Match', 'Dah pilih driver, lepas tu apa jadi?', 'Explain selected-match clarity: one chosen driver, trip context, in-app chat and ride status. Contrast with awkwardly closing several separate DMs without claiming no-shows can never happen.'],
  ['Trust · Reputation', 'Rating dalam KampusRide untuk apa sebenarnya?', 'Explain two-sided ratings/reputation as context and accountability over time, not a safety certificate. Mention useful behaviour signals such as punctuality/respect without inventing real ratings.'],
  ['Trust · Female Preference', 'Female preferred driver tu guarantee ke?', 'Explain clearly that it is a preference designed to prioritise a female driver when available, not a guarantee. Keep the tone respectful and practical for the IIUM community.'],
  ['Trust · Privacy', 'Cari transporter tak semestinya kena bagi nombor dekat ramai orang.', 'Explain the value of in-app chat and trip context before exposing personal contact details. Connect this to unwanted DMs, sexual spam and scam risk without claiming KampusRide prevents all abuse.'],
  ['Trust · Rules', 'Ada platform rules tak sama dengan “fully regulated”.', 'Explain the difference between KampusRide community/platform rules, moderation and accountability versus legal/regulatory classification. Never claim APAD approval, licensed e-hailing status or official IIUM endorsement without confirmation.'],
  ['Driver Safety', 'Nak secure job sampai kena type masa drive? Itu bukan benda yang patut normalize.', 'Use the real Telegram driver-pressure problem. Show how a structured ride feed/offer flow is meant to reduce frantic chat pressure, while stating drivers should only review/respond when safely stopped.'],
  ['Telegram Reality · Driver', 'Passenger dah confirm. Tengah on the way… chat hilang.', 'Show the frustration of deleted Telegram messages after confirmation and why persistent trip context/selected match is useful. Avoid claiming the app can eliminate cancellations.'],
  ['Telegram Reality · Passenger', 'Driver dah confirm… tapi tak muncul?', 'Talk about no-show frustration. KampusRide can create clearer selected-match history, chat, ride status and ratings; it cannot guarantee no-shows never happen.'],
  ['Telegram Reality · Passenger', 'Nego 4 driver serentak memang penat.', 'Contrast scattered multi-driver negotiation with one request containing visible offers/counteroffers and one final selection.'],
  ['Telegram Reality · Driver', 'Satu job belum settle, tiga chat lain dah masuk.', 'Show multi-job chat chaos for drivers and why a structured request/offer/selection state is easier to track. Never promise job volume or earnings.'],
  ['Current IIUM Context', 'Tengah susun timetable Sem 1? Kami pun tengah susun ride flow.', 'Use the current Semester 1 registration/pre-registration window as a natural build-in-public moment. Connect semester preparation to making campus transport workflow easier, without implying IIUM endorsement.'],
  ['New Intake', 'New intake season dah dekat — campus route memang ambil masa nak familiar.', 'Speak to new-student route learning: mahallah, kulliyyah, LRT Gombak and common campus movements. KampusRide is still pre-launch, so educate rather than sell a live ride.'],
  ['IIUM Life', 'Mahallah ke kulliyyah nampak simple… sampai class 8AM.', 'Relatable campus routine. Show why clear pickup/drop-off/request details matter and keep the visual/copy recognisably IIUM without using protected branding as official endorsement.'],
  ['IIUM Life', 'LRT Gombak ↔ campus: route yang hampir semua student akan kenal.', 'Use LRT Gombak as a familiar mobility context to explain ride requests and clear route information. No fixed fare or availability claims.'],
  ['IIUM Life', 'Hujan + class jauh = masa semua orang nak benda cepat dan clear.', 'Use Malaysian rain/class-rush context. Focus on clear request and offer information; do not imply guaranteed supply.'],
  ['IIUM Events', 'Bila event habis serentak, group chat memang boleh jadi laju gila.', 'Explain how event-end demand can make group chat difficult to follow. Keep this evergreen unless a real IIUM event/date has been verified in the Knowledge Base.'],
  ['IIUM Life', 'Balik kampung weekend: luggage, timing, pickup point — semua kena clear.', 'Use weekend/balik-kampung preparation to teach better ride-request details. Pre-launch education only.'],
  ['Dual Mode', 'Pagi passenger. Petang ada gap class, mungkin jadi driver.', 'Explain passenger/driver mode switching as a campus-native concept. Never imply every passenger is eligible to drive.'],
  ['Trust · Spam & Scams', 'Ride group patut bantu cari ride — bukan buka ruang random spam.', 'Acknowledge spam, scam and sexual harassment risks in open-group/random-DM workflows. Explain privacy, trip context, moderation and reputation carefully without promising complete prevention.'],
  ['Trust · Boundaries', 'Apa yang KampusRide TAK patut promise?', 'Build trust by stating boundaries: no guaranteed safety, no guaranteed female driver, no guaranteed ride, no guaranteed cheapest price, no claim of official IIUM endorsement or settled legal status.'],
  ['Build in Public', 'Sebelum launch, kita nak fix benda yang betul — bukan tambah feature random.', 'Founder/community post asking passengers and drivers which part of the current transporter flow creates the most friction. Show that feedback shapes launch priorities.'],
  ['Community Listening', 'Passenger UIA: kalau boleh fix satu benda dalam transporter flow, apa dia?', 'Pure conversation/listening post. Collect real passenger pain before launch rather than hard-selling.'],
  ['Community Listening', 'Driver kampus: apa satu benda app ni mesti buat supaya betul-betul membantu?', 'Pure driver research post covering attention, negotiation, confirmation, no-show and trip clarity. Never promise jobs or earnings.'],
  ['Launch Readiness', 'Same IIUM ride community. Less chaos. Itu yang kita nak capai sebelum launch.', 'Pre-launch recap: community stays peer-to-peer, KampusRide structures the workflow. Invite people to follow launch updates and keep expectations transparent.'],
];

const videoFormats = ['15-30 sec short-form video', 'UGC / POV video', 'Talking-head explainer', 'Carousel', 'Static ad'];
const threadsFormats = ['Threads text post', 'Conversation starter', 'Mini-story / opinion post', 'Question-led post'];
const softCtas = [
  'Follow KampusRide untuk launch updates.',
  'Student UIA — apa yang paling penting kita kena fix sebelum launch?',
  'Driver kampus — flow macam ni lagi senang tak?',
  'Save post ni untuk bila KampusRide dah live.',
  'Kalau boleh improve satu benda sebelum launch, korang pilih apa?',
];

export function buildKampusRideLaunchAwarePlan(
  input: PlannerInput,
  knowledge: PlanKnowledgeItem[],
  fallback: PlanItem[],
): PlanItem[] {
  if (!isKampusRidePreLaunch(knowledge)) return fallback;
  const platforms = input.platforms.length ? input.platforms : ['Threads'];
  const timing = currentIiumContext();

  return prelaunchIdeas.map(([pillar, hook, concept], index) => {
    const platform = platforms[index % platforms.length];
    const threads = isThreads(platform);
    const context = index === 16 || index === 17 ? ` ${timing}` : '';
    return {
      day_number: index + 1,
      pillar,
      objective: 'Pre-launch awareness, product education, trust and IIUM community learning',
      platform,
      format: threads ? threadsFormats[index % threadsFormats.length] : videoFormats[index % videoFormats.length],
      hook,
      concept: `${concept}${context}${threads ? ' Write as a natural IIUM conversation, not a launch ad.' : ''}`,
      cta: softCtas[index % softCtas.length],
    };
  });
}

const campaignBank = [
  {
    hook: 'KampusRide ni sebenarnya apa?',
    angle: 'App intro · pre-launch',
    body: 'KampusRide ialah app yang cuba susunkan cara student UIA cari dan offer transporter. Passenger post satu ride request, driver hantar offer, passenger compare dan pilih, lepas tu coordination kekal dalam satu trip flow. Kami masih pre-launch — sekarang fokus kemaskan flow supaya bila launch nanti, benda yang student dah biasa buat jadi kurang berselerak.',
  },
  {
    hook: 'Kalau Telegram dah ada, kenapa nak buat KampusRide?',
    angle: 'Why we built it · Telegram comparison',
    body: 'Telegram dah prove satu benda: komuniti transporter UIA memang wujud dan memang membantu. Masalahnya workflow ride bukan benda yang Telegram dibina khas untuk urus — confirmation, banyak DM, nego, privacy, no-show dan trip history semua bercampur. KampusRide bukan nak buang community tu. Kita nak susunkan flow dia.',
  },
  {
    hook: 'Kalau nak ride nanti, flow passenger macam mana?',
    angle: 'Passenger how-to · pre-launch',
    body: 'Simple: post satu ride request → driver bagi offer → compare offer, profile dan details → pilih satu driver → chat dalam app → ride → rate. Idea dia bukan tambah step. Idea dia kurangkan benda yang sekarang kena track dalam banyak chat. Buat masa ni KampusRide masih pre-launch.',
  },
  {
    hook: 'Driver kampus pula guna KampusRide macam mana?',
    angle: 'Driver how-to · pre-launch',
    body: 'Bila free dan kereta dah selamat berhenti, buka Driver mode → tengok request yang sesuai → hantar offer → respond kalau ada counteroffer → tunggu passenger pilih. Bukan berlumba type masa tengah drive. KampusRide masih pre-launch, jadi sekarang kami tengah kemaskan flow ni.',
  },
  {
    hook: 'KampusRide control harga ke?',
    angle: 'Price & negotiation explainer',
    body: 'Bukan fixed fare macam e-hailing biasa. KampusRide boleh bagi suggested price sebagai guide, kemudian driver boleh offer dan passenger boleh counter. Bezanya, negotiation tu duduk pada satu ride request — bukan kena ingat siapa offer berapa dalam beberapa DM.',
  },
  {
    hook: 'Female preferred driver tu guarantee ke?',
    angle: 'Female preference explainer',
    body: 'Tak. “Female preferred” maksudnya preference — bila female driver available, sistem boleh bantu prioritise pilihan tu. Supply tetap bergantung pada siapa yang available. Lagi baik explain limitation awal daripada bagi fake guarantee.',
  },
  {
    hook: 'Cari transporter tak semestinya kena bagi nombor dekat ramai orang.',
    angle: 'Privacy · pre-launch',
    body: 'Dalam open group, satu post boleh bawa banyak random DM. KampusRide direka supaya request, selected match dan chat ada trip context dalam app. Itu tak bermaksud semua scam atau harassment boleh hilang, tapi sekurang-kurangnya coordination ride tak perlu bermula dengan expose contact kepada ramai orang.',
  },
  {
    hook: 'Rating bukan jaminan safety — tapi accountability tetap penting.',
    angle: 'Trust & reputation',
    body: 'Rating tak boleh certify seseorang “selamat”. Tapi bila behaviour selepas ride boleh carry forward sebagai reputation, passenger dan driver ada lebih banyak context daripada start zero setiap kali masuk DM baru. Itu layer accountability yang KampusRide nak bina.',
  },
  {
    hook: 'Sebelum launch, kita nak fix benda yang betul.',
    angle: 'Build in public · community research',
    body: 'Kita boleh tambah macam-macam feature. Tapi kalau benda paling sakit dalam current transporter flow sebenarnya confirmation, nego, no-show atau random DM, itu yang patut diselesaikan dulu. KampusRide masih pre-launch — jadi feedback student dan driver sekarang lagi valuable daripada vanity feature.',
  },
];

export function buildKampusRidePreLaunchCampaignResult(
  data: CampaignInput,
  knowledge: PlanKnowledgeItem[],
  fallback: GenerationResult,
): GenerationResult {
  if (!isKampusRidePreLaunch(knowledge)) return fallback;
  const threads = isThreads(data.brief.platform);
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const idea = campaignBank[index % campaignBank.length];
    const cta = threads
      ? index % 2 === 0
        ? 'Student UIA — apa yang paling penting app ni kena buat sebelum launch?'
        : 'Korang rasa part mana dalam current transporter flow paling messy?'
      : 'Follow KampusRide untuk launch updates.';
    const post = `${idea.hook}\n\n${idea.body}\n\n${cta}`;
    return {
      hook: idea.hook,
      angle: idea.angle,
      script: post,
      caption: post,
      cta,
      creative_prompt: `${threads ? 'THREADS-NATIVE' : data.brief.format} pre-launch KampusRide content for the IIUM community. Make it feel campus-made, natural BM/Manglish and useful rather than salesy. Be transparent that KampusRide is pre-launch. Explain one product flow or one real Telegram pain point, blend with authentic IIUM student/driver life, then use a soft launch-update or feedback CTA. Never imply rides can already be booked, never invent IIUM endorsement, fares, usage numbers, Ta’aruf dates, safety guarantees, female-driver guarantees or settled regulatory status.`,
    };
  });
  return {
    strategy: `PRE-LAUNCH KampusRide strategy: product education + how-to + Telegram workflow advantage + IIUM community listening. ${currentIiumContext()} Do not use live-service conversion CTAs until the founder changes the launch phase.`,
    variants,
    mode: fallback.mode,
  };
}

const liveCtaPatterns: Array<[RegExp, string]> = [
  [/Post ride anda dalam KampusRide\.?/gi, 'Follow KampusRide untuk launch updates.'],
  [/Compare offer dalam satu tempat\.?/gi, 'Follow KampusRide untuk launch updates.'],
  [/Cuba KampusRide untuk ride seterusnya\.?/gi, 'Save post ni untuk bila KampusRide dah live.'],
  [/Check KampusRide bila perlukan transporter\.?/gi, 'Follow KampusRide untuk launch updates.'],
  [/Switch ke Driver mode[^.]*\.?/gi, 'Driver kampus — share feedback untuk flow sebelum launch.'],
  [/Check ride feed bila anda available\.?/gi, 'Driver kampus — share feedback untuk flow sebelum launch.'],
  [/Offer ride bila route dan masa sesuai\.?/gi, 'Follow KampusRide untuk launch updates.'],
];

function sanitizePrelaunchText(value: string) {
  return liveCtaPatterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function enforceKampusRidePreLaunchProduction(
  pack: ProductionPack,
  knowledge: ProductionKnowledgeItem[],
): ProductionPack {
  if (!isKampusRidePreLaunch(knowledge)) return pack;
  const anonymousPublic = /anonymous public beta recruitment/i.test(pack.strategy)
    || pack.qa_notes.some((note) => /public recruitment must not reveal/i.test(note));
  const questionCta = pack.cta.trim().endsWith('?');
  const cta = questionCta ? pack.cta : sanitizePrelaunchText(pack.cta || 'Follow KampusRide untuk launch updates.');
  const safeCta = cta === pack.cta && !questionCta && /post|book|try|cuba|check ride|switch|offer ride/i.test(cta)
    ? 'Follow KampusRide untuk launch updates.'
    : cta;
  return {
    ...pack,
    strategy: `PRE-LAUNCH · ${pack.strategy}`,
    script: sanitizePrelaunchText(pack.script),
    caption: sanitizePrelaunchText(pack.caption),
    cta: safeCta,
    creative_prompt: anonymousPublic
      ? `${pack.creative_prompt} PRE-LAUNCH GUARDRAIL: the unnamed product is not generally launched. Do not reveal its identity or suggest viewers can book/post a ride today.`
      : `${pack.creative_prompt} PRE-LAUNCH GUARDRAIL: KampusRide is not yet generally launched. Do not show or say that viewers can book/post a ride today. Use education, community feedback or launch-update CTA only.`,
    qa_notes: [
      anonymousPublic
        ? 'PRE-LAUNCH: keep the product unnamed and do not imply that viewers can book/post a ride today.'
        : 'PRE-LAUNCH: do not imply KampusRide is already generally available or that a viewer can book/post a ride today.',
      'TIMELINESS: use only verified IIUM semester/Ta’aruf/event dates from the Knowledge Base; never invent a current campus event.',
      ...pack.qa_notes,
    ],
  };
}
