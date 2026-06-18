# 当前 OAM 映射与差异

## 设计锚点

本文件遵循总设计七层模型，只做 vNext 宿舍经营域与当前宿舍 OAM 权威的映射，不改变当前 OAM，不加入 `current-authority-index`，不修改 generated、runtime、surface 或 tests。

本文件必须同时映射 `README.md`、`08-state-action-transition-contract.md` 和 `09-scenario-step-field-contracts.md`，但这些文件在本轮均为 vNext 目标合同，暂不登记为当前 OAM 权威。

## 当前宿舍权威基础

当前宿舍经营已有 Source Authority：

- `docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json`
- `docs/business/domains/dormitory/dormitory-operating-kernel.json`
- `docs/business/domains/dormitory/lodging-scenario-package-index.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json`
- `docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json`

这些文件继续有效。vNext 宿舍域设计只能映射、补目标、标差异。

## 13 场景映射

| 当前 OAM 场景 | vNext 宿舍域位置 | 状态 |
| --- | --- | --- |
| 房源建档与基础就绪 | 房间/床位对象、基础可经营状态 | 保留 |
| 房源运营就绪与状态维护 | 房间/床位状态、清洁维修协同、恢复可经营 | 保留 + 改名 |
| 住宿商品与价格 | 价格快照、费用依据 | 保留 |
| 询价与报价 | `dormitory.external_stay_intake`、住宿申请前置 | 保留 + 未来重构 |
| 预订与库存锁定 | 住宿单、床位锁定、企业批量候选 | 保留 |
| 收款、押金与担保 | 押金申请、收款依据、财务承接 | 保留 + 边界强化 |
| 入住办理 | 入住办理项、床位 occupied、在住摘要 | 保留 |
| 在住管理 | 续住、换房、在住服务、异常修正 | 保留 |
| 退房结算 | 退住检查、退款/扣减依据、关闭住宿单 | 保留 |
| 取消、未到店与退款处理 | 取消/未到店接入、退款依据、财务承接 | 保留 |
| 房务、维修与停售协同 | 清洁维修协同、停售、恢复可经营 | 保留 + 跨域边界强化 |
| 渠道与企业客户 | 企业住宿接入、企业主体和住客分离 | 保留 + `DomainIntake` 强化 |
| 经营报表、审计与复盘 | 宿舍 `BusinessSummaryReadModel`、管理只读分析 | 降级为只读 + 未来重构 |

## vNext 新增或强化概念

| vNext 概念 | 当前 OAM 对应 | 采纳状态 |
| --- | --- | --- |
| `DomainIntake` | 当前分散在询价、预订、员工/企业接入等前置流程 | 新增，暂不进入当前 OAM |
| `VNextExecutionItem` 扩展合同 | WorkItem / Confirm Runtime / operation experience contract | 保留 + 未来重构 |
| `BusinessSummaryReadModel` | Search / Lens / Projection / read model | 新增 + 未来重构 |
| `VNextLanguageContract` | `docs/contracts/language/language-contract.json` 和 catalog | 新增目标，需映射到当前语言合同 |
| `ManagementDecisionRecord` | 管理复盘、行动计划、治理命令 | 新增，暂不进入当前 OAM |
| `DormitoryDomainAuthorityIndex` | 当前 OAM package index / control authority 的领域入口能力 | 新增，暂不进入当前 OAM |
| `DormitoryStateActionTransition` | 当前场景 Source Authority、operation experience contract、Confirm Runtime 状态动作 | 新增目标，未来重构 |
| `DormitoryScenarioStepFieldContract` | 当前 fieldAuthority、readOnlySummary、legalActions、financialContext、searchReadModel | 新增目标，未来重构 |
| `DormitoryMobileUIRedesignDirection` | 当前 mobile surface、surface experience contract、UX acceptance | 新增目标，暂不进入当前 OAM |
| `DormitoryFieldKeyContract` | 当前 fieldAuthority、language catalog、generated surface fields | 新增目标，未来重构 |
| `DormitoryOptionSetContract` | 当前 enum/option authority、language catalog、runtime selection model | 新增目标，未来重构 |
| `DormitoryMinimalInputPolicy` | 当前 startContext、carry-forward、readOnlySummary、surface form model | 新增目标，未来重构 |
| `DormitoryScreenFieldBlueprint` | 当前 mobile surface screens、surface experience contract、UX acceptance | 新增目标，暂不进入当前 OAM |

## 不能直接采纳的内容

- 不把 vNext 文档直接登记为当前 Source Authority。
- 不绕过 `dormitory-13-scenario-control.authority.json`。
- 不手改 generated dormitory contracts。
- 不通过 UI 增加 `DomainIntake` 字段。
- 不让管理驾驶舱直接处理宿舍异常。
- 不用 vNext 三语言示例替代当前 language catalog。
- 不把现有 WorkOSNext mobile surface UI 当作 vNext 高保真继承来源。

## 未来采纳顺序

1. 先评审 vNext 宿舍域设计和当前 13 场景差异。
2. 选择低风险概念进入现有合同，例如语言 key、读模型字段、移动端体验文案。
3. 对 `DormitoryFieldKeyContract` 和 `DormitoryOptionSetContract` 做当前 fieldAuthority、enum、language catalog 差异表。
4. 对 `BusinessSummaryReadModel` 做 search/read-side 合同升级。
5. 对 `DomainIntake` 做 Source Authority 级别试点，不直接影响财务和核心入住。
6. 对 `VNextExecutionItem` 扩展合同做 generated、runtime、surface 全链路改造。
7. 对 `DormitoryScreenFieldBlueprint` 做新移动端样板屏评审，确认不继承旧 UI。
8. 运行合同、runtime、surface、三语言、真实浏览器和 Evidence Root 检查。
9. 单独通过当前 OAM 准入后，才允许进入发布评审。

## 新合同采纳风险

| vNext 合同 | 主要风险 | 采纳前置条件 |
| --- | --- | --- |
| `DormitoryDomainAuthorityIndex` | 与当前 Source Authority 入口产生双权威 | 明确它只作为 vNext 领域入口，当前 OAM 仍以 13 场景 control authority 为准 |
| `DormitoryStateActionTransition` | 与现有 Confirm Runtime 状态动作不一致 | 逐场景回源比对现有 legalActions、transition、audit event |
| `DormitoryScenarioStepFieldContract` | 与现有 generated surface fields、fieldAuthority 不一致 | 先做差异表，再由 Source/Experience/language contract 生成，不手改 generated |
| `DormitoryFieldKeyContract` | 字段 key、字段 label、当前 fieldAuthority 不一致 | 逐字段映射当前 authority，确认保留、改名、新增、废弃 |
| `DormitoryOptionSetContract` | 当前 enum、状态、reason code 和三语言 catalog 缺口 | 先做稳定 value 和语言 label 缺口检查 |
| `DormitoryMinimalInputPolicy` | 当前 surface 仍可能要求用户重复手填 | 先改权威和 generated form model，再改 UI |
| `DormitoryScreenFieldBlueprint` | 被误解为当前 mobile surface 实施单 | 先做 vNext 样板评审，不产生当前 runtime/surface 修改 |
| 三语言 key | 与当前 catalog 缺口较大 | 进入 language contract 前做 zh-CN、ru-RU、ky-KG 全量缺口检查 |
| `DormitoryMobileUIRedesignDirection` | 误把 vNext 视觉方向当成当前 surface 实施 | 先做样板屏评审，再进入 Experience Authority 和 surface contract |

## 当前状态

本文件不产生当前 OAM GO，不产生可发布、可试运行或用户可亲测结论。
