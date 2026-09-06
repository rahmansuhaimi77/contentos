# Website Studio v2 — Production Architecture

## Purpose

Website Studio turns ContentOS + SME Growth OS into a reference-led website production system. Its goal is to produce websites that feel intentionally art-directed and business-specific rather than generated from a fixed landing-page template.

The operating principle is:

**Business truth → reference research → creative direction → section composition → custom assets → implementation → preview → rendered QA → human approval → production.**

Generation never goes directly to production.

---

## Existing stack reused

### ContentOS
Use ContentOS as the operator interface because it already contains:

- Supabase authentication
- Brand Brain
- knowledge and asset libraries
- multi-brand switching
- human approval patterns

Website Studio lives at `/websites` and reads the active Brand Brain instead of asking for the same audience, offer, proof and voice repeatedly.

### Supabase
Reuse the existing Supabase project. Website-production state is isolated in `growth_*` tables and protected with Row Level Security.

The existing `growth_websites` row remains the high-level website shell. Production-only information lives in authenticated child tables so it is not accidentally included in the anonymous live-site read surface.

### GitHub / Codex
Git is the source of truth for implementation. Codex or another coding agent may write and revise site code, but generated code must pass preview + QA gates before production.

### Vercel
Use Vercel for versioned Preview Deployments and production promotion. The intended release pattern is:

1. Build a candidate version.
2. Deploy a Preview.
3. Record its URL and Git SHA.
4. Inspect rendered desktop and mobile output.
5. Resolve blocker/high QA failures.
6. Obtain explicit release approval.
7. Promote the approved candidate to production.
8. Retain the previous production version for rollback.

---

## Data model

### `growth_design_recipes`
Reusable visual systems. A recipe is a set of art-direction constraints, not a complete page template.

Current recipe families:

1. Editorial Authority
2. Bold Utility
3. Warm Local
4. Premium Minimal
5. Kinetic Modern
6. Tactile Craft
7. Immersive Place
8. Trust System

Recipes hold layout, typography, visual, motion and conversion rules plus suitability guidance.

### `growth_website_briefs`
Business and conversion truth for one website:

- business summary
- goal
- audience
- offer
- proof
- voice
- prohibited claims / language
- verified facts
- constraints
- source notes

Statuses: `draft → verified → approved`.

### `growth_website_references`
Reference evidence attached to a website. Every reference has a role such as:

- layout
- typography
- visual language
- motion
- copy
- conversion

References are inspiration inputs, not permission to copy a design.

### `growth_website_directions`
The approved art direction for the website. It stores:

- concept and rationale
- selected recipe
- palette
- typography system
- visual language
- motion language
- composition rules
- anti-patterns

Statuses: `proposed / approved / rejected / superseded`.

### `growth_website_sections`
Section-level production plan. Each section records:

- objective
- copy
- layout logic
- visual brief
- motion behavior
- conversion role
- production status

This is deliberately section-based so the agent cannot hide the whole page inside a single opaque template config.

### `growth_website_assets`
Tracks client, generated, licensed and reference assets, including focal point, cropping rules, alt text and section relationship.

### `growth_website_runs`
Audit trail for agent/model runs, prompts, input/output state, errors and optional cost/token information.

### `growth_website_versions`
Versioned website candidates with Git SHA and Preview URL.

### `growth_website_qa_checks`
Evidence-backed QA at version level across:

- visual
- copy
- responsive
- conversion
- accessibility
- SEO
- performance
- technical
- release

### `growth_website_deployments`
Deployment history for preview and production, linked to a website version.

---

## Production pipeline

### Stage 0 — Brand Brain
Required inputs should already exist where possible:

- business / product
- target audience
- positioning
- voice
- offer
- proof
- preferred CTA
- prohibited language or behavior

### Stage 1 — Fact verification
Complete operational facts that Brand Brain does not normally hold, such as:

- phone / WhatsApp
- location and service area
- hours
- real services / menu / packages
- real guarantees
- real accreditations
- prices where approved
- owner-approved claims

**Gate:** do not start final creative direction while material facts remain assumptions.

### Stage 2 — Reference research
Collect approximately 3–6 useful references. Each must have a reason for inclusion.

Bad: “I like this website.”

Good: “Use this reference only for oversized editorial type and the way service proof enters below the hero.”

Reference principles are extracted and recombined. Never clone a reference.

### Stage 3 — Creative direction
Choose the closest design recipe and adapt it to the business + references.

Output one named direction with:

- concept
- rationale
- palette logic
- typography logic
- image / illustration / 3D / photography strategy
- motion strategy
- composition rules
- conversion strategy
- explicit anti-patterns

**Human gate:** creative direction must be approved before full-page implementation.

### Stage 4 — Section architecture + client-voice copy
Plan the page as a sequence of compositions rather than a stack of identical cards.

For each section define:

- what job it performs
- what the customer should understand / feel
- final copy
- visual idea
- composition
- motion if useful
- CTA / conversion role

Copy must sound like the client speaking to its customer, not an agency promoting the client.

### Stage 5 — Visual production
Priority order:

1. strong real client assets
2. deliberately sourced/licensed visuals
3. art-directed generated visuals
4. restrained graphical treatment when imagery adds no value

Every important asset needs a focal point and responsive crop behavior.

Reject:

- half-cut people or products
- uncontrolled crops
- fake-looking generic AI people
- low-resolution output
- random decorative 3D
- visual styles that drift between sections

### Stage 6 — Implementation
Build the hero first and inspect it before implementing the full page.

Then build the highest-value proof / service sections, followed by supporting sections.

Rules:

- avoid repeating the same card-grid composition more than twice without a clear reason
- maintain semantic HTML and responsive behavior
- motion must support hierarchy or storytelling
- primary conversion action must remain easy to find
- do not use build-time string replacement hacks to inject design changes

### Stage 7 — Preview + rendered QA
Create a versioned Preview before production.

Inspect actual rendered output at minimum on:

- mobile
- tablet / narrow desktop where appropriate
- desktop

Block release for:

- overlap or accidental overflow
- clipping
- awkward image crops
- illegible text over images
- weak hierarchy
- obvious template repetition
- broken CTA / links / forms
- inaccurate business facts
- unverified proof claims
- unusable motion
- major accessibility / SEO / technical regressions

### Stage 8 — Release
A candidate may be released only when:

- blocker/high QA failures = 0
- business facts are approved
- creative direction has been approved
- rendered pages were inspected
- conversion actions were tested
- release approval is explicit

Promote the exact approved preview rather than producing a fresh unreviewed build.

---

## Automation boundary

### Safe to automate aggressively

- pulling Brand Brain context
- creating project records
- state transitions after deterministic checks
- reference metadata capture
- creating initial research queries
- generating draft section plans
- generating visual briefs / prompts
- code generation
- preview deployment creation
- deterministic technical checks
- QA record creation
- version / deployment history

### Agent-assisted, evidence required

- deciding which references are genuinely useful
- extracting design principles
- selecting a recipe
- client-voice copy
- layout composition
- asset selection
- visual QA
- conversion critique

### Human approval remains mandatory for now

- creative direction
- production release

These gates can be reconsidered only after the system has produced enough consistently good sites to justify narrower human review.

---

## Anti-template rules

The production agent must not:

1. Start from “build a professional modern website” without references and a direction.
2. Use one master page template with different text and colors as the main generation strategy.
3. Make every section a headline plus three cards.
4. Invent ratings, customer counts, guarantees, certifications, prices or years of experience.
5. Write from an agency perspective unless the client is actually an agency.
6. Use stock/generative images solely to make an empty section look busy.
7. Ship a generated first pass without rendered inspection.
8. publish directly from an AI generation action.
9. Rebuild an approved preview during release when the approved artifact can be promoted instead.

---

## Cost discipline

The baseline architecture reuses the existing ContentOS, Supabase, GitHub and Vercel setup instead of requiring a second database or a separate admin application.

Do not assume a ChatGPT subscription includes API credits. Provider-backed autonomous generation should therefore be optional and its usage recorded in `growth_website_runs` when introduced.

Visual-generation providers should also be treated as pluggable. A client with strong real photos may need no generative-image cost at all.

---

## Rollout plan

### v2.0 — Production control plane

- database model
- Website Studio dashboard
- Brand Brain bridge
- design recipes
- verified-brief gate
- creative-direction gate
- QA/release model

### v2.1 — Research + composition agent

- reference capture UI
- reference-analysis workflow
- section planner
- client-voice copy agent
- visual brief generator

### v2.2 — Build + preview runner

- dedicated site-code workspace/repository convention
- code generation runner
- preview deployment registration
- automatic Git SHA/version tracking

### v2.3 — Rendered QA agent

- browser-based desktop/mobile screenshots
- visual defect detection
- copy/CTA validation
- accessibility/SEO/performance checks
- QA evidence attached to version

### v2.4 — Controlled release

- explicit Release button
- enforce zero blockers
- promote approved preview
- deployment history
- rollback action

---

## Definition of success

The system is successful when two businesses in the same category can be processed through the same workflow yet emerge with clearly different art direction, section rhythm, imagery and copy—while both remain accurate, conversion-focused, responsive and maintainable.
