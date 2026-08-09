import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const FALLBACK_SUPABASE_URL = 'https://xqlfytlknhazusowiiug.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BjTjAlbEe74g3PLYu6akVg_tjruki1i';

const InputSchema = z.object({ frameId: z.string().uuid() });

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
  ) as any;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedClient(req);
    if (!auth) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'Image generation is not connected yet. You can still copy the prompt or upload a frame manually at RM0.' }, { status: 409 });
    }

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: 'Invalid frame request.' }, { status: 400 });

    const { data: frame, error: frameError } = await auth.supabase
      .from('contentos_storyboard_frames')
      .select('id,storyboard_id,scene_number,image_prompt,status')
      .eq('id', parsed.data.frameId)
      .single();
    if (frameError || !frame) return Response.json({ error: 'Storyboard frame not found.' }, { status: 404 });

    const { data: storyboard, error: storyboardError } = await auth.supabase
      .from('contentos_storyboards')
      .select('id,brand_id,aspect_ratio')
      .eq('id', frame.storyboard_id)
      .single();
    if (storyboardError || !storyboard) return Response.json({ error: 'Storyboard not found.' }, { status: 404 });

    const [{ data: brand }, { data: visual }, { data: assets }] = await Promise.all([
      auth.supabase.from('contentos_brands').select('name').eq('id', storyboard.brand_id).single(),
      auth.supabase.from('contentos_brand_visuals').select('primary_color,secondary_color,accent_color,font_notes,visual_style,image_rules').eq('brand_id', storyboard.brand_id).maybeSingle(),
      auth.supabase.from('contentos_brand_assets').select('kind,title,notes').eq('brand_id', storyboard.brand_id).limit(30),
    ]);

    const assetSummary = (assets ?? []).map((item: any) => `${item.kind}: ${item.title}${item.notes ? ` — ${item.notes}` : ''}`).join('\n');
    const visualRules = visual
      ? `Brand visual profile:\nPrimary: ${visual.primary_color || 'not set'}\nSecondary: ${visual.secondary_color || 'not set'}\nAccent: ${visual.accent_color || 'not set'}\nTypography: ${visual.font_notes || 'not set'}\nVisual style: ${visual.visual_style || 'not set'}\nImage rules: ${visual.image_rules || 'not set'}`
      : '';
    const prompt = `${frame.image_prompt}\n\n${visualRules}\n\nApproved reference inventory exists for ${brand?.name || 'the brand'}:\n${assetSummary || 'No additional approved files recorded.'}\n\nImportant: do not invent or redraw an official logo. Leave clean negative space for the supplied logo to be composited separately if the scene needs branding. Keep this frame visually consistent with a five-scene vertical Malaysian UGC storyboard.`;

    await auth.supabase.from('contentos_storyboard_frames').update({ status: 'generating' }).eq('id', frame.id);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        size: '1024x1536',
        quality: 'low',
        n: 1,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      await auth.supabase.from('contentos_storyboard_frames').update({ status: 'prompt_ready' }).eq('id', frame.id);
      return Response.json({ error: result?.error?.message || 'Image generation failed.' }, { status: response.status });
    }

    const base64 = result?.data?.[0]?.b64_json;
    if (!base64) throw new Error('Image provider returned no image data.');
    const bytes = Buffer.from(base64, 'base64');
    const path = `${storyboard.brand_id}/${storyboard.id}/scene-${frame.scene_number}-${Date.now()}.png`;

    const { error: uploadError } = await auth.supabase.storage
      .from('contentos-storyboards')
      .upload(path, bytes, { contentType: 'image/png', upsert: false, cacheControl: '3600' });
    if (uploadError) throw uploadError;

    const { error: updateError } = await auth.supabase
      .from('contentos_storyboard_frames')
      .update({
        status: 'generated',
        asset_path: path,
        provider: 'openai:gpt-image-2',
        generation_metadata: { quality: 'low', size: '1024x1536', generated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', frame.id);
    if (updateError) throw updateError;

    const { data: signed } = await auth.supabase.storage.from('contentos-storyboards').createSignedUrl(path, 3600);
    return Response.json({ frameId: frame.id, status: 'generated', previewUrl: signed?.signedUrl || null, provider: 'OpenAI', model: 'gpt-image-2' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Image generation failed.' }, { status: 500 });
  }
}
