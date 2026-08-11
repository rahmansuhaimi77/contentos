import type { PlanItem } from './plan-generator';

type PlannerInput = {
  objective: string;
  platforms: string[];
};

type BetaIdea = readonly [string, string, string, string];

const ideas: readonly BetaIdea[] = [
  ['Public · Main Recruitment', 'Beta testers wanted — IIUM Gombak.', 'PUBLIC ANONYMOUS RECRUITMENT. Invite 20 passenger testers and 10 student-driver testers for a new UIA Transporter app. Use “UIA Transporter app” as the familiar community-facing description, but do not use the KampusRide name, logo, screenshots or identifying product details. State clearly that this is a guided simulation only.', 'Message the admin to join. Limited slots.'],
  ['Public · Passenger Recruitment', 'Selalu cari transporter sekitar UIA Gombak?', 'PUBLIC ANONYMOUS RECRUITMENT. Invite passenger testers who can evaluate whether posting a request, comparing options and choosing a driver feels clear. No real trip, fare or payment will occur.', 'Passenger tester berminat? Message admin.'],
  ['Public · Driver Recruitment', 'Student driver UIA Gombak — nak bantu test flow baru?', 'PUBLIC ANONYMOUS RECRUITMENT. Invite student drivers to test request review, offers and selection while safely parked. Do not imply jobs, earnings, real passengers or real driving.', 'Student driver tester berminat? Message admin.'],
  ['Public · Simulation Explainer', 'Simulation-only beta tu maksudnya apa?', 'PUBLIC ANONYMOUS RECRUITMENT. Explain that participants follow guided fictional scenarios inside the app. There are no real trips, no fares, no payment and no obligation to continue after testing.', 'Nak tengok flow dulu? Message admin.'],
  ['Public · Eligibility', 'Siapa boleh join beta test ni?', 'PUBLIC ANONYMOUS RECRUITMENT. Open to the IIUM Gombak community. Separate passenger and student-driver tester roles. Keep screening private with the admin and do not collect sensitive details publicly.', 'Pilih role anda dan message admin.'],
  ['Public · What Testers Do', 'Tak perlu jadi tech expert untuk jadi beta tester.', 'PUBLIC ANONYMOUS RECRUITMENT. Testers only need to follow a short guided scenario, say where they feel confused and report any broken step. Do not reveal the app identity publicly.', 'Boleh bagi honest feedback? Message admin.'],
  ['Public · Final Recruitment', 'Last call: passenger + student driver beta slots.', 'PUBLIC ANONYMOUS RECRUITMENT. Give a final limited-slots reminder for the 20 passenger and 10 student-driver target. Repeat simulation-only, no real trip and no payment.', 'Message admin before recruitment closes.'],
  ['Private · Welcome', 'Welcome to the private testing group.', 'PRIVATE TESTER GROUP. Reveal KampusRide here, thank accepted testers and restate that all activities are guided simulations only. No real ride, payment or live commitment.', 'Reply with your assigned tester role.'],
  ['Private · Ground Rules', 'Sebelum test, baca 5 ground rules ni.', 'PRIVATE TESTER GROUP. Cover respectful conduct, fictional scenario data, no real pickup, no payment, no sharing private group materials and honest issue reporting.', 'React ✅ selepas baca semua rules.'],
  ['Private · Test Setup', 'Quick setup check sebelum simulation bermula.', 'PRIVATE TESTER GROUP. Confirm testers can open KampusRide, understand Passenger and Driver modes and know where to report issues. Avoid collecting passwords, OTPs or sensitive identity data.', 'Reply READY bila setup selesai.'],
  ['Private · Passenger Start', 'Passenger simulation 01: post satu request fiksyen.', 'PRIVATE SIMULATION. Guide passenger testers to create a fictional IIUM route, time and passenger count. Explicitly prohibit using a real immediate trip need.', 'Report step pertama yang rasa tak clear.'],
  ['Private · Driver Start', 'Driver simulation 01: review request masa safely parked.', 'PRIVATE SIMULATION. Guide student-driver testers to inspect a fictional request and judge whether route, time and passenger information are sufficient. No driving occurs.', 'Apa info yang masih missing?'],
  ['Private · Suggested Price', 'Suggested price tu nampak macam guide atau fixed fare?', 'PRIVATE SIMULATION. Test whether passenger and driver understand that the displayed anchor is guidance for a fictional scenario, not a guaranteed or processed fare.', 'Reply: GUIDE / FIXED / CONFUSING.'],
  ['Private · Driver Offer', 'Driver simulation 02: submit fictional offer.', 'PRIVATE SIMULATION. Test the offer form, validation and confirmation state using fictional values. No money changes hands.', 'Berapa tap sampai offer selesai?'],
  ['Private · Passenger Compare', 'Passenger simulation 02: compare beberapa offer.', 'PRIVATE SIMULATION. Ask passenger testers to compare fictional driver options, price, context and reputation signals without implying any safety guarantee.', 'Info mana paling membantu pilihan?'],
  ['Private · Counteroffer', 'Counteroffer flow: jelas atau terlalu banyak step?', 'PRIVATE SIMULATION. Run one fictional negotiation round and check whether both roles understand whose turn it is and what the latest amount means.', 'Screenshot atau describe step yang confusing.'],
  ['Private · Selection', 'Passenger pilih driver — kedua-dua side nampak confirmation yang sama?', 'PRIVATE SIMULATION. Test the selected-match state and make sure other fictional offers resolve clearly. No real driver is dispatched.', 'Passenger + driver confirm apa yang anda nampak.'],
  ['Private · Chat', 'Lepas match, trip context + chat cukup jelas tak?', 'PRIVATE SIMULATION. Exchange only test messages. Check whether route and selected-match context remain visible. Do not share phone numbers or personal details.', 'Apa context yang patut kekal visible?'],
  ['Private · Ride Status', 'Test status flow tanpa bergerak ke mana-mana.', 'PRIVATE SIMULATION. Step through fictional ride statuses while everyone remains stationary. Never encourage app use while driving.', 'Status mana paling ambiguous?'],
  ['Private · Completion', 'Complete + rating flow: useful atau sekadar decoration?', 'PRIVATE SIMULATION. Complete the fictional scenario and test two-sided ratings as accountability context, never as safety certification.', 'Rating tag apa paling practical?'],
  ['Private · Cancellation', 'Simulation edge case: passenger cancel sebelum match.', 'PRIVATE SIMULATION. Test a fictional passenger cancellation and whether the driver receives clear state changes. No real inconvenience occurs.', 'Adakah cancellation reason perlu?'],
  ['Private · Driver Withdrawal', 'Simulation edge case: driver tarik balik offer.', 'PRIVATE SIMULATION. Test fictional offer withdrawal and whether passenger options update clearly.', 'State selepas withdraw jelas tak?'],
  ['Private · No-Show Handling', 'Kalau no-show berlaku, sistem patut record apa?', 'PRIVATE DISCUSSION. Discuss status, evidence and moderation needs using a fictional scenario. Do not claim KampusRide can prevent all no-shows.', 'Cadangkan satu response yang fair.'],
  ['Private · Privacy Review', 'Info apa patut private sebelum dan selepas match?', 'PRIVATE DISCUSSION. Review personal-data exposure, trip context and in-app chat. Do not promise complete protection from abuse.', 'Flag satu privacy concern utama.'],
  ['Private · Accessibility', 'Boleh faham flow ni tanpa founder explain setiap step?', 'PRIVATE RETEST. Ask testers to repeat the core fictional flow with minimal guidance and log every point requiring admin intervention.', 'Reply where you needed help.'],
  ['Private · Bug Triage', 'Top 5 blockers: mana wajib fix dulu?', 'PRIVATE FEEDBACK. Summarise only verified tester findings. Rank core-loop blockers above visual preferences and do not invent metrics.', 'Vote satu blocker paling critical.'],
  ['Private · Passenger Retest', 'Passenger retest: adakah flow sekarang lebih clear?', 'PRIVATE RETEST. Repeat the fictional passenger path after fixes and compare against the previously logged friction points.', 'Mark each issue FIXED / PARTIAL / OPEN.'],
  ['Private · Driver Retest', 'Driver retest: offer flow dah cukup practical?', 'PRIVATE RETEST. Repeat the fictional driver path while safely stationary and verify offer, withdrawal, selection and status feedback.', 'Mark each issue FIXED / PARTIAL / OPEN.'],
  ['Private · Readiness Review', 'Simulation complete — apa yang masih block next phase?', 'PRIVATE REVIEW. Evaluate stability, privacy, support and comprehension. Simulation success does not automatically authorise real rides or public launch.', 'List any remaining no-go issue.'],
  ['Private · Closeout', 'Terima kasih beta testers — next step ikut evidence, bukan hype.', 'PRIVATE CLOSEOUT. Thank the cohort, summarise verified learnings without exposing identities, and state that any next testing or launch phase requires explicit founder approval.', 'Final feedback: satu benda keep, satu benda improve.'],
];

const formats = ['Static ad', 'Carousel', 'WhatsApp text post', '15-30 sec short-form video', 'Talking-head explainer'];

export function isKampusRideSimulationRecruitment(objective: string) {
  return /simulation[- ]only beta recruitment|anonymous public recruitment/i.test(objective);
}

export function buildKampusRideSimulationRecruitmentPlan(input: PlannerInput): PlanItem[] {
  const platforms = input.platforms.length ? input.platforms : ['WhatsApp'];
  return ideas.map(([pillar, hook, concept, cta], index) => ({
    day_number: index + 1,
    pillar,
    objective: input.objective,
    platform: platforms[index % platforms.length],
    format: formats[index % formats.length],
    hook,
    concept,
    cta,
  }));
}
