export type PlanKnowledgeItem = { kind: string; title: string; content: string };

export type PlanItem = {
  day_number: number;
  pillar: string;
  objective: string;
  platform: string;
  format: string;
  hook: string;
  concept: string;
  cta: string;
};

type PlannerInput = {
  brandName: string;
  objective: string;
  platforms: string[];
  language: string;
  cta?: string;
};

const sewaProIdeas = [
  ['Pain Point', 'Dah WhatsApp banyak rental, semua reply full?', 'Tunjukkan betapa lecehnya contact banyak seller satu-satu, kemudian perkenalkan flow SewaPro: bagi requirement sekali, kami bantu semak pilihan.'],
  ['Convenience', 'Tarikh, lokasi, kereta. Bagi sekali je.', 'Terangkan tiga detail asas yang customer boleh hantar supaya SewaPro boleh mula semak pilihan partner yang sesuai.'],
  ['Comparison', 'Nak sewa kereta tak perlu buka 10 chat.', 'Buat perbandingan old way vs SewaPro way: banyak chat dan repeated question berbanding satu request dengan pilihan yang disenarai pendek.'],
  ['Use Case', 'Kereta masuk workshop? Jangan tambah satu lagi headache.', 'Sasarkan customer yang perlukan replacement car sementara dan tunjuk bagaimana SewaPro bantu shortlist pilihan rental.'],
  ['Use Case', 'Trip family dah dekat, kereta masih belum settle?', 'Situasi family trip: minta jumlah penumpang, luggage, tarikh dan lokasi sebelum cadangkan kategori yang sesuai.'],
  ['Trust', 'Harga murah belum tentu pilihan paling sesuai.', 'Educate customer supaya semak jenis kereta, detail booking, lokasi dan availability yang confirmed — bukan headline price sahaja.'],
  ['Traveller', 'Landing KL dan perlukan kereta? Bagi detail sebelum sampai.', 'Content untuk traveller yang mahu semak pilihan rental sebelum tiba di Kuala Lumpur.'],
  ['Education', 'Tak pasti nak pilih Sedan, MPV atau SUV?', 'Panduan ringkas berdasarkan jumlah penumpang, luggage, jenis perjalanan dan bajet tanpa mereka-reka harga.'],
  ['Positioning', 'Satu request. Beberapa pilihan. Anda pilih.', 'Terangkan SewaPro sebagai car-rental finder, bukan pemilik fleet sendiri.'],
  ['Trust', 'Sebelum transfer deposit, confirm benda ni dulu.', 'Checklist: tarikh, kategori/model, total harga, pickup/delivery dan availability yang sudah disahkan.'],
  ['FAQ', 'SewaPro ada kereta sendiri ke?', 'Jawab dengan jelas: SewaPro match customer dengan rental partner dan bantu urus pengalaman booking.'],
  ['FAQ', 'Boleh request model kereta tertentu?', 'Terangkan bahawa customer boleh request model/kategori pilihan tetapi availability akhir perlu disemak dengan partner.'],
  ['FAQ', 'Berapa cepat SewaPro boleh bagi pilihan?', 'Terangkan bahawa kelajuan response bergantung pada availability partner dan elakkan janji instant confirmation.'],
  ['Objection', '“Aku boleh cari sendiri kat Facebook.” Betul. Tapi…', 'Akui customer memang boleh cari sendiri, kemudian tunjuk masa dan friction yang SewaPro boleh kurangkan.'],
  ['Objection', 'Kenapa tak terus contact rental company je?', 'Terangkan value satu point of contact untuk semak beberapa partner option tanpa ulang requirement banyak kali.'],
  ['Education', '3 benda bagi awal kalau nak cepat semak kereta.', 'Ajar customer hantar tarikh sewa, lokasi dan kategori/bajet dalam mesej pertama.'],
  ['Education', 'MPV untuk 6 orang: jangan tengok seat sahaja.', 'Terangkan faktor luggage dan keselesaan apabila pilih MPV tanpa menjanjikan model tertentu.'],
  ['Relatable', 'Group family dah confirm trip. Kereta je belum.', 'Situasi relatable dalam family group chat yang berakhir dengan satu request kepada SewaPro.'],
  ['Relatable', 'Bila seller pertama cakap “full”… seller kedua pun “full”.', 'Sequence ringan/humorous tentang repeated unavailable replies sebelum memperkenalkan SewaPro finder proposition.'],
  ['Process', 'Apa jadi lepas anda WhatsApp SewaPro?', 'Step-by-step: bagi requirement → SewaPro semak partner → shortlist → customer review → booking confirmation.'],
  ['Trust', 'Availability bukan benda yang patut kita teka.', 'Tekankan bahawa SewaPro hanya anggap availability sebagai confirmed selepas semakan dengan rental partner.'],
  ['Trust', 'Posting harga lama ≠ harga booking hari ni.', 'Terangkan kenapa tarikh, season dan supplier availability boleh mempengaruhi harga dan kenapa final price perlu disahkan.'],
  ['Use Case', 'Balik kampung tapi kereta sendiri tak cukup besar?', 'Use case untuk family/luggage lebih banyak; fokus pada mencari kategori yang sesuai melalui network partner.'],
  ['Use Case', 'Kereta kedua untuk event atau kerja beberapa hari?', 'Sasarkan keperluan short-term untuk kerja/event tanpa membuat claim corporate contract yang tidak disahkan.'],
  ['Traveller', 'Airport trip + family + luggage: kereta apa sesuai?', 'Bantu customer fikir kategori kereta berdasarkan jumlah orang dan luggage.'],
  ['Social Proof', 'Apa yang customer sebenarnya nak bila cari rental?', 'Fokus pada trust factor sebenar: detail jelas, responsive communication, pilihan sesuai dan availability confirmed — tanpa fake testimonial.'],
  ['Conversion', 'Nak kami tolong semak? Hantar 4 benda ni.', 'Direct-response post: tarikh, lokasi, kereta/kategori pilihan dan bajet.'],
  ['Conversion', 'Weekend ni perlukan kereta? Start dengan requirement, bukan scroll.', 'Content CTA yang kuat tetapi tanpa fake scarcity atau guaranteed availability.'],
  ['Brand', 'SewaPro bukan “another rental page”.', 'Founder-style positioning: kenapa SewaPro wujud dan bagaimana model finder/matching memudahkan customer.'],
  ['Recap', '30 saat: cara paling simple guna SewaPro.', 'Recap flow penuh SewaPro dengan CTA WhatsApp dan reminder bahawa harga serta availability perlu disahkan.'],
] as const;

const kampusRideIdeas = [
  ['Pain Point', 'Dah post transporter, lepas tu kena buka 6 DM?', 'POV student post ride dalam group, kemudian banyak chat masuk serentak. Contrast dengan KampusRide: post sekali, semua offer duduk satu tempat untuk compare.'],
  ['Product Education', 'Post sekali. Compare semua offer satu tempat.', 'Tunjuk flow mudah: post route → driver offer → compare price/reputation → pilih → chat.'],
  ['Driver Growth', 'Driver kampus: tak perlu camp Telegram tunggu job.', 'Tunjuk driver asyik refresh group, kemudian switch ke Driver mode dan check ride demand bila free. Jangan janji jumlah job atau income.'],
  ['Privacy', 'Nak cari ride tak semestinya kena bagi nombor phone.', 'Explain bahawa coordination boleh dibuat dalam in-app chat dan nombor phone tak perlu diberi kepada setiap orang yang DM.'],
  ['Relatable', 'Class 8AM. Hujan. Mahallah jauh. 😭', 'Campus skit yang relatable: student tengok hujan + jam, kemudian post ride. Product appearance ringan dan natural.'],
  ['How It Works', 'KampusRide works macam mana dalam 20 saat?', 'Screen-record real app flow dari Passenger mode: pilih route/time/pax, post request, offers appear, choose one, chat.'],
  ['Female Preference', 'Prefer female driver? Letak preference.', 'Explain bahawa passenger boleh set driver gender preference. Matching bergantung pada availability dan tidak guaranteed.'],
  ['Driver Lifestyle', 'Free 30 minit sebelum class? Switch Driver mode.', 'Show student driver dengan free window check ride demand. Offer hanya bila available. No earnings promise.'],
  ['Reputation', 'Cheapest bukan satu-satunya benda nak compare.', 'Show price + rating + car details + reputation tags + offer note as decision inputs.'],
  ['Price Education', 'Ride dalam UIA RM3, RM4, RM5 — price guide tu macam mana?', 'Explain suggested price anchor sebagai guide berdasarkan route/community rate, bukan guaranteed fixed fare.'],
  ['Relatable', 'Bila dah pilih driver… tapi 5 orang lagi DM “still need?”', 'Comedy tentang old group workflow, kemudian tunjuk KampusRide organise offers dan selection dalam satu flow.'],
  ['Multi Stop', 'Nak pickup member dulu sebelum pergi? Add stop.', 'Demo intermediate stop dalam ride request. Driver nampak stops sebelum offer. Jangan promise extra stop free.'],
  ['Use Case', 'Nak ke LRT Gombak? Post route, biar driver offer.', 'Common external-trip scenario: destination → price guide → offers → passenger chooses.'],
  ['Trust', 'Driver boleh rate passenger juga? Yes.', 'Explain accountability works both ways dan passenger pun boleh build reputation.'],
  ['Privacy', 'Apa driver boleh nampak — dan apa yang dia tak perlu nampak.', 'Explain enough ride/profile context to offer while personal phone details stay private.'],
  ['Driver Value', 'Fare anda, anda keep. KampusRide tak potong per ride.', 'Explain peer-to-peer fare and no per-ride commission. Do not publish unconfirmed subscription price.'],
  ['Positioning', 'KampusRide bukan “Grab versi kampus”.', 'Explain community cost-sharing marketplace: passenger posts, drivers offer, passenger chooses, direct fare.'],
  ['New Student', 'Tak kenal semua mahallah lagi? Takpe.', 'Show current IIUM place list/search helping newer students choose common campus locations.'],
  ['Notifications', 'Tak payah refresh group tiap 2 minit.', 'Show push notification when an offer/message arrives. Emphasise less manual checking.'],
  ['Driver Reputation', 'Rating anda ikut anda — bukan hilang dalam chat lama.', 'Explain on-platform rating/reputation history. Do not guarantee more jobs.'],
  ['Passenger Choice', 'Offer murah belum tentu offer yang anda nak pilih.', 'Show multiple offers and passenger control over the final choice.'],
  ['Accountability', 'Apa beza ride community yang “tersusun”?', 'Compare scattered anonymous workflow vs profiles, in-app chat, trip record, ratings and moderation.'],
  ['Dual Mode', 'Pagi passenger. Petang driver.', 'Show one user switching between Passenger and Driver modes through a normal campus day.'],
  ['Relatable', 'Kawan: “boleh tumpang?” Aku: “post KampusRide je 😂”', 'Light campus comedy that ends with a quick app shot rather than a hard sell.'],
  ['FAQ', 'Bayar dekat KampusRide ke driver?', 'Answer clearly: passenger pays selected driver directly; KampusRide does not process the ride fare.'],
  ['FAQ', 'Semua driver mesti student UIA ke?', 'Explain carefully that the pool can be mixed; do not claim all drivers are IIUM students or formally document-verified.'],
  ['Female Preference', 'Female preferred ≠ female guaranteed.', 'Set expectation clearly: preference helps prioritise female drivers when available; supply may be limited.'],
  ['Brand', 'Satu request. Satu tempat. Sampai ride selesai.', 'Montage the full lifecycle: post → offer → choose → chat → en route → arrived → complete → rate.'],
  ['Driver Growth', 'Ada kereta dan selalu drive sekitar UIA?', 'Driver recruitment: offer rides when free, see demand, keep direct fare, build reputation. No guaranteed-job claim.'],
  ['Community', 'Ride community, tapi lebih tersusun.', 'Brand montage featuring real campus moments and both passenger/driver perspectives.'],
] as const;

const genericPillars = ['Pain Point','Education','Use Case','Trust','FAQ','Comparison','Convenience','Conversion'];
const formats = ['15-30 sec short-form video','UGC / POV video','Talking-head explainer','Carousel','Static ad','WhatsApp-ready post'];
const threadsFormats = ['Threads text post','Conversation starter','Mini-story / opinion post','Question-led post'];
const sewaProCtas = [
  'Nak semak kereta? WhatsApp SewaPro dengan tarikh, lokasi dan kereta pilihan.',
  'Hantar tarikh + lokasi + kategori kereta. Kami bantu semak pilihan yang sesuai.',
  'Tak pasti kategori mana sesuai? WhatsApp SewaPro dan bagi detail trip anda.',
  'Simpan dulu. Bila dah ready, hantar requirement dekat SewaPro untuk kami semak.',
  'Nak compare tanpa buka banyak chat? Hantar requirement sekali dekat SewaPro.',
  'WhatsApp SewaPro untuk semak pilihan semasa — harga dan availability akan disahkan dahulu.',
];
const kampusRideCtas = [
  'Post ride anda dalam KampusRide.',
  'Check offer dalam satu tempat, kemudian pilih.',
  'Cuba KampusRide untuk ride seterusnya.',
  'Switch ke Driver mode bila anda free.',
  'Check ride yang tengah cari driver.',
  'Save dulu — guna KampusRide bila perlukan ride.',
];
const sewaProThreadsCtas = [
  'Pernah kena situasi macam ni masa cari kereta sewa?',
  'Kalau korang sewa kereta, benda pertama korang check apa?',
  'Team cari satu-satu atau prefer bagi requirement sekali?',
  'Apa part paling leceh bila cari kereta rental?',
];
const kampusRideThreadsCtas = [
  'Student UIA — korang biasa cari ride macam mana sekarang?',
  'Passenger: part paling leceh bila cari transporter apa?',
  'Driver kampus: korang paling penat part mana bila cari ride request?',
  'Kalau feature ni ada masa korang perlukan ride, useful tak?',
];

function isThreads(platform: string) {
  return /threads/i.test(platform);
}

function formatForPlatform(platform: string, index: number) {
  return isThreads(platform) ? threadsFormats[index % threadsFormats.length] : formats[index % formats.length];
}

function conceptForPlatform(platform: string, concept: string) {
  if (!isThreads(platform)) return concept;
  return `${concept} Untuk Threads, tulis sebagai observation/opinion yang natural dan conversational, bukan iklan keras. Buka dengan satu sharp thought, beri satu useful point, kemudian invite meaningful response.`;
}

export function buildThirtyDayPlan(input: PlannerInput, knowledge: PlanKnowledgeItem[]): PlanItem[] {
  const ctaFromKnowledge = knowledge.find((item) => item.title.toLowerCase() === 'preferred cta')?.content;
  const fallbackCta = input.cta || ctaFromKnowledge || 'Contact us to check suitable options.';
  const lowerName = input.brandName.toLowerCase();
  const isSewaPro = lowerName.includes('sewapro');
  const isKampusRide = lowerName.includes('kampusride');
  const isMalay = /bahasa|melayu|manglish/i.test(input.language);
  const platforms = input.platforms.length ? input.platforms : ['TikTok / Reels'];

  if (isSewaPro) {
    return sewaProIdeas.map(([pillar, hook, concept], index) => {
      const platform = platforms[index % platforms.length];
      return {
        day_number: index + 1,
        pillar,
        objective: index % 5 === 4 ? 'Conversion' : input.objective,
        platform,
        format: formatForPlatform(platform, index),
        hook,
        concept: conceptForPlatform(platform, concept),
        cta: isThreads(platform) && isMalay
          ? sewaProThreadsCtas[index % sewaProThreadsCtas.length]
          : isMalay ? sewaProCtas[index % sewaProCtas.length] : fallbackCta,
      };
    });
  }

  if (isKampusRide) {
    return kampusRideIdeas.map(([pillar, hook, concept], index) => {
      const platform = platforms[index % platforms.length];
      return {
        day_number: index + 1,
        pillar,
        objective: pillar.toLowerCase().includes('driver') ? 'Driver acquisition and activation' : input.objective,
        platform,
        format: formatForPlatform(platform, index),
        hook,
        concept: conceptForPlatform(platform, concept),
        cta: isThreads(platform) && isMalay
          ? kampusRideThreadsCtas[index % kampusRideThreadsCtas.length]
          : isMalay ? kampusRideCtas[index % kampusRideCtas.length] : fallbackCta,
      };
    });
  }

  return Array.from({ length: 30 }, (_, index) => {
    const pillar = genericPillars[index % genericPillars.length];
    const platform = platforms[index % platforms.length];
    return {
      day_number: index + 1,
      pillar,
      objective: input.objective,
      platform,
      format: formatForPlatform(platform, index),
      hook: `${pillar}: satu idea practical untuk ${input.brandName}`,
      concept: conceptForPlatform(platform, isMalay
        ? `Hasilkan content ${pillar.toLowerCase()} berdasarkan Brand Brain dan Knowledge Base yang disimpan. Gunakan claim yang boleh disahkan dan jadikan next action jelas.`
        : `Create a ${pillar.toLowerCase()} content piece grounded in the saved Brand Brain and Knowledge Base. Use only verified claims and make the next action obvious.`),
      cta: fallbackCta,
    };
  });
}
