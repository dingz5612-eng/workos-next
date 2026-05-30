# V5.4 Fake Fallback Audit

Date: 2026-05-29

## Scope

Searched banned production fake literals and fallback markers:

```text
张三
A301
A301-02
3000
9300
PAY-2026-009
unknown-room
unknown-bed
demoQueue
workspaceProjections fallback
local fixture fallback
fake evidence
mock payment
hardcoded room
hardcoded resident
```

Production paths audited:

- `apps/mobile/src`, excluding `apps/mobile/src/devFixtures` and `apps/mobile/src/__tests__`.
- `services/core-api/WorkOS.Api`, excluding build outputs.
- Production mobile build output `apps/mobile/dist` when `node scripts/check-no-production-fake-fallback.mjs --dist` is run after build.

## Findings And Actions

| Location | Finding | Action |
| --- | --- | --- |
| `apps/mobile/src/runtime/runtimeStore.js` | Runtime store initialized from static `workspaceProjections` and used `local-fallback` / `offline-demo-fallback` state. | Removed static projection import. Empty startup now uses `empty-runtime`; API failure uses `offline-cache` when real runtime data exists, otherwise `offline-empty`. |
| `apps/mobile/src/selectors/surfaceSelectors.js` | Offline Workbench returned `demoQueue` objects. | Removed `demoQueue` import and `offlineDemoQueue()`. Offline Workbench now returns cached real queue items or an empty list. |
| `apps/mobile/src/views/workbenchView.js` | Offline helper was tied to `offline-demo-fallback`. | Helper now renders only for offline empty Workbench state. |
| `apps/mobile/src/controls/fieldControls.js` | Imported `projectionMetadata`, pulling fake candidate defaults into production bundle. | Moved `capacityForRoomType` into the control helper and removed the fixture import. |
| `apps/mobile/src/i18n.js` | Imported `demoCopy`, which contained fake resident/deposit copy. | Replaced with `i18n/domainCopy.js` containing only domain/UI copy and no fake business object literals. |
| `apps/mobile/src/workspaceProjections.js`, `demoQueue.js`, `projectionMetadata.js`, `i18n/demoCopy.js` | Explicit dev/demo fixture data. | Moved to `apps/mobile/src/devFixtures/**`. These are not production imports. |

## Retained Non-Production Fixtures

The banned literals still exist only in non-production contexts:

- `apps/mobile/src/devFixtures/**`: explicit dev/test fixture data.
- `tests/WorkOS.RuntimeContractTests/Program.cs`: contract fixtures and negative fake-evidence tests.
- `apps/mobile/src/__tests__/surfaceSelectors.test.js`: banned-literal regex assertion that offline state does not include fake business objects.
- Architecture/rules docs and guard scripts: banned terms are listed as examples or scanner inputs.
- `docs/ux/WON_01_MOBILE_UX_REFERENCE_REDESIGN.md`: historical UX reference, not runtime source.
- `scripts/validate-runtime-api.mjs`: synthetic validation payload amount used by API validation, not a production fallback path.

No unresolved production-path TODO remains after this pass.

## Stop-Bad-Facts Guard

New guard:

```powershell
node scripts/check-no-production-fake-fallback.mjs --self-test
node scripts/check-no-production-fake-fallback.mjs
node scripts/check-no-production-fake-fallback.mjs --dist
```

New invariant definition:

```text
runtime.no_production_demo_fallback
```

The invariant is blocking/P0 and is evaluated by `invariant-runner` through `scripts/check-no-production-fake-fallback.mjs`. It generates a `runtime_invariant_checks` result with `passed` or `failed`.

## Expected API Failure Behavior

- Mobile Today/Home API failure: render cached real runtime surface data if already loaded; otherwise render an empty surface.
- Mobile Work API failure: render cached real queue items if already loaded; otherwise render an empty queue.
- No production API failure path may materialize resident, room, bed, deposit, payment, or evidence fake objects.
