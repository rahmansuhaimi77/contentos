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
  ['Pain Point', 'Dah WhatsApp banyak rental, semua reply full?', 'Show the frustrating old journey of contacting multiple rental sellers, then explain the one-request SewaPro flow.'],
  ['Convenience', 'Tarikh, lokasi, kereta. Bagi sekali je.', 'Explain the three basic details a customer can send so SewaPro can start checking suitable partner options.'],
  ['Comparison', 'Nak sewa kereta tak perlu buka 10 chat.', 'Split-screen old way vs SewaPro way: many chats versus one request and shortlisted options.'],
  ['Use Case', 'Kereta masuk workshop? Jangan tambah satu lagi headache.', 'Target temporary replacement-car customers and explain how SewaPro can help shortlist rental options.'],
  ['Use Case', 'Trip family dah dekat, kereta masih belum settle?', 'Family-trip planning scenario. Ask for passenger count, dates, location and suitable category.'],
  ['Trust', 'Harga murah belum tentu pilihan paling sesuai.', 'Educate customers to review vehicle type, booking details, location and confirmed availability—not headline price alone.'],
  ['Traveller', 'Landing KL dan perlukan kereta? Bagi detail sebelum sampai.', 'Pre-arrival content for visitors who want to review rental options before reaching Kuala Lumpur.'],
  ['Education', 'Tak pasti nak pilih Sedan, MPV atau SUV?', 'Simple decision guide based on passengers, luggage, trip type and budget without inventing exact pricing.'],
  ['Positioning', 'Satu request. Beberapa pilihan. Anda pilih.', 'Explain SewaPro as a car-rental finder, not a fleet owner.'],
  ['Trust', 'Sebelum transfer deposit, confirm benda ni dulu.', 'Checklist: dates, vehicle/category, total price, pickup/delivery details and confirmed availability.'],
  ['FAQ', 'SewaPro ada kereta sendiri ke?', 'Answer clearly: SewaPro matches customers with rental partners and manages the booking experience.'],
  ['FAQ', 'Boleh request model kereta tertentu?', 'Explain that customers can request preferred models/categories but final availability must be checked with partners.'],
  ['FAQ', 'Berapa cepat SewaPro boleh bagi pilihan?', 'Explain that response speed depends on partner availability and avoid promising instant confirmation.'],
  ['Objection', '“Aku boleh cari sendiri kat Facebook.” Betul. Tapi…', 'Acknowledge the alternative, then show the time and comparison friction SewaPro removes.'],
  ['Objection', 'Kenapa tak terus contact rental company je?', 'Explain the value of checking several partner options through one point of contact.'],
  ['Education', '3 benda bagi awal kalau nak cepat semak kereta.', 'Teach customers to send rental dates, location and preferred category/budget in the first message.'],
  ['Education', 'MPV untuk 6 orang: jangan tengok seat sahaja.', 'Discuss luggage and comfort considerations when choosing MPV without promising a specific model.'],
  ['Relatable', 'Group family dah confirm trip. Kereta je belum.', 'Relatable family group-chat scenario ending with a SewaPro WhatsApp request.'],
  ['Relatable', 'Bila seller pertama cakap “full”… seller kedua pun “full”.', 'Humorous sequence of repeated unavailable replies, followed by the SewaPro finder proposition.'],
  ['Process', 'Apa jadi lepas anda WhatsApp SewaPro?', 'Step-by-step: send requirement → SewaPro checks partners → shortlist → customer reviews → booking confirmation.'],
  ['Trust', 'Availability bukan benda yang patut kita teka.', 'Reinforce that SewaPro confirms availability with rental partners before presenting it as confirmed.'],
  ['Trust', 'Posting harga lama ≠ harga booking hari ni.', 'Explain why dates, season and supplier availability matter, and why final pricing needs confirmation.'],
  ['Use Case', 'Balik kampung tapi kereta sendiri tak cukup besar?', 'Use-case content for larger family/luggage needs; position SewaPro as a finder for suitable categories.'],
  ['Use Case', 'Kereta kedua untuk event atau kerja beberapa hari?', 'Target short-term work/event rental without making corporate contract claims.'],
  ['Traveller', 'Airport trip + family + luggage: kereta apa sesuai?', 'Decision-support content on category choice based on people and luggage.'],
  ['Social Proof', 'Apa yang customer sebenarnya nak bila cari rental?', 'Frame trust factors: clear details, responsive communication, suitable choices and confirmed availability; use no fake testimonials.'],
  ['Conversion', 'Nak kami tolong semak? Hantar 4 benda ni.', 'Direct-response post: date, location, preferred car/category and budget.'],
  ['Conversion', 'Weekend ni perlukan kereta? Start dengan requirement, bukan scroll.', 'Strong CTA-focused content while avoiding fake scarcity or guaranteed availability.'],
  ['Brand', 'SewaPro bukan “another rental page”.', 'Founder-style positioning content explaining the aggregator/matching concept and why it exists.'],
  ['Recap', '30 saat: cara paling simple guna SewaPro.', 'Fast recap of the entire flow with a direct WhatsApp CTA and explicit availability confirmation rule.'],
] as const;

const genericPillars = ['Pain Point','Education','Use Case','Trust','FAQ','Comparison','Convenience','Conversion'];
const formats = ['15-30 sec short-form video','UGC / POV video','Talking-head explainer','Carousel','Static ad','WhatsApp-ready post'];

export function buildThirtyDayPlan(input: PlannerInput, knowledge: PlanKnowledgeItem[]): PlanItem[] {
  const ctaFromKnowledge = knowledge.find((item) => item.title.toLowerCase() === 'preferred cta')?.content;
  const cta = input.cta || ctaFromKnowledge || 'Contact us to check suitable options.';
  const isSewaPro = input.brandName.toLowerCase().includes('sewapro');
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
      cta,
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
      concept: `Create a ${pillar.toLowerCase()} content piece grounded in the saved Brand Brain and Knowledge Base. Use only verified claims and make the next action obvious.`,
      cta,
    };
  });
}
