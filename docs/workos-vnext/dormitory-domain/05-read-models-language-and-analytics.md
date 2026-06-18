# 宿舍读模型、三语言与分析

## 设计锚点

本文件遵循总设计七层模型，定义宿舍经营域输出给搜索、共享治理、管理驾驶舱和分析的 `BusinessSummaryReadModel`。读模型只读消费摘要，不写宿舍事实、不写财务事实、不处理异常；合法动作只能回到 `DomainIntake`、`VNextExecutionItem` 或只读详情，三语言表达遵循 `VNextLanguageContract`。本文件不修改当前 OAM、generated、runtime、surface 或 tests。

读模型可展示的字段必须来自 `09-scenario-step-field-contracts.md` 的 `searchReadModel`、`11-field-key-and-option-set-contract.md` 的字段/选项，以及 `12-minimal-input-and-autofill-policy.md` 允许只读复用的摘要。读模型中的 `legalActions` 必须回到 `08-state-action-transition-contract.md` 允许的办理动作，不得在搜索、画像或分析卡直接写事实。

## 宿舍读模型类型

| read model | 粒度 | 用途 |
| --- | --- | --- |
| `dormitory.source_summary` | 来源 | 来源转化、接入状态、初始证据 |
| `dormitory.intake_summary` | DomainIntake | 接入状态、失败路由、下一办理项 |
| `dormitory.application_summary` | 住宿申请 | 申请状态、主体、需求、证据 |
| `dormitory.stay_order_summary` | 住宿单 | 入住、在住、续住、换房、退住状态 |
| `dormitory.room_summary` | 房间 | 可经营状态、占用、清洁、维修、停售 |
| `dormitory.bed_summary` | 床位 | 可用、锁定、占用、检查、恢复 |
| `dormitory.finance_basis_summary` | 金额依据 | 费用、押金、退款、扣减的承接状态 |
| `dormitory.checkout_summary` | 退住 | 检查、结算、财务、关闭状态 |
| `dormitory.analytics_summary` | 管理分析 | 转化、入住率、风险、效率 |

## 标准字段

每个 `BusinessSummaryReadModel` 必须包含：

- `sourceDomain: dormitory`
- `sourceObjectType`
- `sourceObjectRef`
- `summaryGrain`
- `displayFields`
- `status`
- `risk`
- `amountSummary`
- `evidenceSummary`
- `legalActions`
- `forbiddenActions`
- `freshness`
- `auditRef`
- `languageKeys`

## 搜索显示优先级

宿舍搜索结果优先显示：

1. 业务锚点：住宿单、房间/床位、住客或企业。
2. 当前状态：申请、已分配、等待财务、在住、退住、关闭。
3. 日期：入住、续住、退住或承接时间。
4. 金额摘要：金额、币种、阶段语义。
5. 证据摘要：齐备、缺失、驳回、过期。
6. 下一步：可办理、等待上游、等待财务、只读查看。

不得以内部 ID、payload hash、definitionId、commandSubmissionId 作为主标题。

## 共享治理画像消费

共享治理可只读消费：

- 住客当前住宿状态。
- 企业住宿关系。
- 员工住宿摘要。
- 重复主体可能影响的住宿对象。
- 风险回执。

共享治理不得合并住宿事件，不得改写住宿单、房间床位状态或金额依据。

## 管理分析消费

管理驾驶舱可只读消费：

- 来源转化。
- 入住率。
- 房间床位占用。
- 等待财务数量。
- 押金/退款承接风险。
- 退住结算效率。
- 清洁维修恢复耗时。

管理分析不得直接关闭异常。需要处理时，必须形成 `ManagementDecisionRecord` 或回宿舍/财务办理项。

## 三语言显示合同

宿舍读模型必须提供：

- `titleKey`
- `statusKey`
- `riskKey`
- `amountKey`
- `evidenceKey`
- `nextActionKey`
- `emptyStateKey`
- `blockedReasonKey`

语言覆盖：

- `zh-CN`
- `ru-RU`
- `ky-KG`

稳定 value 不得展示给用户。

## 宿舍关键词示例

| 概念 | zh-CN | ru-RU | ky-KG |
| --- | --- | --- | --- |
| 住宿申请 | 住宿申请 | Заявка на проживание | Жашоо арызы |
| 住宿单 | 住宿单 | Карточка проживания | Жашоо жазуусу |
| 房间 | 房间 | Комната | Бөлмө |
| 床位 | 床位 | Место | Керебет орду |
| 入住 | 入住 | Заселение | Кирүү |
| 续住 | 续住 | Продление проживания | Узартуу |
| 换房 | 换房 | Смена комнаты | Бөлмө алмаштыруу |
| 退住 | 退住 | Выезд | Чыгуу |
| 押金申请 | 押金申请 | Заявка на депозит | Депозит арызы |
| 等待财务 | 等待财务 | Ожидает финансы | Финансы күтүлүүдө |
| 床位不可用 | 床位不可用 | Место недоступно | Керебет орду жеткиликсиз |

正式落地时，上述词汇必须进入当前语言合同和 catalog，不得只保存在 vNext 文档。

上述词汇只是 vNext 设计候选表达，不是当前语言权威。正式采纳时必须把 `09` 中的 `titleKey`、`fieldKey`、`actionKey`、`statusKey`、`errorKey`、`blockedReasonKey` 和 `nextStepKey`，以及 `11` 中所有 `optionSetRef` 的稳定 value 和三语言 label 映射到当前 language contract/catalog，并保留稳定 value 与本地化 label 分离。

## 读模型禁止

- 搜索结果直接确认入住、退住、收款、退款。
- 分析卡直接处理异常。
- 管理看板改房态。
- 摘要复制财务事实。
- 用旧中文状态或测试样例作为 fallback。
