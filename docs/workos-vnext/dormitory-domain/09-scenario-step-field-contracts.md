# 宿舍场景步骤字段合同

## 设计锚点

本文件定义 `DormitoryScenarioStepFieldContract`。它设计的是场景步骤级办理项字段合同，不是数据库表结构，也不是 UI 临时字段清单。字段用于约束后续 Source Authority、Experience Authority、generated contracts、runtime、surface 和 tests 的共同语义。

所有字段必须服务于 `VNextExecutionItem`，所有写入必须进入提交确认；本文件不修改当前 OAM Source Authority、generated、runtime、surface 或 tests。

字段 key、控件类型、选项集和三语言 label 以 `11-field-key-and-option-set-contract.md` 为准；少填、自动带出和只读复用以 `12-minimal-input-and-autofill-policy.md` 为准；页面组合以 `13-screen-field-blueprint.md` 为准。

## 合同结构

每个场景步骤必须声明：

- `scenarioKey`：场景稳定 key。
- `stepKey`：步骤稳定 key。
- `primaryBusinessObject`：当前办理对象。
- `fieldKeyGroups.requiredReadContext`：系统带出的只读上下文字段 key。
- `fieldKeyGroups.editableInputs`：用户本次真正需要填写的字段 key。
- `fieldKeyGroups.fixedSelections`：对象选择器、枚举、分段按钮或权威选项集字段 key。
- `fieldKeyGroups.financialContext`：金额、币种、收付方向、阶段语义、业务对象和财务承接状态字段 key。
- `fieldKeyGroups.evidenceMaterials`：证据 key 和证据状态字段 key。
- `fieldKeyGroups.legalActions`：按钮和流程动作 key，不得成为字段。
- `fieldKeyGroups.handoffSummary`：上一步带入、提交后去哪、下一责任角色字段 key。
- `fieldKeyGroups.searchReadModel`：提交后更新的只读摘要类型。
- `languageKeys`：中文、俄语、吉语标题、字段、按钮、状态、错误、空态 key。

## 字段组格式

每个步骤的 `fieldKeyGroups` 必须采用同一格式：

```text
read=[fieldKey...]
edit=[fieldKey...]
fixed=[fieldKey or optionSetRef...]
finance=[fieldKey...]
evidence=[evidenceKey...]
actions=[actionKey...]
handoff=[fieldKey...]
search=[BusinessSummaryReadModel...]
language=[titleKey, descriptionKey, primaryActionKey, statusKey, errorKey, emptyStateKey, blockedReasonKey, nextStepKey]
```

字段组中出现的字段必须存在于 `DormitoryFieldKeyContract`。所有 `fixed` 项必须能追溯到 `DormitoryOptionSetContract` 或对象选择器。所有 `edit` 项必须通过 `DormitoryMinimalInputPolicy`，不能让用户重复填写系统已知信息。

## 场景步骤字段矩阵

本矩阵按“场景 -> 步骤”拆分。每一行都是一个可进入 `VNextExecutionItem` 的办理项步骤；复合场景不得再用一行兜底。

| scenarioKey | stepKey | primaryBusinessObject | fieldKeyGroups |
| --- | --- | --- | --- |
| `lodging.resource_basic_readiness` | `create_room_resource` | 房间 | read=[`building.ref`,`resource.operation_profile`] edit=[`room.display_name`,`room.note.optional`] fixed=[`room.type`,`resource.operable_flag`] finance=[] evidence=[`resource_profile`] actions=[`complete_room_basic_setup`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.room_summary`] language=[standard] |
| `lodging.resource_basic_readiness` | `create_bed_resource` | 床位 | read=[`room.ref`,`room.type`,`resource.capacity`] edit=[`bed.count`,`bed.note.optional`] fixed=[`bed.type`,`resource.operable_flag`] finance=[] evidence=[`resource_profile`] actions=[`complete_bed_basic_setup`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.bed_summary`] language=[standard] |
| `lodging.resource_operation_status` | `confirm_operational_status` | 房间/床位 | read=[`room.ref`,`bed.ref`,`inspection.summary`] edit=[`inspection.note.optional`] fixed=[`room.status`,`bed.status`,`inspection.result`] finance=[] evidence=[`room_inspection`,`bed_inspection`] actions=[`confirm_room_operational_ready`] handoff=[`blocked.reason`,`handoff.next_role`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.resource_operation_status` | `mark_out_of_service` | 房间/床位 | read=[`room.ref`,`bed.ref`,`room_bed.status`,`risk.summary`,`occupancy.summary`] edit=[`service.note.optional`] fixed=[`out_of_service.reason`,`responsibility.domain`] finance=[] evidence=[`room_inspection`,`bed_inspection`] actions=[`mark_room_out_of_service`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.product_and_rate` | `prepare_price_snapshot` | 价格快照 | read=[`room.type`,`bed.type`,`stay.period`,`channel.ref`] edit=[`amount.value`,`price.note.optional`] fixed=[`currency.code`,`stay.period`,`price.target_type`,`amount.stage`] finance=[`amount.value`,`currency.code`,`amount.stage`,`business_object.ref`] evidence=[`price_confirmation`] actions=[`prepare_amount_basis`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.finance_basis_summary`] language=[standard] |
| `lodging.inquiry_and_quote` | `external_source_to_intake` | 住宿接入 | read=[`source.ref`,`source.request_summary`,`subject.candidate_summary`] edit=[`stay.start_date`,`stay.period`,`guest.count`,`preference.note.optional`] fixed=[`stay.intent_type`,`evidence.type`] finance=[`amount.stage`] evidence=[`identity_document`] actions=[`submit_intake_for_resolution`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.intake_summary`] language=[standard] |
| `lodging.inquiry_and_quote` | `select_quote_room_bed` | 住宿申请 | read=[`subject.ref`,`source.request_summary`,`available_resource.summary`] edit=[`preference.note.optional`] fixed=[`room.ref`,`bed.ref`,`price_snapshot.ref`] finance=[`amount.value`,`currency.code`,`amount.stage`,`business_object.ref`] evidence=[`price_confirmation`] actions=[`select_room_bed_candidate`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.application_summary`] language=[standard] |
| `lodging.reservation_and_inventory_hold` | `hold_reservation_bed` | 住宿单 | read=[`application.ref`,`subject.ref`,`available_resource.summary`,`price_snapshot.ref`] edit=[`reservation.note.optional`] fixed=[`room.ref`,`bed.ref`,`hold.duration`] finance=[`amount.stage`,`business_object.ref`] evidence=[`price_confirmation`,`deposit_basis`] actions=[`reserve_or_assign_bed`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.reservation_and_inventory_hold` | `release_expired_hold` | 床位锁定 | read=[`stay_order.ref`,`hold.expired_at`,`audit.ref`] edit=[`release.note.optional`] fixed=[`release.reason`,`bed.release_result`] finance=[] evidence=[`audit.ref`] actions=[`release_bed_to_available`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.bed_summary`] language=[standard] |
| `lodging.payment_deposit_and_guarantee` | `prepare_deposit_basis` | 押金申请 | read=[`stay_order.ref`,`subject.ref`,`price_snapshot.ref`,`evidence.status`] edit=[`amount.value`,`finance.note.optional`] fixed=[`currency.code`,`payment.direction`,`deposit.type`,`amount.stage`] finance=[`amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status`] evidence=[`deposit_basis`] actions=[`request_deposit_handoff`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.finance_basis_summary`] language=[standard] |
| `lodging.payment_deposit_and_guarantee` | `prepare_payment_basis` | 收款依据 | read=[`stay_order.ref`,`subject.ref`,`price_snapshot.ref`,`evidence.status`] edit=[`amount.value`,`finance.note.optional`] fixed=[`currency.code`,`payment.direction`,`finance.handoff_type`,`amount.stage`] finance=[`amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status`] evidence=[`price_confirmation`] actions=[`request_finance_handoff`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.finance_basis_summary`] language=[standard] |
| `lodging.check_in_processing` | `verify_checkin_readiness` | 住宿单 | read=[`subject.ref`,`room.ref`,`bed.ref`,`finance.receipt_summary`,`evidence.status`] edit=[] fixed=[`blocked.reason`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`identity_document`,`checkin_handover`] actions=[`consume_finance_receipt`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.check_in_processing` | `confirm_checkin` | 住宿单 | read=[`subject.ref`,`room.ref`,`bed.ref`,`finance.receipt_summary`,`evidence.status`] edit=[`stay.actual_checkin_at`,`handover.note.optional`] fixed=[`handover.key_status`,`handover.access_status`,`handover.item_status`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`identity_document`,`checkin_handover`] actions=[`confirm_checkin`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.stay_order_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.in_stay_management` | `start_renewal` | 续住办理项 | read=[`stay_order.ref`,`bed.ref`,`deposit.balance_summary`] edit=[`stay.period`,`stay.expected_end_date`,`renewal.note.optional`] fixed=[`price_snapshot.ref`] finance=[`amount.value`,`currency.code`,`amount.stage`,`business_object.ref`] evidence=[`price_confirmation`] actions=[`start_renewal`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.in_stay_management` | `confirm_renewal_after_finance` | 住宿单 | read=[`renewal_basis.ref`,`finance.receipt_summary`,`stay_order.ref`] edit=[] fixed=[`renewal.confirm_result`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`finance_receipt_summary`] actions=[`confirm_renewal`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.in_stay_management` | `start_room_bed_change` | 换房换床办理项 | read=[`stay_order.ref`,`current_room_bed.summary`,`available_resource.summary`] edit=[`change.reason_note.optional`] fixed=[`change.reason`,`room.ref`,`bed.ref`] finance=[`amount.value`,`currency.code`,`amount.stage`,`business_object.ref`] evidence=[`room_inspection`,`bed_inspection`] actions=[`start_room_bed_change`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.in_stay_management` | `confirm_room_bed_change` | 住宿单 | read=[`original_bed.inspection_summary`,`room.ref`,`bed.ref`,`finance.receipt_summary`] edit=[`handover.note.optional`] fixed=[`original_bed.result`,`bed.ref`,`no_finance.reason`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`room_inspection`,`bed_inspection`] actions=[`confirm_room_bed_change`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.stay_order_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.in_stay_management` | `create_service_request` | 服务协同办理项 | read=[`stay_order.ref`,`room.ref`,`bed.ref`,`issue.summary`] edit=[`service.note.optional`] fixed=[`service.type`,`responsibility.domain`] finance=[`amount.stage`,`business_object.ref`] evidence=[`room_inspection`,`bed_inspection`,`damage_photo`] actions=[`assign_service_task`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.checkout_and_settlement` | `start_checkout_inspection` | 退住办理项 | read=[`stay_order.ref`,`bed.ref`,`deposit.balance_summary`] edit=[`stay.actual_checkout_at`] fixed=[`checkout.type`,`checkout.reason`] finance=[`amount.stage`,`business_object.ref`] evidence=[`room_inspection`,`bed_inspection`] actions=[`start_checkout`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.checkout_summary`] language=[standard] |
| `lodging.checkout_and_settlement` | `submit_checkout_settlement` | 退住结算依据 | read=[`stay_order.ref`,`inspection.summary`,`damage.summary`] edit=[`amount.value`,`settlement.note.optional`] fixed=[`settlement.type`,`responsibility.domain`,`refund.type`,`deduction.type`,`currency.code`,`payment.direction`] finance=[`amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status`] evidence=[`room_inspection`,`bed_inspection`,`damage_photo`] actions=[`submit_checkout_settlement`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.checkout_summary`] language=[standard] |
| `lodging.checkout_and_settlement` | `close_after_finance` | 住宿单 | read=[`finance.receipt_summary`,`resource_recovery.summary`,`stay_order.ref`] edit=[`close.note.optional`] fixed=[`close.reason`,`bed.release_result`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`finance_receipt_summary`] actions=[`close_after_finance`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.stay_order_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.cancel_noshow_refund_intake` | `start_reservation_cancel` | 住宿单 | read=[`stay_order.ref`,`subject.ref`,`bed_hold.summary`,`finance.summary`] edit=[`cancel.note.optional`] fixed=[`cancel.type`,`cancel.reason`,`responsibility.domain`] finance=[`amount.stage`,`business_object.ref`] evidence=[`cancellation_request`] actions=[`start_reservation_cancel`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.cancel_noshow_refund_intake` | `mark_noshow` | 住宿单 | read=[`stay_order.ref`,`scheduled_checkin_at`,`contact.record`] edit=[`noshow.note.optional`] fixed=[`noshow.type`,`noshow.reason`,`responsibility.domain`] finance=[`amount.stage`,`business_object.ref`] evidence=[`noshow_contact_record`] actions=[`mark_noshow`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.cancel_noshow_refund_intake` | `prepare_cancel_or_noshow_refund_basis` | 退款依据 | read=[`cancel_or_noshow.record`,`finance.summary`,`stay_order.ref`] edit=[`amount.value`,`refund.note.optional`] fixed=[`refund.type`,`deduction.type`,`cancel.handling_type`,`noshow.handling_type`,`currency.code`,`payment.direction`] finance=[`amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status`] evidence=[`cancellation_request`,`noshow_contact_record`] actions=[`prepare_cancel_refund_basis`,`prepare_noshow_refund_basis`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.finance_basis_summary`] language=[standard] |
| `lodging.cancel_noshow_refund_intake` | `close_cancel_or_noshow` | 住宿单 | read=[`refund_basis.ref`,`finance.receipt_summary`,`no_finance.reason`] edit=[`close.note.optional`] fixed=[`close.reason`,`bed.release_result`] finance=[`finance.handoff_status`,`amount.stage`] evidence=[`audit.ref`] actions=[`close_after_finance`,`close_without_finance`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.stay_order_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.housekeeping_maintenance_outofservice` | `assign_service_task` | 房间/床位服务任务 | read=[`room_bed.status`,`inspection.summary`,`issue.summary`] edit=[`service.note.optional`] fixed=[`service.type`,`responsibility.domain`] finance=[`amount.stage`,`business_object.ref`] evidence=[`room_inspection`,`bed_inspection`,`damage_photo`] actions=[`assign_service_task`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.housekeeping_maintenance_outofservice` | `inspect_recovery` | 恢复检查办理项 | read=[`service.completion_summary`,`room_bed.status`] edit=[`inspection.note.optional`] fixed=[`recovery.object`,`inspection.result`] finance=[] evidence=[`room_inspection`,`bed_inspection`] actions=[`start_dormitory_inspection`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.housekeeping_maintenance_outofservice` | `restore_availability` | 房间/床位 | read=[`inspection.summary`,`service.completion_summary`] edit=[`restore.note.optional`] fixed=[`recovery.object`,`release.reason`] finance=[] evidence=[`recovery_inspection_record`] actions=[`restore_to_available`,`release_bed_to_available`] handoff=[`handoff.next_role`,`audit.ref`] search=[`dormitory.room_summary`,`dormitory.bed_summary`] language=[standard] |
| `lodging.channel_corporate_customer` | `corporate_stay_intake` | 企业住宿接入 | read=[`corporate.ref`,`contact.ref`,`source.ref`] edit=[`guest.count`,`stay.period`,`corporate.requirement_note.optional`] fixed=[`corporate.ref`,`contact.ref`,`stay.intent_type`] finance=[`amount.stage`,`business_object.ref`] evidence=[`corporate_authorization`] actions=[`submit_intake_for_resolution`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.intake_summary`] language=[standard] |
| `lodging.channel_corporate_customer` | `bind_corporate_guests` | 企业住宿申请 | read=[`corporate.ref`,`contact.ref`,`guest.candidate_summary`] edit=[`guest.note.optional`] fixed=[`guest.ref`,`employee_relation.summary`,`room.ref`,`bed.ref`] finance=[`amount.stage`,`business_object.ref`] evidence=[`corporate_authorization`,`identity_document`] actions=[`confirm_subject_binding`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.application_summary`] language=[standard] |
| `lodging.channel_corporate_customer` | `create_batch_stay_orders` | 批量住宿单 | read=[`corporate_application.ref`,`guest.list_summary`,`available_resource.summary`] edit=[`batch.note.optional`] fixed=[`corporate.ref`,`guest.ref`,`room.ref`,`bed.ref`] finance=[`amount.value`,`currency.code`,`amount.stage`,`business_object.ref`] evidence=[`corporate_authorization`,`price_confirmation`] actions=[`convert_to_stay_order`] handoff=[`handoff.next_role`,`finance.handoff_status`] search=[`dormitory.stay_order_summary`] language=[standard] |
| `lodging.reporting_audit_review` | `review_analytics_summary` | 宿舍经营摘要 | read=[`analytics.summary`,`risk.summary`,`audit.ref`] edit=[] fixed=[`analytics.grain`] finance=[`amount.summary_readonly`] evidence=[`audit.ref`] actions=[`view_detail`] handoff=[`handoff.next_role`] search=[`dormitory.analytics_summary`] language=[standard] |
| `lodging.reporting_audit_review` | `create_management_decision_record` | 管理拍板记录 | read=[`analytics.summary`,`responsibility.domain`,`risk.evidence_summary`] edit=[`decision.note`] fixed=[`responsibility.domain`,`next_work_item.type`] finance=[`amount.summary_readonly`] evidence=[`management_decision_basis`] actions=[`create_management_decision_record`] handoff=[`handoff.next_role`,`next_work_item.type`] search=[`dormitory.analytics_summary`] language=[standard] |
| `lodging.reporting_audit_review` | `start_audit_correction` | 修正办理项 | read=[`original_fact.summary`,`audit.ref`,`correction.reason_summary`] edit=[`correction.note`] fixed=[`correction.type`,`responsibility.domain`,`finance.impact_declaration`] finance=[`finance.impact_declaration`] evidence=[`audit.ref`] actions=[`start_correction`] handoff=[`handoff.next_role`,`blocked.reason`] search=[`dormitory.stay_order_summary`] language=[standard] |

## 页面字段分组顺序

每个步骤页面必须按以下顺序呈现：

1. `primaryBusinessObject`：业务对象和状态，不显示内部主键作为主标题。
2. `requiredReadContext`：来源、主体、房间床位、价格、财务、证据只读摘要。
3. `editableInputs`：本次真实输入，数量应少而准。
4. `fixedSelections`：对象选择器和权威选项，禁止手填替代。
5. `financialContext`：金额、币种、方向、阶段、业务对象、财务状态。
6. `evidenceMaterials`：缺失、驳回、过期和补交路径。
7. `blockedReason`：当前不可处理原因和责任域。
8. `legalActions`：唯一主按钮和辅助动作。
9. `handoffSummary`：提交后去向和下一责任人。

## 三语言键规则

每个场景步骤至少提供：

- `titleKey`: `dormitory.<scenarioKey>.<stepKey>.title`
- `descriptionKey`: `dormitory.<scenarioKey>.<stepKey>.description`
- `primaryActionKey`: `dormitory.<scenarioKey>.<stepKey>.primary_action`
- `statusKey`: `dormitory.<scenarioKey>.<stepKey>.status`
- `errorKey`: `dormitory.<scenarioKey>.<stepKey>.error`
- `emptyStateKey`: `dormitory.<scenarioKey>.<stepKey>.empty`
- `blockedReasonKey`: `dormitory.<scenarioKey>.<stepKey>.blocked_reason`
- `nextStepKey`: `dormitory.<scenarioKey>.<stepKey>.next_step`

`language=[standard]` 表示必须生成上述 8 类 key，并由 `VNextLanguageContract` 提供 `zh-CN`、`ru-RU`、`ky-KG` 三语言 label。正式落地时，这些 key 必须进入当前语言合同和 catalog。本文档只定义 key 和业务语义，不替代当前语言文件。

## 字段验收

一个步骤字段合同不通过的情况：

- 把 `legalActions` 生成为用户字段。
- 让用户手填房间、床位、主体、币种、状态、证据类型、阻断原因。
- 所有 `fixed` 项没有引用 `DormitoryOptionSetContract` 或对象选择器。
- 金额没有币种、收付方向、阶段语义或业务对象。
- 系统已知的来源、主体、房间床位、财务回执要求用户重复录入。
- 自由文本成为事实主来源，而不是受控原因后的可选补充。
- 页面只显示内部 ID、旧中文状态、测试样例或技术 key。
- 任一关键字段没有中文、俄语、吉语 label key。
