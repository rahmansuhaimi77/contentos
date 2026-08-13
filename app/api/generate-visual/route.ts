export const runtime = 'nodejs';
export const maxDuration = 120;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqlfytlknhazusowiiug.supabase.co';

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) return Response.json({ error: 'Please sign in before generating visuals.' }, { status: 401 });

    const body = await req.text();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contentos-ai/generate-static`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body,
    });

    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.error('generate-visual proxy', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to generate visual.' }, { status: 500 });
  }
}
