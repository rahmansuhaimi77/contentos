# Website Studio v2.4 — Human Approval, Production Release + Rollback

## Purpose

v2.4 completes the Website Studio production lifecycle without weakening the quality gates built in v2.1–v2.3.

The central rule is:

> **Production must be the exact Vercel preview deployment that passed rendered QA. No rebuild is allowed during release.**

## Release path

1. Verified business brief
2. Approved references
3. Approved creative direction
4. Production plan
5. Versioned static source build
6. Isolated Vercel preview deployment
7. Rendered mobile + desktop QA
8. Automated QA pass at >=85/100, zero high/blocker defects, zero pending visuals
9. Explicit human release approval
10. Separate production confirmation (`RELEASE`)
11. Vercel promote of the exact preview deployment ID
12. Live source hash smoke test
13. Release recorded as live only if all three production files match the approved source snapshot
14. Verified rollback target retained when a prior Website Studio release exists

## Human approval is separate from publication

Passing QA does not publish anything.

The release operator first approves the exact version. Approval creates a `growth_website_releases` candidate tied to:

- website ID
- version ID
- exact preview deployment ID
- SHA-256 source fingerprint
- approval timestamp
- optional approval note

Only one open release candidate may exist per website.

A current live release may coexist with a newer approved candidate so rollback lineage is preserved.

## Production promotion

Production promotion uses Vercel's deployment promotion API:

```text
POST /v10/projects/{projectId}/promote/{deploymentId}
```

This action points production traffic to an existing deployment and **does not rebuild it**.

Before promotion, Website Studio re-validates:

- release candidate status is approved
- source version is still approved
- rendered QA still passes at >=85
- no high/blocker QA findings remain
- no visual assets are pending
- source snapshot fingerprint still matches the approval fingerprint
- exact preview deployment record exists
- Vercel deployment ID matches
- Vercel project name matches the Website Studio project
- Vercel deployment state is READY
- Vercel metadata matches the Website Studio version when metadata is present

## Database production gate

The previous temporary hard production block is replaced by a stricter permanent release gate.

A `growth_website_deployments` production row is rejected unless:

- it references an approved release-quality version
- that version passed rendered QA
- it has no pending visuals
- its deployment ID is already recorded as the preview deployment for the same version
- a matching human-approved release record is actively being promoted/live

This means a newly rebuilt or unrelated deployment cannot be written as Website Studio production even if UI/API logic is bypassed.

## Exact-source smoke verification

After Vercel promotion, Website Studio fetches production:

- `/` (the saved `index.html`)
- `/styles.css`
- `/script.js`

It computes SHA-256 hashes from the live responses and compares them with the saved immutable source snapshot.

The release becomes `live` only when all three files return successfully and match exactly.

If any file differs or cannot be fetched, the release becomes `smoke_failed` and is not treated as a verified live release.

## Rollback lineage

Before every promotion, Website Studio records the current Vercel production deployment ID.

Automated rollback is offered **only** when that deployment corresponds to a previous Website Studio release with a retained source snapshot. This relationship is stored as `previous_release_id`.

A Vercel deployment that predates Website Studio may still be recorded for audit, but one-click rollback is intentionally not offered because the restored artifact cannot be independently verified.

## Rollback execution

Rollback uses Vercel's rollback endpoint:

```text
POST /v1/projects/{projectId}/rollback/{deploymentId}
```

Website Studio then fetches the restored production files and hashes them against the previous release snapshot.

Rollback is declared successful only if the previous artifact is restored exactly.

On verified rollback:

- current release → `rolled_back`
- previous release → `live`
- current version → `approved`
- restored previous version → `production`
- deployment records are updated accordingly

If Vercel accepts the rollback but source verification fails, Website Studio records a failure and requires manual inspection rather than falsely reporting success.

## Operator confirmations

The operator UI deliberately uses two separate boundaries:

### Approval

`Approve vN for release`

This records human approval but changes no production traffic.

### Production

The operator must type:

```text
RELEASE
```

before promotion is enabled.

### Rollback

The operator must type:

```text
ROLLBACK
```

before verified rollback is enabled.

## Production URL

The default production URL is the dedicated Website Studio Vercel project domain:

```text
https://ws-<website-slug>.vercel.app
```

If a custom production alias is assigned by Vercel, it is recorded together with all returned production aliases.

Custom-domain provisioning itself remains a separate domain-management concern; v2.4 promotes the tested artifact to the project's existing production aliases.

## Server configuration

Production release and rollback require server-only:

```text
VERCEL_TOKEN
VERCEL_TEAM_ID
```

These credentials must never be exposed through `NEXT_PUBLIC_*`, client-side code, Brand Brain, generated website source, or release history.

## Audit trail

`growth_website_releases` records:

- approved version
- preview deployment ID
- source fingerprint
- project ID/name
- previous Website Studio release linkage
- previous production deployment ID
- production deployment ID
- production URL and aliases
- approval note/time
- promotion time
- smoke status/details
- rollback time
- lifecycle status

## Current rollout requirement

The release code is intentionally inert until ContentOS itself has a Vercel server environment with the required credentials and an actual Website Studio preview exists.

The draft PR should remain unmerged until at least one real end-to-end Website Studio test has exercised:

1. build
2. preview deploy
3. rendered QA
4. human approval
5. production promotion
6. exact-source smoke verification
7. second release
8. verified rollback to the first release
