import OpenAI from 'openai';
import type { z } from 'zod';

/**
 * One way to ask an AI model for structured JSON.
 *
 * Provider order: Gemini (GEMINI_API_KEY, free tier) → OpenAI (OPENAI_API_KEY + OPENAI_MODEL).
 * With neither configured it returns null and callers fall back to the zero-cost demo path.
 *
 * Gemini model: GEMINI_MODEL if set; otherwise the best available Flash model is discovered
 * from the ListModels endpoint, so no model id is hardcoded here. On a quota error (429) the
 * next candidate (e.g. Flash-Lite, which has a much larger free daily quota) is tried.
 *
 * Free-tier Gemini prompts may be used by Google to improve its products. Only brand marketing
 * context is sent: never customer names, phone numbers or booking records.
 */

export type AiResult<T> = { data: T; provider: 'gemini' | 'openai'; model: string };

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
let geminiCandidates: { at: number; models: string[] } | null = null;

export function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL));
}

export function extractJson(text: string) {
  const cleaned = (text || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstObject = cleaned.indexOf('{');
  const firstArray = cleaned.indexOf('[');
  const start = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject) ? firstArray : firstObject;
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function rankGeminiModel(name: string) {
  const n = name.toLowerCase();
  let score = 0;
  if (n.includes('flash')) score += 100;
  if (n.includes('lite')) score -= 30;
  if (/preview|exp|experimental/.test(n)) score -= 20;
  if (/image|tts|audio|live|embedding|vision|thinking/.test(n)) score -= 1000;
  const version = Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
  return score + version;
}

async function geminiModels(apiKey: string): Promise<string[]> {
  if (process.env.GEMINI_MODEL) {
    return [process.env.GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODEL ? [process.env.GEMINI_FALLBACK_MODEL] : [])];
  }
  if (geminiCandidates && Date.now() - geminiCandidates.at < 6 * 60 * 60 * 1000) return geminiCandidates.models;
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`Gemini rejected the API key (${res.status}).`);
  const body = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
  const usable = (body.models ?? [])
    .filter((m) => m.name.includes('gemini') && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((name) => rankGeminiModel(name) > 0)
    .sort((a, b) => rankGeminiModel(b) - rankGeminiModel(a));
  const full = usable.find((n) => !n.includes('lite'));
  const lite = usable.find((n) => n.includes('lite'));
  const models = [full, lite].filter(Boolean) as string[];
  if (!models.length) throw new Error('No Gemini text model is available for this API key.');
  geminiCandidates = { at: Date.now(), models };
  return models;
}

const CALL_TIMEOUT_MS = Number(process.env.AI_CALL_TIMEOUT_MS || 50000);

async function callGemini(apiKey: string, model: string, system: string, prompt: string) {
  const started = Date.now();
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const error = new Error(`Gemini ${model} failed (${res.status}): ${detail.slice(0, 300)}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  const body = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  console.info(`[contentos ai] gemini ${model} ok in ${Date.now() - started}ms`);
  return body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

export async function generateJson<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<AiResult<T> | null> {
  const errors: string[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      for (const model of await geminiModels(geminiKey)) {
        try {
          const text = await callGemini(geminiKey, model, system, prompt);
          const parsed = schema.safeParse(extractJson(text));
          if (parsed.success) return { data: parsed.data, provider: 'gemini', model };
          errors.push(`${model}: output did not match the expected shape`);
        } catch (error) {
          const status = (error as { status?: number }).status;
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          errors.push(timedOut ? `${model}: timed out after ${CALL_TIMEOUT_MS}ms` : error instanceof Error ? error.message : String(error));
          if (!timedOut && status && ![429, 404, 500, 503].includes(status)) break;
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.responses.create({ model: process.env.OPENAI_MODEL, instructions: system, input: prompt });
      const parsed = schema.safeParse(extractJson(response.output_text || ''));
      if (parsed.success) return { data: parsed.data, provider: 'openai', model: process.env.OPENAI_MODEL };
      errors.push('openai: output did not match the expected shape');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length) console.error('[contentos ai] all providers failed, using demo fallback:', errors.join(' | '));
  return null;
}

export const SYSTEM_PROMPT = `You are the senior content strategist and copywriter for a Malaysian brand. You write audience-facing social content that sounds like a real local person, not a brand.

Hard rules:
- The VERIFIED FACTS are the only facts you may state. Never invent prices, availability, numbers, testimonials, reviews, guarantees, endorsements or capabilities.
- Obey every NEVER CLAIM line literally. If a request conflicts with one, follow the rule and still produce useful content.
- Production instructions are metadata. Never put task words ("Create a poster", "Static ad", "carousel", "follow this request") into hooks, scripts, captions or on-screen text.
- Every piece makes one point and has one CTA.
- Style references show voice and specificity. Write new ideas; never reuse their hooks.
- Return only JSON in the exact shape requested.`;
