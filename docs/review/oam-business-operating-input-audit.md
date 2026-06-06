# OAM 业务设计输入审计

## 审计范围

本审计读取三份外部设计输入：项目总纲、总设计、真值归属矩阵。它们只作为当前 OAM 合同的设计输入，不成为第二套规则权威，也不直接打开任何生产能力。

## 已纳入当前 OAM 的决策

- 主体、车辆、正式关系、共享回执和画像归共享治理；业务域只能提交录入线索、引用回执或读取画像。
- 宿舍业务归住宿能力线，覆盖房间、床位、入住、在住、换床、续住、退住、清洁维修、退押和周期复盘。
- 正式财务事实、收款、押金、费用、工资、报销、核销、账本交易和账本分录归 FinanceTruthPack 与 MoneyKernelPack。
- 业务域只能提出金额依据、费用依据或押金申请；正式财务事实必须经 finance-gate 语义校验后追加写入。
- 不清楚的款项先进入 UnclearMoneyCase；未澄清前不得写 LedgerTransaction 或 LedgerEntry。
- 证据对象归 EvidenceTrustPack；图片识别或文本识别只能作为建议，必须由用户采纳后才能进入业务字段。
- 搜索、BI、Dashboard、Projection、Lens、Profile、Summary、Receipt 都是读侧或展示侧，不拥有业务事实。
- 管理驾驶舱只读总览、风险、告警、决策上下文和派单线索；不得直接处理业务异常、财务异常或发布异常。
- 宿舍作为员工住宿的业务线处理，不作为 HR 子模块；HR 只保留 L0 合同预览。
- 销售、广告和营销线索当前不登记为可执行业务线；现有主体、车辆和来源关系先由共享治理承接。
- 司机不是单一员工或客户类型；主体关系与主体车辆关系必须由共享治理归一。
- 自有车辆回收、车辆能源保障、维修、配件、工资、报销和公司费用的正式财务落点都必须回到当前 finance-gate 边界。

## 未纳入执行范围

- 不打开 Business Production。
- 不打开 Dormitory L2。
- 不允许 production_confirm。
- 不新增页面私有业务写 API。
- 不新增 Mobile BFF 业务事实写路径。
- 不新增未登记业务线、空服务壳、空包或只作占位的合同。
- 不把销售业务线、广告业务线或完整营销闭环登记为当前可执行域。
- 不让共享回执替代 AdmissionDecision、confirmAllowed、productionAllowed 或正式财务事实。
- 不让管理驾驶舱绕过 OAM Confirm Runtime 处理异常或写业务事实。

## 当前合同落点

- 当前架构权威：`docs/oam/current-architecture.md`
- 机器合同：`docs/contracts/oam.current.json`
- 准入状态：`docs/oam/current-admission-state.json`
- 业务线登记：`docs/business/business-line-registry.json`
- 准入矩阵：`docs/contracts/admission/admission-matrix.json`
- 真值归属：`docs/business/truth-owner-registry.yml`
- 共享治理边界：`docs/business/shared-governance/subject-vehicle-truth.yml`
- 宿舍领域包：`docs/business/domains/dormitory/domain-pack.yml`
- 宿舍金标场景：`docs/scenarios/dormitory/golden-pilot.yml`
- 宿舍字段、证据和分录合同：`docs/business/dormitory/`
- 财务事实管线：`docs/business/finance/finance-truth-pipeline.yml`
- 财务语义内核：`docs/finance/finance-semantic-truth-kernel.yml`
- 搜索内核：`docs/contracts/search/search-contract.json`
- 语言内核：`docs/contracts/language/language-contract.json`

## 审计结论

三份外部设计输入已经按当前 OAM 权威拆入合同、准入、真值、场景、财务语义、读侧和门禁。未能映射为当前执行合同的内容只作为未纳入范围记录，不形成运行入口、生产许可或第二套权威。
