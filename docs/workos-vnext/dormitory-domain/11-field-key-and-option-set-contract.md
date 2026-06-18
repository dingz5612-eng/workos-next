# 宿舍字段 key 与选项集合同

## 设计锚点

本文件定义 `DormitoryFieldKeyContract` 和 `DormitoryOptionSetContract`。它是宿舍经营域字段、控件类型、稳定 value、三语言 label 和选项来源的唯一合同；不是数据库表结构，也不是当前 OAM language catalog。

本文件只约束 vNext 宿舍经营域设计包，不修改当前 Source Authority、generated、runtime、surface 或 tests。

## 控件类型原则

不是所有字段都是下拉列表。字段必须按语义选择控件：

| controlType | 用途 | 禁止 |
| --- | --- | --- |
| `readOnlyRef` / `readOnlySummary` / `readOnlyStatus` | 来源、主体、住宿单、财务回执、证据状态等系统带出信息 | 让用户重复填写 |
| `objectPicker` | 主体、联系人、企业、住客、房间、床位、价格快照、住宿单 | 手填名称或内部编号 |
| `fixedSelection` | 状态、原因、类型、责任域、币种、收付方向、证据类型 | 自由文本替代选项 |
| `segmentedControl` | 少量互斥高频动作或类型 | 超过 4 项仍强行分段 |
| `datePicker` / `dateTimePicker` | 入住、退住、到店、实际交付时间 | 手填日期字符串 |
| `numberInput` | 人数、床位数量、锁定小时数 | 无上下限的自由输入 |
| `moneyInput` | 金额，必须和币种、业务对象、阶段语义同组 | 单独输入金额 |
| `optionalNote` | 受控原因后的补充说明 | 作为事实主来源 |

## 字段 key 合同

| fieldKey | meaning | controlType | requiredDefault | source/defaultFrom | validationRef | label.zh-CN | label.ru-RU | label.ky-KG |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `source.ref` | 来源引用 | `readOnlyRef` | 是 | `SourceAttribution` | `source_exists` | 来源 | Источник | Булак |
| `source.request_summary` | 原始诉求摘要 | `readOnlySummary` | 是 | `SourceAttribution` | `source_summary_present` | 诉求 | Запрос | Суроо-талап |
| `subject.candidate_summary` | 主体候选摘要 | `readOnlySummary` | 条件必需 | `SubjectResolution` | `subject_candidates_present` | 主体候选 | Кандидаты субъекта | Субъект талапкерлер |
| `subject.ref` | 主体引用 | `objectPicker` / `readOnlyRef` | 是 | 共享治理主对象 | `subject_resolved` | 主体 | Субъект | Субъект |
| `guest.ref` | 住客引用 | `objectPicker` / `readOnlyRef` | 条件必需 | 主体解析或企业批量名单 | `guest_resolved` | 住客 | Проживающий | Жашоочу |
| `guest.candidate_summary` | 住客候选摘要 | `readOnlySummary` | 条件必需 | 企业名单/来源 | `guest_candidates_present` | 住客候选 | Кандидаты проживающих | Жашоочу талапкерлер |
| `corporate.ref` | 企业主体引用 | `objectPicker` / `readOnlyRef` | 条件必需 | 共享治理企业主体 | `corporate_resolved` | 企业 | Компания | Компания |
| `contact.ref` | 联系人引用 | `objectPicker` / `readOnlyRef` | 条件必需 | 主体联系人 | `contact_resolved` | 联系人 | Контакт | Байланыш |
| `employee_relation.summary` | 员工关系摘要 | `readOnlySummary` | 条件必需 | 人事行政域 | `employee_relation_current` | 员工关系 | Трудовая связь | Кызматкер байланышы |
| `building.ref` | 楼栋引用 | `objectPicker` | 条件必需 | 宿舍资源主档 | `building_active` | 楼栋 | Здание | Имарат |
| `room.ref` | 房间引用 | `objectPicker` / `readOnlyRef` | 条件必需 | 宿舍房间对象 | `room_selectable` | 房间 | Комната | Бөлмө |
| `bed.ref` | 床位引用 | `objectPicker` / `readOnlyRef` | 条件必需 | 宿舍床位对象 | `bed_selectable` | 床位 | Место | Керебет орду |
| `room.type` | 房型 | `fixedSelection` | 条件必需 | `option.room_type` | `room_type_valid` | 房型 | Тип комнаты | Бөлмө түрү |
| `bed.type` | 床型 | `fixedSelection` | 条件必需 | `option.bed_type` | `bed_type_valid` | 床型 | Тип места | Керебет түрү |
| `resource.capacity` | 容量 | `readOnlySummary` | 条件必需 | 房间/床位配置 | `capacity_present` | 容量 | Вместимость | Сыйымдуулук |
| `resource.operable_flag` | 可经营属性 | `fixedSelection` | 是 | `option.operable_flag` | `operable_flag_valid` | 可经营属性 | Эксплуатация | Иштетүү абалы |
| `room.status` | 房间状态 | `fixedSelection` / `readOnlyStatus` | 是 | `option.room_status` | `room_status_valid` | 房间状态 | Статус комнаты | Бөлмө абалы |
| `bed.status` | 床位状态 | `fixedSelection` / `readOnlyStatus` | 是 | `option.bed_status` | `bed_status_valid` | 床位状态 | Статус места | Орун абалы |
| `room_bed.status` | 房态/床态摘要 | `readOnlyStatus` | 是 | 房间/床位状态机 | `room_bed_status_present` | 房态/床态 | Статус комнаты/места | Бөлмө/орун абалы |
| `available_resource.summary` | 可用资源摘要 | `readOnlySummary` | 条件必需 | 宿舍资源读模型 | `available_resource_present` | 可用资源 | Доступные ресурсы | Жеткиликтүү ресурс |
| `current_room_bed.summary` | 当前房间床位摘要 | `readOnlySummary` | 条件必需 | 在住摘要 | `current_room_bed_present` | 当前房间床位 | Текущая комната/место | Учурдагы бөлмө/орун |
| `price_snapshot.ref` | 价格快照 | `objectPicker` / `readOnlyRef` | 条件必需 | 价格快照 | `price_snapshot_active` | 价格快照 | Снимок цены | Баа үзүндүсү |
| `channel.ref` | 渠道引用 | `readOnlyRef` | 条件必需 | 来源归因 | `channel_present` | 渠道 | Канал | Канал |
| `stay.intent_type` | 住宿类型 | `segmentedControl` | 是 | `option.stay_intent_type` | `stay_intent_type_valid` | 住宿类型 | Тип проживания | Жашоо түрү |
| `stay.start_date` | 预计入住日期 | `datePicker` | 条件必需 | 用户选择或来源默认 | `date_not_past_or_allowed` | 入住日期 | Дата заселения | Кирүү күнү |
| `stay.expected_end_date` | 预计退住日期 | `datePicker` | 条件必需 | 周期推导或用户选择 | `end_after_start` | 预计退住日期 | Плановая дата выезда | Чыгуу күнү |
| `stay.actual_checkin_at` | 实际入住时间 | `dateTimePicker` | 条件必需 | 当前时间默认，可调整 | `actual_time_valid` | 实际入住时间 | Фактическое заселение | Чыныгы кирүү убактысы |
| `stay.actual_checkout_at` | 实际退住时间 | `dateTimePicker` | 条件必需 | 当前时间默认，可调整 | `actual_time_valid` | 实际退住时间 | Фактический выезд | Чыныгы чыгуу убактысы |
| `stay.period` | 住宿周期 | `fixedSelection` | 是 | `option.stay_period` | `stay_period_valid` | 住宿周期 | Срок проживания | Жашоо мөөнөтү |
| `guest.count` | 住客人数 | `numberInput` | 条件必需 | 来源默认或用户输入 | `positive_integer` | 住客人数 | Количество проживающих | Жашоочулар саны |
| `hold.duration` | 锁定时长 | `fixedSelection` | 条件必需 | `option.hold_duration` | `hold_duration_valid` | 锁定时长 | Срок удержания | Кармоо мөөнөтү |
| `amount.value` | 金额 | `moneyInput` | 条件必需 | 价格快照或用户确认 | `money_positive_or_zero` | 金额 | Сумма | Сумма |
| `amount.summary_readonly` | 金额只读摘要 | `readOnlySummary` | 条件必需 | 财务/业务摘要 | `amount_summary_present` | 金额摘要 | Сводка суммы | Сумма кыскача |
| `currency.code` | 币种 | `fixedSelection` | 是 | `option.currency_code`，默认 `KGS` | `currency_valid` | 币种 | Валюта | Валюта |
| `payment.direction` | 收付方向 | `fixedSelection` | 条件必需 | `option.payment_direction` | `payment_direction_valid` | 收付方向 | Направление платежа | Төлөм багыты |
| `amount.stage` | 金额阶段 | `fixedSelection` / `readOnlyStatus` | 是 | `option.amount_stage` | `amount_stage_valid` | 金额阶段 | Этап суммы | Сумма этабы |
| `business_object.ref` | 金额业务对象 | `readOnlyRef` | 条件必需 | 当前办理对象 | `business_object_present` | 业务对象 | Бизнес-объект | Бизнес объект |
| `finance.handoff_type` | 财务承接类型 | `fixedSelection` | 条件必需 | `option.finance_handoff_type` | `finance_handoff_type_valid` | 承接类型 | Тип передачи | Өткөрүү түрү |
| `finance.handoff_status` | 财务承接状态 | `readOnlyStatus` | 条件必需 | 财务域回执 | `finance_status_present` | 财务承接 | Передача в финансы | Финансыга өткөрүү |
| `finance.receipt_summary` | 财务回执摘要 | `readOnlySummary` | 条件必需 | 财务域 | `finance_receipt_present` | 财务回执 | Финансовый ответ | Финансы жообу |
| `finance.summary` | 已承接金额摘要 | `readOnlySummary` | 条件必需 | 财务域/金额依据 | `finance_summary_present` | 财务摘要 | Финансовая сводка | Финансы кыскача |
| `deposit.balance_summary` | 押金/余额摘要 | `readOnlySummary` | 条件必需 | 财务域只读摘要 | `deposit_summary_present` | 押金/余额 | Депозит/остаток | Депозит/калдык |
| `deposit.type` | 押金类型 | `fixedSelection` | 条件必需 | `option.deposit_type` | `deposit_type_valid` | 押金类型 | Тип депозита | Депозит түрү |
| `refund.type` | 退款类型 | `fixedSelection` | 条件必需 | `option.refund_type` | `refund_type_valid` | 退款类型 | Тип возврата | Кайтаруу түрү |
| `deduction.type` | 扣减类型 | `fixedSelection` | 条件必需 | `option.deduction_type` | `deduction_type_valid` | 扣减类型 | Тип удержания | Кармоо түрү |
| `responsibility.domain` | 责任域 | `fixedSelection` | 条件必需 | `option.responsibility_domain` | `responsibility_domain_valid` | 责任域 | Ответственный домен | Жооптуу домен |
| `blocked.reason` | 阻断原因 | `fixedSelection` / `readOnlyStatus` | 条件必需 | `option.blocked_reason` | `blocked_reason_valid` | 阻断原因 | Причина блокировки | Тоскоолдук себеби |
| `evidence.type` | 证据类型 | `fixedSelection` | 条件必需 | `option.evidence_type` | `evidence_type_valid` | 证据类型 | Тип доказательства | Далил түрү |
| `evidence.status` | 证据状态 | `readOnlyStatus` | 是 | 证据服务/办理项 | `evidence_status_valid` | 证据状态 | Статус доказательства | Далил абалы |
| `inspection.summary` | 检查摘要 | `readOnlySummary` | 条件必需 | 房务/宿舍检查 | `inspection_summary_present` | 检查摘要 | Сводка осмотра | Текшерүү кыскача |
| `inspection.result` | 检查结果 | `fixedSelection` | 条件必需 | `option.inspection_result` | `inspection_result_valid` | 检查结果 | Результат осмотра | Текшерүү жыйынтыгы |
| `cancel.type` | 取消类型 | `fixedSelection` | 条件必需 | `option.cancel_type` | `cancel_type_valid` | 取消类型 | Тип отмены | Жокко чыгаруу түрү |
| `cancel.reason` | 取消原因 | `fixedSelection` | 条件必需 | `option.cancel_reason` | `cancel_reason_valid` | 取消原因 | Причина отмены | Жокко чыгаруу себеби |
| `cancel.handling_type` | 取消处理类型 | `fixedSelection` | 条件必需 | `option.cancel_handling_type` | `cancel_handling_type_valid` | 取消处理 | Обработка отмены | Жокко чыгарууну иштетүү |
| `noshow.type` | 未到店类型 | `fixedSelection` | 条件必需 | `option.noshow_type` | `noshow_type_valid` | 未到店类型 | Тип неявки | Келбей коюу түрү |
| `noshow.reason` | 未到店原因 | `fixedSelection` | 条件必需 | `option.noshow_reason` | `noshow_reason_valid` | 未到店原因 | Причина неявки | Келбей коюу себеби |
| `noshow.handling_type` | 未到店处理类型 | `fixedSelection` | 条件必需 | `option.noshow_handling_type` | `noshow_handling_type_valid` | 未到店处理 | Обработка неявки | Келбей коюуну иштетүү |
| `checkout.type` | 退住类型 | `fixedSelection` | 条件必需 | `option.checkout_type` | `checkout_type_valid` | 退住类型 | Тип выезда | Чыгуу түрү |
| `checkout.reason` | 退住原因 | `fixedSelection` | 条件必需 | `option.checkout_reason` | `checkout_reason_valid` | 退住原因 | Причина выезда | Чыгуу себеби |
| `settlement.type` | 结算类型 | `fixedSelection` | 条件必需 | `option.settlement_type` | `settlement_type_valid` | 结算类型 | Тип расчета | Эсептешүү түрү |
| `close.reason` | 关闭原因 | `fixedSelection` | 条件必需 | `option.close_reason` | `close_reason_valid` | 关闭原因 | Причина закрытия | Жабуу себеби |
| `release.reason` | 释放原因 | `fixedSelection` | 条件必需 | `option.release_reason` | `release_reason_valid` | 释放原因 | Причина освобождения | Бошотуу себеби |
| `bed.release_result` | 床位释放结果 | `fixedSelection` | 条件必需 | `option.bed_release_result` | `bed_release_result_valid` | 床位处理 | Обработка места | Орун иштетүү |
| `service.type` | 服务类型 | `fixedSelection` | 条件必需 | `option.service_type` | `service_type_valid` | 服务类型 | Тип услуги | Кызмат түрү |
| `recovery.object` | 恢复对象 | `fixedSelection` | 条件必需 | `option.recovery_object` | `recovery_object_valid` | 恢复对象 | Объект восстановления | Калыбына келтирүү объекти |
| `correction.type` | 修正类型 | `fixedSelection` | 条件必需 | `option.correction_type` | `correction_type_valid` | 修正类型 | Тип исправления | Түзөтүү түрү |
| `finance.impact_declaration` | 财务影响声明 | `fixedSelection` | 条件必需 | `option.finance_impact` | `finance_impact_valid` | 财务影响 | Финансовое влияние | Финансы таасири |
| `analytics.grain` | 分析口径 | `fixedSelection` | 条件必需 | `option.analytics_grain` | `analytics_grain_valid` | 分析口径 | Разрез анализа | Анализ деңгээли |
| `next_work_item.type` | 后续办理项类型 | `fixedSelection` | 条件必需 | `option.next_work_item_type` | `next_work_item_type_valid` | 后续办理项 | Следующая задача | Кийинки иш |
| `handoff.next_role` | 下一责任角色 | `readOnlyStatus` | 是 | 办理项路由 | `next_role_present` | 下一责任人 | Следующий ответственный | Кийинки жооптуу |
| `audit.ref` | 审计引用 | `readOnlyRef` | 是 | 审计链 | `audit_ref_present` | 审计 | Аудит | Аудит |
| `application.ref` | 住宿申请引用 | `readOnlyRef` | 条件必需 | 住宿申请 | `application_present` | 住宿申请 | Заявка на проживание | Жашоо арызы |
| `stay_order.ref` | 住宿单引用 | `readOnlyRef` | 条件必需 | 住宿单 | `stay_order_present` | 住宿单 | Карточка проживания | Жашоо жазуусу |
| `corporate_application.ref` | 企业住宿申请引用 | `readOnlyRef` | 条件必需 | 企业住宿申请 | `corporate_application_present` | 企业住宿申请 | Заявка компании | Компания арызы |
| `renewal_basis.ref` | 续住费用依据引用 | `readOnlyRef` | 条件必需 | 续住金额依据 | `renewal_basis_present` | 续住费用依据 | Основание продления | Узартуу негизи |
| `refund_basis.ref` | 退款依据引用 | `readOnlyRef` | 条件必需 | 退款/扣减依据 | `refund_basis_present` | 退款依据 | Основание возврата | Кайтаруу негизи |
| `resource.operation_profile` | 经营属性摘要 | `readOnlySummary` | 条件必需 | 宿舍资源主档 | `operation_profile_present` | 经营属性 | Профиль эксплуатации | Иштетүү мүнөзү |
| `room.display_name` | 房间显示名 | `textInput` | 条件必需 | 用户输入或导入 | `room_display_name_valid` | 房间名称 | Название комнаты | Бөлмө аты |
| `bed.count` | 床位数量 | `numberInput` | 条件必需 | 用户输入 | `positive_integer` | 床位数量 | Количество мест | Орун саны |
| `risk.summary` | 风险摘要 | `readOnlySummary` | 条件必需 | 共享治理/宿舍摘要 | `risk_summary_present` | 风险摘要 | Сводка риска | Тобокел кыскача |
| `occupancy.summary` | 占用摘要 | `readOnlySummary` | 条件必需 | 房间床位读模型 | `occupancy_summary_present` | 占用摘要 | Сводка занятости | Ээлөө кыскача |
| `bed_hold.summary` | 床位锁定摘要 | `readOnlySummary` | 条件必需 | 床位锁定记录 | `bed_hold_present` | 床位锁定 | Удержание места | Орун кармоо |
| `hold.expired_at` | 锁定过期时间 | `readOnlyStatus` | 条件必需 | 床位锁定记录 | `hold_expiry_present` | 锁定过期 | Истечение удержания | Кармоо бүтөт |
| `price.target_type` | 价格适用对象 | `fixedSelection` | 条件必需 | `option.price_target_type` | `price_target_type_valid` | 适用对象 | Объект цены | Баа объекти |
| `no_finance.reason` | 无需财务原因 | `fixedSelection` / `readOnlySummary` | 条件必需 | `option.no_finance_reason` | `no_finance_reason_valid` | 无需财务原因 | Причина без финансов | Финансысыз себеп |
| `original_bed.inspection_summary` | 原床位检查摘要 | `readOnlySummary` | 条件必需 | 宿舍检查记录 | `original_bed_inspection_present` | 原床位检查 | Осмотр прежнего места | Мурунку орун текшерүү |
| `original_bed.result` | 原床位处理结果 | `fixedSelection` | 条件必需 | `option.bed_release_result` | `original_bed_result_valid` | 原床位处理 | Обработка прежнего места | Мурунку орун иштетүү |
| `damage.summary` | 损耗摘要 | `readOnlySummary` | 条件必需 | 检查/证据摘要 | `damage_summary_present` | 损耗摘要 | Сводка ущерба | Зыян кыскача |
| `issue.summary` | 问题摘要 | `readOnlySummary` | 条件必需 | 检查/服务接入 | `issue_summary_present` | 问题摘要 | Сводка проблемы | Маселе кыскача |
| `service.completion_summary` | 服务完成摘要 | `readOnlySummary` | 条件必需 | 房务/维修域回执 | `service_completion_present` | 服务完成 | Завершение услуги | Кызмат бүтүшү |
| `resource_recovery.summary` | 资源恢复摘要 | `readOnlySummary` | 条件必需 | 恢复检查/资源状态 | `resource_recovery_present` | 恢复摘要 | Сводка восстановления | Калыбына кыскача |
| `cancel_or_noshow.record` | 取消/未到店记录 | `readOnlySummary` | 条件必需 | 取消或未到店办理项 | `cancel_or_noshow_record_present` | 取消/未到店记录 | Запись отмены/неявки | Жокко/келбей жазуу |
| `scheduled_checkin_at` | 约定入住时间 | `readOnlyStatus` | 条件必需 | 预订/住宿单 | `scheduled_checkin_present` | 约定入住时间 | Плановое заселение | Пландалган кирүү |
| `out_of_service.reason` | 停售原因 | `fixedSelection` | 条件必需 | `option.out_of_service_reason` | `out_of_service_reason_valid` | 停售原因 | Причина вывода | Токтотуу себеби |
| `change.reason` | 换房换床原因 | `fixedSelection` | 条件必需 | `option.change_reason` | `change_reason_valid` | 换房原因 | Причина смены | Алмашуу себеби |
| `analytics.summary` | 分析摘要 | `readOnlySummary` | 条件必需 | 读模型与分析层 | `analytics_summary_present` | 分析摘要 | Аналитическая сводка | Анализ кыскача |
| `risk.evidence_summary` | 风险证据摘要 | `readOnlySummary` | 条件必需 | 分析/审计链 | `risk_evidence_present` | 风险证据 | Доказательства риска | Тобокел далили |
| `contact.record` | 联系记录 | `readOnlySummary` / `optionalNote` | 条件必需 | 来源/沟通记录 | `contact_record_present` | 联系记录 | Запись контакта | Байланыш жазуусу |
| `guest.list_summary` | 住客名单摘要 | `readOnlySummary` | 条件必需 | 企业住宿申请 | `guest_list_present` | 住客名单 | Список проживающих | Жашоочулар тизмеси |
| `original_fact.summary` | 原事实摘要 | `readOnlySummary` | 条件必需 | 审计链 | `original_fact_present` | 原事实 | Исходный факт | Баштапкы факт |
| `correction.reason_summary` | 修正原因摘要 | `readOnlySummary` | 条件必需 | 审计/责任域 | `correction_reason_present` | 修正原因 | Причина исправления | Түзөтүү себеби |
| `handover.key_status` | 钥匙交付状态 | `fixedSelection` | 条件必需 | `option.handover_status` | `handover_status_valid` | 钥匙交付 | Передача ключа | Ачкыч берүү |
| `handover.access_status` | 门禁交付状态 | `fixedSelection` | 条件必需 | `option.handover_status` | `handover_status_valid` | 门禁交付 | Передача доступа | Кирүү уруксаты |
| `handover.item_status` | 物品交付状态 | `fixedSelection` | 条件必需 | `option.handover_status` | `handover_status_valid` | 物品交付 | Передача вещей | Буюм берүү |
| `renewal.confirm_result` | 续住确认结果 | `fixedSelection` | 条件必需 | `option.renewal_confirm_result` | `renewal_confirm_valid` | 续住结果 | Результат продления | Узартуу жыйынтыгы |
| `room.note.optional` | 房间补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 房间备注 | Примечание комнаты | Бөлмө эскертүү |
| `bed.note.optional` | 床位补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 床位备注 | Примечание места | Орун эскертүү |
| `price.note.optional` | 价格补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 价格备注 | Примечание цены | Баа эскертүү |
| `preference.note.optional` | 偏好补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 偏好说明 | Пожелания | Каалоо түшүндүрмө |
| `reservation.note.optional` | 预订补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 预订备注 | Примечание брони | Бронь эскертүү |
| `release.note.optional` | 释放补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 释放备注 | Примечание освобождения | Бошотуу эскертүү |
| `finance.note.optional` | 财务补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 财务备注 | Примечание для финансов | Финансы эскертүү |
| `handover.note.optional` | 交付补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 交付备注 | Примечание передачи | Өткөрүү эскертүү |
| `renewal.note.optional` | 续住补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 续住备注 | Примечание продления | Узартуу эскертүү |
| `change.reason_note.optional` | 换房补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 换房说明 | Пояснение смены | Алмашуу түшүндүрмө |
| `service.note.optional` | 服务补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 服务说明 | Описание услуги | Кызмат түшүндүрмө |
| `inspection.note.optional` | 检查补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 检查说明 | Примечание осмотра | Текшерүү эскертүү |
| `settlement.note.optional` | 结算补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 结算说明 | Пояснение расчета | Эсептешүү түшүндүрмө |
| `cancel.note.optional` | 取消补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 取消说明 | Пояснение отмены | Жокко чыгаруу түшүндүрмө |
| `noshow.note.optional` | 未到店补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 未到店说明 | Пояснение неявки | Келбей коюу түшүндүрмө |
| `refund.note.optional` | 退款补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 退款说明 | Пояснение возврата | Кайтаруу түшүндүрмө |
| `close.note.optional` | 关闭补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 关闭备注 | Примечание закрытия | Жабуу эскертүү |
| `restore.note.optional` | 恢复补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 恢复说明 | Пояснение восстановления | Калыбына түшүндүрмө |
| `corporate.requirement_note.optional` | 企业需求补充说明 | `optionalNote` | 否 | 用户补充 | `note_300_chars` | 企业需求 | Требования компании | Компания талабы |
| `guest.note.optional` | 住客补充说明 | `optionalNote` | 否 | 用户补充 | `note_200_chars` | 住客说明 | Пояснение по гостю | Жашоочу түшүндүрмө |
| `batch.note.optional` | 批量补充说明 | `optionalNote` | 否 | 用户补充 | `note_300_chars` | 批量备注 | Примечание пакета | Пакет эскертүү |
| `decision.note` | 管理拍板说明 | `optionalNote` | 是 | 管理层输入 | `note_500_chars` | 拍板说明 | Решение руководства | Башкаруу чечими |
| `correction.note` | 修正说明 | `optionalNote` | 是 | 审计/责任域输入 | `note_500_chars` | 修正说明 | Пояснение исправления | Түзөтүү түшүндүрмө |

## 核心选项集

| optionSetRef | owner | stable values | zh-CN labels | ru-RU labels | ky-KG labels |
| --- | --- | --- | --- | --- | --- |
| `option.currency_code` | 财务域 | `KGS`,`USD`,`CNY` | 吉尔吉斯索姆,美元,人民币 | Киргизский сом,Доллар США,Китайский юань | Кыргыз сому,АКШ доллары,Кытай юаны |
| `option.stay_intent_type` | 宿舍域 | `external`,`employee`,`corporate` | 外部客户,员工住宿,企业客户 | Внешний клиент,Сотрудник,Компания | Тышкы кардар,Кызматкер,Компания |
| `option.stay_period` | 宿舍域 | `day`,`week`,`month`,`custom` | 日租,周租,月租,自定义 | День,Неделя,Месяц,Пользовательский | Күн,Жума,Ай,Өзгөчө |
| `option.hold_duration` | 宿舍域 | `2h`,`6h`,`12h`,`24h`,`custom_approved` | 2小时,6小时,12小时,24小时,审批自定义 | 2 часа,6 часов,12 часов,24 часа,Индивидуально с согласованием | 2 саат,6 саат,12 саат,24 саат,Бекитилген өзгөчө |
| `option.room_type` | 宿舍域 | `single`,`double`,`multi_bed`,`suite`,`staff_room` | 单间,双人间,多人间,套间,员工房 | Одноместная,Двухместная,Многоместная,Люкс,Комната сотрудников | Бир кишилик,Эки кишилик,Көп орундуу,Люкс,Кызматкер бөлмөсү |
| `option.bed_type` | 宿舍域 | `lower`,`upper`,`single_bed`,`double_bed`,`flex` | 下铺,上铺,单床,双床,灵活床位 | Нижнее,Верхнее,Односпальное,Двуспальное,Гибкое | Төмөнкү,Жогорку,Бир кишилик,Эки кишилик,Ийкемдүү |
| `option.operable_flag` | 宿舍域 | `operable`,`not_operable`,`pending_check` | 可经营,不可经营,待检查 | Можно эксплуатировать,Нельзя эксплуатировать,Ожидает проверки | Иштетүүгө болот,Болбойт,Текшерүү күтүлөт |
| `option.room_status` | 宿舍域 | `draft`,`ready_for_bed_setup`,`operational_ready`,`cleaning`,`maintenance`,`out_of_service` | 草稿,待配床,可经营,清洁中,维修中,停售 | Черновик,Настройка мест,Готова,Уборка,Ремонт,Выведена | Черновик,Орун коюу,Даяр,Тазалоо,Оңдоо,Токтотулган |
| `option.bed_status` | 宿舍域 | `available`,`held`,`assigned`,`occupied`,`checkout_inspection`,`cleaning`,`maintenance`,`available_after_recovery` | 可用,已锁定,已分配,在住,退住检查,清洁中,维修中,恢复待释放 | Доступно,Удержано,Назначено,Занято,Проверка выезда,Уборка,Ремонт,Восстановлено | Жеткиликтүү,Кармалган,Бөлүнгөн,Жашап жатат,Чыгуу текшерүү,Тазалоо,Оңдоо,Калыбына келген |
| `option.payment_direction` | 财务域 | `receivable`,`payable`,`refund`,`deduction` | 应收,应付,退款,扣减 | К получению,К оплате,Возврат,Удержание | Алуучу,Төлөнүүчү,Кайтаруу,Кармоо |
| `option.amount_stage` | 宿舍/财务边界 | `basis`,`handoff_requested`,`finance_processing`,`finance_confirmed_readonly`,`finance_rejected`,`no_finance_required` | 金额依据,已请求承接,财务处理中,财务已确认只读,财务驳回,无需财务 | Основание,Передано,В работе финансов,Подтверждено финансами,Отклонено финансами,Финансы не нужны | Негиз,Өткөрүлдү,Финансы иштеп жатат,Финансы тастыктады,Финансы четке какты,Финансы керек эмес |
| `option.price_target_type` | 宿舍域 | `public_rate`,`employee_rate`,`corporate_rate`,`promotion_rate`,`manual_approved` | 公开价,员工价,企业价,活动价,审批手动价 | Публичный тариф,Тариф сотрудника,Корпоративный тариф,Акционный тариф,Ручной с согласованием | Ачык баа,Кызматкер баасы,Компания баасы,Акция баасы,Бекитилген кол баа |
| `option.finance_handoff_type` | 财务域 | `deposit`,`rent_payment`,`refund`,`deduction`,`adjustment` | 押金,租金收款,退款,扣减,调整 | Депозит,Оплата аренды,Возврат,Удержание,Корректировка | Депозит,Ижара төлөмү,Кайтаруу,Кармоо,Түзөтүү |
| `option.deposit_type` | 财务域 | `cash_deposit`,`company_guarantee`,`employee_guarantee` | 现金押金,企业担保,员工担保 | Денежный депозит,Гарантия компании,Гарантия сотрудника | Нак депозит,Компания кепилдиги,Кызматкер кепилдиги |
| `option.refund_type` | 财务域 | `full`,`partial`,`none`,`deduction_offset` | 全额退款,部分退款,不退款,扣减抵扣 | Полный возврат,Частичный возврат,Без возврата,Зачет удержания | Толук кайтаруу,Жарым-жартылай,Кайтарылбайт,Кармоо менен жабуу |
| `option.deduction_type` | 财务域 | `damage`,`late_checkout`,`unpaid_fee`,`policy_penalty`,`other_controlled` | 损耗扣减,超时扣减,未付费用,规则扣减,其他受控 | Ущерб,Поздний выезд,Неоплачено,Штраф по правилу,Другое | Зыян,Кеч чыгуу,Төлөнбөгөн,Эреже кармоо,Башка |
| `option.cancel_type` | 宿舍域 | `guest_requested`,`operator_cancelled`,`policy_cancelled` | 客户取消,运营取消,规则取消 | Отмена клиентом,Отмена оператором,Отмена по правилу | Кардар жокко чыгарды,Оператор жокко чыгарды,Эреже боюнча |
| `option.cancel_reason` | 宿舍域 | `plan_changed`,`price_unaccepted`,`no_bed_available`,`duplicate_booking`,`other_controlled` | 行程变化,未接受价格,无可用床位,重复预订,其他受控 | Изменение планов,Цена не принята,Нет мест,Дублирование,Другое | План өзгөрдү,Бааны кабыл алган жок,Орун жок,Кайталанган бронь,Башка |
| `option.cancel_handling_type` | 宿舍域 | `refund_required`,`deduction_required`,`no_finance_required`,`manual_review` | 需要退款,需要扣减,无需财务,人工复核 | Нужен возврат,Нужно удержание,Финансы не нужны,Ручная проверка | Кайтаруу керек,Кармоо керек,Финансы кереги жок,Кол текшерүү |
| `option.noshow_type` | 宿舍域 | `no_contact`,`contacted_not_arrive`,`late_arrival_uncertain`,`company_guest_missing` | 无法联系,已联系未到,迟到未确认,企业住客未到 | Нет связи,Связались не прибыл,Опоздание не подтверждено,Гость компании не прибыл | Байланыш жок,Байланышты бирок келген жок,Кечигүү белгисиз,Компания жашоочусу келген жок |
| `option.noshow_reason` | 宿舍域 | `unreachable`,`transport_issue`,`changed_plan`,`company_changed_guest`,`other_controlled` | 联系不上,交通原因,计划变化,企业换人,其他受控 | Недоступен,Транспорт,Планы изменились,Компания сменила гостя,Другое | Жетүүгө болбойт,Транспорт,План өзгөрдү,Компания адам алмаштырды,Башка |
| `option.noshow_handling_type` | 宿舍域 | `keep_hold_temporarily`,`release_with_refund_basis`,`release_without_finance`,`manual_review` | 暂保留,释放并生成退款依据,释放无需财务,人工复核 | Временно держать,Освободить с возвратом,Освободить без финансов,Ручная проверка | Убактылуу кармоо,Кайтаруу менен бошотуу,Финансысыз бошотуу,Кол текшерүү |
| `option.checkout_type` | 宿舍域 | `normal`,`early`,`forced`,`transfer` | 正常退住,提前退住,强制退住,转住 | Обычный выезд,Досрочный,Принудительный,Перевод | Кадимки чыгуу,Эрте чыгуу,Мажбур чыгуу,Которулуу |
| `option.checkout_reason` | 宿舍域 | `period_ended`,`employee_left`,`company_request`,`guest_request`,`violation`,`other_controlled` | 到期,离职,企业要求,住客要求,违规,其他受控 | Срок закончился,Уволился,Запрос компании,Запрос гостя,Нарушение,Другое | Мөөнөт бүттү,Иштен чыкты,Компания талабы,Жашоочу талабы,Эреже бузуу,Башка |
| `option.settlement_type` | 宿舍/财务边界 | `refund`,`deduction`,`additional_receivable`,`zero_settlement` | 退款,扣减,补收,零结算 | Возврат,Удержание,Доплата,Нулевой расчет | Кайтаруу,Кармоо,Кошумча алуу,Нөл эсеп |
| `option.no_finance_reason` | 宿舍/财务边界 | `zero_amount`,`already_settled`,`policy_no_charge`,`manager_approved_no_finance` | 零金额,已结清,规则无需收费,主管批准无需财务 | Нулевая сумма,Уже закрыто,По правилу без оплаты,Руководитель одобрил без финансов | Нөл сумма,Бүттү,Эреже боюнча төлөм жок,Жетекчи бекитти |
| `option.service_type` | 宿舍/维修边界 | `cleaning`,`maintenance`,`inspection`,`pest_control`,`other_controlled` | 清洁,维修,检查,消杀,其他受控 | Уборка,Ремонт,Осмотр,Дезинсекция,Другое | Тазалоо,Оңдоо,Текшерүү,Дезинфекция,Башка |
| `option.responsibility_domain` | 共享治理 | `dormitory`,`finance`,`hr_admin`,`maintenance`,`shared_governance`,`management` | 宿舍,财务,人事行政,维修,共享治理,管理 | Общежитие,Финансы,HR/админ,Ремонт,Общее управление,Руководство | Жатакана,Финансы,HR/админ,Оңдоо,Жалпы башкаруу,Менеджмент |
| `option.blocked_reason` | 宿舍域 | `missing_subject`,`missing_evidence`,`no_available_bed`,`finance_pending`,`finance_rejected`,`permission_required`,`upstream_pending` | 缺主体,缺证据,无可用床位,等待财务,财务驳回,缺权限,等待上游 | Нет субъекта,Нет доказательств,Нет мест,Ожидает финансы,Финансы отклонили,Нет прав,Ожидает входящие | Субъект жок,Далил жок,Орун жок,Финансы күтүлөт,Финансы четке какты,Уруксат жок,Жогору жак күтүлөт |
| `option.evidence_type` | 证据服务 | `identity_document`,`employee_approval`,`corporate_authorization`,`price_confirmation`,`deposit_basis`,`checkin_handover`,`room_inspection`,`bed_inspection`,`damage_photo`,`finance_rejection_reason`,`cancellation_request`,`noshow_contact_record`,`recovery_inspection_record`,`management_decision_basis` | 身份证件,员工审批,企业授权,价格确认,押金依据,入住交付,房间检查,床位检查,损耗照片,财务驳回原因,取消申请,未到店联系记录,恢复检查记录,管理拍板依据 | Документ личности,Согласование сотрудника,Авторизация компании,Подтверждение цены,Основание депозита,Передача при заселении,Осмотр комнаты,Осмотр места,Фото ущерба,Причина отклонения,Заявка отмены,Контакт при неявке,Осмотр восстановления,Основание решения | Жеке документ,Кызматкер уруксаты,Компания уруксаты,Бааны ырастоо,Депозит негизи,Кирүү өткөрүү,Бөлмө текшерүү,Орун текшерүү,Зыян сүрөтү,Четке кагуу себеби,Жокко чыгаруу арызы,Келбей коюу байланышы,Калыбына текшерүү,Чечим негизи |
| `option.inspection_result` | 宿舍域 | `passed`,`needs_cleaning`,`needs_maintenance`,`blocked` | 通过,需清洁,需维修,阻断 | Пройдено,Нужна уборка,Нужен ремонт,Заблокировано | Өттү,Тазалоо керек,Оңдоо керек,Тоскоол |
| `option.out_of_service_reason` | 宿舍域 | `cleaning_required`,`maintenance_required`,`safety_risk`,`management_hold`,`other_controlled` | 需清洁,需维修,安全风险,管理锁定,其他受控 | Нужна уборка,Нужен ремонт,Риск безопасности,Удержание руководства,Другое | Тазалоо керек,Оңдоо керек,Коопсуздук тобокели,Башкаруу кармоо,Башка |
| `option.change_reason` | 宿舍域 | `guest_request`,`resource_issue`,`company_adjustment`,`maintenance_required`,`manager_arranged` | 住客要求,资源问题,企业调整,需维修,主管安排 | Запрос гостя,Проблема ресурса,Корректировка компании,Нужен ремонт,Назначено руководителем | Жашоочу талабы,Ресурс маселеси,Компания өзгөртүү,Оңдоо керек,Жетекчи дайындады |
| `option.handover_status` | 宿舍域 | `not_required`,`pending`,`completed`,`exception` | 不需要,待交付,已交付,异常 | Не требуется,Ожидает передачи,Передано,Исключение | Керек эмес,Берүү күтүлөт,Берилди,Өзгөчө |
| `option.renewal_confirm_result` | 宿舍域 | `renewed`,`finance_pending`,`rejected`,`needs_correction` | 已续住,等待财务,已拒绝,需修正 | Продлено,Ожидает финансы,Отклонено,Нужно исправить | Узартылды,Финансы күтүлөт,Четке кагылды,Түзөтүү керек |
| `option.close_reason` | 宿舍域 | `finance_completed`,`no_finance_required`,`cancel_completed`,`audit_corrected`,`manual_closed` | 财务完成,无需财务,取消完成,审计修正,人工关闭 | Финансы завершены,Финансы не нужны,Отмена завершена,Аудит исправлен,Ручное закрытие | Финансы бүттү,Финансы керек эмес,Жокко чыгаруу бүттү,Аудит түзөтүлдү,Кол менен жабылды |
| `option.release_reason` | 宿舍域 | `hold_expired`,`cancelled`,`checkout_completed`,`recovery_passed`,`manual_release` | 锁定过期,已取消,退住完成,恢复通过,人工释放 | Удержание истекло,Отменено,Выезд завершен,Восстановление прошло,Ручное освобождение | Кармоо бүттү,Жокко чыгарылды,Чыгуу бүттү,Калыбына өттү,Кол менен бошотуу |
| `option.bed_release_result` | 宿舍域 | `available`,`cleaning`,`maintenance`,`blocked` | 可用,清洁中,维修中,阻断 | Доступно,Уборка,Ремонт,Заблокировано | Жеткиликтүү,Тазалоо,Оңдоо,Тоскоол |
| `option.recovery_object` | 宿舍域 | `room`,`bed`,`room_and_bed` | 房间,床位,房间和床位 | Комната,Место,Комната и место | Бөлмө,Орун,Бөлмө жана орун |
| `option.correction_type` | 宿舍/审计 | `business_fact`,`resource_status`,`evidence`,`finance_basis`,`language_display` | 业务事实,资源状态,证据,金额依据,语言显示 | Бизнес-факт,Статус ресурса,Доказательство,Основание суммы,Язык | Бизнес факт,Ресурс абалы,Далил,Сумма негизи,Тил |
| `option.finance_impact` | 财务域 | `none`,`basis_only`,`requires_finance_review`,`finance_confirmed_readonly` | 无,仅金额依据,需财务复核,财务已确认只读 | Нет,Только основание,Нужна проверка финансов,Подтверждено финансами | Жок,Негиз гана,Финансы текшерүүсү керек,Финансы тастыктады |
| `option.analytics_grain` | 分析域 | `source`,`application`,`stay_order`,`room`,`bed`,`finance_basis`,`day`,`month` | 来源,申请,住宿单,房间,床位,金额依据,日,月 | Источник,Заявка,Проживание,Комната,Место,Основание суммы,День,Месяц | Булак,Арыз,Жашоо жазуусу,Бөлмө,Орун,Сумма негизи,Күн,Ай |
| `option.next_work_item_type` | 执行层 | `dormitory`,`finance`,`governance`,`maintenance`,`hr_admin`,`read_only_record` | 宿舍办理,财务办理,治理办理,维修办理,人事办理,只读记录 | Задача общежития,Финансы,Управление,Ремонт,HR/админ,Только чтение | Жатакана иши,Финансы,Башкаруу,Оңдоо,HR/админ,Окуу гана |

## 证据 key 合同

证据 key 使用 `option.evidence_type` 的稳定 value。必需性由 `09` 的场景步骤和 `08` 的状态动作决定：

- `identity_document`：外部客户、入住、退住。
- `employee_approval`：内部员工住宿。
- `corporate_authorization`：企业客户住宿。
- `price_confirmation`：报价、预订、续住。
- `deposit_basis`：押金申请。
- `checkin_handover`：入住交付。
- `room_inspection`、`bed_inspection`：换房、退住、恢复。
- `damage_photo`：退住扣减、维修，条件必需。
- `finance_rejection_reason`：财务驳回修正。
- `cancellation_request`：取消处理。
- `noshow_contact_record`：未到店处理。
- `recovery_inspection_record`：恢复可经营。
- `management_decision_basis`：管理拍板。

## 选项集验收

不通过情况：

- 选项只有中文，没有稳定 value。
- 选项 value 使用中文、俄语或吉语。
- 页面自造选项，不引用本文件或对象选择器。
- 固定选项退化为自由输入。
- 下拉列表承担对象选择职责，例如手填房间名、床位号、主体名。
- 金额字段没有 `currency.code`、`payment.direction`、`amount.stage` 和 `business_object.ref` 同组出现。
