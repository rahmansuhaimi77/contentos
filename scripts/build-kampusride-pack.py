"""One-off: converts the hardcoded KampusRide banks (extracted to JSON) into a Brand Profile pack.
Kept in the repo so the provenance of every KampusRide exemplar is reviewable."""
import json, sys
src = json.load(open(sys.argv[1])); out_path = sys.argv[2]

PRE = ['controlled_beta', 'beta_driver_onboarding', 'pre_launch', 'stabilisation', 'driver_activation_sprint']
LIVE = ['public_launch', 'launch_week', 'early_growth', 'growth_optimisation', 'retention']

def ex(p, h, c, phases, cta=None):
    e = {'pillar': p, 'hook': h, 'concept': c, 'phases': phases}
    if cta: e['cta'] = cta
    return e

seen = set(); exemplars = []
def add(e):
    if e['hook'] in seen: return
    seen.add(e['hook']); exemplars.append(e)

for p, h, c in src['prelaunch']: add(ex(p, h, c, PRE))
for item in src['campaignBank']: add(ex(item['angle'], item['hook'], item['body'], PRE))
for phase, bank in src['growth'].items():
    for p, h, c, cta in bank: add(ex(p, h, c, [phase], cta))
for p, h, c in src['live']: add(ex(p, h, c, LIVE))
for p, h, c in src['plan']: add(ex(p, h, c, LIVE))

talking_points = [
  {'match': ['type', 'drive', 'driving', 'tengah drive'], 'text': 'Dalam Telegram, driver yang nak secure job kadang rasa kena reply atau nego cepat walaupun tengah bergerak. Itu workflow yang kita tak patut normalize. KampusRide susun ride request dan offer dalam satu tempat supaya driver boleh review bila selamat berhenti — bukan berlumba menaip masa memandu.'},
  {'match': ['chat hilang', 'delete', 'deleted'], 'text': 'Bila passenger dah confirm kemudian mesej hilang, driver boleh kehilangan route/context masa dah bersiap atau tengah menuju pickup. KampusRide jadikan request, selected match, chat dan ride status satu flow supaya kurang bergantung pada DM yang berselerak.'},
  {'match': ['no-show', 'noshow', 'tak muncul'], 'text': 'No-show tetap boleh berlaku di mana-mana platform. Bezanya, KampusRide ada selected match, in-app chat, ride-status flow dan rating/reputation supaya apa yang berlaku tak sekadar hilang dalam private chat. Accountability lebih jelas, bukan safety guarantee.'},
  {'match': ['nego', 'price', 'harga'], 'text': 'Nego dalam banyak DM mudah jadi tak terkawal: siapa offer berapa, siapa dah confirm, siapa masih counter. KampusRide letak suggested price sebagai guide dan kumpulkan offer/counteroffer pada satu ride request. Passenger masih pilih, driver masih boleh offer — cuma flow lebih jelas.'},
  {'match': ['spam', 'scam', 'sexual', 'harass'], 'text': 'Open group dan random DM boleh membuka ruang kepada spam, scam atau sexual harassment. KampusRide tak boleh janji semua abuse akan hilang, tetapi private contact, authenticated account, in-app chat, trip context, reputation dan moderation beri layer accountability yang Telegram ride arrangement tak dibina khusus untuk sediakan.'},
  {'match': ['rules', 'regulated', 'accountable'], 'text': 'Community ride perlukan rules dan accountability, tapi jangan campur-adukkan platform rules dengan legal regulation. KampusRide boleh ada moderation, suspension, trip context dan audit controls. Status undang-undang pula mesti disahkan berasingan — bukan dibuat claim marketing.'},
  {'match': ['female'], 'text': 'Masa buat ride request, pilih female preferred. Bila female driver available, preference itu boleh diprioritikan. Ia preference, bukan guarantee kerana availability boleh berubah.'},
  {'match': ['intro', 'apa sebenarnya', 'what is', 'about kampusride'], 'text': 'KampusRide susunkan cara student UIA cari dan offer transporter dalam satu flow: passenger post ride request, driver hantar offer, passenger compare dan pilih, kemudian coordination kekal dalam app. Komuniti yang sama, cara yang lebih tersusun.'},
  {'match': ['bayar', 'payment', 'fare', 'commission', 'potong'], 'text': 'Passenger bayar fare terus kepada driver yang dipilih. KampusRide tidak pegang atau process fare ride dan tidak potong komisen per ride. App urus request, offer, chat, ride status dan rating.'},
]

pre_guidance = 'KampusRide is NOT yet generally launched. Education, how-to, trust, community listening and launch-update CTAs only. Never show or say that viewers can book or post a ride today.'
phases = []
for key, label in [('controlled_beta', 'Controlled beta'), ('beta_driver_onboarding', 'Beta driver onboarding'), ('pre_launch', 'Pre-launch'), ('stabilisation', 'Stabilisation'), ('driver_activation_sprint', 'Driver activation sprint')]:
    phases.append({'key': key, 'label': label, 'guidance': pre_guidance, 'ctas': src['softCtas'],
                   'replace': [{'pattern': p, 'with': w} for p, w in src['replace']],
                   'qa_notes': ['PRE-LAUNCH: do not imply KampusRide is already generally available or that a viewer can book/post a ride today.']})
live_ctas = src['liveCtas']['passenger'] + src['liveCtas']['driver']
for key, label in [('public_launch', 'Public launch'), ('launch_week', 'Launch week'), ('early_growth', 'Early growth'), ('growth_optimisation', 'Growth optimisation'), ('retention', 'Retention')]:
    phases.append({'key': key, 'label': label, 'guidance': 'KampusRide is live for IIUM Gombak. Practical how-to, real campus situations and both sides of the marketplace. Set realistic supply expectations; never guarantee availability.', 'ctas': live_ctas, 'replace': [], 'qa_notes': []})

calendar = [
  ('2026-08-18', '2026-10-02', 'Semester 1 registration', 'Semester 1 course registration and new-intake registration are active. Use new-semester preparation, route familiarity and community education. Not an official IIUM partnership.'),
  ('2026-10-03', '2026-10-09', 'New-intake registration (final week)', 'New-intake online registration runs through 9 October 2026. Use first-weeks/new-student context only when relevant and do not invent Ta’aruf dates.'),
  ('2026-09-01', '2026-09-11', 'Semester 3 lectures', 'Short-semester lecture period. Use live beta behaviour for learning, not as a proxy for normal-semester demand.'),
  ('2026-09-12', '2026-09-13', 'Semester 3 revision', 'Keep public content lighter and prioritise product stabilisation.'),
  ('2026-09-14', '2026-09-19', 'Semester 3 exams', 'Keep marketing low-pressure; prioritise QA, support and launch readiness.'),
  ('2026-09-20', '2026-09-27', 'Return-to-campus preparation', 'Semester 1 lectures begin 28 September 2026. Do not let the date itself force launch; the product phase is the source of truth.'),
  ('2026-09-28', '2026-11-13', 'Semester 1 first lecture block', 'Prioritise real campus routines, class movement, rain, LRT Gombak, app how-to and practical adoption content.'),
  ('2026-11-14', '2026-11-22', 'Mid-semester break', 'Prioritise balik kampung, luggage, airport/LRT movement, lighter campus demand and travel-prep content.'),
  ('2026-11-23', '2027-01-08', 'Semester 1 second lecture block', 'Return to regular campus routine and utility-led ride content.'),
  ('2027-01-09', '2027-01-13', 'Revision period', 'Keep content concise and utility-first; study/revision movement context rather than heavy promotion.'),
  ('2027-01-14', '2027-02-05', 'Examination period', 'Low-friction logistics and exam mobility; avoid noisy hard-sell content.'),
  ('2027-02-06', '2027-02-21', 'Inter-semester vacation', 'Lighter feedback, retention, community stories and product-improvement content.'),
]
calendar = [{'start': a, 'end': b, 'label': l, 'guidance': g, 'moment': False} for a, b, l, g in calendar]

install_slides = [
  ('How to Install KampusRide 📱', 'Simple cover slide with Android and iPhone visual cues and the approved KampusRide app icon.', 'Tak perlu cari dekat App Store atau Play Store. Install terus dari browser.'),
  ('Android: open in Chrome', 'Android phone showing KampusRide opened in Google Chrome.', 'Buka KampusRide menggunakan Google Chrome.'),
  ('Android: install app', 'Chrome three-dot menu with Install app highlighted.', 'Tap ⋮ → Install app → Install. KampusRide akan muncul dekat Home Screen.'),
  ('iPhone: add to Home Screen', 'Safari share sheet with Add to Home Screen highlighted.', 'Buka KampusRide dalam Safari → Share → Add to Home Screen → Open as Web App → Add.'),
  ('Enable notifications 🔔', 'Notification permission prompt with Allow highlighted.', 'Buka KampusRide dan tap Allow bila notification permission keluar. Ini penting untuk driver offer, ride updates dan trip status.'),
  ('Done ✅', 'Home Screen with the approved KR app icon installed.', 'KampusRide dah ready dekat Home Screen. From Campus, For You.'),
]
install_cta = 'Install KampusRide, add to Home Screen dan enable notifications supaya tak terlepas ride updates.'
modes = [
  {'key': 'install_tutorial', 'label': 'Install + notifications tutorial',
   'match': ['install', 'add to home screen', 'enable notification', 'home screen'],
   'instructions': 'Public onboarding tutorial. Follow the six fixed slides exactly. Not a general introduction, not a Telegram comparison, not a launch announcement.',
   'example_request': 'Create a public how-to showing students how to install KampusRide on Android and iPhone, then enable notifications.',
   'qa_notes': ['Do not turn this into a general KampusRide introduction or Telegram comparison.', 'Use approved KampusRide logo/app icon and real screenshots where available.', 'Do not claim App Store/Play Store availability while KampusRide is installed as a web app/PWA.'],
   'fixed': {'hook': 'Nak install KampusRide? Senang je 📱',
             'script': '\n\n'.join(f'SLIDE {i+1} — {t.upper()}\n{x}' for i, (t, v, x) in enumerate(install_slides)),
             'caption': 'Nak letak KampusRide dekat Home Screen? Senang je 👇\n\nAndroid: Chrome → ⋮ → Install app → Install ✅\niPhone: Safari → Share → Add to Home Screen → Open as Web App → Add ✅\n\nLepas install, buka KampusRide dan tap Allow bila notification permission keluar 🔔\n\nSupaya tak terlepas driver offer, ride updates dan trip status.\n\n' + install_cta,
             'cta': install_cta,
             'slides': [{'title': t, 'visual': v, 'text': x} for t, v, x in install_slides]}},
  {'key': 'simulation_recruitment', 'label': 'Simulation-only beta recruitment (30 days)',
   'match': ['simulation[- ]only beta recruitment', 'anonymous public recruitment'],
   'instructions': 'Public items: keep the product completely anonymous (no name, logo, screenshots, palette, website or QR). Call it a "new UIA Transporter app". State clearly: guided simulation only, no real trips, fares or payments. Private items: KampusRide may be named; every activity is simulation-only.',
   'example_request': 'Simulation-only beta recruitment: 20 passenger testers and 10 student-driver testers at IIUM Gombak.',
   'qa_notes': ['Public recruitment must not reveal the product identity in text or visuals.', 'Do not use any supplied brand assets, screenshots, icons or brand colours in public recruitment.', 'State clearly that this is a guided simulation with no real trips, fares or payments.', 'Do not imply official IIUM endorsement or invent contact details.'],
   'plan_sequence': [{'pillar': p, 'hook': h, 'concept': c, 'cta': cta} for p, h, c, cta in src['beta']]},
]

pack = {
  'version': 1, 'slug': 'kampusride',
  'summary': 'KampusRide is a campus-made ride marketplace for the IIUM Gombak community. It keeps the existing peer-to-peer transporter culture but structures it: passenger posts one request → drivers send offers → passenger compares and chooses → in-app chat → ride → two-sided rating. Fares are paid directly to the driver; KampusRide does not process fares or take a per-ride commission.',
  'language': {'default': 'Bahasa Melayu / natural Manglish', 'guidance': 'Write like an IIUM student talking to friends: natural BM with Manglish where it sounds human. Campus-native references (mahallah, kulliyyah, LRT Gombak, class 8AM, rain). Never corporate.'},
  'audiences': [
    {'key': 'passenger', 'name': 'Passengers', 'description': 'IIUM Gombak students who need rides around campus, to LRT Gombak, balik kampung or events.', 'ctas': src['liveCtas']['passenger']},
    {'key': 'driver', 'name': 'Student drivers', 'description': 'Students with a car who offer rides when free. Never promise jobs or earnings.', 'ctas': src['liveCtas']['driver']},
  ],
  'pillars': [
    {'name': 'Telegram reality', 'goal': 'One specific real pain in the current Telegram transporter workflow, then the structural KampusRide advantage. Telegram is the old workflow, not the enemy.', 'weight': 3},
    {'name': 'IIUM life', 'goal': 'A recognisable campus situation (class, rain, LRT, exams, events, balik kampung).', 'weight': 3},
    {'name': 'How it works', 'goal': 'Teach one step of the passenger or driver flow clearly.', 'weight': 2},
    {'name': 'Trust & accountability', 'goal': 'Explain ratings, privacy, female preference or rules honestly, including limits.', 'weight': 2},
    {'name': 'Community', 'goal': 'Build in public, listen, ask genuine questions.', 'weight': 1},
  ],
  'exemplars': exemplars,
  'talking_points': talking_points,
  'phase': {'current': 'pre_launch', 'options': phases},
  'calendar': calendar,
  'channels': [
    {'platform': 'Threads', 'role': 'Main conversation channel with the IIUM community', 'tone': 'Real observation or opinion, soft sell, end with one genuine question', 'formats': ['Threads text post', 'Conversation starter', 'Mini-story / opinion post', 'Question-led post'], 'ctas': src['liveCtas']['threads'], 'manual': False},
    {'platform': 'TikTok / Reels', 'role': 'Reach new students', 'tone': 'Campus UGC/POV, casual, fast hook', 'formats': ['15-30 sec short-form video', 'UGC / POV video', 'Talking-head explainer'], 'manual': False},
    {'platform': 'Instagram carousel', 'role': 'Saveable how-to and explainers', 'tone': 'Clean, instructional', 'formats': ['Carousel', 'Static ad'], 'manual': False},
    {'platform': 'WhatsApp', 'role': 'Tester and community groups', 'tone': 'Direct, short', 'formats': ['WhatsApp text post'], 'manual': True},
  ],
  'claims': {
    'never': ['official IIUM endorsement', 'guaranteed safety or that no-shows, scams or harassment are prevented', 'guaranteed female driver (it is a preference)', 'guaranteed ride availability, jobs or earnings', 'APAD approval, licensed e-hailing status or settled legal/regulatory status', 'fixed or cheapest fares (the suggested price is a guide)', 'invented user, ride, rating or driver counts', 'that every driver is an IIUM student or document-verified', 'that KampusRide employs drivers, owns vehicles, processes fares or takes a per-ride commission'],
    'always': ['Drivers only check or respond when safely stopped; never show phone use while a vehicle is moving.', 'Treat the Telegram transporter community with respect.', 'One product idea and one CTA per piece.'],
  },
  'visual': {'setting': 'Authentic Malaysian university campus life at IIUM Gombak: mahallah, kulliyyah, walkways, LRT Gombak, rain, natural daylight, modest student styling, believable smartphone use.', 'rules': ['Use the supplied official KampusRide logo exactly; never redraw it. Without a logo asset use the wordmark as plain text.', 'Use approved real KampusRide screenshots as UI references; never invent unsupported screens.', 'No IIUM logo or official marks unless separately approved.', 'Chats shown on screen must be fictional and anonymised.']},
  'modes': modes,
  'qa_notes': ['Use the real Telegram pain point specifically; do not reduce every comparison to "too many DMs".', 'Do not attack or shame the IIUM transporter community.', 'Keep Malay/Manglish natural, campus-native and short enough for the format.'],
  'links': {},
}
json.dump(pack, open(out_path, 'w'), ensure_ascii=False, indent=1)
print('exemplars', len(exemplars), 'phases', len(phases), 'calendar', len(calendar), 'modes', len(modes))
