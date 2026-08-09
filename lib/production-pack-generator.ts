export type ProductionKnowledgeItem = { kind: string; title: string; content: string };

export type ProductionVisualContext = {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  font_notes?: string | null;
  visual_style?: string | null;
  image_rules?: string | null;
  asset_kinds?: string[];
  asset_titles?: string[];
};

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
  image_prompt: string;
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
    return 'Kalau dah kena buka banyak chat semata-mata nak cari satu kereta, memang leceh. Dengan SewaPro, hantar requirement sekali — tarikh sewa, lokasi dan kereta atau kategori yang anda nak. Kami semak rangkaian rental partner dan shortlist pilihan yang sesuai untuk anda tengok dan bandingkan.';
  }
  if (h.includes('tarikh, lokasi, kereta')) {
    return 'Nak kami mula semak? Bagi tiga benda dulu: tarikh sewa, lokasi dan kereta atau kategori yang anda nak. Dari situ SewaPro akan semak rangkaian rental partner dan shortlist pilihan yang sesuai. Tak perlu ulang benda sama dekat banyak seller.';
  }
  if (h.includes('workshop')) {
    return 'Kalau kereta masuk workshop beberapa hari, anda tak perlukan satu lagi benda untuk pening. Beritahu SewaPro bila anda perlukan kereta, lokasi dan kategori yang sesuai. Kami bantu semak pilihan daripada rental partner, tertakluk kepada availability semasa.';
  }
  if (h.includes('family') || h.includes('balik kampung')) {
    return 'Untuk trip family, jangan tengok model kereta sahaja. Beritahu berapa orang, banyak luggage atau tidak, tarikh dan lokasi. SewaPro bantu semak kategori serta pilihan yang lebih sesuai daripada rental partner.';
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
    return 'SewaPro bukan satu lagi page yang pegang satu fleet sahaja. Anda bagi requirement sekali, kami semak rangkaian rental partner dan shortlist pilihan yang sesuai. Anda tengok detail dan pilih mana yang paling sesuai.';
  }
  return `${input.concept} Dengan SewaPro, customer bagi requirement sekali dan kami bantu semak serta shortlist pilihan daripada rental partner. Harga dan availability mesti disahkan sebelum booking.`;
}

function visualContextText(context: ProductionVisualContext) {
  const rules: string[] = [];
  if (context.primary_color) rules.push(`Primary brand colour: ${context.primary_color}.`);
  if (context.secondary_color) rules.push(`Secondary brand colour: ${context.secondary_color}.`);
  if (context.accent_color) rules.push(`Accent colour: ${context.accent_color}.`);
  if (context.font_notes) rules.push(`Typography direction: ${context.font_notes}`);
  if (context.visual_style) rules.push(`Approved visual style: ${context.visual_style}`);
  if (context.image_rules) rules.push(`Image rules: ${context.image_rules}`);
  const kinds = context.asset_kinds ?? [];
  if (kinds.includes('logo')) rules.push('An official uploaded logo exists in Brand Assets. Use that supplied logo reference; never redraw or reinterpret it.');
  else rules.push('No official logo asset is available yet. Use the text name only and do not fabricate a logo.');
  if (kinds.includes('screenshot')) rules.push('Approved screenshots exist in Brand Assets; use them as UI/layout references when ContentOS visual generation is connected.');
  if (kinds.includes('vehicle')) rules.push('Approved vehicle/product photos exist in Brand Assets; prefer those references over inventing specific vehicle details.');
  if (kinds.includes('visual_reference')) rules.push('Approved visual references exist in Brand Assets; preserve their overall composition and mood without copying third-party branding.');
  return rules.join(' ');
}

function scenePrompt(input: ProductionInput, scene: number, visual: string, text: string, visualContext: ProductionVisualContext) {
  const brandRules = visualContextText(visualContext);
  const base = `Vertical 9:16 realistic Malaysian UGC storyboard frame for ${input.brandName}. Natural daylight, authentic smartphone-camera look, everyday KL/Selangor environment, believable hands and phone UI, clean composition with safe space for subtitles. Keep the same phone, hand, lighting style and visual identity across all scenes. ${brandRules}`;
  const sceneDirection = [
    'Close POV of a smartphone with several car-rental WhatsApp chats showing short unavailable/full-style replies without naming real companies. Slight frustration, quick-scroll feeling.',
    'POV transition from many open rental chats to one clean SewaPro WhatsApp conversation. The screen should feel simpler and calmer than the previous scene.',
    'Close-up of a WhatsApp message containing rental date, location and preferred car/category, followed by two or three neutral shortlisted option cards with no unverified prices.',
    'Customer reviewing one shortlisted option on a phone. Include a small visual note that price and availability require partner confirmation. No claim that booking is confirmed.',
    'Clean final mobile CTA frame with a WhatsApp conversation ready to send. Use the official uploaded brand mark only if supplied in Brand Assets.',
  ][scene - 1] || visual;
  return `${base} Scene ${scene}: ${sceneDirection} On-screen text to reserve space for: “${text}”. Do not invent prices, reviews, vehicle availability or unsupported UI. No watermark, no stock-photo look, no extra promotional claims.`;
}

function storyboardFor(input: ProductionInput, body: string, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const isVideo = /video|reels|tiktok|ugc|talking/i.test(`${input.platform} ${input.format}`);
  if (!isVideo) {
    const frames = [
      { scene: 1, duration: 'Frame 1', visual: 'Bold problem-led headline on a clean mobile-first layout.', on_screen_text: input.hook, voiceover: '' },
      { scene: 2, duration: 'Frame 2', visual: 'Simple visual explaining the customer problem and SewaPro process.', on_screen_text: 'Satu request → kami bantu semak', voiceover: '' },
      { scene: 3, duration: 'Frame 3', visual: 'WhatsApp-style CTA card using only approved SewaPro brand assets.', on_screen_text: cta, voiceover: '' },
    ];
    return frames.map((frame) => ({ ...frame, image_prompt: scenePrompt(input, frame.scene, frame.visual, frame.on_screen_text, visualContext) }));
  }

  const sentences = body.split('.').map((part) => part.trim()).filter(Boolean);
  const scenes = [
    { scene: 1, duration: '0-2s', visual: 'POV phone screen showing the frustrating customer situation. Fast punch-in, authentic Malaysian setting.', on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: '2-7s', visual: 'Quick cuts of multiple rental chats/search results, then stop on one SewaPro WhatsApp conversation.', on_screen_text: 'Tak perlu cari satu-satu', voiceover: `${sentences.slice(0, 2).join('. ')}.` },
    { scene: 3, duration: '7-14s', visual: 'Show a clean message containing rental date, location and preferred car/category, followed by 2-3 shortlisted option cards.', on_screen_text: 'Tarikh + lokasi + kereta', voiceover: sentences.slice(2).join('. ') || 'Bagi requirement sekali. SewaPro bantu semak pilihan yang sesuai.' },
    { scene: 4, duration: '14-20s', visual: 'Close-up of customer reviewing an option; include a small note that price and availability require partner confirmation.', on_screen_text: 'Harga & availability disahkan dahulu', voiceover: 'Harga dan availability disahkan dengan rental partner sebelum booking.' },
    { scene: 5, duration: '20-25s', visual: 'SewaPro WhatsApp CTA screen with subtle phone tap animation and only approved brand assets.', on_screen_text: cta, voiceover: cta },
  ];

  return scenes.map((scene) => ({ ...scene, image_prompt: scenePrompt(input, scene.scene, scene.visual, scene.on_screen_text, visualContext) }));
}

function naturalSewaProCta(input: ProductionInput) {
  const pillar = input.pillar.toLowerCase();
  if (pillar.includes('education') || pillar.includes('trust')) return 'Nak kami bantu semak pilihan yang sesuai? Hantar tarikh, lokasi dan jenis kereta.';
  if (pillar.includes('faq') || pillar.includes('process')) return 'Nak mula semak? Hantar tarikh + lokasi + kategori kereta.';
  if (pillar.includes('conversion')) return 'Nak semak sekarang? WhatsApp tarikh, lokasi, kereta pilihan dan bajet.';
  if (pillar.includes('use case') || pillar.includes('traveller')) return 'Dah ada tarikh perjalanan? Hantar tarikh, lokasi dan keperluan kereta untuk kami semak.';
  return 'Tak nak buka banyak chat? WhatsApp tarikh, lokasi dan kereta yang anda cari kepada SewaPro.';
}

export function buildProductionPack(
  input: ProductionInput,
  knowledgeItems: ProductionKnowledgeItem[],
  visualContext: ProductionVisualContext = {},
): ProductionPack {
  const isSewaPro = input.brandName.toLowerCase().includes('sewapro');
  const isMalay = /bahasa|melayu|manglish/i.test(input.language);
  const preferredCta = knowledge(knowledgeItems, 'Preferred CTA');
  const availabilityRule = knowledge(knowledgeItems, 'Availability rule');
  const cta = isSewaPro && isMalay
    ? naturalSewaProCta(input)
    : input.cta || preferredCta || 'WhatsApp kami dengan tarikh, lokasi dan kereta pilihan untuk semak availability.';
  const body = isSewaPro ? sewProBody(input) : `${input.concept} Keep the explanation practical, specific and grounded in the saved Brand Brain.`;
  const script = `${input.hook}\n\n${body}\n\n${cta}`;
  const caption = isSewaPro
    ? `${input.hook}\n\nBagi requirement sekali kepada SewaPro. Kami bantu semak dan shortlist pilihan daripada rental partner supaya anda boleh bandingkan dengan lebih mudah. Harga dan availability tertakluk kepada pengesahan semasa.\n\n${cta}`
    : `${input.hook}\n\n${body}\n\n${cta}`;
  const storyboard = storyboardFor(input, body, cta, visualContext);
  const brandRules = visualContextText(visualContext);

  return {
    strategy: `Turn Day content into a production-ready ${input.format} using a ${input.pillar.toLowerCase()} angle. Keep the hook intact, explain one idea only, and end with one clear next action.`,
    hook: input.hook,
    angle: `${input.pillar} — ${input.concept}`,
    script,
    caption,
    cta,
    creative_prompt: `Create a vertical 9:16 ${input.format} for ${input.platform}, designed for Malaysian audiences. Target duration: about 20-25 seconds unless the selected format requires otherwise. Use authentic UGC/POV visual language, realistic phone interactions and natural lighting. First 2 seconds must show the problem and exact hook: “${input.hook}”. Then visually explain the SewaPro one-request flow using date, location and preferred car/category. Maintain the same phone, hand, lighting and visual identity across scenes. ${brandRules} Do not show fake prices, fake reviews or guaranteed availability. Add readable Malay subtitles. End with one WhatsApp CTA. ${availabilityRule ? `Mandatory brand rule: ${availabilityRule}` : ''}`,
    storyboard,
    qa_notes: [
      'No fake urgency, fake testimonials or invented discounts.',
      'Do not imply SewaPro owns the rental vehicles.',
      'Do not claim a vehicle is available until a rental partner confirms it.',
      'Use only approved Brand Assets for logos, screenshots and visual references.',
      'Keep spoken Malay natural and short enough for the selected format.',
      'Use one CTA only; avoid repeating the same request in both body and ending.',
    ],
  };
}
