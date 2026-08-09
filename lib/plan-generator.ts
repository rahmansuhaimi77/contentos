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

const genericPillars = ['Pain Point','Education','Use Case','Trust','FAQ','Comparison','Convenience','Conversion'];
const formats = ['15-30 sec short-form video','UGC / POV video','Talking-head explainer','Carousel','Static ad','WhatsApp-ready post'];
const sewaProCtas = [
  'Nak semak kereta? WhatsApp SewaPro dengan tarikh, lokasi dan kereta pilihan.',
  'Hantar tarikh + lokasi + kategori kereta. Kami bantu semak pilihan yang sesuai.',
  'Tak pasti kategori mana sesuai? WhatsApp SewaPro dan bagi detail trip anda.',
  'Simpan dulu. Bila dah ready, hantar requirement dekat SewaPro untuk kami semak.',
  'Nak compare tanpa buka banyak chat? Hantar requirement sekali dekat SewaPro.',
  'WhatsApp SewaPro untuk semak pilihan semasa — harga dan availability akan disahkan dahulu.',
];

export function buildThirtyDayPlan(input: PlannerInput, knowledge: PlanKnowledgeItem[]): PlanItem[] {
  const ctaFromKnowledge = knowledge.find((item) => item.title.toLowerCase() === 'preferred cta')?.content;
  const fallbackCta = input.cta || ctaFromKnowledge || 'Contact us to check suitable options.';
  const isSewaPro = input.brandName.toLowerCase().includes('sewapro');
  const isMalay = /bahasa|melayu|manglish/i.test(input.language);
  const platforms = input.platforms.length ? input.platforms : ['TikTok / Reels'];

  if (isSewaPro) {
    return sewaProIdeas.map(([pillar, hook, concept], index) => ({
      day_number: index + 1,
      pillar,
      objective: index % 5 === 4 ? 'Conversion' : input.objective,
      platform: platforms[index % platforms.length],
      format: formats[index % formats.length],
      hook,
      concept,
      cta: isMalay ? sewaProCtas[index % sewaProCtas.length] : fallbackCta,
    }));
  }

  return Array.from({ length: 30 }, (_, index) => {
    const pillar = genericPillars[index % genericPillars.length];
    return {
      day_number: index + 1,
      pillar,
      objective: input.objective,
      platform: platforms[index % platforms.length],
      format: formats[index % formats.length],
      hook: `${pillar}: satu idea practical untuk ${input.brandName}`,
      concept: isMalay
        ? `Hasilkan content ${pillar.toLowerCase()} berdasarkan Brand Brain dan Knowledge Base yang disimpan. Gunakan claim yang boleh disahkan dan jadikan next action jelas.`
        : `Create a ${pillar.toLowerCase()} content piece grounded in the saved Brand Brain and Knowledge Base. Use only verified claims and make the next action obvious.`,
      cta: fallbackCta,
    };
  });
}
