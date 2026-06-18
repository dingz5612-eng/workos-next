# 宿舍经营域验收合同

## 设计锚点

本文件只验收 vNext 宿舍经营域设计包是否自洽，不验收当前 OAM 发布状态。任何通过结论都不等于当前 OAM GO、可发布、可试运行或用户可亲测。

本文件验收对象包括 `README.md`、`08-state-action-transition-contract.md`、`09-scenario-step-field-contracts.md`、`11-field-key-and-option-set-contract.md`、`12-minimal-input-and-autofill-policy.md` 和 `13-screen-field-blueprint.md`。没有通过状态动作、场景字段、选项集、少填和页面蓝图检查时，不能称为 vNext 宿舍经营域正式候选版。

## 文件级验收

必须成立：

- 宿舍域设计包位于 `docs/workos-vnext/dormitory-domain/`。
- 不修改当前宿舍 Source Authority、generated、runtime、surface、tests。
- 所有文件遵循七层模型、`DomainIntake`、`VNextExecutionItem`、`BusinessSummaryReadModel`、`VNextLanguageContract`。
- 宿舍只是 vNext 第一个领域样板，不反向改写 Work OS 总设计。
- 当前宿舍 13 场景权威继续有效。
- `README.md` 声明本地域权威顺序、冲突裁决、字段设计口径和当前 OAM 边界。
- `08-state-action-transition-contract.md` 覆盖住宿申请、住宿单、房间、床位、金额依据、押金/退款、取消/未到店、清洁维修和修正。
- `09-scenario-step-field-contracts.md` 覆盖 13 类宿舍场景，并把复合场景拆成多个步骤字段合同。
- `11-field-key-and-option-set-contract.md` 覆盖所有字段 key、控件类型、稳定 value 和中文/俄语/吉语 label。
- `12-minimal-input-and-autofill-policy.md` 明确哪些字段系统带出、哪些字段对象选择、哪些字段允许用户输入。
- `13-screen-field-blueprint.md` 把 6 个样板屏映射到步骤字段组，不允许从视觉稿反推业务字段。
- `10-mobile-ui-redesign-direction.md` 明确旧 WorkOSNext mobile surface 不继承，只作为问题来源和反例。

## 场景验收

| 场景 | 必须通过 |
| --- | --- |
| 外部住宿客户 | 来源不生成住宿事实；主体归共享治理；住宿申请和住宿单归宿舍；押金和收款归财务。 |
| 内部员工住宿 | 员工关系归人事；住宿服务动作归宿舍；必要支付/扣减归财务。 |
| 企业客户住宿 | 企业主体、联系人、住客分离；企业协议和结算只形成依据；批量入住逐个住客可追踪。 |
| 入住办理 | 财务、身份、证据、房间床位状态满足后才能入住。 |
| 续住 | 生成续住事件和费用依据，不覆盖原入住事实。 |
| 换房换床 | 原床位检查、目标床位分配、差额依据都有审计。 |
| 退住结算 | 房间床位检查、退款/扣减依据、财务承接、资源恢复按顺序完成。 |
| 押金/退款 | 宿舍只输出依据，正式财务事实归财务域。 |
| 取消/未到店退款 | 取消、未到店、退款依据、床位释放必须独立追踪，不用退住或异常修正兜底。 |
| 清洁维修恢复 | 维修施工事实归维修域，宿舍只确认可经营恢复。 |
| 重复主体/员工关系 | 共享治理处理主对象和关系，不合并住宿事件。 |
| 管理分析拍板 | 分析只读，拍板形成 `ManagementDecisionRecord` 后回责任域办理。 |

## 边界验收

| 边界 | 通过标准 |
| --- | --- |
| 来源归因 | 只记录来源、触点、诉求和初始证据。 |
| 共享治理 | 只管主体、车辆、关系、重复和风险回执。 |
| 宿舍经营 | 只拥有住宿事实、房间床位经营状态、金额依据和宿舍摘要。 |
| 人事行政 | 只拥有人事关系、员工资格和人事摘要，不处理住宿服务动作。 |
| 合同与财务 | 唯一拥有正式收付、押金、退款、扣减、核销、核算。 |
| 维修与配件 | 拥有维修施工和配件履约事实，宿舍只读消费恢复摘要。 |
| 管理驾驶舱 | 只读分析，不直接处理异常。 |

## UX 验收

每个关键页面必须回答：

1. 我在办什么？
2. 这个来源、主体、住宿单、房间或床位是什么？
3. 系统已经带出了什么？
4. 我本次真正需要填写或选择什么？
5. 哪些内容只读？
6. 缺什么证据、权限、上游、床位或财务承接？
7. 金额处于依据、申请、承接中、已定真还是已核算？
8. 提交后谁处理、去哪里看、下一步是什么？

不通过：

- 要求用户重复填写已知来源、主体、房间床位或财务摘要。
- 固定选项退化为手填。
- 页面只显示内部 ID。
- 提交后只显示“成功”。

## 字段合同验收

每个场景步骤必须通过：

| 字段组 | 通过标准 |
| --- | --- |
| `primaryBusinessObject` | 用户看得懂当前办理对象，不以内部 ID 为主标题。 |
| `requiredReadContext` | 来源、主体、住宿单、房间床位、财务摘要和证据能只读带出。 |
| `editableInputs` | 只包含本次真实输入，不重复录入系统已知信息。 |
| `fixedSelections` | 房间、床位、币种、状态、证据类型、阻断原因必须来自对象选择或权威选项。 |
| `financialContext` | 金额有币种、收付方向、阶段语义、业务对象和财务承接状态。 |
| `evidenceMaterials` | 必需证据、缺失原因、驳回原因和补交路径清楚。 |
| `legalActions` | 按钮和流程动作不进入表单字段。 |
| `handoffSummary` | 提交后责任角色、下一办理项或只读记录明确。 |
| `searchReadModel` | 搜索和列表只读，能追溯来源对象。 |
| `languageKeys` | 中文、俄语、吉语 key 齐备，label 和 value 分离。 |

## 字段 key 与选项集验收

必须成立：

- 34 个场景步骤全部有 `fieldKeyGroups`。
- 每个 `fieldKeyGroups` 都包含 read、edit、fixed、finance、evidence、actions、handoff、search、language。
- 每个 fieldKey 都能在 `DormitoryFieldKeyContract` 找到定义，或明确是 read model/action/evidence key。
- 所有固定选择都引用 `DormitoryOptionSetContract` 或对象选择器。
- 所有选项都有稳定 value、中文 label、俄语 label、吉语 label。
- 金额类步骤必须同时出现 `amount.value`、`currency.code`、`payment.direction`、`amount.stage` 和 `business_object.ref`，除非该步骤明确无金额。

不通过：

- 房间、床位、主体、企业、联系人、住客用文本框。
- 币种、状态、原因、证据类型、阻断原因、责任域没有选项集。
- 选项 value 使用中文、俄语、吉语或展示文案。
- 自由文本字段没有 `.optional` 边界，或成为原因/状态/责任域主来源。

## 少填验收

必须成立：

- 来源、主体、企业、员工关系、房间、床位、价格快照、财务回执和证据状态优先只读带出。
- 用户只填写当前步骤真实必要输入。
- 受控原因先选择，再允许补充说明。
- 主按钮来自 `legalActions`，不进入 `editableInputs`。
- 页面不可提交时必须显示阻断原因、责任域、补交路径和下一步。

不通过：

- 用户重复填写系统已知信息。
- 页面用大表单一次性收集未来步骤字段。
- 备注替代受控选项。
- 提交后只显示“成功”，不显示下一办理项或等待对象。

## 三语言验收

必须覆盖：

- 中文 `zh-CN`。
- 俄语 `ru-RU`。
- 吉语 `ky-KG`。
- 页面标题、按钮、字段、状态、错误、空态、证据、金额、币种、下一步。
- 展示 label 和提交 value 分离。
- 长文案不遮挡主按钮、金额、证据状态和下一步承接区。

不通过：

- 任一语言缺少关键错误或金额表达。
- 展示 enum/status/action 稳定 value。
- fallback 到内部 key、技术词、旧中文状态或测试样例。

## 移动 UI 重设计验收

必须成立：

- 旧 WorkOSNext mobile surface 不作为视觉、布局、组件、色彩、字体、卡片风格或交互继承对象。
- 旧 mobile surface 只能作为问题审计输入，用来避免内部编号主显示、字段大表单、卡片堆砌、动作字段污染、三语言溢出和移动端遮挡。
- 高保真页面必须先有 `09` 的步骤字段合同、`08` 的状态动作、财务边界、三语言 key 和阻断原因。
- 高保真页面必须先通过 `11` 字段 key/选项集、`12` 少填策略和 `13` 页面字段蓝图。
- 高保真页面不得新增业务字段、绕过 WorkItem、隐藏必需证据、混淆宿舍金额依据与正式财务事实。
- 第一批高保真只允许作为 vNext 样板方向，不形成当前 runtime/surface 修改。

## 页面蓝图验收

6 个样板屏必须覆盖：

- 今日待办/宿舍办理项队列。
- 外部住宿客户接入与报价。
- 房间床位选择。
- 押金/收款财务承接。
- 入住确认。
- 退住结算/退款扣减。

每个样板屏必须声明 screenKey、对应步骤、主对象、read、edit、fixed、finance、evidence、actions、blocked、next 和三语言要求。样板屏不得新增 `09` 之外的业务字段。

## OAM 兼容验收

必须明确：

- 本设计不加入 `current-authority-index`。
- 本设计不替代 `dormitory-13-scenario-control.authority.json`。
- 本设计不修改 generated dormitory contracts。
- 本设计不修改 runtime、surface、tests。
- 本设计不产生发布或试运行结论。

未来采纳必须另行进入 Source Authority、Experience Authority、language contract、generated、runtime、surface、tests、Evidence Root 全链路。
