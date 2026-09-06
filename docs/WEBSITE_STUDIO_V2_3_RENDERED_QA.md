# Website Studio v2.3 — Rendered Visual QA

## Purpose

v2.3 judges the **actual deployed preview**, not the prompt, source code or production plan.

A version cannot pass merely because it compiled or because the AI says the intended design is good.

## Evidence path

1. Build an immutable `growth_website_versions` source snapshot.
2. Deploy that exact snapshot to the recorded Vercel preview URL.
3. Run PageSpeed Insights / Lighthouse twice: mobile and desktop.
4. Require a rendered final screenshot from each Lighthouse result.
5. Fetch the visible page text from the same preview.
6. Send business truth, approved art direction, visible copy, Lighthouse evidence and both screenshots to the visual QA model.
7. Persist individual checks in `growth_website_qa_checks` and the summary on the exact source version.

## URL integrity

Rendered QA only accepts the recorded Vercel preview for the selected Website Studio version.

The v2.3 API rejects:

- missing preview URLs
- URLs not attached to the selected version
- non-preview deployment records
- non-Vercel preview hostnames

This prevents arbitrary URL scanning and ensures QA evidence maps to the exact saved artifact.

## Scoring

The overall score is 0–100 and is intentionally weighted toward visual quality:

- 55% visual design quality
  - hierarchy
  - composition / spacing
  - crop / overflow safety
  - typography / readability
  - brand specificity
  - mobile composition
- 15% copy authenticity + conversion clarity
- 12% minimum mobile/desktop Lighthouse accessibility score
- 8% minimum mobile/desktop Lighthouse performance score
- 5% minimum mobile/desktop Lighthouse SEO score
- 5% minimum mobile/desktop Lighthouse best-practices score

A release-quality automated pass requires:

```text
overall score >= 85
AND zero high/blocker QA failures
AND zero pending visual assets
```

An automated pass is **not** permission to publish. It only unlocks the future human release stage.

## Visual review categories

The vision review scores:

- visual hierarchy
- composition and spacing
- crop / overflow
- typography and readability
- brand specificity / generic-template risk
- copy authenticity
- conversion clarity
- mobile quality

The reviewer is explicitly instructed to flag:

- half-cut subjects
- uncontrolled cropping
- clipped text
- horizontal overflow
- awkward wraps
- weak contrast
- inconsistent spacing / radii
- generic card-grid composition
- generic AI visual language
- agency-sounding client copy
- vague filler
- unclear or buried CTA
- desktop layouts merely stacked on mobile

## Lighthouse evidence

The QA record stores category scores for mobile and desktop:

- performance
- accessibility
- SEO
- best practices

It also records failed critical audits where available, including:

- viewport
- color contrast
- image alt text
- accessible link / button names
- heading order
- tap targets
- document title
- meta description

PageSpeed Insights can be used with or without an API key; `PAGESPEED_API_KEY` is supported for automated usage/quota reliability.

## Persistent QA state

Each version stores:

- `qa_score`
- `qa_status`
- `qa_summary`
- `qa_completed_at`

Each detailed defect is stored in `growth_website_qa_checks` with:

- category
- checkpoint
- device
- severity
- pass/fail status
- score when applicable
- corrective notes
- preview evidence URL
- structured details

Re-running rendered QA replaces the previous checks for that same version so the defect register reflects the current run.

## Database approval gate

The database prevents a website version from being marked `approved` unless:

- `qa_status = 'pass'`
- `qa_score >= 85`
- `source_snapshot.pending_asset_count = 0`
- no failed `high` or `blocker` QA checks remain

This is independent of UI logic.

## Production remains locked

The v2.2 temporary database hard block on Website Studio production deployment remains active.

v2.3 does not add a production deployment endpoint.

The next stage must implement explicit human approval and promotion of the **exact preview artifact that passed QA**, with rollback data recorded before production is allowed.
