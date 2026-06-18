# 唯一设计权威

## 文件定位

本文件是 Work OS vNext 总设计包的最高内部权威。其它文件与本文件冲突时，以本文件为准。vNext 总设计与当前 OAM 权威冲突时，以当前 OAM 权威为准，vNext 只能记录为未来目标、差异或重构建议。

## 生效顺序

1. `00-design-authority.md`：唯一生效规则、冲突裁决、全局禁止越界。
2. `01-product-positioning.md`：产品定位、目标用户、非目标、设计原则。
3. `02-operating-architecture.md`：七层经营架构、事实边界、读写边界、读模型合同。
4. `03-mobile-experience-shell.md`：移动端一级入口、角色路径、页面体验合同。
5. `04-source-governance-and-objects.md`：来源归因、主体/车辆解析、`DomainIntake`、主对象。
6. `05-domain-responsibility-matrix.md`：业务域职责、接入条件、事实、摘要、失败路由。
7. `06-execution-and-handoff.md`：办理项、跨域移交、财务承接、追加修正、审计。
8. `07-reusable-experience-patterns.md`：可复用体验模式。
9. `08-dormitory-pilot-slice.md`：宿舍样板验证。
10. `09-oam-mapping-and-adoption.md`：当前 OAM 映射与采纳策略。
11. `10-validation-contract.md`：验收合同和不通过处理。
12. `11-language-and-localization.md`：中文、俄语、吉语三语言显示合同。
13. `12-vnext-baseline-and-prototype-policy.md`：vNext 文档基线、原型资产边界和高保真重做策略。

## 七层模型

Work OS vNext 只有一套总模型：

1. 来源归因层：记录需求从哪里来。
2. 共享治理层：解析主体、车辆、关系和重复。
3. 业务域事实层：各业务域拥有自己的申请、事件、状态、资源、摘要和金额依据。
4. 财务真值层：合同与财务域拥有正式财务事实。
5. 执行层：办理项/WorkItem 是唯一可写入口。
6. 读模型与分析层：搜索、驾驶舱、统计分析、Projection、Lens 只读消费摘要。
7. 体验层：移动端以今日、工作项、搜索、我的收口，并通过三语言合同表达。

## 唯一写入路径

任何可改变业务事实、财务事实、关系事实、状态事实、拍板记录或修正记录的动作，都必须进入：

```text
来源、主对象或只读摘要
-> 合法动作判断
-> 办理项/WorkItem
-> 提交确认
-> 归属层事实或拍板记录
-> BusinessSummaryReadModel 和审计追踪
```

页面、搜索、驾驶舱、报表、摘要、Projection、Lens、学习入口、应用职责群都不得绕过办理项写事实。

## 总设计接口

| 接口 | 唯一职责 | 禁止 |
| --- | --- | --- |
| `SourceAttribution` | 记录来源、触点、诉求和初始证据。 | 生成业务事实、财务依据或主体主档。 |
| `SubjectResolution` | 解析主体、车辆、关系、重复和合并建议。 | 合并业务事件或改写财务事实。 |
| `DomainIntake` | 承接来源进入业务域前的接入对象。 | 直接替代业务域申请、订单或服务单。 |
| `VNextExecutionItem` | 唯一可写办理入口。 | 把流程动作放进用户字段。 |
| `BusinessSummaryReadModel` | 只读摘要、搜索、画像、驾驶舱和分析消费。 | 改写源域事实或处理异常。 |
| `ManagementDecisionRecord` | 记录管理拍板并路由后续办理。 | 直接关闭异常或形成财务真值。 |
| `VNextLanguageContract` | 定义三语言 label、提示、状态和错误。 | 页面私造翻译、混用展示文案和提交值。 |

## 全局禁止

- 禁止来源归因直接生成业务事实。
- 禁止共享治理汇总替代、改写或统计定真业务域事实。
- 禁止管理驾驶舱直接办理、关闭或改写业务异常。
- 禁止搜索、报表、摘要、Projection、Lens、分析看板写事实。
- 禁止应用职责群成为移动端一级入口。
- 禁止页面绕过办理项/WorkItem 写入。
- 禁止业务域形成正式财务真值。
- 禁止用 UI 文案、隐藏字段或测试放宽弥补权威层缺陷。
- 禁止用户界面只支持单语言或把 enum/status/action 的提交值当作展示文案。

## 当前 OAM 边界

本设计包不做以下事情：

- 不加入 `current-authority-index`。
- 不修改 generated 合同。
- 不修改 runtime、surface 或测试。
- 不改变发布准入状态。
- 不产生当前 OAM GO、可发布、可试运行或用户可亲测结论。
- 不把 `outputs/workos-vnext/` 当前本地原型作为设计权威、demo、baseline 或验收件。

## 完成标准

总设计完成必须同时满足：

- 所有文件都指向同一套七层模型。
- 每个事实只有一个拥有者。
- 每个写动作都有办理项和提交确认。
- 每个读模型只读且可追溯来源域。
- 每个跨域流都有输入、输出、失败路由、下一步承接和审计追踪。
- 每个关键页面能回答“我在办什么、系统带出什么、我要填什么、缺什么、提交后去哪”。
- 每个用户可见页面、状态、按钮、错误、证据和金额表达都覆盖中文、俄语、吉语。
