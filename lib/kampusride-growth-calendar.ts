import type { PlanItem } from './plan-generator';

export type GrowthProfile = {
  current_phase: string;
  marketplace_need: string;
  target_launch_start: string | null;
  target_launch_end: string | null;
};

export type GrowthCalendarItem = {
  start_date: string;
  end_date: string;
  phase: string;
  academic_phase: string;
  title: string;
  objective: string;
  audience_focus: string;
  marketplace_need: string;
  content_mix: string[];
  ops_priorities: string[];
  success_gates: string[];
};

type Idea = readonly [string, string, string, string];

const banks: Record<string, readonly Idea[]> = {
  controlled_beta: [
    ['Beta · Intro', 'KampusRide beta minggu ni — apa sebenarnya kita nak test?', 'Explain that this is a controlled beta: validate the full ride loop with real students, find friction and fix it before public launch.', 'Beta tester — kalau jumpa benda confusing, bagitahu terus.'],
    ['Beta · Passenger', 'Passenger beta: post → offer → pilih. Dekat mana flow paling senang sangkut?', 'Walk through the passenger beta journey and explicitly invite testers to flag unclear steps instead of selling the app as finished.', 'Passenger tester — step mana paling confusing?'],
    ['Beta · Driver', 'Driver beta: request masuk → offer → tunggu passenger pilih. Clear tak?', 'Teach the driver beta flow and reinforce that drivers only review/respond when safely stopped.', 'Driver tester — flow offer ni clear tak?'],
    ['Beta · Learning', 'Beta bukan cari pujian. Kita nak cari benda yang rosak.', 'Build in public: explain that useful beta feedback is bugs, confusion, no-show/cancel friction and missing context, not vanity compliments.', 'Kalau boleh break satu flow, cuba break masa beta.'],
    ['Beta · Chat', 'Dah match, chat + trip context cukup clear tak?', 'Test whether selected-match context and in-app chat give both sides enough information to coordinate a real ride.', 'Tester — info apa lagi patut nampak lepas match?'],
    ['Beta · Trust', 'Cancel / no-show masa beta: sistem patut handle macam mana?', 'Use beta to learn what status, record and moderation signals are needed when a driver or passenger cancels or no-shows. Do not promise prevention.', 'Apa response paling fair bila no-show berlaku?'],
    ['Beta · Completion', 'Ride dah habis — rating tu betul-betul useful ke?', 'Test the end of the loop: completion and two-sided reputation. Explain rating as accountability context, not safety certification.', 'Tester — rating/tag apa paling useful?'],
  ],
  beta_driver_onboarding: [
    ['Driver Onboarding', 'KampusRide tengah cari driver beta — bukan kejar angka, kita nak driver yang betul-betul test flow.', 'Invite a controlled driver cohort and explain the purpose: validate supply, offer flow and real campus use cases before launch.', 'Driver kampus yang nak test — follow update onboarding.'],
    ['Driver How-To', 'Bila free dan safely parked, baru check ride request.', 'Show the driver workflow from Driver mode to offer and selection while keeping the no-phone-while-moving rule explicit.', 'Driver kampus — flow ni lagi practical tak?'],
    ['Driver Value', 'Tak perlu camp group sepanjang masa semata-mata takut terlepas request.', 'Explain the intended structured ride-demand feed without promising job volume or earnings.', 'Apa part cari job sekarang paling makan attention?'],
    ['Driver Offers', 'Offer satu ride patut ambil berapa banyak step?', 'Ask drivers to pressure-test offer, counteroffer and selected-match friction during beta.', 'Driver beta — berapa tap masih rasa reasonable?'],
    ['Driver Supply', 'Registered driver ramai tak semestinya ride senang dapat.', 'Educate on active supply: what matters is whether suitable drivers are actually available in the right route/time windows.', 'Route/time mana driver selalu available?'],
    ['Driver Reputation', 'Rating driver bukan decoration — tapi jangan jadikan fake safety badge.', 'Explain practical reputation signals such as punctuality, respectful behaviour and clear pickup while keeping claims careful.', 'Tag apa paling fair untuk driver?'],
    ['Beta Learning', 'Minggu kedua beta: benda apa kita patut fix dulu?', 'Share a build-in-public learning loop without publishing invented metrics. Prioritise real tester feedback and blockers.', 'Tester — satu fix paling urgent apa?'],
  ],
  pre_launch: [
    ['App Intro', 'KampusRide ni sebenarnya apa?', 'Introduce the app simply: same IIUM ride community, more structured request → offers → choose → chat → ride → rate workflow.', 'Follow KampusRide untuk launch updates.'],
    ['Why KampusRide', 'Kalau Telegram dah ada, kenapa nak buat KampusRide?', 'Respect Telegram for creating the community, then explain ride-specific workflow gaps such as scattered DMs, confirmation, privacy and accountability.', 'Current transporter flow paling messy dekat mana?'],
    ['Passenger How-To', 'Kalau nak ride nanti, passenger flow macam mana?', 'Teach the future passenger flow without implying public availability before the manual launch phase is advanced.', 'Save post ni untuk launch nanti.'],
    ['Driver How-To', 'Driver kampus pula guna KampusRide macam mana?', 'Teach Driver mode, offers and selection with the safety rule that interaction happens only when safely stopped.', 'Driver kampus — flow macam ni lagi senang tak?'],
    ['Trust', 'Female preferred driver tu preference, bukan guarantee.', 'Explain the female-driver preference clearly and transparently while acknowledging supply limitations.', 'Female passenger — wording macam ni clear tak?'],
    ['Privacy', 'Cari transporter tak semestinya kena expose nombor dekat ramai orang.', 'Explain in-app trip context and reduced random contact exposure without promising complete protection from abuse.', 'Apa privacy concern paling besar sekarang?'],
  ],
  stabilisation: [
    ['Stabilisation', 'Exam week = kurang hype, lebih banyak fixing.', 'Keep public marketing lighter while the team uses the exam window for QA, bug fixing, support readiness and launch checks.', 'Kita tengah kemaskan benda penting sebelum launch.'],
    ['Launch QA', 'Sebelum launch, “boleh guna” tak cukup — core flow kena reliable.', 'Explain the go/no-go mindset: request, offer, match, chat, completion, cancellation and support must work reliably.', 'Apa satu benda yang korang tak boleh tolerate masa first use?'],
    ['Trust', 'Launch date tak patut menang lawan product readiness.', 'Build trust by saying the team will not force launch if a serious product, safety or privacy blocker remains.', 'Reliable dulu, hype kemudian.'],
    ['FAQ', 'KampusRide launch nanti — apa yang patut korang expect, dan apa yang tak patut?', 'Set realistic expectations around peer-to-peer supply, fare negotiation, female-driver preference and platform limitations.', 'Drop soalan yang korang nak kami jawab sebelum launch.'],
  ],
  driver_activation_sprint: [
    ['Driver Activation', 'Semester nak start. Driver supply kena ready sebelum passenger demand naik.', 'Activate already-onboarded drivers and focus on real route/time availability rather than registration counts.', 'Driver kampus — update bila korang usually available.'],
    ['Coverage', 'Mahallah ↔ kulliyyah, LRT Gombak, class rush — route mana perlukan coverage?', 'Use familiar campus movements to identify driver supply gaps before public demand is pushed.', 'Driver — route mana paling ngam dengan routine korang?'],
    ['Driver Refresher', 'Offer → selected → chat → ride. Quick refresher sebelum launch.', 'Give drivers a concise pre-launch workflow refresher and reinforce safe phone use.', 'Readykan Driver mode sebelum semester start.'],
    ['Readiness', 'Passenger acquisition boleh tunggu 2 hari. Supply kosong tak boleh.', 'Explain why marketplace supply is being activated first without making claims about guaranteed availability.', 'Driver kampus — follow launch update.'],
  ],
  public_launch: [
    ['Launch', 'KampusRide dah dibuka untuk IIUM Gombak.', 'Public-launch announcement only when the manual product phase has actually been advanced to public launch or later. Explain the core flow and set realistic supply expectations.', 'Open KampusRide dan cuba post ride pertama anda.'],
    ['Launch How-To', 'First time guna KampusRide? 20 saat je untuk faham flow.', 'Practical passenger how-to: request, offers, compare, choose and chat. Keep claims factual.', 'Post ride bila perlukan transporter.'],
    ['Return to Campus', 'Balik campus weekend ni? Ride flow tak semestinya kena start dengan 6 DM.', 'Tie launch to return-to-campus mobility without claiming IIUM endorsement or guaranteed supply.', 'Check KampusRide bila dah kembali campus.'],
    ['Driver Launch', 'Driver kampus: Semester 1 nak start — Driver mode dah ready?', 'Activate drivers around real availability and route fit, not income promises.', 'Offer bila anda free dan safely stopped.'],
  ],
  launch_week: [
    ['Week 1', 'Class start. Mahallah jauh. Ride request kena clear.', 'Use first-week class movement to teach clear pickup, drop-off and time details.', 'Post request yang lengkap supaya driver senang evaluate.'],
    ['LRT Gombak', 'LRT Gombak ↔ UIA: one request, compare offer.', 'Use a familiar route to demonstrate the live flow without inventing fares.', 'Check available offers dalam satu request.'],
    ['Rain', 'Hujan + class rush: lagi penting info pickup clear.', 'Practical rainy-day content focused on request quality and realistic availability.', 'Letak pickup point + masa dengan jelas.'],
    ['How-To', 'Driver bagi offer. Passenger tak wajib accept first one.', 'Explain offer comparison and counteroffer mechanics clearly.', 'Compare dulu, pilih yang sesuai.'],
    ['Trust', 'No-show masih boleh berlaku. Bezanya, sekarang ada trip context + reputation.', 'Set realistic accountability expectations after launch without implying the platform eliminates bad behaviour.', 'Rate dengan fair selepas ride.'],
    ['Driver', 'Driver student pun ada class. Availability memang berubah ikut masa.', 'Humanise supply and encourage passengers to plan while avoiding guarantees.', 'Kalau boleh, post request lebih awal.'],
    ['Week 1 Learning', 'Week 1: benda mana KampusRide masih kena improve?', 'Ask for live user feedback and make product iteration visible.', 'Drop satu feedback paling useful.'],
  ],
  early_growth: [
    ['Growth · Liquidity', 'Banyak signup tak guna kalau request tak dapat offer.', 'Teach the marketplace principle: optimise active supply, time-to-first-offer and match quality instead of vanity registrations.', 'Route/time mana masih susah dapat offer?'],
    ['Growth · Passenger', 'Kalau driver supply okay tapi request kurang, passenger side pula kita push.', 'Build in public around balancing both sides of the marketplace without publishing invented metrics.', 'Use case apa patut KampusRide cover lebih banyak?'],
    ['Growth · Driver', 'Kalau request banyak tapi driver kurang, marketing driver dulu.', 'Explain the adaptive growth approach: acquire whichever side is constrained.', 'Driver kampus — route/time mana korang boleh cover?'],
    ['UGC', 'Cerita ride sebenar lagi useful daripada iklan generic.', 'Invite real, permissioned user stories once there is genuine post-launch evidence. Never fabricate testimonials.', 'Ada experience useful? Share dengan permission.'],
    ['Retention', 'First ride bagus. Second ride lagi penting.', 'Shift focus from launch downloads toward repeat use and habit.', 'Apa yang buat korang guna balik platform yang sama?'],
    ['Community', 'Same IIUM ride community. Sekarang kita optimise flow based on real use.', 'Community-first growth recap grounded in actual feedback and operational learning.', 'Keep the feedback coming.'],
  ],
};

function daysBetween(start: string, end: string) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.max(0, Math.floor((b - a) / 86400000));
}

const phaseRank: Record<string, number> = {
  controlled_beta: 1,
  beta_driver_onboarding: 2,
  pre_launch: 3,
  stabilisation: 4,
  driver_activation_sprint: 5,
  public_launch: 6,
  launch_week: 7,
  early_growth: 8,
  growth_optimisation: 9,
  retention: 10,
};

export function applyKampusRideGrowthCalendar(
  item: PlanItem,
  plannedDate: string,
  calendar: GrowthCalendarItem[],
  profile: GrowthProfile | null,
): PlanItem {
  const window = calendar.find((row) => plannedDate >= row.start_date && plannedDate <= row.end_date);
  if (!window) return item;
  const bank = banks[window.phase] || [];
  const idea = bank.length ? bank[daysBetween(window.start_date, plannedDate) % bank.length] : null;
  const futurePhaseNeedsManualApproval = profile && (phaseRank[window.phase] || 0) >= phaseRank.public_launch && (phaseRank[profile.current_phase] || 0) < phaseRank.public_launch;
  const guardrail = futurePhaseNeedsManualApproval
    ? ' FUTURE LAUNCH GUARDRAIL: This is roadmap content only. Do not state the app is publicly live unless the manual Product Phase has been advanced to Public Launch or later.'
    : '';
  const growthContext = ` Growth context (${plannedDate}): ${window.title}. Academic context: ${window.academic_phase}. Marketplace priority: ${window.marketplace_need}. Strategic objective: ${window.objective}.${guardrail}`;

  if (!idea) return { ...item, objective: window.objective, concept: `${item.concept}${growthContext}` };
  return {
    ...item,
    pillar: idea[0],
    objective: window.objective,
    hook: idea[1],
    concept: `${idea[2]}${growthContext}`,
    cta: idea[3],
  };
}
