# Dormitory Ten Scenario Real Browser Audit

- Run ID: ten-dormitory-scenario-real-browser-20260605-global-audit-04
- Status: passed
- Browser mode: playwright-chromium-visible
- Mock policy: real browser clicks and form input only; no route mocks; no backend simulation; no API substitute for user operations
- Scenario count: 10
- Screenshot count: 156
- Operations workspace starts: 10
- Operations confirms: 10
- Legacy workspace/card writes: 0

| Scenario | Negative | Positive | Findings |
| --- | --- | --- | ---: |
| 新增住宿房源 | passed | passed | 0 |
| 登记咨询和预订 | passed | passed | 0 |
| 安排入住和收款 | passed | passed | 0 |
| 维护在住信息 | passed | passed | 0 |
| 处理押金 | passed | passed | 0 |
| 登记普通收款 | passed | passed | 0 |
| 安排清洁或维修 | passed | passed | 0 |
| 办理退房 | passed | passed | 0 |
| 办理退住结算 | passed | passed | 0 |
| 做周期复盘 | passed | passed | 0 |

## Assertions

| Assertion | Status |
| --- | --- |
| search.entry.unified_count | passed |
| search.entry.no_resource_special_start | passed |
| network.workspace_start_count | passed |
| network.operations_confirm_count | passed |
| network.no_legacy_workspace_card_writes | passed |
| network.no_direct_business_fact_writes | passed |
