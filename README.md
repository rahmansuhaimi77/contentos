# ContentOS MVP

A multi-brand AI marketing operating system.

## What works in v0.1

- Brand Brain form
- Campaign brief builder
- OpenAI-powered campaign generation
- Strategy + multiple creative variants
- Hook, angle, script, caption, CTA and image/video production prompt
- Responsive dashboard UI
- Supabase multi-tenant schema + RLS migration ready for the persistence phase

## Architecture

Browser → Next.js App Router → `/api/generate` → OpenAI Responses API

Persistence phase:
Next.js → Supabase Auth/Postgres → workspace → brands → knowledge_items → campaigns → content_variants

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Add `OPENAI_API_KEY`.
3. Set `OPENAI_MODEL` to a model available in your OpenAI API project.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

Supabase is not required for the first generation screen. The included SQL migration is for the next phase: login, saved Brand Brains, campaign history and approvals.

## Build order

### Phase 1 — Campaign engine (included)
Brand Brain → campaign brief → generated creative pack.

### Phase 2 — Persistent Brand Brain
Supabase Auth, workspaces, brands, knowledge base, save/load campaigns.

### Phase 3 — Creative pipeline
Generate image storyboards, image assets and video-ready prompts; store all assets against each creative.

### Phase 4 — Approval & publishing
Draft → review → approve → schedule/publish. Never auto-publish by default.

### Phase 5 — Learning loop
Ingest platform/GA4 performance, score hooks/angles/formats and feed those learnings back into the strategist.

## Recommended first production principle

Keep a human approval checkpoint between AI generation and publishing. Automatic publishing should only be introduced after brand rules, permissions, audit history and platform integrations are stable.
