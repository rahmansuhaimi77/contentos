export type ProductionKnowledgeItem = { kind: string; title: string; content: string };

export type ProductionInput = {
  brandName: string;
  platform: string;
  format: string;
  language: string;
  pillar: string;
  objective: string;
  hook: string;
  concept: string;
  cta: string;
};

export type StoryboardScene = {
  scene: number;
  duration: string;
  visual: string;
  on_screen_text: string;
  voiceover: string;
};

export type ProductionPack = {
  strategy: string;
  hook: string;
  angle: string;
  script: string;
  caption: string;
  cta: string;
  creative_prompt: string;
  storyboard: StoryboardScene[];
  qa_notes: string[];
};

function knowledge(knowledgeItems: ProductionKnowledgeItem[], title: string) {
  return knowledgeItems.find((item) => item.title.toLowerCase() === title.toLowerCase())?.content || '';
}

function sewProBody(input: ProductionInput) {
  const h = input.hook.toLowerCase();
  if (h.includes('whatsapp banyak rental') || h.includes('10 chat')) {
    return 'Kalau dah kena buka banyak chat semata-mata nak cari satu kereta, itu memang leceh. Dengan SewaPro, hantar requirement sekali — tarikh sewa, lokasi dan kereta atau kategori yang anda nak. Kami semak rangkaian rental partner dan shortlist pilihan yang sesuai untuk anda review.';
  }
  if (h.includes('tarikh, lokasi, kereta')) {
    return 'Nak kami mula semak? Bagi tiga benda dulu: tarikh sewa, lokasi dan kereta atau kategori yang anda nak. Dari situ SewaPro akan semak rangkaian rental partner dan shortlist pilihan yang sesuai. Tak perlu ulang benda sama dekat banyak seller.';
  }
  if (h.includes('workshop')) {
    return 'Kalau kereta masuk workshop beberapa hari, anda tak perlukan satu lagi benda untuk pening. Beritahu SewaPro bila anda perlukan kereta, lokasi dan kategori yang sesuai. Kami bantu semak pilihan daripada rental partner, tertakluk kepada availability semasa.';
  }
  if (h.includes('family') || h.includes('balik kampung')) {
    return 'Untuk trip family, jangan tengok model kereta sahaja. Beritahu berapa orang, ada banyak luggage atau tidak, tarikh dan lokasi. SewaPro bantu semak kategori serta pilihan yang lebih sesuai daripada rental partner.';
  }
  if (h.includes('sedan') || h.includes('mpv') || h.includes('suv')) {
    return 'Pilihan kereta bergantung pada jumlah penumpang, luggage, jenis perjalanan dan bajet. Bagi detail itu kepada SewaPro dan kami bantu shortlist kategori serta pilihan yang lebih sesuai sebelum anda confirm.';
  }
  if (h.includes('deposit') || input.pillar.toLowerCase().includes('trust')) {
    return 'Sebelum confirm rental, pastikan tarikh, kategori atau model, harga, lokasi pickup atau delivery dan availability semuanya jelas. SewaPro hanya anggap availability sebagai confirmed selepas semakan dengan rental partner.';
  }
  if (input.pillar.toLowerCase().includes('faq')) {
    return `${input.concept} SewaPro bertindak sebagai car-rental finder: kami semak rangkaian rental partner, shortlist pilihan yang sesuai dan bantu urus proses booking. Pilihan akhir tetap bergantung pada availability partner.`;
  }
  if (input.pillar.toLowerCase().includes('brand') || input.pillar.toLowerCase().includes('position')) {
    return 'SewaPro bukan satu lagi page yang pegang satu fleet sahaja. Anda bagi requirement sekali, kami semak rangkaian rental partner dan shortlist pilihan yang sesuai. Anda review detail dan pilih mana yang paling sesuai untuk anda.';
  }
  return `${input.concept} Dengan SewaPro, customer bagi requirement sekali dan kami bantu semak serta shortlist pilihan daripada rental partner. Harga dan availability mesti disahkan sebelum booking.`;
}

function storyboardFor(input: ProductionInput, body: string, cta: string): StoryboardScene[] {
  const isVideo = /video|reels|tiktok|ugc|talking/i.test(`${input.platform} ${input.format}`);
  if (!isVideo) {
    return [
      { scene: 1, duration: 'Frame 1', visual: 'Bold problem-led headline on a clean mobile-first layout.', on_screen_text: input.hook, voiceover: '' },
      { scene: 2, duration: 'Frame 2', visual: 'Simple visual explaining the customer problem and SewaPro process.', on_screen_text: body.slice(0, 90), voiceover: '' },
      { scene: 3, duration: 'Frame 3', visual: 'WhatsApp-style CTA card with SewaPro branding.', on_screen_text: cta, voiceover: '' },
    ];
  }

  return [
    { scene: 1, duration: '0-2s', visual: 'POV phone screen showing the frustrating customer situation. Fast punch-in, authentic Malaysian setting.', on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: '2-7s', visual: 'Quick cuts of multiple rental chats/search results, then stop on one SewaPro WhatsApp conversation.', on_screen_text: 'Tak perlu cari satu-satu', voiceover: body.split('.').slice(0, 2).join('.') + '.' },
    { scene: 3, duration: '7-14s', visual: 'Show a clean message containing rental date, location and preferred car/category, followed by 2-3 shortlisted option cards.', on_screen_text: 'Tarikh + lokasi + kereta', voiceover: body.split('.').slice(2).join('.').trim() || 'Bagi requirement sekali. SewaPro bantu semak pilihan yang sesuai.' },
    { scene: 4, duration: '14-20s', visual: 'Close-up of customer reviewing an option; include a small note that price and availability require partner confirmation.', on_screen_text: 'Harga & availability disahkan dahulu', voiceover: 'Harga dan availability disahkan dengan rental partner sebelum booking.' },
    { scene: 5, duration: '20-25s', visual: 'SewaPro WhatsApp CTA screen, clean logo lockup, subtle phone tap animation.', on_screen_text: cta, voiceover: cta },
  ];
}

export function buildProductionPack(input: ProductionInput, knowledgeItems: ProductionKnowledgeItem[]): ProductionPack {
  const isSewaPro = input.brandName.toLowerCase().includes('sewapro');
  const preferredCta = knowledge(knowledgeItems, 'Preferred CTA');
  const availabilityRule = knowledge(knowledgeItems, 'Availability rule');
  const cta = input.cta || preferredCta || 'WhatsApp kami dengan tarikh, lokasi dan kereta pilihan untuk semak availability.';
  const body = isSewaPro ? sewProBody(input) : `${input.concept} Keep the explanation practical, specific and grounded in the saved Brand Brain.`;
  const script = `${input.hook}\n\n${body}\n\n${cta}`;
  const caption = isSewaPro
    ? `${input.hook}\n\nTak perlu cari rental satu-satu. Hantar requirement kepada SewaPro dan kami bantu semak pilihan yang sesuai daripada rental partner. Harga dan availability tertakluk kepada pengesahan semasa.\n\n${cta}`
    : `${input.hook}\n\n${body}\n\n${cta}`;
  const storyboard = storyboardFor(input, body, cta);

  return {
    strategy: `Turn Day content into a production-ready ${input.format} using a ${input.pillar.toLowerCase()} angle. Keep the hook intact, explain one idea only, and end with one clear next action.`,
    hook: input.hook,
    angle: `${input.pillar} — ${input.concept}`,
    script,
    caption,
    cta,
    creative_prompt: `Create a vertical 9:16 ${input.format} for ${input.platform}, designed for Malaysian audiences. Use authentic UGC/POV visual language, realistic phone interactions and natural lighting. First 2 seconds must show the problem and exact hook: “${input.hook}”. Then visually explain the SewaPro one-request flow using date, location and preferred car/category. Do not show fake prices, fake reviews or guaranteed availability. Add readable Malay subtitles. End with a WhatsApp CTA. ${availabilityRule ? `Mandatory brand rule: ${availabilityRule}` : ''}`,
    storyboard,
    qa_notes: [
      'No fake urgency, fake testimonials or invented discounts.',
      'Do not imply SewaPro owns the rental vehicles.',
      'Do not claim a vehicle is available until a rental partner confirms it.',
      'Keep spoken Malay natural and short enough for the selected format.',
    ],
  };
}
