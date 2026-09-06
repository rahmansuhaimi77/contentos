# Website Studio v2.2 — Build + Preview Runner

## Purpose

Turn an approved Website Studio production plan into a versioned, inspectable website artifact and deploy that exact artifact to an isolated Vercel **preview** environment.

v2.2 deliberately does **not** include production promotion.

## End-to-end path

1. Verified business brief
2. At least three approved references
3. Exactly one approved creative direction
4. Production plan with at least five sections
5. Source build
6. Immutable `growth_website_versions` snapshot
7. Optional Vercel preview deployment
8. Rendered QA (v2.3)
9. Release approval (future stage)
10. Production promotion (future stage)

## Build artifact

The source builder creates exactly:

- `index.html`
- `styles.css`
- `script.js`

The files are stored in `growth_website_versions.source_snapshot` before any deployment occurs.

This separation is intentional. A generated build can be reviewed, superseded or regenerated without coupling source generation to hosting.

## Build safety

The build endpoint rejects generated JavaScript containing:

- network requests (`fetch`, XHR, WebSocket, EventSource)
- cookies
- local/session storage
- `sendBeacon`
- `eval` / dynamic `Function`

It also rejects external script tags, executable data URLs and external form actions that have not been explicitly verified.

No analytics or tracking code is generated during the preview stage.

## Visual asset states

A preview may be generated while visual assets remain pending so layout, copy and hierarchy can be inspected.

When an asset has not been selected, the builder must use an explicit, art-directed placeholder marked:

```html
data-visual-pending="true"
```

Such builds are stored as `draft_incomplete` and, after preview deployment, `preview_incomplete`.

Pending assets are therefore visible technical debt, not silently hidden behind fake imagery.

## Vercel architecture

ContentOS is the **control plane**.

Each website preview is deployed to a dedicated Vercel project named from its Website Studio slug:

```text
ws-<website-slug>
```

The preview runner:

1. Checks whether the project already exists.
2. Creates it through `POST /v11/projects` if required.
3. Uploads the exact version snapshot through `POST /v13/deployments`.
4. Omits a production target so the deployment remains a preview.
5. Stores deployment ID, URL, environment and status in `growth_website_deployments`.
6. Stores the preview URL on the source version.

This avoids creating a separate Git repository for every client website while still isolating deployments by project.

## Required server configuration

The preview deployer requires these **server-only** variables in the ContentOS deployment environment:

```text
VERCEL_TOKEN
VERCEL_TEAM_ID
```

`VERCEL_TOKEN` must never be exposed through `NEXT_PUBLIC_*`, client-side code, Brand Brain data or website source snapshots.

If either variable is absent, the preview endpoint stops with `vercel_not_configured` and creates nothing.

## Current account state

At v2.2 implementation time, the connected Vercel team contains only the existing KampusRide project. Website Studio does not reuse or modify that project.

ContentOS still needs its own Vercel deployment/configuration before the v2.2 preview route can be exercised from the live operator UI.

## Release boundary

There is intentionally no production deployment endpoint in v2.2.

A future production promotion endpoint must require, at minimum:

- no pending visual assets
- completed rendered desktop/mobile QA
- zero high/blocker failures
- approved source version
- explicit human release action
- rollback target recorded

The production artifact must be the exact preview artifact that passed QA. It must not be rebuilt during promotion.
