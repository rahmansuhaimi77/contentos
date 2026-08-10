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

function brandKind(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('sewapro')) return 'sewapro';
  if (lower.includes('kampusride')) return 'kampusride';
  return 'generic';
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
  if (/brand|position/i.test(input.pillar)) {
    return 'SewaPro bukan satu lagi page yang pegang satu fleet sahaja. Anda bagi requirement sekali, kami semak rangkaian rental partner dan shortlist pilihan yang sesuai. Anda tengok detail dan pilih mana yang paling sesuai.';
  }
  return `${input.concept} Dengan SewaPro, customer bagi requirement sekali dan kami bantu semak serta shortlist pilihan daripada rental partner. Harga dan availability mesti disahkan sebelum booking.`;
}

function kampusRideBody(input: ProductionInput) {
  const h = input.hook.toLowerCase();
  const p = input.pillar.toLowerCase();
  if (h.includes('6 dm') || h.includes('post sekali') || h.includes('satu request')) {
    return 'Cara lama: post dekat group, lepas tu banyak driver masuk DM dan anda kena compare satu-satu. Dengan KampusRide, post ride sekali, tengok semua offer dalam satu tempat, compare price dan reputation, kemudian pilih driver yang anda nak. Lepas match, coordinate dalam in-app chat.';
  }
  if (p.includes('driver') || h.includes('driver mode') || h.includes('camp telegram')) {
    return 'Kalau anda driver dan ada masa free, tak perlu tunggu dalam group sepanjang masa. Switch ke Driver mode, tengok ride yang sedang cari driver, semak route dan price guide, kemudian offer hanya untuk ride yang sesuai dengan masa anda. Fare ride dibayar terus oleh passenger kepada driver; KampusRide tidak potong commission setiap ride.';
  }
  if (p.includes('privacy') || h.includes('nombor phone') || h.includes('boleh nampak')) {
    return 'KampusRide bagi cukup context untuk driver dan passenger buat keputusan tanpa perlu terus share nombor phone kepada ramai orang. Lepas driver dipilih, coordination boleh dibuat dalam in-app chat. Fokusnya privacy dan satu conversation yang lebih tersusun.';
  }
  if (p.includes('female') || h.includes('female')) {
    return 'Kalau anda lebih selesa dengan female driver, anda boleh letak preference masa buat ride request. Preference itu membantu prioritise female driver bila available, tetapi bukan guarantee kerana supply mungkin terhad pada waktu tertentu.';
  }
  if (p.includes('reputation') || h.includes('rating') || h.includes('cheapest')) {
    return 'Bila compare offer, jangan tengok harga sahaja. KampusRide bantu anda tengok reputation, rating, car details dan offer note supaya pilihan lebih informed. Rating membantu accountability dari ride ke ride, tetapi bukan jaminan keselamatan.';
  }
  if (p.includes('price') || h.includes('rm3') || h.includes('price guide')) {
    return 'KampusRide guna suggested price anchor berdasarkan route dan community rate sebagai panduan. Driver masih boleh buat offer atau counter ikut flow marketplace. Jadi price guide memudahkan expectation, bukan janji bahawa setiap ride mesti fixed pada satu harga.';
  }
  if (p.includes('multi') || h.includes('add stop') || h.includes('pickup member')) {
    return 'Kalau ada intermediate stop, anda boleh tambah stop dalam request supaya driver nampak route dengan lebih jelas sebelum offer. Extra stop bukan automatik bermaksud harga tak berubah — driver tetap boleh pertimbangkan route masa buat offer.';
  }
  if (p.includes('faq') && h.includes('bayar')) {
    return 'Passenger bayar fare terus kepada driver yang dipilih. KampusRide tidak pegang atau process fare ride. App urus request, offer, chat, ride status dan reputation — payment ride kekal peer-to-peer.';
  }
  if (p.includes('faq') && h.includes('student')) {
    return 'KampusRide direka untuk community sekitar kampus, tetapi driver pool boleh jadi mixed. Jangan assume semua driver ialah student IIUM atau document-verified. Sebelum pilih, semak profile, car details, offer dan reputation yang tersedia dalam app.';
  }
  if (/position|brand/i.test(p) || h.includes('grab versi kampus')) {
    return 'KampusRide bukan e-hailing corporate yang auto-assign driver. Ia marketplace ride community: passenger post request, drivers offer, passenger compare dan pilih, kemudian kedua-dua pihak coordinate dalam app. Struktur familiar, tapi lebih transparent dan accountable.';
  }
  return `${input.concept} Fokus pada satu manfaat sahaja: post ride, compare offer dengan lebih jelas, pilih driver sendiri dan coordinate dalam app. Jangan overclaim safety, verification, fare atau availability.`;
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
  else rules.push('No official logo asset is available yet. Use the text brand name only and do not fabricate a logo.');
  if (kinds.includes('screenshot')) rules.push('Approved screenshots exist in Brand Assets; use them as UI/layout references instead of inventing app screens.');
  if (kinds.includes('vehicle')) rules.push('Approved vehicle/product photos exist in Brand Assets; prefer those references over inventing specific vehicle details.');
  if (kinds.includes('visual_reference')) rules.push('Approved visual references exist in Brand Assets; preserve their overall mood without copying third-party branding.');
  return rules.join(' ');
}

function environmentFor(input: ProductionInput) {
  const kind = brandKind(input.brandName);
  if (kind === 'kampusride') return 'authentic Malaysian university-campus environment, IIUM-style campus architecture and student-life context where appropriate';
  if (kind === 'sewapro') return 'everyday Kuala Lumpur / Selangor environment';
  return 'authentic Malaysian everyday environment';
}

function scenePrompt(input: ProductionInput, scene: number, visual: string, text: string, visualContext: ProductionVisualContext) {
  const brandRules = visualContextText(visualContext);
  return `Vertical 9:16 realistic Malaysian UGC storyboard frame for ${input.brandName}. ${environmentFor(input)}. Natural daylight, authentic smartphone-camera look, believable hands/people, clean composition with safe space for subtitles. Keep the same main person, phone, wardrobe, lighting style and visual identity across all scenes. ${brandRules} Scene ${scene}: ${visual} Reserve space for on-screen text: “${text}”. Do not invent prices, reviews, availability, verification badges, institutional endorsements or unsupported UI. No watermark, no stock-photo look, no extra promotional claims.`;
}

function nonVideoStoryboard(input: ProductionInput, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const kind = brandKind(input.brandName);
  const frames = [
    { scene: 1, duration: 'Frame 1', visual: 'Bold problem-led headline on a clean mobile-first layout.', on_screen_text: input.hook, voiceover: '' },
    { scene: 2, duration: 'Frame 2', visual: kind === 'kampusride' ? 'Simple visual explaining the campus ride problem and the KampusRide request → offers → choose flow.' : 'Simple visual explaining the problem and the brand process.', on_screen_text: kind === 'kampusride' ? 'Post → offers → pilih' : 'Satu request → proses lebih mudah', voiceover: '' },
    { scene: 3, duration: 'Frame 3', visual: 'Clean CTA card using only approved brand assets.', on_screen_text: cta, voiceover: '' },
  ];
  return frames.map((frame) => ({ ...frame, image_prompt: scenePrompt(input, frame.scene, frame.visual, frame.on_screen_text, visualContext) }));
}

function sewProStoryboard(input: ProductionInput, body: string, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const sentences = body.split('.').map((part) => part.trim()).filter(Boolean);
  const scenes = [
    { scene: 1, duration: '0-2s', visual: 'POV phone screen showing the frustrating rental-search situation. Fast punch-in.', on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: '2-7s', visual: 'Quick cuts of multiple rental chats/search results, then stop on one clean SewaPro WhatsApp conversation.', on_screen_text: 'Tak perlu cari satu-satu', voiceover: `${sentences.slice(0, 2).join('. ')}.` },
    { scene: 3, duration: '7-14s', visual: 'Show a clean message containing rental date, location and preferred car/category, followed by neutral shortlisted options.', on_screen_text: 'Tarikh + lokasi + kereta', voiceover: sentences.slice(2).join('. ') || 'Bagi requirement sekali. SewaPro bantu semak pilihan yang sesuai.' },
    { scene: 4, duration: '14-20s', visual: 'Customer reviewing one option; small note that price and availability require partner confirmation.', on_screen_text: 'Harga & availability disahkan dahulu', voiceover: 'Harga dan availability disahkan dengan rental partner sebelum booking.' },
    { scene: 5, duration: '20-25s', visual: 'SewaPro WhatsApp CTA screen with subtle phone tap animation and only approved brand assets.', on_screen_text: cta, voiceover: cta },
  ];
  return scenes.map((scene) => ({ ...scene, image_prompt: scenePrompt(input, scene.scene, scene.visual, scene.on_screen_text, visualContext) }));
}

function kampusRideStoryboard(input: ProductionInput, body: string, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const p = input.pillar.toLowerCase();
  const isDriver = p.includes('driver');
  const isFemale = p.includes('female');
  const isPrivacy = p.includes('privacy');
  const isReputation = p.includes('reputation') || p.includes('trust');
  let scenes: Omit<StoryboardScene, 'image_prompt'>[];

  if (isDriver) {
    scenes = [
      { scene: 1, duration: '0-2s', visual: 'Student/young driver POV staring at a busy phone group chat, clearly tired of refreshing it.', on_screen_text: input.hook, voiceover: input.hook },
      { scene: 2, duration: '2-7s', visual: 'Same person switches into KampusRide Driver mode on the phone. Use real app screenshot reference if supplied.', on_screen_text: 'Free? Switch Driver mode', voiceover: 'Kalau anda free, tak perlu camp group sepanjang masa.' },
      { scene: 3, duration: '7-14s', visual: 'Phone shows a clean list of ride requests with route and price-guide context, no invented numbers beyond approved app references.', on_screen_text: 'Check ride yang sesuai', voiceover: 'Tengok ride yang tengah cari driver, semak route dan offer bila sesuai.' },
      { scene: 4, duration: '14-20s', visual: 'Driver taps an offer action, then a simple matched/chat state. Keep direct-fare idea visual but do not show fake earnings.', on_screen_text: 'Offer bila anda available', voiceover: 'Passenger pilih offer. Fare ride dibayar terus kepada driver.' },
      { scene: 5, duration: '20-25s', visual: 'Campus parking/road POV with clean KampusRide CTA card.', on_screen_text: cta, voiceover: cta },
    ];
  } else if (isFemale) {
    scenes = [
      { scene: 1, duration: '0-2s', visual: 'Female student holding phone in a calm campus setting, thinking about ride preference.', on_screen_text: input.hook, voiceover: input.hook },
      { scene: 2, duration: '2-7s', visual: 'Close phone view showing the driver-gender-preference control in the real KampusRide request flow if an approved screenshot exists.', on_screen_text: 'Set preference masa post ride', voiceover: 'Kalau lebih selesa dengan female driver, letak preference masa post ride.' },
      { scene: 3, duration: '7-14s', visual: 'Request submitted with a subtle preference indicator. Do not show a guaranteed match.', on_screen_text: 'Prioritise bila available', voiceover: 'KampusRide boleh prioritise female driver bila available.' },
      { scene: 4, duration: '14-20s', visual: 'Transparent informational card: availability depends on driver supply. Friendly, reassuring tone.', on_screen_text: 'Preference ≠ guarantee', voiceover: 'Supply mungkin terhad, jadi preference bukan guarantee.' },
      { scene: 5, duration: '20-25s', visual: 'Female student continues normal campus day with simple app CTA overlay.', on_screen_text: cta, voiceover: cta },
    ];
  } else if (isPrivacy || isReputation) {
    scenes = [
      { scene: 1, duration: '0-2s', visual: 'POV phone scene showing the exact problem in the hook: scattered DMs, privacy concern or confusing driver choice.', on_screen_text: input.hook, voiceover: input.hook },
      { scene: 2, duration: '2-7s', visual: 'KampusRide offer screen with profile/reputation information or in-app chat, using approved screenshot if available.', on_screen_text: isPrivacy ? 'Chat dalam app' : 'Compare lebih daripada harga', voiceover: isPrivacy ? 'Tak perlu terus share nombor phone dekat ramai orang.' : 'Tengok reputation, car details dan offer sebelum pilih.' },
      { scene: 3, duration: '7-14s', visual: 'Passenger reviews two or three offers in one clean screen. No fake ratings unless supplied by an approved real screenshot.', on_screen_text: 'Semua offer satu tempat', voiceover: 'Semua offer duduk satu tempat supaya senang compare.' },
      { scene: 4, duration: '14-20s', visual: 'Matched ride transitions into in-app chat / ride-status screen.', on_screen_text: 'Pilih → chat → ride', voiceover: 'Lepas pilih driver, coordinate dan follow ride dalam app.' },
      { scene: 5, duration: '20-25s', visual: 'Warm campus CTA frame, community-first rather than corporate.', on_screen_text: cta, voiceover: cta },
    ];
  } else {
    scenes = [
      { scene: 1, duration: '0-2s', visual: 'Authentic campus POV showing the exact pain point or relatable situation in the hook.', on_screen_text: input.hook, voiceover: input.hook },
      { scene: 2, duration: '2-7s', visual: 'Phone opens KampusRide and creates or shows a ride request with route/time/pax. Use real UI if approved screenshot exists.', on_screen_text: 'Post ride sekali', voiceover: 'Post route, masa dan detail ride sekali.' },
      { scene: 3, duration: '7-14s', visual: 'Multiple driver offers appear together in one screen; passenger compares without jumping across DMs.', on_screen_text: 'Compare offer', voiceover: 'Driver offer. Anda compare price, profile dan reputation.' },
      { scene: 4, duration: '14-20s', visual: 'Passenger chooses one offer, then clean in-app chat or ride-status transition.', on_screen_text: 'Pilih → chat → ride', voiceover: 'Pilih driver yang anda nak, then coordinate dalam app.' },
      { scene: 5, duration: '20-25s', visual: 'Realistic campus arrival / walking-to-car moment with clean KampusRide CTA overlay.', on_screen_text: cta, voiceover: cta },
    ];
  }

  return scenes.map((scene) => ({ ...scene, image_prompt: scenePrompt(input, scene.scene, scene.visual, scene.on_screen_text, visualContext) }));
}

function genericStoryboard(input: ProductionInput, body: string, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const scenes = [
    { scene: 1, duration: '0-3s', visual: 'Show the specific problem in the hook in a natural real-world setting.', on_screen_text: input.hook, voiceover: input.hook },
    { scene: 2, duration: '3-10s', visual: 'Introduce the brand process or solution with a simple phone/product interaction.', on_screen_text: 'Cara lebih mudah', voiceover: body },
    { scene: 3, duration: '10-16s', visual: 'Show the user reviewing the useful result or next step.', on_screen_text: input.brandName, voiceover: '' },
    { scene: 4, duration: '16-22s', visual: 'Close with one clear action and approved brand assets.', on_screen_text: cta, voiceover: cta },
  ];
  return scenes.map((scene) => ({ ...scene, image_prompt: scenePrompt(input, scene.scene, scene.visual, scene.on_screen_text, visualContext) }));
}

function storyboardFor(input: ProductionInput, body: string, cta: string, visualContext: ProductionVisualContext): StoryboardScene[] {
  const isVideo = /video|reels|tiktok|ugc|talking/i.test(`${input.platform} ${input.format}`);
  if (!isVideo) return nonVideoStoryboard(input, cta, visualContext);
  const kind = brandKind(input.brandName);
  if (kind === 'sewapro') return sewProStoryboard(input, body, cta, visualContext);
  if (kind === 'kampusride') return kampusRideStoryboard(input, body, cta, visualContext);
  return genericStoryboard(input, body, cta, visualContext);
}

function naturalSewaProCta(input: ProductionInput) {
  const pillar = input.pillar.toLowerCase();
  if (pillar.includes('education') || pillar.includes('trust')) return 'Nak kami bantu semak pilihan yang sesuai? Hantar tarikh, lokasi dan jenis kereta.';
  if (pillar.includes('faq') || pillar.includes('process')) return 'Nak mula semak? Hantar tarikh + lokasi + kategori kereta.';
  if (pillar.includes('conversion')) return 'Nak semak sekarang? WhatsApp tarikh, lokasi, kereta pilihan dan bajet.';
  if (pillar.includes('use case') || pillar.includes('traveller')) return 'Dah ada tarikh perjalanan? Hantar tarikh, lokasi dan keperluan kereta untuk kami semak.';
  return 'Tak nak buka banyak chat? WhatsApp tarikh, lokasi dan kereta yang anda cari kepada SewaPro.';
}

function naturalKampusRideCta(input: ProductionInput) {
  const pillar = input.pillar.toLowerCase();
  if (pillar.includes('driver')) return 'Switch ke Driver mode bila anda free dan check ride yang sesuai.';
  if (pillar.includes('female')) return 'Set preference masa post ride kalau itu lebih sesuai untuk anda.';
  if (pillar.includes('privacy') || pillar.includes('trust') || pillar.includes('reputation')) return 'Next ride, compare dulu dalam KampusRide.';
  if (pillar.includes('faq') || pillar.includes('education')) return 'Cuba flow KampusRide untuk ride seterusnya.';
  return 'Post ride anda dalam KampusRide dan compare offer dalam satu tempat.';
}

function captionFor(kind: string, input: ProductionInput, body: string, cta: string) {
  if (kind === 'sewapro') return `${input.hook}\n\nBagi requirement sekali kepada SewaPro. Kami bantu semak dan shortlist pilihan daripada rental partner supaya anda boleh bandingkan dengan lebih mudah. Harga dan availability tertakluk kepada pengesahan semasa.\n\n${cta}`;
  if (kind === 'kampusride') return `${input.hook}\n\n${body}\n\n${cta}\n\nKampusRide bantu susun request, offer, pilihan dan chat dalam satu flow. Fare ride dibayar terus kepada driver. Availability, final offer dan driver preference bergantung pada keadaan semasa.`;
  return `${input.hook}\n\n${body}\n\n${cta}`;
}

export function buildProductionPack(
  input: ProductionInput,
  knowledgeItems: ProductionKnowledgeItem[],
  visualContext: ProductionVisualContext = {},
): ProductionPack {
  const kind = brandKind(input.brandName);
  const isMalay = /bahasa|melayu|manglish/i.test(input.language);
  const preferredCta = knowledge(knowledgeItems, 'Preferred CTA');
  const availabilityRule = knowledge(knowledgeItems, 'Availability rule');
  const cta = kind === 'sewapro' && isMalay
    ? naturalSewaProCta(input)
    : kind === 'kampusride' && isMalay
      ? naturalKampusRideCta(input)
      : input.cta || preferredCta || 'Take the next step with the brand.';
  const body = kind === 'sewapro'
    ? sewProBody(input)
    : kind === 'kampusride'
      ? kampusRideBody(input)
      : `${input.concept} Keep the explanation practical, specific and grounded in the saved Brand Brain.`;
  const script = `${input.hook}\n\n${body}\n\n${cta}`;
  const caption = captionFor(kind, input, body, cta);
  const storyboard = storyboardFor(input, body, cta, visualContext);
  const brandRules = visualContextText(visualContext);

  const creativePrompt = kind === 'kampusride'
    ? `Create a vertical 9:16 ${input.format} for ${input.platform}, designed for Malaysian university audiences. Target about 20-25 seconds unless the selected format requires otherwise. First 2 seconds must show the exact hook: “${input.hook}”. Use authentic campus UGC/POV, natural daylight, student-life situations and realistic phone interactions. Show only the KampusRide feature relevant to this content, using approved app screenshots/assets whenever available. Maintain the same person, phone, wardrobe and visual identity across scenes. ${brandRules} Do not invent fares, ratings, user counts, verification badges, female-driver availability, institutional endorsement or safety guarantees. If discussing price, describe it as a guide/offer flow. If discussing female preference, explicitly preserve “preference, not guarantee”. Add readable natural Malay subtitles. End with one CTA.`
    : kind === 'sewapro'
      ? `Create a vertical 9:16 ${input.format} for ${input.platform}, designed for Malaysian audiences. Target about 20-25 seconds unless the selected format requires otherwise. Use authentic UGC/POV visual language, realistic phone interactions and natural lighting. First 2 seconds must show the problem and exact hook: “${input.hook}”. Then visually explain the SewaPro one-request flow using date, location and preferred car/category. Maintain the same phone, hand, lighting and visual identity across scenes. ${brandRules} Do not show fake prices, fake reviews or guaranteed availability. Add readable Malay subtitles. End with one WhatsApp CTA. ${availabilityRule ? `Mandatory brand rule: ${availabilityRule}` : ''}`
      : `Create a vertical 9:16 ${input.format} for ${input.platform}. Use the exact hook “${input.hook}” immediately, then explain one practical idea grounded in the saved Brand Brain. ${brandRules} Avoid unsupported claims and end with one CTA.`;

  const qaNotes = kind === 'kampusride'
    ? [
        'Do not claim guaranteed safety, guaranteed ride availability or guaranteed female driver matching.',
        'Do not imply every driver is an IIUM student or formally document-verified.',
        'Do not imply KampusRide employs drivers, owns vehicles, processes ride fares or takes a per-ride commission.',
        'Do not publish internal user, ride, rating or driver counts without explicit approval.',
        'Use only approved KampusRide Brand Assets/screenshots; never fabricate an IIUM endorsement or logo.',
        'Keep Malay/Manglish natural, campus-native and short enough for the selected format.',
        'Use one CTA only and keep the content focused on one product idea.',
      ]
    : [
        'No fake urgency, fake testimonials or invented discounts.',
        'Do not imply SewaPro owns the rental vehicles.',
        'Do not claim a vehicle is available until a rental partner confirms it.',
        'Use only approved Brand Assets for logos, screenshots and visual references.',
        'Keep spoken Malay natural and short enough for the selected format.',
        'Use one CTA only; avoid repeating the same request in both body and ending.',
      ];

  return {
    strategy: `Turn Day content into a production-ready ${input.format} using a ${input.pillar.toLowerCase()} angle. Keep the hook intact, explain one idea only, and end with one clear next action.`,
    hook: input.hook,
    angle: `${input.pillar} — ${input.concept}`,
    script,
    caption,
    cta,
    creative_prompt: creativePrompt,
    storyboard,
    qa_notes: qaNotes,
  };
}
