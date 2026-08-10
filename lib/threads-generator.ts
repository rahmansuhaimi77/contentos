import type { BrandBrain, CampaignBrief, GenerationResult } from './types';
import type { PromptKnowledgeItem } from './prompt';

type ThreadsInput = {
  brand: BrandBrain;
  brief: CampaignBrief;
};

type ThreadsDraft = {
  hook: string;
  angle: string;
  body: string;
  question: string;
};

function brandKind(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('sewapro')) return 'sewapro';
  if (lower.includes('kampusride')) return 'kampusride';
  return 'generic';
}

function knowledge(knowledgeItems: PromptKnowledgeItem[], title: string) {
  return knowledgeItems.find((item) => item.title.toLowerCase() === title.toLowerCase())?.content || '';
}

const sewaProThreads: ThreadsDraft[] = [
  {
    hook: 'Hot take: cari kereta sewa ikut harga paling murah dulu tak semestinya paling jimat.',
    angle: 'Opinion — shift the conversation from headline price to booking clarity.',
    body: 'Kalau model tak sesuai, pickup jauh, atau availability sebenarnya belum confirm, murah dekat poster tak banyak membantu.\n\nAku lagi suka check tarikh, lokasi, jenis kereta dan final detail dulu — baru compare harga.',
    question: 'Kalau korang sewa kereta, benda pertama korang check apa?',
  },
  {
    hook: 'Benda paling penat bila cari rental bukan compare harga. Buka chat satu-satu tu yang makan masa.',
    angle: 'Relatable pain point — fragmented rental search.',
    body: 'Seller A full. Seller B lambat reply. Seller C minta detail yang sama lagi.\n\nSebab tu idea SewaPro simple: bagi requirement sekali, then kami bantu semak dan shortlist option daripada rental partner.',
    question: 'Team cari satu-satu atau prefer bagi requirement sekali?',
  },
  {
    hook: 'Kalau satu rental page cakap “full”, itu tak semestinya bermaksud semua option dah habis.',
    angle: 'Education — explain the value of a partner network without promising availability.',
    body: 'Availability ikut tarikh, lokasi, kategori dan supplier. Jadi lebih practical kalau semak beberapa source sebelum assume memang tak ada kereta.\n\nSewaPro buat bahagian semakan itu, tapi final availability tetap kena confirm dengan partner.',
    question: 'Pernah tak dah hampir give up cari kereta sebab beberapa tempat reply full?',
  },
  {
    hook: 'Aku rasa rental car search patut rasa macam “bagi requirement → dapat shortlist”, bukan “scroll sampai jumpa”.',
    angle: 'Founder-style positioning — explain the SewaPro model.',
    body: 'Tarikh. Lokasi. Preferred car/category. Budget kalau ada.\n\nLepas tu biar satu point of contact bantu cari option yang masuk akal. Less searching, more deciding.',
    question: 'Kalau flow macam ni, detail apa lagi korang nak bagi awal?',
  },
];

const kampusRideThreads: ThreadsDraft[] = [
  {
    hook: 'Student UIA: masalah cari transporter bukan semata-mata “tak ada driver”. Kadang masalah dia terlalu banyak DM.',
    angle: 'Passenger pain point — scattered conversations.',
    body: 'Post sekali dekat group, lepas tu beberapa orang masuk private chat. Nak compare price, kereta, rating atau siapa reply dulu pun jadi messy.\n\nKampusRide cuba susun benda yang student memang dah buat: post → offers → pilih → chat.',
    question: 'Korang paling penat part mana bila cari transporter?',
  },
  {
    hook: 'Aku rasa KampusRide tak patut jadi “Grab versi kampus”.',
    angle: 'Founder opinion — community marketplace positioning.',
    body: 'Ride kampus dah ada culture sendiri. Passenger post, driver decide nak offer atau tak, passenger pula pilih siapa dia selesa.\n\nYang kita cuba improve bukan culture tu — kita cuba kurangkan chaos sekelilingnya.',
    question: 'Kalau korang boleh fix satu benda dalam current transporter flow, apa dia?',
  },
  {
    hook: 'Female preferred driver patut jadi preference, bukan fake guarantee.',
    angle: 'Trust — set a transparent expectation around female-driver preference.',
    body: 'Kalau female passenger lebih selesa dengan female driver, app patut bagi pilihan untuk nyatakan preference.\n\nTapi supply female driver mungkin limited pada waktu tertentu. Better jujur tentang availability daripada promise benda yang platform tak boleh control.',
    question: 'Female passengers — feature macam ni penting tak untuk korang?',
  },
  {
    hook: 'Driver kampus sebenarnya tak perlu “online kerja” sepanjang hari.',
    angle: 'Driver lifestyle — flexible participation without earnings promises.',
    body: 'Ada gap 30 minit? Tengah drive area campus? Buka Driver mode, tengok ride yang sesuai, offer kalau route dan masa ngam.\n\nKalau tak sesuai, skip. Simple.',
    question: 'Driver/student drivers: korang prefer job feed macam ni atau monitor group chat?',
  },
  {
    hook: 'Cheapest offer bukan semestinya offer yang passenger akan pilih.',
    angle: 'Reputation — explain choice beyond price.',
    body: 'Kalau semua offer duduk satu screen, passenger boleh tengok lebih daripada harga: profile, car details, rating/reputation dan note daripada driver.\n\nHarga penting. Context pun penting.',
    question: 'Kalau korang passenger, top 3 benda yang korang tengok sebelum pilih driver apa?',
  },
  {
    hook: 'Nombor phone tak semestinya kena jadi “ticket masuk” untuk cari ride.',
    angle: 'Privacy — keep coordination inside the product.',
    body: 'Kalau request, offer dan chat boleh berlaku dalam app, tak perlu share nombor dekat setiap orang yang reply.\n\nBenda kecil, tapi untuk ride community yang ramai strangers, privacy friction tu real.',
    question: 'Korang okay share nombor terus, atau prefer chat dalam app dulu?',
  },
];

function genericThreads(data: ThreadsInput): ThreadsDraft[] {
  return [
    {
      hook: `Satu observation tentang ${data.brand.name}: orang jarang perlukan lebih banyak pilihan — mereka perlukan pilihan yang lebih jelas.`,
      angle: 'Observation — simplify the customer decision.',
      body: `${data.brand.positioning || data.brand.product}\n\nBila process jelas, orang lebih senang decide apa next step tanpa rasa kena hard-sell.`,
      question: 'Apa part dalam process ni yang paling penting untuk korang?',
    },
    {
      hook: `Kalau nak explain ${data.brand.name} dalam satu ayat, aku akan cakap macam ni:`,
      angle: 'Founder positioning — explain the product simply.',
      body: data.brand.positioning || data.brand.product,
      question: 'Clear tak positioning macam ni, atau ada part yang masih confuse?',
    },
    {
      hook: 'Useful marketing > loud marketing.',
      angle: 'Education — lead with a practical customer insight.',
      body: `${data.brand.proof || data.brand.product}\n\nKalau content boleh bantu orang buat keputusan lebih baik, sales message tak perlu terlalu kuat.`,
      question: 'Content jenis apa yang paling korang save atau reply?',
    },
  ];
}

export function buildThreadsDemoResult(data: ThreadsInput, knowledgeItems: PromptKnowledgeItem[]): GenerationResult {
  const kind = brandKind(data.brand.name);
  const bank = kind === 'sewapro' ? sewaProThreads : kind === 'kampusride' ? kampusRideThreads : genericThreads(data);
  const avoid = data.brand.avoid || knowledge(knowledgeItems, 'Trust rules');
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const draft = bank[index % bank.length];
    const post = `${draft.hook}\n\n${draft.body}\n\n${draft.question}`;
    return {
      hook: draft.hook,
      angle: draft.angle,
      script: post,
      caption: post,
      cta: draft.question,
      creative_prompt: `THREADS-NATIVE TEXT POST. Write for ${data.brand.name} in ${data.brief.language}. Keep one clear idea, conversational line breaks, a strong first sentence, useful context, and one genuine discussion prompt at the end. Do not turn it into a TikTok script or a corporate advertisement. Avoid forced engagement bait, hashtag stuffing, fake urgency and unsupported claims. Brand guardrails: ${avoid || 'Use only verified claims from the Brand Brain and Knowledge Base.'}${data.brief.extra ? ` Extra direction: ${data.brief.extra}` : ''}`,
    };
  });

  return {
    strategy: `Threads-first strategy for ${data.brand.name}: lead with sharp observations, useful opinions, relatable situations and genuine questions. Keep selling soft; use conversation to learn what the audience cares about, then turn strong themes into future campaigns.`,
    variants,
    mode: 'demo',
  };
}
