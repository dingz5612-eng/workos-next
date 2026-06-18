# Work OS vNext 总设计包

## 设计锚点

本目录定义 Work OS vNext 的未来目标总设计。所有文件统一遵循七层模型：来源归因层、共享治理层、业务域事实层、财务真值层、执行层、读模型与分析层、体验层。

所有可写动作必须进入办理项/WorkItem 和提交确认；所有用户可见表达必须遵循 `VNextLanguageContract` 的中文、俄语、吉语三语言合同。

## 定位

Work OS vNext 是移动端优先的公司经营执行系统。它把来源归因、主对象治理、业务域事实、财务真值、办理项执行、读模型分析、移动端体验和三语言表达收口到一套可追踪、可协作、边界清楚的经营操作系统里。

本目录不替代当前 `oam.current` 的 Source Authority、Generated Contract、Runtime Contract、发布准入或 Evidence Root 结论。当前 WorkOSNext 仍以 `docs/oam/current-architecture.md`、`docs/contracts/oam.current.json` 和 `docs/oam/current-authority-index.json` 为准。

## 阅读顺序

1. [唯一设计权威](00-design-authority.md)
2. [产品定位](01-product-positioning.md)
3. [经营总架构](02-operating-architecture.md)
4. [移动端体验壳](03-mobile-experience-shell.md)
5. [来源、治理与主对象](04-source-governance-and-objects.md)
6. [业务域职责矩阵](05-domain-responsibility-matrix.md)
7. [执行与跨域移交](06-execution-and-handoff.md)
8. [可复用体验模式](07-reusable-experience-patterns.md)
9. [宿舍样板切片](08-dormitory-pilot-slice.md)
10. [OAM 映射与采纳](09-oam-mapping-and-adoption.md)
11. [验收合同](10-validation-contract.md)
12. [三语言与本地化合同](11-language-and-localization.md)
13. [vNext 基线与原型策略](12-vnext-baseline-and-prototype-policy.md)

## 核心模型

```text
SourceAttribution
-> SubjectResolution
-> DomainIntake
-> VNextExecutionItem
-> 归属层事实
-> BusinessSummaryReadModel
-> 搜索/驾驶舱/分析只读消费
-> 追加修正或 ManagementDecisionRecord 路由
```

## 横向合同

| 合同 | 作用 |
| --- | --- |
| `SourceAttribution` | 记录来源、触点、诉求和初始证据，不写业务事实。 |
| `SubjectResolution` | 解析主体、车辆、关系、重复和合并建议。 |
| `DomainIntake` | 来源进入业务域后的接入对象，不是来源对象，也不是业务事实。 |
| `VNextExecutionItem` | 用户可见办理项，架构映射 WorkItem，唯一可写执行入口。 |
| `BusinessSummaryReadModel` | 给搜索、共享治理、驾驶舱和分析使用的只读摘要。 |
| `ManagementDecisionRecord` | 管理拍板记录，只能路由后续办理，不直接处理异常。 |
| `VNextLanguageContract` | 中文、俄语、吉语三语言显示合同，保证 label/value 分离。 |

## 设计边界

- 三份 FunRide 文件只作为背景输入，不作为结构模板、命名模板或上位权威。
- 宿舍只是样板切片，不反向主导 Work OS 总设计。
- 来源归因记录入口和诉求，不写业务事实。
- 共享治理负责主对象、关系、去重和共享状态，不吞并业务事实，不做经营统计定真。
- 合同与财务域是唯一正式财务真值口。
- 办理项/WorkItem 是唯一可写执行入口。
- 搜索、报表、摘要、Projection、Lens、分析看板只读。
- 移动端一级入口固定为今日、工作项、搜索、我的。
- 三语言是产品体验合同，不是界面临时翻译，不得由页面私自兜底。
- `outputs/workos-vnext/` 当前原型不属于本次设计基线；其状态是 rejected local draft，不得作为 vNext 高保真方向、demo 或验收件。
