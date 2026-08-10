import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CONTENTOS_APP_URL = 'https://contentos-uv1s.vercel.app';
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/contentos-social/callback/threads`;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-contentos-worker',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function requireUser(req: Request) {
  const auth = req.headers.get('authorization');
  const token = auth?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('AUTH_REQUIRED');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return data.user;
}

async function brandAccess(userId: string, brandId: string, adminOnly = false) {
  const { data: brand, error } = await admin.from('contentos_brands').select('id,name,workspace_id').eq('id', brandId).single();
  if (error || !brand) throw new Error('BRAND_NOT_FOUND');
  const { data: member } = await admin.from('contentos_workspace_members').select('role').eq('workspace_id', brand.workspace_id).eq('user_id', userId).maybeSingle();
  if (!member || (adminOnly && !['owner', 'admin'].includes(member.role))) throw new Error('FORBIDDEN');
  return { brand, role: member.role };
}

async function workspaceAdmin(userId: string, workspaceId: string) {
  const { data: member } = await admin.from('contentos_workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
  if (!member || !['owner', 'admin'].includes(member.role)) throw new Error('FORBIDDEN');
}

async function vaultRead(secretId: string) {
  const { data, error } = await admin.rpc('contentos_read_vault_secret', { p_secret_id: secretId });
  if (error || !data) throw new Error('SECRET_UNAVAILABLE');
  return data as string;
}

async function vaultStore(secret: string, name: string, description: string) {
  const { data, error } = await admin.rpc('contentos_store_vault_secret', { p_secret: secret, p_name: name, p_description: description });
  if (error || !data) throw new Error(error?.message || 'SECRET_STORE_FAILED');
  return data as string;
}

async function vaultDelete(secretId?: string | null) {
  if (!secretId) return;
  await admin.rpc('contentos_delete_vault_secret', { p_secret_id: secretId });
}

async function configureThreads(req: Request) {
  const user = await requireUser(req);
  const body = await req.json();
  const workspaceId = String(body.workspace_id || '');
  const clientId = String(body.client_id || '').trim();
  const clientSecret = String(body.client_secret || '').trim();
  if (!workspaceId || !clientId || !clientSecret) return json({ error: 'Workspace, Threads App ID and App Secret are required.' }, 400);
  await workspaceAdmin(user.id, workspaceId);

  const { data: existingCredential } = await admin.from('contentos_social_app_credentials').select('client_secret_secret_id').eq('workspace_id', workspaceId).eq('platform', 'threads').maybeSingle();
  const secretId = await vaultStore(clientSecret, `contentos_threads_app_${workspaceId}_${crypto.randomUUID()}`, 'ContentOS Threads App Secret');

  const { error: appError } = await admin.from('contentos_social_apps').upsert({
    workspace_id: workspaceId,
    platform: 'threads',
    client_id: clientId,
    redirect_uri: CALLBACK_URL,
    status: 'configured',
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,platform' });
  if (appError) { await vaultDelete(secretId); throw appError; }

  const { error: credentialError } = await admin.from('contentos_social_app_credentials').upsert({
    workspace_id: workspaceId,
    platform: 'threads',
    client_secret_secret_id: secretId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,platform' });
  if (credentialError) { await vaultDelete(secretId); throw credentialError; }
  await vaultDelete(existingCredential?.client_secret_secret_id);
  return json({ ok: true, redirect_uri: CALLBACK_URL });
}

async function startThreads(req: Request) {
  const user = await requireUser(req);
  const body = await req.json();
  const brandId = String(body.brand_id || '');
  const { brand } = await brandAccess(user.id, brandId);

  const { data: app } = await admin.from('contentos_social_apps').select('client_id,redirect_uri,status').eq('workspace_id', brand.workspace_id).eq('platform', 'threads').maybeSingle();
  if (!app || app.status !== 'configured' || !app.client_id) return json({ error: 'Configure the Threads developer app first.', needs_setup: true, redirect_uri: CALLBACK_URL }, 409);

  const state = randomState();
  const stateHash = await sha256(state);
  const { error } = await admin.from('contentos_oauth_states').insert({
    state_hash: stateHash,
    brand_id: brandId,
    workspace_id: brand.workspace_id,
    platform: 'threads',
    user_id: user.id,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw error;

  const params = new URLSearchParams({
    client_id: app.client_id,
    redirect_uri: app.redirect_uri || CALLBACK_URL,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
    state,
  });
  return json({ url: `https://threads.net/oauth/authorize?${params.toString()}` });
}

async function threadsCallback(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error') || url.searchParams.get('error_message');
  const redirect = new URL('/connections', CONTENTOS_APP_URL);
  if (oauthError || !code || !state) {
    redirect.searchParams.set('threads', 'error');
    redirect.searchParams.set('message', oauthError || 'Authorization was cancelled or incomplete.');
    return Response.redirect(redirect.toString(), 302);
  }

  const stateHash = await sha256(state);
  const { data: oauthState } = await admin.from('contentos_oauth_states').select('*').eq('state_hash', stateHash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!oauthState || oauthState.platform !== 'threads') {
    redirect.searchParams.set('threads', 'error');
    redirect.searchParams.set('message', 'This connection link expired. Please try Connect Threads again.');
    return Response.redirect(redirect.toString(), 302);
  }

  try {
    const [{ data: app }, { data: appCred }] = await Promise.all([
      admin.from('contentos_social_apps').select('client_id,redirect_uri').eq('workspace_id', oauthState.workspace_id).eq('platform', 'threads').single(),
      admin.from('contentos_social_app_credentials').select('client_secret_secret_id').eq('workspace_id', oauthState.workspace_id).eq('platform', 'threads').single(),
    ]);
    const appSecret = await vaultRead(appCred.client_secret_secret_id);
    const tokenParams = new URLSearchParams({
      client_id: app.client_id,
      client_secret: appSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: app.redirect_uri || CALLBACK_URL,
    });
    const shortRes = await fetch(`https://graph.threads.net/oauth/access_token?${tokenParams.toString()}`, { method: 'POST' });
    const shortToken = await shortRes.json();
    if (!shortRes.ok || !shortToken.access_token) throw new Error(shortToken?.error?.message || 'Threads token exchange failed.');

    const longParams = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: appSecret, access_token: shortToken.access_token });
    const longRes = await fetch(`https://graph.threads.net/access_token?${longParams.toString()}`);
    const longToken = await longRes.json();
    const accessToken = longRes.ok && longToken.access_token ? longToken.access_token : shortToken.access_token;
    const expiresIn = longToken.expires_in || 3600;

    const profileRes = await fetch(`https://graph.threads.net/me?fields=id,username,name,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`);
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.id) throw new Error(profile?.error?.message || 'Unable to read Threads profile.');

    const { data: existing } = await admin.from('contentos_social_connections').select('id').eq('brand_id', oauthState.brand_id).eq('platform', 'threads').maybeSingle();
    let oldSecretId: string | null = null;
    if (existing?.id) {
      const { data: oldCred } = await admin.from('contentos_social_connection_credentials').select('access_token_secret_id').eq('connection_id', existing.id).maybeSingle();
      oldSecretId = oldCred?.access_token_secret_id || null;
    }

    const accessTokenSecretId = await vaultStore(accessToken, `contentos_threads_token_${oauthState.brand_id}_${crypto.randomUUID()}`, 'ContentOS Threads long-lived user token');
    const { data: connection, error: connectionError } = await admin.from('contentos_social_connections').upsert({
      brand_id: oauthState.brand_id,
      platform: 'threads',
      platform_user_id: String(profile.id),
      username: profile.username || null,
      display_name: profile.name || null,
      status: 'connected',
      scopes: ['threads_basic', 'threads_content_publish'],
      token_expires_at: new Date(Date.now() + Number(expiresIn) * 1000).toISOString(),
      metadata: { profile_picture_url: profile.threads_profile_picture_url || null },
      connected_by: oauthState.user_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' }).select('id').single();
    if (connectionError) { await vaultDelete(accessTokenSecretId); throw connectionError; }

    const { error: credError } = await admin.from('contentos_social_connection_credentials').upsert({
      connection_id: connection.id,
      access_token_secret_id: accessTokenSecretId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' });
    if (credError) { await vaultDelete(accessTokenSecretId); throw credError; }
    await vaultDelete(oldSecretId);
    await admin.from('contentos_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', oauthState.id);

    redirect.searchParams.set('threads', 'connected');
    redirect.searchParams.set('brand', oauthState.brand_id);
    return Response.redirect(redirect.toString(), 302);
  } catch (error) {
    await admin.from('contentos_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', oauthState.id);
    redirect.searchParams.set('threads', 'error');
    redirect.searchParams.set('message', error instanceof Error ? error.message : 'Threads connection failed.');
    return Response.redirect(redirect.toString(), 302);
  }
}

async function publishThreads(publicationId: string) {
  const { data: publication, error: pubError } = await admin.from('contentos_publications').select('*').eq('id', publicationId).single();
  if (pubError || !publication) throw new Error('Publication not found.');
  if (publication.platform !== 'threads') throw new Error('Only Threads direct publishing is enabled in Phase 1.');
  if (!['approved', 'scheduled', 'publishing', 'failed'].includes(publication.status)) throw new Error(`Publication is ${publication.status}, not ready to publish.`);

  const { data: connection } = await admin.from('contentos_social_connections').select('*').eq('id', publication.connection_id).eq('platform', 'threads').eq('status', 'connected').maybeSingle();
  if (!connection) throw new Error('Threads account is not connected for this brand.');
  const { data: credential } = await admin.from('contentos_social_connection_credentials').select('access_token_secret_id').eq('connection_id', connection.id).single();
  const accessToken = await vaultRead(credential.access_token_secret_id);

  await admin.from('contentos_publications').update({ status: 'publishing', error_message: null, updated_at: new Date().toISOString() }).eq('id', publication.id);
  await admin.from('contentos_publish_events').insert({ publication_id: publication.id, event_type: 'publishing', message: 'Sending post to Threads.' });

  try {
    const params = new URLSearchParams({ media_type: 'TEXT', text: publication.post_text, auto_publish_text: 'true' });
    const postRes = await fetch(`https://graph.threads.net/me/threads?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const post = await postRes.json();
    if (!postRes.ok || !post.id) throw new Error(post?.error?.message || 'Threads rejected the post.');

    let permalink: string | null = null;
    try {
      const detailRes = await fetch(`https://graph.threads.net/${post.id}?fields=id,permalink&access_token=${encodeURIComponent(accessToken)}`);
      const detail = await detailRes.json();
      if (detailRes.ok) permalink = detail.permalink || null;
    } catch { /* permalink is optional */ }

    const publishedAt = new Date().toISOString();
    await admin.from('contentos_publications').update({
      status: 'published', published_at: publishedAt, platform_post_id: String(post.id), permalink, error_message: null, updated_at: publishedAt,
    }).eq('id', publication.id);
    if (publication.variant_id) await admin.from('contentos_content_variants').update({ status: 'published', updated_at: publishedAt }).eq('id', publication.variant_id);
    if (publication.plan_item_id) await admin.from('contentos_plan_items').update({ status: 'published', updated_at: publishedAt }).eq('id', publication.plan_item_id);
    await admin.from('contentos_publish_events').insert({ publication_id: publication.id, event_type: 'published', message: 'Published successfully to Threads.', details: { platform_post_id: String(post.id), permalink } });
    return { id: publication.id, platform_post_id: String(post.id), permalink };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publishing failed.';
    await admin.from('contentos_publications').update({ status: 'failed', error_message: message, retry_count: publication.retry_count + 1, updated_at: new Date().toISOString() }).eq('id', publication.id);
    await admin.from('contentos_publish_events').insert({ publication_id: publication.id, event_type: 'failed', message });
    throw error;
  }
}

async function publishNow(req: Request) {
  const user = await requireUser(req);
  const body = await req.json();
  const publicationId = String(body.publication_id || '');
  const { data: publication } = await admin.from('contentos_publications').select('id,brand_id').eq('id', publicationId).maybeSingle();
  if (!publication) return json({ error: 'Publication not found.' }, 404);
  await brandAccess(user.id, publication.brand_id);
  try { return json({ ok: true, result: await publishThreads(publicationId) }); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Publishing failed.' }, 502); }
}

async function runWorker(req: Request) {
  const workerKey = req.headers.get('x-contentos-worker');
  const { data: secretRow } = await admin.rpc('contentos_get_worker_secret');
  if (!workerKey || !secretRow || workerKey !== secretRow) return json({ error: 'Unauthorized worker.' }, 401);

  const { data: due } = await admin.from('contentos_publications').select('id').eq('status', 'scheduled').lte('scheduled_for', new Date().toISOString()).order('scheduled_for', { ascending: true }).limit(10);
  const results = [];
  for (const item of due || []) {
    const { data: claimed } = await admin.from('contentos_publications').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', item.id).eq('status', 'scheduled').select('id').maybeSingle();
    if (!claimed) continue;
    try { results.push({ id: item.id, ok: true, result: await publishThreads(item.id) }); }
    catch (error) { results.push({ id: item.id, ok: false, error: error instanceof Error ? error.message : 'failed' }); }
  }
  return json({ ok: true, processed: results.length, results });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith('/config/threads') && req.method === 'POST') return await configureThreads(req);
    if (path.endsWith('/connect/threads') && req.method === 'POST') return await startThreads(req);
    if (path.endsWith('/callback/threads') && req.method === 'GET') return await threadsCallback(req);
    if (path.endsWith('/publish') && req.method === 'POST') return await publishNow(req);
    if (path.endsWith('/worker') && req.method === 'POST') return await runWorker(req);
    if (path.endsWith('/health')) return json({ ok: true, callback_url: CALLBACK_URL });
    return json({ error: 'Route not found.' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    const status = message === 'AUTH_REQUIRED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'BRAND_NOT_FOUND' ? 404 : 500;
    return json({ error: message }, status);
  }
});
