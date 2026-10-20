# CLAUDE.md

ContentOS: Next.js 15 / React 19 / Supabase multi-brand marketing tool. Deployed on Vercel (project `contentos`, production = `main`).

## Rules

- **No brand names in code.** Anything specific to KampusRide, SewaPro or any future brand belongs in that brand's profile (`lib/engine/packs/*.json` as a starter, `contentos_brands.profile` once saved). If you are about to write `if (brand.name.includes(...))`, add a profile field instead.
- Generation goes through `lib/engine/` only: `planner.ts`, `campaign.ts`, `production.ts`, all sharing `context.ts#brandContext` so the three never disagree.
- AI calls go through `lib/engine/ai.ts#generateJson`. Never send customer personal data (names, phones, bookings): free-tier Gemini prompts may be used by Google.
- Every AI path has a zero-cost fallback that must keep working with no API key.
- Phase phrase rules (`applyPhaseRules`) run on AI output too. Pre-launch brands must never get a live CTA.

## Supabase

Project `xqlfytlknhazusowiiug` is shared with SewaPro and other products. ContentOS tables are all `contentos_*`; never touch anything else. Migrations in `supabase/migrations/` are applied by hand in the SQL editor; code must tolerate a migration not being applied yet (see `lib/engine/load.ts#loadBrandRow`).

## Commands

```bash
npm install
npm run build          # type-checks too
npm run check:engine   # offline engine test for every starter pack
```
