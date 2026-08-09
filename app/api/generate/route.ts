import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildCampaignPrompt, type PromptKnowledgeItem } from '@/lib/prompt';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    product: z.string().min(1),
    audience: z.string().min(1),
    positioning: z.string(),
    voice: z.string(),
    offer: z.string(),
    proof: z.string(),
    cta: z.string(),
    avoid: z.string(),
  }),
  brief: z.object({
    objective: z.string().min(1),
    platform: z.string().min(1),
    format: z.string().min(1),
    language: z.string().min(1),
    count: z.number().int().min(1).max(10),
    extra: z.string(),
  }),
});

const ResultSchema = z.object({
  strategy: z.string(),
  variants: z.array(z.object({
    hook: z.string(),
    angle: z.string(),
    script: z.string(),
    caption: z.string(),
    cta: z.string(),
    creative_prompt: z.string(),
  })),
});

type Input = z.infer<typeof InputSchema>;

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function findKnowledge(knowledge: PromptKnowledgeItem[], title: string) {
  return knowledge.find((item) => item.title.toLowerCase() === title.toLowerCase())?.content || '';
}

function buildDemoResult(data: Input, knowledge: PromptKnowledgeItem[]) {
  const isMalay = /bahasa|melayu|manglish/i.test(data.brief.language);
  const isSewaPro = data.brand.name.toLowerCase().includes('sewapro');
  const cta = data.brand.cta || findKnowledge(knowledge, 'Preferred CTA') || (isMalay ? 'WhatsApp kami untuk semak pilihan.' : 'Contact us to check suitable options.');
  const bookingFlow = findKnowledge(knowledge, 'Booking flow');
  const availabilityRule = findKnowledge(knowledge, 'Availability rule');
  const trustRule = findKnowledge(knowledge, 'Trust rules');

  const sewaproAngles = [
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
    {
      hook: 'Landing KL dan perlukan kereta? Bagi detail sebelum sampai.',
      angle: 'Traveller use case — pre-arrival convenience.',
      script: `Kalau anda akan sampai KL dan perlukan kereta rental, hantar detail lebih awal: tarikh, lokasi pickup atau delivery dan kategori kereta. SewaPro bantu semak pilihan daripada rental partner supaya anda boleh review sebelum confirm. ${cta}`,
    },
    {
      hook: 'Tak pasti nak pilih Sedan, MPV atau SUV?',
      angle: 'Decision support — help customers choose the right vehicle category.',
      script: `Tak semua trip perlukan kereta yang sama. Beritahu SewaPro berapa orang, berapa lama sewa dan kegunaan anda. Kami bantu shortlist kategori serta pilihan yang lebih sesuai berdasarkan availability partner. ${cta}`,
    },
    {
      hook: 'Satu request. Beberapa pilihan. Anda pilih.',
      angle: 'Simple product explanation — describe the SewaPro model in one line.',
      script: `SewaPro bukan satu lagi fleet kereta rental. Kami bantu anda cari. Hantar requirement sekali, kami semak network rental partner dan shortlist pilihan yang sesuai. Anda review detail, kemudian pilih mana yang anda nak. ${cta}`,
    },
    {
      hook: 'Sebelum transfer deposit, confirm benda ni dulu.',
      angle: 'Educational trust content that naturally introduces SewaPro.',
      script: `Sebelum confirm rental, pastikan tarikh, jenis kereta, harga dan availability memang jelas. Jangan assume berdasarkan posting lama. Dengan SewaPro, pilihan yang diberi perlu disemak dengan partner sebelum booking disahkan. ${cta}`,
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

  const angleBank = isSewaPro ? sewaproAngles : genericAngles;
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const base = angleBank[index % angleBank.length];
    const productionNotes = data.brief.extra ? ` Extra campaign direction: ${data.brief.extra}` : '';
    const knowledgeNotes = [bookingFlow, availabilityRule].filter(Boolean).join(' ');

    return {
      hook: base.hook,
      angle: base.angle,
      script: base.script,
      caption: isSewaPro
        ? `Tak perlu cari rental satu-satu. Hantar tarikh, lokasi dan kereta yang anda perlukan kepada SewaPro — kami bantu semak pilihan yang sesuai. Availability & harga tertakluk kepada pengesahan partner. ${cta}`
        : `${data.brand.name} — ${data.brand.offer || data.brand.product}. ${cta}`,
      cta,
      creative_prompt: `Create a ${data.brief.format} for ${data.brief.platform}. Use the hook “${base.hook}” in the first 1-2 seconds. Audience context: ${data.brand.audience}. Visual style: authentic, mobile-first, natural Malaysian UGC where relevant, realistic phone/WhatsApp interactions, concise subtitles, fast clear pacing, no fake testimonials or unverified claims. Show the problem first, then the simpler process, then the CTA. Language: ${data.brief.language}.${productionNotes}${knowledgeNotes ? ` Brand constraints: ${knowledgeNotes}` : ''}`,
    };
  });

  return {
    strategy: isSewaPro
      ? 'Zero-cost strategy: position SewaPro as the car-rental finder that replaces multiple searches with one request. Variants rotate through pain-point, convenience, comparison and real-life use cases while preserving pricing and availability rules.'
      : `Zero-cost strategy: use distinct pain-point, convenience and trust angles for ${data.brand.name}, grounded in the saved Brand Brain and Knowledge Base.`,
    variants,
    mode: 'demo' as const,
  };
}

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}

async function loadKnowledge(supabase: ReturnType<typeof createSupabaseClient>, brandName: string) {
  const { data: brandRows } = await supabase
    .from('contentos_brands')
    .select('id')
    .ilike('name', brandName)
    .order('updated_at', { ascending: false })
    .limit(1);

  const brandId = brandRows?.[0]?.id;
  if (!brandId) return [] as PromptKnowledgeItem[];

  const { data } = await supabase
    .from('contentos_knowledge_items')
    .select('kind,title,content')
    .eq('brand_id', brandId)
    .order('updated_at', { ascending: false })
    .limit(40);

  return (data ?? []) as PromptKnowledgeItem[];
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in before generating content.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const knowledge = await loadKnowledge(auth.supabase, parsed.data.brand.name);

    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
      return Response.json(buildDemoResult(parsed.data, knowledge));
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = buildCampaignPrompt(parsed.data.brand, parsed.data.brief, knowledge);
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL,
      input: prompt,
    });

    const output = extractJson(response.output_text || '');
    const validated = ResultSchema.parse(output);

    if (validated.variants.length !== parsed.data.brief.count) {
      return Response.json({ error: 'Model returned the wrong number of variants.' }, { status: 502 });
    }

    return Response.json({ ...validated, mode: 'ai' });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
