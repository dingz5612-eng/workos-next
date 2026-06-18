# 全项目纯净操作与权威一致性封版报告

本报告是本地/测试/真实浏览器证据封版，不是新的业务权威源，不改变住宿经营 13 场景业务语义。

## 封版结论

- 唯一权威源：`docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json`。
- 当前主链入口：住宿经营 13 场景总控，通过 generated page-entry policy、surface navigation、ConsumerGraph 和真实浏览器证据消费。
- 13 场景状态：Source Authority、generated 合同、runtime/surface 消费、正反向浏览器证据均为 PASS。
- 旧链处理状态：仅保留为只读历史证据、迁移映射、测试夹具或控制面隔离对象，不得作为默认入口、当前办理、搜索写事实或当前 Evidence Root 主证明。
- 保留内容：历史证据、迁移映射、旧数据解释、生成链追溯摘要、浏览器截图索引。
- 删除内容：本轮项目瘦身已删除真实浏览器 runner 中无引用的 `Test-TcpReady` 死函数；未删除任何 Source Authority、generated、Evidence Root 必需产物或历史审计证据。
- 可接受风险：移动端主 chunk 仍较大，但真实浏览器性能预算通过，已登记为后续 P2 抽象项。
- 当前边界：`productionConfirmAllowed=false`、`businessGoLiveAllowed=false`、`releaseAuthority=false`、`finalGoNoGo=NO_GO`。

## 封版抽检范围

真实浏览器证据来自当前 13 场景浏览器硬门禁与上线前试运行报告：

- 首页默认入口、今日、工作项、我的：`artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json`
- 搜索只读：`artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json`
- 低风险场景抽检：场景 1、2、13。
- 高风险场景抽检：场景 5 预订、场景 7 入住、场景 6 收款押金、场景 10 取消退款、场景 9 退房结算。

## 本轮封版修复

- 修复搜索页在用户输入普通对象编号后仍短暂保留空搜索主动办理入口的问题。
- 非空搜索不再展示常用/最近推荐入口，避免对象查询被误解为发起办理。
- 当前主链命令关键词从 generated capability projection 合并，保留“新增房间”等业务同义词，同时继续使用 `W-DORM-MAINLINE` 作为当前办理入口。
- 复验结果：场景 1 反向浏览器审计 PASS，13 场景真实浏览器硬门禁 PASS。

## 证据目录

- 入口截图：`artifacts/oam/evidence/dormitory-13-scenario-entry-browser/screenshots/`
- 试运行截图：`artifacts/oam/evidence/dormitory-prelaunch-ops-trial/screenshots/`
- 场景截图：`artifacts/oam/evidence/dormitory-scenario*-*/screenshots/`
- Evidence Root：`artifacts/oam/evidence/evidence-graph.json`
- 主链事务：`artifacts/oam/evidence/dormitory-mainline-activation-transaction.json`

## 下一步前端最终体验验收范围

- 业务人员按角色亲测今日、工作项、搜索、我的。
- 重点复核预订、入住、收款押金、退款、退房结算五个高风险场景。
- 继续关注移动端 bundle 体积、首屏加载和提交反馈。
- 仍需 Release Authority 与 ControlPlane 独立授权后，才可进入任何生产发布或业务上线讨论。
