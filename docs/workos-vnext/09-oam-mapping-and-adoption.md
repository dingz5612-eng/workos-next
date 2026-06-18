# OAM 映射与采纳

## 设计锚点

本文件遵循七层模型和 `VNextLanguageContract`。OAM 映射只评审采纳路径；任何当前落地都必须另行进入办理项/WorkItem、generated、runtime、surface、三语言和证据链评审。

## 文件定位

本文件只做 vNext 到当前 WorkOSNext/OAM 的映射评审，不改变当前 OAM，不加入 `current-authority-index`。

## 映射状态

| 状态 | 含义 |
| --- | --- |
| 保留 | 当前 OAM 已有机制，vNext 继续采用。 |
| 改名 | 架构机制保留，用户表达产品化。 |
| 新增 | 当前 OAM 不完整，vNext 新增目标概念。 |
| 降级 | 只能作为辅助、只读、筛选或学习，不作为执行入口。 |
| 暂不进入当前 OAM | 仅保留在 vNext 蓝图。 |
| 未来重构 | 后续跨 Source、合同、runtime、surface、tests 重构。 |

## 核心映射

| vNext 概念 | 当前 OAM 对应 | 状态 |
| --- | --- | --- |
| 办理项 | WorkItem | 保留 + 改名 |
| 业务案件 | OperationCase | 保留 + 改名 |
| 提交确认 | Confirm Runtime / Unit of Work | 保留 + 改名 |
| 来源归因 | 入口、线索、申请、导入来源的未来统一模型 | 新增 |
| 主体解析 | identity / shared governance | 新增 |
| `DomainIntake` | 当前缺少的业务接入对象 | 新增 |
| 主对象关系图 | business object registry / search read model | 新增 |
| `BusinessSummaryReadModel` | Projection / Lens / search read model | 新增 + 未来重构 |
| `ManagementDecisionRecord` | 管理拍板的受控记录 | 新增 |
| 业务域事实 | Product Capability / Domain Module | 保留 |
| 财务真值 | finance gate / ledger | 保留 |
| 读模型与分析 | Projection / Lens / Manager Control Tower | 保留 + 降级 |
| 应用职责群 | role navigation / filters / Me permissions | 降级 |
| 移动端入口 | Mobile Surface | 保留 |
| `VNextLanguageContract` | Experience Authority / language model / display contract | 新增 + 未来重构 |

## 当前可保留经验

- WorkItem 原生移动端办理。
- Confirm Runtime 作为写入主路径。
- Projection/Lens 只读边界。
- Evidence/Trace/Audit。
- 追加修正。
- 真实浏览器证据优先。

## 新增目标概念

- `SourceAttribution`
- `SubjectResolution`
- `DomainIntake`
- `ObjectIdentityGraph`
- `BusinessSummaryReadModel`
- `ManagementDecisionRecord`
- `VNextLanguageContract`

这些概念本轮不进入当前 OAM 权威，只作为 vNext 总设计目标。

## 不应映射

- 不把 FunRide 三份参考文件登记为当前 Source Authority。
- 不把 vNext 蓝图直接加入 `current-authority-index`。
- 不把来源归因映射成业务事实。
- 不把共享治理映射成业务事实仓库。
- 不把管理驾驶舱映射成异常处理入口。
- 不把业务域金额依据映射成财务事实。
- 不把应用职责群映射成移动端一级导航。
- 不把三语言文案作为 UI 私有 fallback。

## 概念采纳门槛

| 概念 | 进入当前 OAM 前必须满足 |
| --- | --- |
| `DomainIntake` | 进入 Source Authority 或等价业务权威；定义字段、状态、失败路由；生成 runtime 可消费合同。 |
| `BusinessSummaryReadModel` | 明确来源域、摘要粒度、合法动作、禁止动作；搜索、列表、驾驶舱只读消费。 |
| `ManagementDecisionRecord` | 明确不能直接处理异常；必须生成业务域或财务域办理项。 |
| `VNextExecutionItem` 扩展合同 | WorkItem、Confirm Runtime、surface、tests 使用同一字段来源。 |
| `VNextLanguageContract` | 进入 Experience Authority、language model 或 display contract；三语言 key/value 分离。 |

## 后续采纳顺序

1. 评审 vNext 总设计。
2. 标记概念：保留、改名、新增、降级、暂不进入当前 OAM、未来重构。
3. 选择一个试点概念进入 Source Authority 或 Experience Authority。
4. 生成合同。
5. 修改 runtime 和 surface 消费。
6. 运行合同、runtime、surface、三语言、真实浏览器和 Evidence Root 检查。
7. 通过当前 OAM 准入后才进入发布评审。
