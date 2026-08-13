import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const ContentTypeSchema = z.enum(['write', 'poster', 'carousel', 'video', 'pack']);

const InputSchema = z.object({
  brandId: z.string().uuid(),
  request: z.string().min(3).max(5000),
  contentType: ContentTypeSchema.optional(),
});

const FillSchema = z.object({
  idea: z.string().min(1),
  objective: z.string().min(1),
  phase: z.enum(['Pre-Launch', 'Launch Week', 'Early Growth', 'Evergreen']),
  platform: z.enum(['Instagram carousel', 'TikTok / Reels', 'Threads', 'Facebook', 'WhatsApp', 'Multi-platform']),
  format: z.enum(['Carousel', '15-30 second short-form video', 'UGC / POV video', 'Static ad', 'Threads text post', 'Long-form post']),
  language: z.string().min(1),
});

type Fill = z.infer<typeof FillSchema>;
type ContentType = z.infer<typeof ContentTypeSchema>;

type Brand = {
  name: string;
  product: string;
  audience: string;
  positioning: string;
  voice: string;
  offer: string;
  preferred_cta: string;
  avoid: string;
};

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Assistant did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function getAuthenticatedClient(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}

function defaultsForType(type: ContentType) {
  if (type === 'poster') return { platform: 'Instagram carousel' as const, format: 'Static ad' as const };
  if (type === 'carousel') return { platform: 'Instagram carousel' as const, format: 'Carousel' as const };
  if (type === 'video') return { platform: 'TikTok / Reels' as const, format: '15-30 second short-form video' as const };
  if (type === 'pack') return { platform: 'Multi-platform' as const, format: 'Long-form post' as const };
  return { platform: 'Multi-platform' as const, format: 'Long-form post' as const };
}

function platformFromRequest(request: string, contentType: ContentType) {
  if (/threads/i.test(request)) return 'Threads' as const;
  if (/whatsapp/i.test(request)) return 'WhatsApp' as const;
  if (/facebook|\bfb\b/i.test(request)) return 'Facebook' as const;
  if (/tiktok|reels?|short[- ]?form|vertical video/i.test(request)) return 'TikTok / Reels' as const;
  if (/multi[- ]?platform|all platforms|every platform/i.test(request)) return 'Multi-platform' as const;
  return defaultsForType(contentType).platform;
}

function formatFromRequest(request: string, platform: Fill['platform'], contentType: ContentType) {
  if (contentType === 'poster') return 'Static ad' as const;
  if (contentType === 'carousel') return 'Carousel' as const;
  if (contentType === 'video') return /ugc|pov/i.test(request) ? 'UGC / POV video' as const : '15-30 second short-form video' as const;
  if (contentType === 'pack' || contentType === 'write') return platform === 'Threads' ? 'Threads text post' as const : 'Long-form post' as const;
  return defaultsForType(contentType).format;
}

function phaseFromContext(currentPhase: string | null, request: string): Fill['phase'] {
  if (/evergreen/i.test(request)) return 'Evergreen';
  if (/early growth|growth phase|post[- ]launch/i.test(request)) return 'Early Growth';
  if (/launch week|launch day/i.test(request)) return 'Launch Week';
  if (/pre[- ]?launch|before launch|beta|coming soon/i.test(request)) return 'Pre-Launch';
  if (currentPhase === 'launch_week' || currentPhase === 'public_launch') return 'Launch Week';
  if (currentPhase === 'early_growth' || currentPhase === 'growth_optimisation' || currentPhase === 'retention') return 'Early Growth';
  return 'Pre-Launch';
}

function languageFromRequest(request: string) {
  if (/english only|in english|english language/i.test(request)) return 'English, natural and concise';
  if (/bahasa|\bbm\b|malay|manglish/i.test(request)) return 'Bahasa Melayu / natural Manglish, simple and human';
  return 'Bahasa Melayu / natural Manglish where appropriate';
}

function objectiveFromRequest(request: string) {
  if (/install|how to|tutorial|guide|step[- ]by[- ]step|onboard/i.test(request)) return 'Product education / onboarding — make the requested task easy to understand and complete.';
  if (/recruit|tester|beta tester|driver onboarding/i.test(request)) return 'Recruit the right participants with a clear, low-friction call to action.';
  if (/awareness|introduce|what is|brand intro/i.test(request)) return 'Build awareness and explain the product simply without over-selling.';
  if (/engagement|question|poll|feedback|conversation/i.test(request)) return 'Drive useful community engagement and collect actionable feedback.';
  if (/conversion|sign up|register|install now|download|book/i.test(request)) return 'Drive the next user action clearly while staying within current product and launch guardrails.';
  return 'Create a useful, platform-ready marketing asset that follows the request exactly.';
}

function expandRequest(brand: Brand, request: string, format: Fill['format'], contentType: ContentType) {
  const clean = request.trim();
  const install = /install.*kampusride|kampusride.*install|add to home screen|enable (push )?notifications?/i.test(clean);
  if (brand.name.toLowerCase().includes('kampusride') && install) {
    return 'Create a public 6-slide step-by-step tutorial titled “How to Install KampusRide + Enable Notifications”. This must be an installation tutorial, not a general brand introduction. Slide 1: How to Install KampusRide. Slide 2: Android — open KampusRide in Google Chrome. Slide 3: Android — tap the three-dot menu → Install app → Install. Slide 4: iPhone — open KampusRide in Safari → Share → Add to Home Screen → Open as Web App → Add. Slide 5: Enable Notifications — open KampusRide and tap Allow when the notification permission appears. Slide 6: Done — show the approved KR app icon on the Home Screen with “From Campus, For You.” Use simple BM / natural Manglish, short instructional copy and approved KampusRide branding. Do not turn this into a Telegram comparison or “What is KampusRide?” post. Do not imply App Store/Play Store availability, official IIUM endorsement, guaranteed safety, fares or live ride availability.';
  }
  const typeLabel = contentType === 'write' ? 'copy/caption' : contentType === 'pack' ? 'multi-platform post pack' : contentType;
  return `Create a ${typeLabel} (${format}) for ${brand.name}. Follow this request exactly: ${clean}. Keep it aligned with the brand audience and positioning. Make the output specific and production-ready rather than generic. Do not invent facts, proof, prices, availability, endorsements or guarantees.`;
}

function smartFill(brand: Brand, currentPhase: string | null, request: string, contentType: ContentType): Fill {
  const platform = platformFromRequest(request, contentType);
  const format = formatFromRequest(request, platform, contentType);
  return {
    idea: expandRequest(brand, request, format, contentType),
    objective: objectiveFromRequest(request),
    phase: phaseFromContext(currentPhase, request),
    platform,
    format,
    language: languageFromRequest(request),
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await getAuthenticatedClient(req);
    if (!supabase) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Tell the assistant what you want to create.' }, { status: 400 });

    const contentType: ContentType = parsed.data.contentType || 'carousel';
    const [{ data: brandRow, error: brandError }, { data: growthRow }, { data: knowledgeRows }] = await Promise.all([
      supabase.from('contentos_brands').select('name,product,audience,positioning,voice,offer,preferred_cta,avoid').eq('id', parsed.data.brandId).single(),
      supabase.from('contentos_growth_profiles').select('current_phase').eq('brand_id', parsed.data.brandId).maybeSingle(),
      supabase.from('contentos_knowledge_items').select('kind,title,content').eq('brand_id', parsed.data.brandId).order('updated_at', { ascending: false }).limit(20),
    ]);

    if (brandError || !brandRow) return Response.json({ error: 'Active brand not found.' }, { status: 404 });
    const brand = brandRow as Brand;
    const fallback = smartFill(brand, growthRow?.current_phase ?? null, parsed.data.request, contentType);

    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return Response.json({ ...fallback, mode: 'smart' as const });

    const knowledge = (knowledgeRows ?? []).map((item: any) => `[${item.kind}] ${item.title}: ${item.content}`).join('\n');
    const prompt = `You are the brief assistant inside ContentOS. Fill a Quick Create form from the user's plain-language request. Do not create the final social post yet.\n\nACTIVE BRAND\nName: ${brand.name}\nProduct: ${brand.product}\nAudience: ${brand.audience}\nPositioning: ${brand.positioning}\nVoice: ${brand.voice}\nCurrent context/offer: ${brand.offer}\nPreferred CTA: ${brand.preferred_cta}\nNever do/say: ${brand.avoid}\nCurrent product phase: ${growthRow?.current_phase || 'not set'}\n\nSELECTED CONTENT TYPE\n${contentType}\n\nVERIFIED KNOWLEDGE\n${knowledge || 'No extra knowledge supplied.'}\n\nUSER REQUEST\n${parsed.data.request}\n\nThe selected content type is authoritative unless the user explicitly asks for another format in the request. Expand vague requests into a clear production brief, but never substitute a different topic. Choose exactly one allowed value for phase, platform and format. Never invent claims, prices, availability, endorsements or product capabilities.\n\nReturn ONLY JSON with this exact shape:\n{\n  "idea": "detailed production-ready brief",\n  "objective": "single clear objective",\n  "phase": "Pre-Launch | Launch Week | Early Growth | Evergreen",\n  "platform": "Instagram carousel | TikTok / Reels | Threads | Facebook | WhatsApp | Multi-platform",\n  "format": "Carousel | 15-30 second short-form video | UGC / POV video | Static ad | Threads text post | Long-form post",\n  "language": "language and tone instruction"\n}`;

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.responses.create({ model: process.env.OPENAI_MODEL, input: prompt });
      const result = FillSchema.parse(extractJson(response.output_text || ''));
      return Response.json({ ...result, mode: 'ai' as const });
    } catch (aiError) {
      console.error('assist-fill AI fallback', aiError);
      return Response.json({ ...fallback, mode: 'smart' as const });
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to fill the form.' }, { status: 500 });
  }
}
