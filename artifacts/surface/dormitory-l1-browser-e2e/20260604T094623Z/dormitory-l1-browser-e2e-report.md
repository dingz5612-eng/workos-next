# Dormitory L1 Browser E2E Audit

- Run ID: 20260604T094623Z
- Status: passed
- Browser mode: playwright-real-browser
- Commit SHA: 305b736fa55449bf8178bbc5b141c842d12a4ec4
- CI run ID: 26943137920
- Scope: Dormitory L1 only; Repair / Parts / HR excluded

## Scenarios

| Scenario | Type | Status | Steps | Violations |
| --- | --- | --- | ---: | ---: |
| dormitory_l1_positive_normal | positive | passed | 22 | 0 |
| dormitory_l1_negative_illegal_access | negative | passed | 2 | 0 |
| dormitory_l1_negative_unauthorized | negative | passed | 3 | 0 |
| dormitory_l1_negative_wrong_status | negative | passed | 2 | 0 |

## Architecture Assertions

| Assertion | Status |
| --- | --- |
| coverage.positive | passed |
| coverage.illegal_access | passed |
| coverage.unauthorized | passed |
| coverage.wrong_status | passed |
| coverage.resource_lifecycle | passed |
| admission.visible_not_allowed | passed |
| admission.completed_readonly | passed |
| runtime.blocked_required | passed |
| runtime.terminal | passed |
| runtime.only_write_entry | passed |
| compat.no_legacy_card_write | passed |
| ui.no_submit_terminal | passed |
| evidence.screenshots_hashed | passed |
| ci.bound | passed |

## Evidence

- Report: artifacts/surface/dormitory-l1-browser-e2e/20260604T094623Z/dormitory-l1-browser-e2e-report.json
- Screenshot index: artifacts/surface/dormitory-l1-browser-e2e/20260604T094623Z/screenshot-index.json
- Screenshot count: 99
