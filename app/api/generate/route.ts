import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildCampaignPrompt, type PromptKnowledgeItem } from '@/lib/prompt';
import { buildDemoResult } from '@/lib/demo-generator';
import { buildThreadsDemoResult } from '@/lib/threads-generator';
import { buildKampusRideCampaignResult, isKampusRide } from '@/lib/kampusride-strategy';
import { buildKampusRidePreLaunchCampaignResult } from '@/lib/kampusride-launch-context';

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
  return supabase;
}

async function loadKnowledge(supabase: any, brandName: string): Promise<PromptKnowledgeItem[]> {
  const { data: brandRows } = await supabase
    .from('contentos_brands')
    .select('id')
    .ilike('name', brandName)
    .order('updated_at', { ascending: false })
    .limit(1);

  const brandId = (brandRows as Array<{ id: string }> | null)?.[0]?.id;
  if (!brandId) return [];

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
    const supabase = await getAuthenticatedClient(req);
    if (!supabase) {
      return Response.json({ error: 'Please sign in before generating content.' }, { status: 401 });
    }

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const knowledge = await loadKnowledge(supabase, parsed.data.brand.name);
    const isThreads = /threads/i.test(parsed.data.brief.platform);
    const kampusRide = isKampusRide(parsed.data.brand.name);

    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
      if (kampusRide) {
        const fallback = buildKampusRideCampaignResult(parsed.data);
        return Response.json(buildKampusRidePreLaunchCampaignResult(parsed.data, knowledge, fallback));
      }
      return Response.json(isThreads
        ? buildThreadsDemoResult(parsed.data, knowledge)
        : buildDemoResult(parsed.data, knowledge));
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

    const aiResult = { ...validated, mode: 'ai' as const };
    return Response.json(kampusRide
      ? buildKampusRidePreLaunchCampaignResult(parsed.data, knowledge, aiResult)
      : aiResult);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
