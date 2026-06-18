# 宿舍经营域对象与状态

## 设计锚点

本文件定义 vNext 宿舍经营域对象、状态和事实归属。所有对象必须能进入 `VNextExecutionItem` 办理，所有读侧输出必须形成 `BusinessSummaryReadModel`，所有用户可见表达必须遵循 `VNextLanguageContract`。

状态集合只说明对象可能处于什么状态；状态如何转移、谁负责、需要什么证据、失败后去哪，以 `08-state-action-transition-contract.md` 为准。各状态页面需要显示和填写的字段，以 `09-scenario-step-field-contracts.md` 为准。

## 对象总览

| 对象 | 类型 | 归属 | 是否宿舍事实 |
| --- | --- | --- | --- |
| 住宿来源 | `SourceAttribution` | 来源归因层 | 否 |
| 住宿接入 | `DomainIntake` | 宿舍域接入对象 | 否，转入后才形成事实 |
| 住客主体 | 主体主对象 | 共享治理层 | 否 |
| 员工关系摘要 | 只读摘要 | 人事行政域 | 否 |
| 住宿申请 | 业务事实 | 宿舍经营域 | 是 |
| 住宿单 | 业务执行对象 | 宿舍经营域 | 是 |
| 房间 | 经营资源 | 宿舍经营域 | 是 |
| 床位 | 经营资源 | 宿舍经营域 | 是 |
| 价格快照 | 金额依据 | 宿舍经营域 | 是，非财务真值 |
| 押金申请 | 财务承接依据 | 宿舍经营域 | 是，非押金财务事实 |
| 退住结算依据 | 财务承接依据 | 宿舍经营域 | 是，非退款/扣减财务事实 |
| 房务/维修协同 | 协同状态 | 宿舍域 + 维修域 | 分段归属 |
| 宿舍经营摘要 | `BusinessSummaryReadModel` | 读模型与分析层消费 | 只读 |

## DomainIntake 类型

| intake 类型 | 进入条件 | 成功后创建 |
| --- | --- | --- |
| `dormitory.external_stay_intake` | 外部客户主体可识别，住宿诉求有效 | 住宿申请办理项 |
| `dormitory.employee_stay_intake` | 员工主体和员工关系摘要可读 | 员工住宿申请办理项 |
| `dormitory.corporate_stay_intake` | 企业主体、联系人和住宿人数/周期明确 | 企业住宿接入办理项 |
| `dormitory.checkout_intake` | 住宿单在住或待退住 | 退住办理项 |
| `dormitory.change_room_intake` | 住宿单有效且目标资源可评估 | 换房换床办理项 |
| `dormitory.service_recovery_intake` | 房务、维修或停售状态需要恢复 | 恢复可经营办理项 |

`DomainIntake` 只代表接入，不提前生成住宿单、费用依据、房间占用或财务事实。

## 住宿申请状态

```text
draft
-> awaiting_subject_resolution
-> awaiting_evidence
-> ready_for_room_bed_selection
-> submitted
-> accepted
-> rejected
-> converted_to_stay_order
-> blocked
-> closed
```

状态边界：

- `draft` 不写住宿事实。
- `submitted` 后只能通过办理项追加修正。
- `converted_to_stay_order` 后，主业务锚点变为住宿单。
- `rejected` 必须有三语言拒绝原因和下一步。

## 住宿单状态

```text
pending_confirmation
-> reserved_or_assigned
-> awaiting_finance
-> ready_for_checkin
-> in_stay
-> renewal_pending
-> change_pending
-> checkout_pending
-> settlement_pending
-> closed
-> correction_pending
```

禁止：

- 财务未承接时显示“已收款”。
- 房务检查未完成时释放床位。
- 清洁或维修未完成时恢复可经营。
- 关闭后原地编辑住宿单。

## 房间状态

```text
draft
-> ready_for_bed_setup
-> operational_ready
-> partially_available
-> occupied
-> out_of_service
-> cleaning
-> maintenance
-> blocked
-> retired
```

房间状态属于宿舍域经营资源事实。涉及维修施工时，维修事实归维修与配件服务域，宿舍只读消费维修恢复摘要。

## 床位状态

```text
draft
-> available
-> held
-> assigned
-> occupied
-> checkout_inspection
-> cleaning
-> maintenance
-> out_of_service
-> available_after_recovery
```

床位状态必须有来源动作、责任角色和审计追踪。床位锁定、分配、释放和恢复必须进入办理项。

床位状态不得被房态看板、搜索结果或管理分析直接改写。床位的 `held`、`assigned`、`occupied`、`checkout_inspection`、`available_after_recovery` 等变化必须能追溯到 `DormitoryStateActionTransition` 的合法动作和审计事件。

## 金额依据状态

```text
basis_draft
-> basis_ready
-> finance_handoff_requested
-> finance_processing
-> finance_confirmed_readonly
-> finance_rejected
-> correction_required
```

金额依据属于宿舍域；正式收款、押金、退款、扣减、核销和核算属于合同与财务域。

## 清洁维修协同状态

```text
service_required
-> assigned
-> in_progress
-> completed_by_service_domain
-> dormitory_inspection_pending
-> restored_to_available
-> blocked
```

边界：

- 维修施工和配件消耗归维修与配件服务域。
- 宿舍负责房间床位可经营判断。
- 恢复可经营必须引用维修/清洁只读摘要和宿舍检查办理项。

## 宿舍 BusinessSummaryReadModel

每个摘要必须包含：

- `sourceDomain: dormitory`
- `sourceObjectType`：住宿申请、住宿单、房间、床位、费用依据、押金申请、退住结算依据。
- `sourceObjectRef`：可追溯业务锚点。
- `status`：稳定状态 value。
- `displayFields`：三语言 label。
- `amountSummary`：金额、币种、阶段语义和财务承接状态。
- `evidenceSummary`：证据齐备、缺失、拒绝或过期。
- `legalActions`：只能打开详情、打开办理项或查看审计。
- `forbiddenActions`：不能直接编辑事实、不能确认财务、不能处理异常。

读模型字段来自办理项提交后的业务摘要，不得反向成为写入入口。若读模型中的 `legalActions` 指向办理，必须打开 `09-scenario-step-field-contracts.md` 中已定义的场景步骤。
