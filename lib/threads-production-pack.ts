import type {
  ProductionInput,
  ProductionKnowledgeItem,
  ProductionVisualContext,
  ProductionPack,
} from './production-pack-generator';

function brandKind(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('sewapro')) return 'sewapro';
  if (lower.includes('kampusride')) return 'kampusride';
  return 'generic';
}

function naturalQuestion(input: ProductionInput, kind: string) {
  if (input.cta && /\?$/.test(input.cta.trim())) return input.cta.trim();
  const p = input.pillar.toLowerCase();
  if (kind === 'kampusride') {
    if (p.includes('driver')) return 'Driver kampus — korang prefer check ride feed atau monitor group chat?';
    if (p.includes('female')) return 'Female passengers — preference macam ni penting tak untuk korang?';
    if (p.includes('privacy')) return 'Korang prefer chat dalam app dulu atau terus share nombor?';
    return 'Student UIA — korang paling penat part mana bila cari transporter?';
  }
  if (kind === 'sewapro') {
    if (p.includes('trust') || p.includes('education')) return 'Kalau korang sewa kereta, benda pertama korang check apa?';
    return 'Apa part paling leceh bila cari kereta rental?';
  }
  return 'Apa pendapat korang tentang benda ni?';
}

function bodyFor(input: ProductionInput, kind: string) {
  const p = input.pillar.toLowerCase();
  if (kind === 'kampusride') {
    if (p.includes('driver')) return 'Ada masa free? Switch Driver mode, check ride yang sesuai dengan route dan masa, then offer kalau ngam. Tak perlu duduk refresh group sepanjang hari. Fare ride dibayar terus kepada driver; jangan anggap ada guaranteed job atau income.';
    if (p.includes('female')) return 'Kalau female passenger lebih selesa dengan female driver, preference patut boleh dinyatakan masa post ride. Tapi supply boleh limited ikut masa, jadi preference bukan guarantee. Better expectation jelas daripada overpromise.';
    if (p.includes('privacy')) return 'Kalau request, offers dan chat boleh duduk dalam app, tak perlu share nombor phone dekat setiap orang yang reply. Benda kecil, tapi ia kurangkan friction bila ride community melibatkan orang yang kita belum kenal.';
    if (p.includes('reputation') || p.includes('trust')) return 'Harga memang penting, tapi context pun penting. Rating/reputation, car details dan offer note boleh bantu passenger compare dengan lebih informed. Ia bantu accountability — bukan jaminan keselamatan.';
    return 'Current transporter flow sebenarnya dah familiar: passenger post, drivers offer, passenger pilih. KampusRide tak cuba ubah behaviour tu sangat — cuma susun request, offer, pilihan dan chat dalam satu tempat supaya kurang chaos.';
  }
  if (kind === 'sewapro') {
    if (p.includes('trust') || p.includes('education')) return 'Harga dekat poster belum tentu sama dengan final booking untuk tarikh, lokasi dan category yang anda perlukan. Lagi useful kalau confirm detail dan availability dulu, kemudian baru compare option.';
    if (p.includes('use case')) return 'Bila kereta sendiri tak available atau trip dah dekat, benda terakhir yang kita nak ialah repeat requirement dekat banyak seller. SewaPro cuba jadikan flow tu lebih simple: bagi requirement sekali, kami bantu semak dan shortlist pilihan partner.';
    return 'Cari rental satu-satu boleh jadi lebih penat daripada pilih kereta itu sendiri. SewaPro dibina atas idea simple: tarikh + lokasi + category/model yang dicari → semak beberapa partner → shortlist pilihan untuk customer review.';
  }
  return `${input.concept} Tulis sebagai satu observation yang berguna, bukan hard sell. Fokus pada satu idea sahaja dan beri enough context supaya pembaca boleh respond secara meaningful.`;
}

function optionalVisualPrompt(input: ProductionInput, context: ProductionVisualContext) {
  const colours = [context.primary_color, context.secondary_color, context.accent_color].filter(Boolean).join(', ');
  const assets = context.asset_kinds?.includes('screenshot') ? 'Use an approved real app/UI screenshot if relevant.' : '';
  return `Optional supporting image for a Threads post by ${input.brandName}. Clean square or portrait social graphic, one simple idea only, no dense ad layout. ${colours ? `Use approved brand colours: ${colours}.` : ''} ${assets} Do not fabricate testimonials, prices, ratings, availability, verification or institutional endorsement. The Threads post must still work without this image.`;
}

export function buildThreadsProductionPack(
  input: ProductionInput,
  _knowledgeItems: ProductionKnowledgeItem[],
  visualContext: ProductionVisualContext = {},
): ProductionPack {
  const kind = brandKind(input.brandName);
  const question = naturalQuestion(input, kind);
  const body = bodyFor(input, kind);
  const post = `${input.hook}\n\n${body}\n\n${question}`;

  return {
    strategy: `Create a Threads-native ${input.pillar.toLowerCase()} post for ${input.brandName}: one sharp thought, useful context, and one genuine discussion prompt. Keep the sell soft and use replies as audience research.`,
    hook: input.hook,
    angle: `${input.pillar} — ${input.concept}`,
    script: post,
    caption: post,
    cta: question,
    creative_prompt: `THREADS PRODUCTION BRIEF. Publish as a text-first Threads post in ${input.language}. Use short conversational paragraphs and natural Malaysian language. Lead with the exact first line “${input.hook}”. Explain one idea only. End with one genuine question that helps learn what the audience thinks. Avoid corporate ad copy, repeated CTA, forced engagement bait, hashtag stuffing, fake urgency and unsupported claims. Optional supporting media is secondary; the text must stand on its own.`,
    storyboard: [{
      scene: 1,
      duration: 'Optional visual',
      visual: 'Text-first Threads post. Add one supporting brand image or app screenshot only if it genuinely adds context.',
      on_screen_text: '',
      voiceover: '',
      image_prompt: optionalVisualPrompt(input, visualContext),
    }],
    qa_notes: kind === 'kampusride'
      ? [
          'Do not claim guaranteed safety, ride availability or female-driver matching.',
          'Do not imply every driver is an IIUM student or formally document-verified.',
          'Do not imply KampusRide employs drivers or processes ride fares.',
          'Keep the post conversational and campus-native; avoid sounding like an ad.',
          'Ask one meaningful question only; do not manufacture engagement bait.',
        ]
      : kind === 'sewapro'
        ? [
            'Do not claim guaranteed vehicle availability or cheapest price.',
            'Do not invent testimonials, discounts, prices or urgency.',
            'Do not imply SewaPro owns the rental vehicles.',
            'Keep the post conversational and useful; selling should be secondary.',
            'Ask one meaningful question only; do not manufacture engagement bait.',
          ]
        : [
            'Use only verified Brand Brain and Knowledge Base claims.',
            'Keep one idea per post and one genuine discussion prompt.',
            'Avoid corporate ad language, fake urgency and engagement bait.',
          ],
  };
}
