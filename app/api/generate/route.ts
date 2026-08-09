import OpenAI from 'openai';
import { z } from 'zod';
import { buildCampaignPrompt } from '@/lib/prompt';

export const runtime = 'nodejs';

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

export async function POST(req: Request) {
  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
      return Response.json({ error: 'OPENAI_API_KEY and OPENAI_MODEL must be configured.' }, { status: 500 });
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

    return Response.json(validated);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
