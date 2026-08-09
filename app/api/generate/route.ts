import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildCampaignPrompt } from '@/lib/prompt';

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

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildDemoResult(data: z.infer<typeof InputSchema>) {
  const variants = Array.from({ length: data.brief.count }, (_, index) => {
    const number = index + 1;
    return {
      hook: `${number}. ${data.brand.audience}: masih cari cara lebih mudah untuk ${data.brief.objective.toLowerCase()}?`,
      angle: `Lead with a specific audience problem, then position ${data.brand.name} as the practical next step without exaggerated claims.`,
      script: `Hook: ${data.brand.audience}, kalau anda perlukan ${data.brand.product}, jangan terus pilih berdasarkan harga sahaja.\n\nProblem: Fokus pada perkara yang paling menyusahkan atau berisiko untuk pelanggan.\n\nSolution: ${data.brand.name} membantu dengan ${data.brand.positioning || data.brand.product}.\n\nProof: ${data.brand.proof || 'Use only verified proof points supplied by the brand.'}\n\nCTA: ${data.brand.cta || 'Contact us to learn more.'}`,
      caption: `${data.brand.name} — ${data.brand.offer || data.brand.product}. ${data.brand.cta || 'DM us for details.'}`,
      cta: data.brand.cta || 'Contact us to learn more.',
      creative_prompt: `Create a ${data.brief.format} for ${data.brief.platform}. Audience: ${data.brand.audience}. Visual style: authentic, polished, mobile-first, natural lighting, no fake testimonials. Open with a clear visual problem in the first 2 seconds, show the service/product naturally, use concise on-screen text, and end with the CTA: ${data.brand.cta || 'Contact us'}. Language: ${data.brief.language}. Variant ${number}.`,
    };
  });

  return {
    strategy: `Demo mode: use a problem → practical solution → proof → CTA structure for ${data.brand.name}. Add an OpenAI API key later to replace these templates with model-generated strategy and copy.`,
    variants,
    mode: 'demo' as const,
  };
}

async function requireUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (!user) return Response.json({ error: 'Please sign in before generating content.' }, { status: 401 });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
      return Response.json(buildDemoResult(parsed.data));
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = buildCampaignPrompt(parsed.data.brand, parsed.data.brief);
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
