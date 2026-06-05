# PC Governance Real Browser Audit

- Run ID: pc-governance-real-browser-global-audit-20260605-01
- Status: failed
- Browser mode: playwright-chromium-visible
- Mock policy: real browser clicks and form input only; no route mocks; no backend simulation; no API substitute for user operations
- Step count: 26
- Screenshot count: 76

| Assertion | Status |
| --- | --- |
| pc.surface.loaded | passed |
| pc.mobile_shell_absent | passed |
| pc.nav.present | passed |
| account.create.posted | passed |
| account.create.visible | failed |
| account.password_reset.posted | passed |
| account.disable.posted | passed |
| account.audit.visible | failed |
| network.account_create_count | failed |
| network.account_reset_count | failed |
| network.account_disable_count | failed |
| network.no_legacy_workspace_card_writes | passed |
| network.no_direct_business_fact_writes | passed |
