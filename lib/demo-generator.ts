import type { BrandBrain, CampaignBrief, GenerationResult } from './types';
import type { PromptKnowledgeItem } from './prompt';

type DemoInput = {
  brand: BrandBrain;
  brief: CampaignBrief;
};

function findKnowledge(knowledge: PromptKnowledgeItem[], title: string) {
  return knowledge.find((item) => item.title.toLowerCase() === title.toLowerCase())?.content || '';
}

export function buildDemoResult(data: DemoInput, knowledge: PromptKnowledgeItem[]): GenerationResult {
  const isMalay = /bahasa|melayu|manglish/i.test(data.brief.language);
  const lowerName = data.brand.name.toLowerCase();
  const isSewaPro = lowerName.includes('sewapro');
  const isKampusRide = lowerName.includes('kampusride');
  const fallbackCta = isKampusRide
    ? (isMalay ? 'Post ride anda dalam KampusRide dan compare offer dalam satu tempat.' : 'Post your ride in KampusRide and compare offers in one place.')
    : (isMalay ? 'WhatsApp kami untuk semak pilihan.' : 'Contact us to check suitable options.');
  const cta = data.brand.cta || findKnowledge(knowledge, 'Preferred CTA') || fallbackCta;
  const bookingFlow = findKnowledge(knowledge, 'Booking flow');
  const availabilityRule = findKnowledge(knowledge, 'Availability rule');
  const trustRule = findKnowledge(knowledge, 'Trust rules');

  const sewaProAngles = [
    {
      hook: 'Dah WhatsApp banyak rental, semua reply full?',
      angle: 'Pain point — search fatigue and repeated rejection.',
      script: `Dah WhatsApp banyak rental, semua reply full? Dengan SewaPro, tak perlu cari satu-satu. Hantar tarikh sewa, lokasi dan kereta yang anda nak. Kami semak rangkaian partner dan shortlist pilihan yang sesuai. Harga dan availability tetap disahkan sebelum booking. ${cta}`,
    },
    {
      hook: 'Tarikh, lokasi, kereta. Bagi sekali je.',
      angle: 'Convenience — reduce many rental searches into one request.',
      script: `Nak sewa kereta tapi malas buka banyak chat? Bagi SewaPro tiga benda: tarikh, lokasi dan kereta atau kategori yang anda nak. Kami carikan pilihan daripada network partner dan shortlist yang sesuai untuk anda. Lepas tu baru pilih. ${cta}`,
    },
    {
      hook: 'Nak sewa kereta tak perlu buka 10 chat.',
      angle: 'Comparison — contrast the old fragmented search process with SewaPro.',
      script: `Cara biasa: cari Facebook, WhatsApp seller A, seller B, seller C — belum tentu ada kereta. Cara SewaPro: bagi requirement sekali, kami bantu semak pilihan yang sesuai daripada network rental partner. Senang compare, senang decide. ${cta}`,
    },
    {
      hook: 'Kereta masuk workshop? Jangan tambah satu lagi headache.',
      angle: 'Urgent use case — temporary replacement car.',
      script: `Kereta masuk workshop beberapa hari? Anda dah ada cukup benda nak fikir. Bagi tarikh, lokasi dan jenis kereta yang diperlukan kepada SewaPro. Kami bantu cari dan shortlist pilihan rental yang sesuai, tertakluk kepada availability partner. ${cta}`,
    },
    {
      hook: 'Trip family dah dekat, kereta masih belum settle?',
      angle: 'Family-trip use case with a practical planning trigger.',
      script: `Kalau trip family dah dekat tapi kereta rental belum confirm, jangan tunggu sampai last minute. Hantar detail trip kepada SewaPro — tarikh, lokasi, jumlah penumpang dan kategori kereta. Kami bantu semak pilihan yang sesuai daripada partner rental. ${cta}`,
    },
    {
      hook: 'Harga murah belum tentu pilihan paling sesuai.',
      angle: 'Trust — move the conversation beyond headline price.',
      script: `Bila sewa kereta, jangan tengok harga saja. Check juga jenis kereta, detail booking, lokasi dan apa yang sebenarnya termasuk. SewaPro bantu shortlist pilihan yang sesuai dan pastikan harga serta availability disahkan sebelum anda confirm. ${cta}`,
    },
  ];

  const kampusRideAngles = [
    {
      hook: 'Dah post transporter, lepas tu kena buka 6 DM?',
      angle: 'Passenger pain point — replace scattered DMs with one offer screen.',
      script: `Cara lama: post dekat group, lepas tu banyak driver DM dan anda kena compare satu-satu. Dengan KampusRide, post ride sekali, tengok semua offer dalam satu tempat, compare price dan reputation, kemudian pilih driver yang anda nak. Lepas match, coordinate dalam in-app chat. ${cta}`,
    },
    {
      hook: 'Post sekali. Compare semua offer satu tempat.',
      angle: 'Product simplicity — explain the full marketplace in one line.',
      script: `Pilih route, masa dan pax. Post ride. Driver offer. Anda compare price, rating dan car details, kemudian pilih. Tak perlu ulang benda sama dekat banyak chat. ${cta}`,
    },
    {
      hook: 'Driver kampus: tak perlu camp Telegram tunggu job.',
      angle: 'Driver acquisition — flexible driver mode without guaranteed earnings.',
      script: `Kalau anda free dan nak drive, switch ke Driver mode. Tengok ride yang tengah cari driver, semak route dan price guide, then offer bila sesuai dengan masa anda. Passenger pilih offer, dan fare ride dibayar terus kepada driver. ${isMalay ? 'Switch ke Driver mode bila anda free.' : 'Switch to Driver mode when you are free.'}`,
    },
    {
      hook: 'Nak cari ride tak semestinya kena bagi nombor phone.',
      angle: 'Privacy — keep coordination inside the app.',
      script: `Tak perlu share nombor phone dekat setiap orang yang DM. KampusRide susun request dan offer dalam app, kemudian bila dah pilih driver anda boleh coordinate melalui in-app chat. Lebih kemas, lebih private. ${cta}`,
    },
    {
      hook: 'Prefer female driver? Letak preference.',
      angle: 'Female-passenger preference — transparent, not guaranteed.',
      script: `Kalau anda lebih selesa dengan female driver, letak preference masa post ride. KampusRide boleh prioritise female driver bila available, tapi ia bukan guarantee sebab supply mungkin terhad pada masa tertentu. ${cta}`,
    },
    {
      hook: 'Cheapest bukan satu-satunya benda nak compare.',
      angle: 'Trust — compare reputation and car details as well as price.',
      script: `Bila offer masuk, jangan tengok harga sahaja. Check rating, reputation, car details dan offer note sebelum pilih. KampusRide bagi semua tu dalam satu tempat supaya keputusan lebih informed. Rating bantu accountability, bukan jaminan keselamatan. ${cta}`,
    },
    {
      hook: 'KampusRide bukan “Grab versi kampus”.',
      angle: 'Positioning — campus cost-sharing marketplace, not corporate e-hailing.',
      script: `KampusRide bukan auto-assign driver macam e-hailing biasa. Passenger post request, drivers offer, passenger compare dan pilih. Fare dibayar terus kepada driver. Familiar macam transporter community, cuma lebih tersusun. ${cta}`,
    },
    {
      hook: 'Free 30 minit sebelum class? Switch Driver mode.',
      angle: 'Driver lifestyle — offer rides only when available.',
      script: `Ada free time sebelum class? Kalau anda driver, buka Driver mode dan tengok ride yang sesuai dengan route dan masa anda. Offer bila free, skip bila tak sesuai. Tak perlu duduk tunggu group sepanjang hari. ${isMalay ? 'Check ride yang tengah cari driver.' : 'Check rides looking for a driver.'}`,
    },
    {
      hook: 'Tak payah refresh group tiap 2 minit.',
      angle: 'Product convenience — notifications reduce manual checking.',
      script: `Post ride dalam KampusRide dan biar app susun offer serta message dalam satu flow. Bila ada update, notification bantu anda tahu tanpa kena stare dekat group sepanjang masa. ${cta}`,
    },
    {
      hook: 'Ride community, tapi lebih tersusun.',
      angle: 'Brand — community-first structure and accountability.',
      script: `KampusRide ambil behaviour yang student dah biasa — cari transporter — dan susun jadi flow yang lebih jelas: post, offer, pilih, chat, ride, rate. Community feel kekal, cuma kurang chaos. ${cta}`,
    },
  ];

  const genericAngles = [
    {
      hook: isMalay ? `Penat cari ${data.brand.product} satu-satu?` : `Tired of searching for ${data.brand.product} one by one?`,
      angle: 'Pain point — reduce friction before introducing the solution.',
      script: isMalay
        ? `Kalau proses cari ${data.brand.product} dah mula makan masa, ${data.brand.name} bantu jadikan langkah seterusnya lebih mudah. ${data.brand.positioning || data.brand.product}. ${cta}`
        : `If finding ${data.brand.product} is taking too much time, ${data.brand.name} makes the next step easier. ${data.brand.positioning || data.brand.product}. ${cta}`,
    },
    {
      hook: isMalay ? 'Bagi requirement sekali. Biar kami bantu.' : 'Share the requirement once. Let us help.',
      angle: 'Convenience — simplify the customer journey.',
      script: isMalay
        ? `${data.brand.name} fokus pada proses yang lebih mudah dan practical. ${data.brand.positioning || data.brand.product}. ${cta}`
        : `${data.brand.name} focuses on making the process simpler and more practical. ${data.brand.positioning || data.brand.product}. ${cta}`,
    },
    {
      hook: isMalay ? 'Jangan pilih berdasarkan harga sahaja.' : 'Do not choose on price alone.',
      angle: 'Trust — give a useful decision rule before the CTA.',
      script: `${data.brand.proof || trustRule || data.brand.positioning}. ${cta}`,
    },
  ];

  const angleBank = isSewaPro ? sewaProAngles : isKampusRide ? kampusRideAngles : genericAngles;
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const base = angleBank[index % angleBank.length];
    const productionNotes = data.brief.extra ? ` Extra campaign direction: ${data.brief.extra}` : '';
    const knowledgeNotes = [bookingFlow, availabilityRule].filter(Boolean).join(' ');
    const caption = isSewaPro
      ? `Tak perlu cari rental satu-satu. Hantar tarikh, lokasi dan kereta yang anda perlukan kepada SewaPro — kami bantu semak pilihan yang sesuai. Availability & harga tertakluk kepada pengesahan partner. ${cta}`
      : isKampusRide
        ? `${base.hook}\n\nKampusRide susun ride request, driver offers, pilihan dan chat dalam satu flow. Passenger pilih sendiri; fare ride dibayar terus kepada driver. Jangan assume female preference, price guide atau ride availability sebagai guarantee.\n\n${cta}`
        : `${data.brand.name} — ${data.brand.offer || data.brand.product}. ${cta}`;
    const visualDirection = isKampusRide
      ? 'Authentic Malaysian university-campus UGC/POV, natural student-life setting, realistic KampusRide app/phone interactions using approved screenshots when available, short Malay subtitles, no fake IIUM endorsement, no fake fares/ratings/verification badges, and no guaranteed female-driver or safety claims.'
      : 'Authentic, mobile-first, natural Malaysian UGC where relevant, realistic phone/WhatsApp interactions, concise subtitles, fast clear pacing, no fake testimonials or unverified claims.';

    return {
      hook: base.hook,
      angle: base.angle,
      script: base.script,
      caption,
      cta,
      creative_prompt: `Create a ${data.brief.format} for ${data.brief.platform}. Use the hook “${base.hook}” in the first 1-2 seconds. Audience context: ${data.brand.audience}. Visual direction: ${visualDirection} Show the problem first, then one clear product idea, then the CTA. Language: ${data.brief.language}.${productionNotes}${knowledgeNotes ? ` Brand constraints: ${knowledgeNotes}` : ''}`,
    };
  });

  return {
    strategy: isSewaPro
      ? 'Zero-cost strategy: position SewaPro as the car-rental finder that replaces multiple searches with one request. Variants rotate through pain-point, convenience, comparison and real-life use cases while preserving pricing and availability rules.'
      : isKampusRide
        ? 'Zero-cost strategy: position KampusRide as the campus-made marketplace that replaces scattered transporter DMs with one structured ride flow. Rotate passenger pain points, driver opportunity, trust/privacy, female-preference education and campus-life angles without overclaiming safety, verification or availability.'
        : `Zero-cost strategy: use distinct pain-point, convenience and trust angles for ${data.brand.name}, grounded in the saved Brand Brain and Knowledge Base.`,
    variants,
    mode: 'demo',
  };
}
