# Work OS vNext 宿舍经营域设计包

## 状态口径

本目录是 Work OS vNext 宿舍经营域设计包，当前状态为 **vNext 宿舍经营域设计 v1.0 正式候选版**。它可以用于评审、差异分析和后续重构设计，但不是当前 OAM Source Authority，不进入 `current-authority-index`，不产生当前 generated、runtime、surface、tests、Evidence Root 或发布结论。

当前宿舍 13 场景权威继续有效。本目录只描述未来目标、领域边界、办理合同、字段合同、三语言体验和 OAM 映射。

## 本地域权威顺序

当本目录内部文件出现冲突时，按以下顺序裁决：

1. `README.md`：本目录唯一入口、状态口径、文件顺序和冲突裁决。
2. `00-domain-positioning-and-boundaries.md`：宿舍域职责、禁止越界和跨域边界。
3. `08-state-action-transition-contract.md`：状态、合法动作、责任角色、证据、失败路由和审计事件。
4. `09-scenario-step-field-contracts.md`：各场景各步骤的办理项字段合同。
5. `11-field-key-and-option-set-contract.md`：字段 key、控件类型、选项集、稳定 value 和三语言 label。
6. `12-minimal-input-and-autofill-policy.md`：少填、自动带出、只读复用和自由文本边界。
7. `13-screen-field-blueprint.md`：6 个样板屏到步骤字段组、阻断、主按钮和下一步的映射。
8. `01-domain-objects-and-states.md`：领域对象、状态集合和事实归属。
9. `02-execution-flows.md`：宿舍业务执行流。
10. `03-mobile-ux-contract.md`：移动端页面顺序、卡片和角色体验。
11. `10-mobile-ui-redesign-direction.md`：全新移动 UI 方向、高保真准入和旧 mobile surface 边界。
12. `04-finance-and-handoff.md`：宿舍金额依据与合同财务域移交。
13. `05-read-models-language-and-analytics.md`：搜索、画像、分析和三语言读模型。
14. `06-current-oam-mapping.md`：当前 OAM 13 场景映射与采纳边界。
15. `07-validation-contract.md`：设计包验收合同。

规则：`08`、`09`、`11` 和 `12` 是执行硬合同。`13` 和 `10` 是 vNext 移动端页面与高保真准入合同。叙事性流程、页面描述、视觉方向或示例术语如果与这些硬合同冲突，以硬合同为准。

## 原型资产状态

当前 `outputs/workos-vnext/dormitory-ui-prototype/` 是 `rejected local draft`，不得提交为 vNext 基线，也不得作为高保真 UI 方向、demo、验收件或后续视觉继承来源。

后续新原型必须按 `../12-vnext-baseline-and-prototype-policy.md` 和 `10-mobile-ui-redesign-direction.md` 重新制作，并在人工设计验收后再决定是否单独提交。

## 唯一执行原则

宿舍域所有写动作必须进入 `VNextExecutionItem`/WorkItem 和提交确认。页面、搜索、报表、房态看板、人员详情、管理驾驶舱、财务摘要不得绕过办理项写住宿事实。

标准路径：

```text
SourceAttribution
-> SubjectResolution
-> DomainIntake
-> VNextExecutionItem
-> DormitoryStateActionTransition
-> 宿舍业务事实或宿舍金额依据
-> BusinessSummaryReadModel
-> 财务承接、下一办理项或只读记录
```

## 字段设计口径

本目录会设计各场景各步骤字段，但字段含义是 **办理项字段合同**，不是数据库表结构，也不是 UI 临时字段清单。

字段必须分为：

- `requiredReadContext`：系统带出的只读上下文。
- `editableInputs`：用户本次真正需要填写的业务输入。
- `fixedSelections`：对象选择器、枚举、分段控件或权威选项集。
- `financialContext`：金额、币种、收付方向、阶段语义、业务对象和财务承接状态。
- `evidenceMaterials`：证据名称、必需性、缺失原因和补交路径。
- `legalActions`：页面按钮、流程动作和状态机动作，禁止进入表单字段。
- `handoffSummary`：上一步带入什么、提交后去哪、下一责任角色。
- `searchReadModel`：提交后更新的只读摘要。
- `languageKeys`：中文、俄语、吉语显示 key；提交 value 稳定中立。

字段 key、控件类型和选项集以 `11-field-key-and-option-set-contract.md` 为准；是否需要用户填写、是否自动带出、是否只读复用以 `12-minimal-input-and-autofill-policy.md` 为准；移动页面如何组合字段以 `13-screen-field-blueprint.md` 为准。

## 当前 OAM 边界

本目录不得：

- 替代 `docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json`。
- 修改当前宿舍 13 场景 Source Authority。
- 手改 generated contracts 或 generated mirror。
- 修改 runtime、surface、tests、Evidence Root。
- 宣布当前 OAM GO、可发布、可试运行或用户可亲测。
- 继承现有 WorkOSNext mobile surface 的视觉、布局、组件、色彩、字体、卡片风格或交互作为 vNext 默认 UI。

未来采纳必须另行进入 Source Authority、Experience Authority、language contract、generated、runtime、surface、tests 和 Evidence Root 全链路。
