# 来源、治理与主对象

## 设计锚点

本文件遵循七层模型和 `VNextLanguageContract`。来源和主对象治理不写业务事实；任何转入业务域的写动作必须进入办理项/WorkItem 和提交确认。

## SourceAttribution

`SourceAttribution` 是全域来源归因对象，只记录需求从哪里来，不写业务事实。

字段：

- `sourceType`：广告、推荐、门店、电话、合作方、内部申请、系统导入、管理指派。
- `channelTouchpoint`：渠道名、活动、入口页面、联系人、接入设备。
- `originalRequest`：用户或内部人员最初表达的需求。
- `capturedAt`、`capturedBy`、`capturedRole`：接入时间、接入人和角色。
- `candidateDomains`：候选业务域。
- `initialEvidence`：图片、表单、聊天记录、电话纪要、合同草稿、证明材料。
- `status`：`new`、`awaiting_resolution`、`ready_for_intake`、`converted`、`duplicate`、`invalid`、`closed`。
- `displayKeys`：来源类型、状态、错误和动作的三语言显示键。

禁止：

- 直接生成住宿单、维修单、合同、收款、押金、运行任务或人事事实。
- 作为主体主档。
- 作为财务依据。
- 替代业务域申请。

## SourceAttribution 的业务语言

| 场景 | 用户语言 | 底层类型 |
| --- | --- | --- |
| 宿舍、维修、配件、车辆服务 | 线索、客户需求、来源 | `SourceAttribution` |
| 人事、行政、员工住宿 | 申请、内部请求 | `SourceAttribution` |
| 财务承接 | 承接来源、来源单据 | 业务办理项引用，必要时关联 `SourceAttribution` |
| 管理指派 | 指派来源、拍板来源 | `SourceAttribution` 或 `ManagementDecisionRecord` |

## SubjectResolution

`SubjectResolution` 负责主体、车辆和关系解析。

职责：

- 识别自然人、组织、内部员工、外部客户、合作方、供应方。
- 识别车辆和车辆控制关系。
- 检测重复主体、重复车辆、冲突关系。
- 提供合并建议、不可合并原因和差异字段。
- 绑定来源、业务对象和主对象。

输出：

- 主体主对象。
- 车辆主对象。
- 正式关系。
- 重复候选。
- 合并建议。
- 风险或阻断回执。

禁止：

- 合并业务域事件。
- 改写已确认业务事实。
- 改写正式财务事实。
- 用主体姓名、手机号、车牌或房间名替代业务锚点。

## DomainIntake

`DomainIntake` 是来源进入业务域后的接入对象。它不是来源对象，也不是业务事实本身；只有通过办理项确认后，才形成业务域申请、订单、服务单或事件。

必备字段：

- `intakeId`：接入对象标识。
- `sourceRef`：来源引用。
- `subjectResolutionRef`：主体、车辆或关系解析结果。
- `targetDomain`：目标业务域。
- `intakeIntent`：住宿、维修、配件、运力、人事行政、财务承接、治理复核等接入意图。
- `intakeStatus`：`draft`、`awaiting_resolution`、`awaiting_evidence`、`ready_for_work_item`、`accepted`、`rejected`、`converted`、`blocked`。
- `acceptanceCriteria`：接入条件和准入要求。
- `requiredEvidence`：接入阶段证据要求。
- `readOnlyContext`：来源摘要、主体摘要、关系摘要、上游只读摘要。
- `proposedExecutionItem`：转入后要创建或打开的办理项。
- `failureRoute`：主体未解析、证据不足、目标域不匹配、重复风险、权限不足、设备不可信等失败路由。
- `handoffSummary`：来源转域时带给业务域的只读摘要。
- `displayKeys`：标题、状态、动作、错误的三语言 key。
- `auditRef`：来源、解析、接入确认和责任人的审计引用。

边界：

- `DomainIntake` 可以被业务域接受、拒绝、阻断或转交。
- `DomainIntake` 不拥有业务域状态机。
- `DomainIntake` 不拥有金额依据、财务事实或资源占用事实。
- `DomainIntake` 的合法动作只能创建或打开 `VNextExecutionItem`。

## ObjectIdentityGraph

`ObjectIdentityGraph` 是共享治理维护的跨域对象关系图。

包含：

- 主体与主体关系。
- 主体与车辆关系。
- 主体与业务对象关系引用。
- 车辆与业务对象关系引用。
- 来源与主体候选关系。
- 业务对象与财务承接关系引用。

用途：

- 搜索发现。
- 重复检查。
- 风险提示。
- 只读对象画像。
- 跨域摘要导航。

不用于：

- 经营统计定真。
- 财务定真。
- 业务事件合并。
- 管理异常处理。
- 复制业务域或财务域事实。

## 主对象

vNext 主对象包括：

- 来源记录
- 主体
- 车辆
- 关系
- 业务接入对象
- 业务执行对象
- 财务对象
- 管理拍板记录
- 审计追踪对象

每个主对象必须有：

- 唯一归属层。
- 可读摘要。
- 合法动作。
- 禁止动作。
- 可追踪来源。
- 三语言显示键。

## 来源转业务域

标准流：

```text
来源记录
-> 主体/车辆/关系解析
-> 候选业务域确认
-> DomainIntake
-> 办理项/WorkItem
```

转域条件：

- 来源有效。
- 主体或车辆解析达到业务可接受程度。
- 用户选择或系统确认目标业务域。
- 证据和权限满足接入要求。
- 三语言显示键齐备，用户能读懂接入结果和失败原因。

转域结果：

- 住宿接入、维修接待、配件需求、运行任务接入、人事申请、财务承接接入或治理复核接入。

来源转域后，来源仍然只读保存为归因记录。
