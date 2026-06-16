# 住宿经营 13 场景投产可用闭环最终校准报告

> 本报告是本地/测试/真实浏览器验收交付包，不是新的业务权威源。业务规则仍以 `docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json`、13 个场景 Source Authority、以及 `docs/business/domains/dormitory/dormitory-production-mainline-activation.authority.json` 为准。

## 0. 当前结论

- 当前唯一 active mainline：住宿经营 13 场景总控。
- 旧链状态：只读、迁移、历史证据或测试夹具；不得作为默认入口、当前办理、搜索写事实、浏览器 current main audit 或 Evidence Root current proof。
- 当前可用性状态：本地/测试/真实浏览器主链闭环 PASS。
- 仍然保持：`productionConfirmAllowed=false`、`businessGoLiveAllowed=false`、`releaseAuthority=false`、`finalGoNoGo=NO_GO`。
- 用户亲测地址：启动本地测试环境后访问 `http://127.0.0.1:5175/?device=mobile`。

## 1. 现有架构资产表

| 资产 | 位置 | 职责 | 当前生效 | generated 消费 | runtime 消费 | surface 消费 | 测试覆盖 | evidence 覆盖 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 当前 OAM 权威索引 | `docs/oam/current-authority-index.json` | 登记当前权威源 | 是 | 间接 | 间接 | 间接 | `check-current-oam` | Evidence Root |
| 住宿经营总控 | `docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json` | 13 场景最高业务权威 | 是 | 是 | 是 | 是 | 13 场景 authority 检查 | Evidence Root |
| 投产主链激活 authority | `docs/business/domains/dormitory/dormitory-production-mainline-activation.authority.json` | 主链激活、职责域、旧链退役、SOP | 是 | 间接 | 间接 | 间接 | production mainline authority 检查 | mainline transaction |
| 场景 1-13 authority | `docs/business/domains/dormitory/dormitory-scenario*-*.authority.json` | 各场景对象、字段、步骤、CRUD、边界 | 是 | 是 | 是 | 是 | 13 场景合同/消费检查 | Evidence Root |
| generated contracts | `docs/contracts/generated/dormitory/` | 编译后的场景合同、字段矩阵、CRUD、财务边界、测试计划 | 是 | 本身 | 是 | 是 | generated 一致性与未手改 | Evidence Root |
| mobile generated OAM | `apps/mobile/src/generated/oam/` | 移动端消费镜像 | 是 | 本身 | 否 | 是 | mobile 单测/e2e | 浏览器证据 |
| runtime generated mirror | `services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json` | 后端运行时消费镜像 | 是 | 本身 | 是 | 否 | runtime/消费边界 | Evidence Root |
| ConsumerGraph | `docs/oam/lodging-consumer-graph.json` | 登记 mobile/runtime/search/今日/工作项/我的/tests/browser/evidence/CI 消费者 | 是 | 间接 | 是 | 是 | consumer graph 检查 | Evidence Root |
| MainlineManifest | `docs/oam/dormitory-mainline-manifest.json` | 唯一 active 主链与旧链禁用边界 | 是 | 间接 | 是 | 是 | mainline manifest 检查 | Evidence Root |
| 旧链退役总账 | `docs/oam` 下的旧链退役总账 JSON | 旧身份扫描分类规则 | 是 | 间接 | 是 | 是 | 旧链退役总账检查 | Evidence Root |
| VisibleBusinessCopyContract | `docs/oam/visible-business-copy-contract.json` | 业务可见文案和内部 ID 防暴露 | 是 | 间接 | 否 | 是 | UI copy 检查 | 浏览器证据 |
| CI hard gates | `.github/workflows/ci.yml` | 主链硬门禁 | 是 | 间接 | 是 | 是 | CI gate 检查 | Evidence Root |
| 真实浏览器审计 | `scripts/surface/run-dormitory-real-browser-audits.ps1`、`scripts/surface/run-dormitory-scenario*-*-browser-audit.mjs` | 13 场景正反向、入口、性能、旧链隔离 | 是 | 是 | 是 | 是 | browser audit checks | 截图与报告 |
| Evidence Root | `artifacts/oam/evidence/` | 汇总 source/generated/runtime/surface/browser/CI/mainline transaction 证据 | 是 | 间接 | 间接 | 间接 | Evidence Root 检查 | 本身 |

## 2. 15 个投产职责域消费闭环矩阵

| # | 职责域 | 当前状态 | 权威与消费链 | 本轮结论 |
| --- | --- | --- | --- | --- |
| 1 | 产品业务：13 场景、步骤、字段、CRUD、异常 | 已闭环 | 总控 + 13 场景 authority -> generated contracts -> runtime/surface/tests | 场景 1-13 正反向浏览器 PASS |
| 2 | 场景衔接：上游输出、下游读取、不得重复填 | 已闭环 | handoff summaries + consumption boundary | 下游只读带入、越权写入被阻断 |
| 3 | 体验语言：页面名、按钮、字段、提示、多语言 | 已闭环 | VisibleBusinessCopyContract + i18n + DOM 检查 | 工作项按钮已校准为“开始办理 / 继续办理 / 查看详情” |
| 4 | UI/UX 交互：布局、步骤条、空/错/加载状态 | 已闭环 | surface navigation + operation panel + browser screenshots | 真实移动端截图覆盖入口、办理、摘要、异常 |
| 5 | 架构权威源：唯一业务规则来源 | 已闭环 | current-authority-index + MainlineManifest | 13 场景总控是唯一 active mainline |
| 6 | 生成合同：steps、fields、crud、runtime、surface、test、evidence | 已闭环 | generated contracts + generated-not-manual check | generated 未手改、可复现 |
| 7 | Operations Runtime：命令、状态机、幂等、并发、无副作用 | 已闭环 | runtime mirror + unit/runtime/browser negative | 重复提交、并发、伪造 ID、失败无副作用覆盖 |
| 8 | 数据库与主数据：表、迁移、历史数据、备份恢复 | 权威有，测试环境闭环 | 旧链退役总账 + runtime 数据归一化 | 旧 workspace/workItem 不再作为当前办理；生产迁移需独立发布授权 |
| 9 | 搜索与信息架构：搜索入口、只读结果、合法动作跳转 | 已闭环 | page-entry-policy + search tests/browser | 搜索只读跳转，不直接写事实 |
| 10 | BI/KPI/报表：指标口径、血缘、只读、审计 | 已闭环 | 场景 13 authority + read-model/report checks | 报表无 permission/lineage/freshness 不生成正式报表 |
| 11 | 财务资金：价格、收款、押金、退款、账务边界 | 已闭环 | finance-boundary generated + scenarios 3/6/9/10 | 业务只生成 Intent/Draft/Request/Snapshot，账务真值归 finance-gate |
| 12 | 权限安全：租户、组织、角色、设备信任、Admission | 已闭环 | permission/admission contract + browser negative | 越权、伪造内部 ID、跨场景提前操作阻断 |
| 13 | 发布控制：ControlPlane、Release、NO_GO、灰度、回滚 | 已闭环 | CI hard gates + mainline transaction | PASS 只代表本地/测试主链治理闭环，仍 NO_GO |
| 14 | 质量证据：单测、集成、浏览器、截图、回归、Evidence Root | 已闭环 | unit/e2e/browser/evidence scripts | 13 场景正反向浏览器和 Evidence Root PASS |
| 15 | 运营交付：SOP、培训、异常处理、人工复核、上线清单 | 已闭环，需业务方亲测确认 | production mainline activation authority + 本报告亲测包 | 一线亲测步骤、异常预期、旧入口说明已纳入本报告 |

## 3. 旧链退役矩阵与保留理由

| 分类 | 包含对象 | 当前处理 | 保留理由 |
| --- | --- | --- | --- |
| A 当前主链必须保留的内部 ID | 13 场景 authorityId、generated digest、runtime mirror id | 仅审计/证据层可见 | 追溯 Source -> generated -> runtime/surface/evidence |
| B 历史证据只读引用 | FirstGoldenChain、golden-chain、旧浏览器证据 digest | 只读保留 | 不删除历史 evidence，避免证据断链 |
| C 迁移映射引用 | 旧资源可用性、旧销售线索预订、旧房间/床位/资源准备确认命令 | 只作为迁移或 generated 旧链引用 | 支持旧数据归一化和审计解释 |
| D 兼容入口但不默认展示 | 旧链接、旧 workspace/workItem | 归档说明或重定向到新场景；不可继续提交 | 保护老链接访问体验，但不允许旧办理 |
| E 活跃链路污染 | 默认入口、搜索写事实、runtime 写事实、CI current gate、Evidence Root current proof 中的旧链 | 当前门禁要求为 0 | 发现即 P0/P1，必须回源修复 |
| F 死代码、失效文档、失效测试、失效证据 | 无活跃引用的旧断言/旧入口说明 | 退役或标记 historical | 不能再把旧链描述为当前业务入口 |

复验门禁：

- 旧身份活跃路径检查
- 旧链退役总账检查
- `node scripts/oam/check-business-ui-copy-no-technical-leak.mjs`
- `node scripts/oam/check-evidence-root-hard-gate-matrix.mjs`

## 4. 13 场景业务可用性重核

| # | 业务名称 | 用户亲测入口动作 | 正向目标 | 反向重点 | 下游/边界 |
| --- | --- | --- | --- | --- | --- |
| 1 | 房源建档与基础就绪 | 搜索“房源建档与基础就绪”后点“开始办理” | 完成房间建档、床位组确认、基础就绪摘要 | 重复房号、床位数 0、缺证据、伪造内部 ID | 不输出可运营、价格、预订 |
| 2 | 房源运营就绪与状态维护 | 搜索场景名后点“查看详情” | 读取场景 1 摘要并确认运营状态 | 未基础就绪、越权恢复、跳到价格/预订 | 可运营权威在场景 2，不与场景 11 争夺 |
| 3 | 住宿商品与价格 | 查看详情 | 对可运营房源配置商品和价格摘要 | 未运营、价格越权、财务越界 | 不写收款/押金/账务 |
| 4 | 询价与报价 | 查看详情 | 承接房源、运营、价格、客户意向并生成报价 | 报价当预订、旧销售线索预订主路径 | 报价不等于库存锁定 |
| 5 | 预订与库存锁定 | 查看详情 | 基于报价重新校验并锁定库存 | 重复锁房、无报价、直接入住 | 库存锁定不等于入住 |
| 6 | 收款、押金与担保 | 查看详情 | 生成收款/押金/担保请求并读取 finance-gate 确认 | 押金当收入、退款到账、直接写 Ledger | 账务真值独占于 finance-gate |
| 7 | 入住办理 | 查看详情 | 从有效预订转为入住事实 | 无预订、身份核验失败、重复入住 | 不重新定价，不绕过预订 |
| 8 | 在住管理 | 查看详情 | 记录在住服务、异常和变更摘要 | 未入住、已退房、旧房源释放语义主路径 | 不直接退房结算、退款或写账 |
| 9 | 退房结算 | 查看详情 | 生成退房摘要、结算快照、财务请求 | 未入住、直接退款到账、费用来源不清 | 退房结算不等于退款 |
| 10 | 取消、未到店与退款处理 | 查看详情 | 处理取消/未到店并生成释放/退款请求 | 已入住取消、直接退款、缺证据 | 退款申请不是退款到账 |
| 11 | 房务、维修与停售协同 | 查看详情 | 生成房务/维修任务和恢复建议 | 缺上游任务、缺作业证据、直接恢复运营 | 恢复建议回场景 2 确认 |
| 12 | 渠道与企业客户 | 查看详情 | 维护渠道、企业协议和发布规则摘要 | 直接改价格、无协议证据、越权发布 | 不争夺价格真值 |
| 13 | 经营报表、审计与复盘 | 查看详情 | 只读生成指标、审计链路和复盘摘要 | 报表写事实、无 lineage/freshness/permission | 报表不得反写业务 |

所有场景共同规则：

- 用户填写/选择/上传业务字段，系统生成内部引用；普通页面不得要求用户记 `roomId`、`workItemId`、`stableRef`、`projectionVersion`、`digest`。
- 草稿可改；确认后不得原地覆盖，只能追加变更、作废/取消/停用/关闭或纠错。
- 查询、搜索、看板、BI、KPI、报表只读，不写业务事实。

## 5. 真实浏览器验收设计与实际证据

统一执行：

- 全量入口、性能、场景 1-13 正反向：`pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1`
- 入口报告：`artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json`
- 性能报告：`artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json`
- 场景截图目录：`artifacts/oam/evidence/dormitory-scenario*-*/screenshots/`
- Evidence Root：`artifacts/oam/evidence/`

截图验收规则：

- 关键步骤截完整页面；长页面截全页。
- 弹窗、错误提示、加载态、空状态、提交成功态单独截图。
- 每张截图绑定场景、步骤、操作、预期、实际、问题等级、修复归属层。
- 反向路径必须同时证明业务提示可理解、无非法副作用。

## 6. 性能与可恢复性结果

当前浏览器性能报告通过，关键耗时如下：

| 操作 | 实测 | 门槛 | 状态 |
| --- | --- | --- | --- |
| 打开首页 | 501ms | 3000ms | PASS |
| 打开工作项 | 75ms | 1000ms | PASS |
| 打开办理页 | 145ms | 1200ms | PASS |
| 保存草稿 | 142ms | 800ms | PASS |
| 确认提交 | 133ms | 2000ms | PASS |
| 搜索 | 316ms | 1500ms | PASS |
| 打开摘要 | 53ms | 1000ms | PASS |

可恢复性：

- 重复提交提示：系统识别到重复提交。
- 业务校验失败提示：提交校验未通过。
- 失败路径不写非法 CommandSubmission、DomainEvent、Projection、Search、Dashboard 或 Ledger。

## 7. 用户亲测包

本地环境：

- 启动：`pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev/manage-local-test-environment.ps1 -Restart -Validate`
- 地址：`http://127.0.0.1:5175/?device=mobile`
- 建议角色：住宿经办人。

入口使用：

- 今天：只看今天要处理的被动任务。
- 工作项：查看全部被动任务池，按钮应显示“开始办理 / 继续办理 / 查看详情”。
- 搜索：主动查 13 场景、楼栋、房间、床位、状态；结果只读，只能跳合法动作。
- 我的：草稿、个人跟进、收藏、导出、设置、权限和设备状态。

每个场景亲测动作：

1. 在搜索输入场景业务名称。
2. 打开场景卡片，确认按钮名称正确。
3. 发起/查看办理，保存草稿。
4. 补齐页面要求字段与证据，提交确认。
5. 查看完成摘要、状态历史和下一步。
6. 回到搜索查看结果，确认搜索不能直接写事实。
7. 触发反向路径：缺字段、缺证据、重复提交、伪造内部 ID、越权、错误状态、旧入口直达。
8. 确认错误提示是业务语言，并且没有非法副作用。

旧入口亲测预期：

- 旧第一主链、旧住宿资源种子、旧房间/床位/资源准备步骤、旧资源可用性、旧销售线索预订不得作为默认入口。
- 旧链接只能解释、归档、只读或重定向到新 13 场景，不得继续提交。

常见异常预期：

- 缺上游：提示先完成上游场景或等待摘要生成。
- 缺字段/证据：提示缺少哪一项，并保持草稿。
- 重复提交：提示系统识别到重复提交，不重复写事实。
- 并发冲突：提示当前记录已变化，需要刷新后继续。
- 越权：提示当前账号或状态不能办理。
- 伪造内部 ID：阻断并无副作用。
- 报表/搜索写事实：阻断并提示只能查看或跳转合法动作。

## 8. 最终复验脚本

本轮最终复验应至少运行：

- `node scripts/oam/check-current-oam.mjs`
- `node scripts/oam/check-generated-files-not-manually-edited.mjs`
- `node scripts/business/check-dormitory-13-scenario-control-authority.mjs`
- `node scripts/business/check-dormitory-production-mainline-activation-authority.mjs`
- `node scripts/business/check-dormitory-13-scenario-generated-contracts.mjs`
- `node scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs`
- 旧身份活跃路径检查
- `node scripts/oam/check-business-ui-copy-no-technical-leak.mjs`
- `node scripts/oam/check-lodging-consumer-graph.mjs`
- 旧链退役总账检查
- `node scripts/oam/check-dormitory-ci-hard-gates.mjs`
- `npm --prefix apps/mobile run test`
- `npm --prefix apps/mobile run test:e2e`
- `npm --prefix apps/mobile run build`
- `dotnet build services/core-api/WorkOS.Api/WorkOS.Api.csproj -c Release --no-restore`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj --no-restore --verbosity minimal`
- `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1`
- `node scripts/oam/generate-current-evidence-root.mjs`
- `node scripts/oam/check-current-evidence-root.mjs`
- `node scripts/oam/check-evidence-root-hard-gate-matrix.mjs`
- `node scripts/oam/generate-dormitory-mainline-activation-transaction.mjs`
- `node scripts/oam/check-dormitory-mainline-activation-transaction.mjs`

## 9. 未关闭边界

- 本报告不声明生产发布、业务上线或 final GO。
- 生产数据迁移、灰度、回滚、发布窗口、真实租户权限和财务系统联调仍需 Release Authority / ControlPlane 独立授权。
- 若后续任一 P0/P1 重新打开，主链激活交易和 Evidence Root 必须 FAIL，不能用报告文字绕过。
