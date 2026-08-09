export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    provider: process.env.OPENAI_API_KEY ? 'OpenAI' : null,
    model: process.env.OPENAI_API_KEY ? 'gpt-image-2' : null,
    defaultQuality: 'low',
    defaultSize: '1024x1536',
  });
}
