# ContentOS

A multi-brand AI marketing operating system: Brand Brain → campaign generation → saved creative library → human approval.

## v0.2 status

Working in this build:

- Supabase email/password authentication
- Isolated `contentos_*` tables inside the selected existing Supabase Pro project
- Row Level Security for workspaces, brands, campaign history and creative variants
- Multi-brand Brand Brain persistence
- Campaign Studio with multiple creative variants
- Automatic campaign + creative persistence
- Content Library / campaign history
- Approval Queue with approve / needs review / reject states
- Protected generation endpoint that requires a valid Supabase session
- Zero-cost demo generator when no OpenAI key is configured
- Optional OpenAI Responses API generation when an API key/model are added

## Architecture

Browser → Next.js App Router → Supabase Auth → ContentOS RLS tables

Campaign generation:

Browser (authenticated) → `/api/generate` → verify Supabase access token → OpenAI Responses API **or** zero-cost demo generator → persist campaign/variants to Supabase

## Database isolation

ContentOS shares the existing Supabase project, but not the SewaPro application tables. All ContentOS tables are prefixed:

- `contentos_workspaces`
- `contentos_workspace_members`
- `contentos_brands`
- `contentos_knowledge_items`
- `contentos_campaigns`
- `contentos_content_variants`

RLS helper functions live in a non-public `contentos_private` schema.

## Environment variables

The current selected Supabase URL and **publishable** key are included as safe fallbacks for this private MVP repository. They can be overridden with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Real AI generation is optional:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=
```

Without the OpenAI variables, the app remains fully testable and stores campaigns using demo-mode content generation.

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production principle

Publishing is intentionally not automated yet. Human approval remains mandatory while the Brand Brain, prompts, permissions and performance feedback loop are being validated.

## Next phases

1. Knowledge uploads: FAQs, testimonials, product docs and best-performing historical content.
2. Separate strategist / copywriter / creative-director agents.
3. Image and storyboard generation.
4. Publishing integrations.
5. Performance ingestion + learning loop.
