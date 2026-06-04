# Dormitory Scenario Real Browser Audit

生成时间：2026-06-03T14:21:00Z

## Scope

本支线使用 in-app browser 对宿舍业务移动端进行真实点击和完整截图。未使用后台写入、模拟数据注入或测试模式替代浏览器操作。

## Screenshots

| Step | Scenario | Screenshot |
| --- | --- | --- |
| 01 | 登录页，中文，账号登录入口 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/01-login-zh-full.png` |
| 02 | 正例登录后首页 / 今日 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/02-after-login-home-full.png` |
| 03 | 工作台 / 被动任务队列 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/03-workbench-full.png` |
| 04 | 搜索页空查询 / 主动办理入口 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/04-search-empty-full.png` |
| 05 | 点击“开始办理”未跳转 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/06-search-start-click-noop-full.png` |
| 06 | 点击“查看案件”进入住宿资源办理面 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/07-search-case-click-result-full.png` |
| 07 | 反例：房间备注为空直接提交 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/08-operation-panel-submit-missing-required-full.png` |
| 08 | 办理面字段区域滚动截图 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/09-operation-panel-scrolled-inputs-full.png` |
| 09 | 我的 / 个人运营中心 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/11-me-full.png` |
| 10 | 学习中心 / 住宿场景说明 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/12-learning-full.png` |
| 11 | 最近提交 / 中文 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/13-recent-submissions-full.png` |
| 12 | 最近提交 / 俄语 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/14-recent-submissions-ru-full.png` |
| 13 | 最近提交 / 吉语 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/15-recent-submissions-ky-full.png` |
| 14 | 修复后登录进入首页，URL 同步为 `view=home` | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/16-after-fix-home-url-synced-full.png` |
| 15 | 修复后三语言搜索页 / 中文 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/17-after-fix-search-zh-full.png` |
| 16 | 修复后三语言搜索页 / 俄语 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/18-after-fix-search-ru-full.png` |
| 17 | 修复后三语言搜索页 / 吉语 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/19-after-fix-search-ky-full.png` |
| 18 | 修复后吉语学习状态 / 第一屏 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/20b-after-fix-learning-status-ky-viewport.png` |
| 19 | 修复后吉语学习状态 / 学习内容区 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/20e-after-fix-learning-status-ky-learning-section.png` |
| 20 | 修复后住宿资源办理面 / 字段第一屏 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/21a-after-fix-workspace-required-summary-top.png` |
| 21 | 修复后住宿资源办理面 / 提交前校验区 | `artifacts/oam-cab/dormitory-scenario-browser-audit-2026-06-03/21c-after-fix-workspace-required-summary-validation.png` |

## Positive / Negative Results

| Case | Result | Evidence |
| --- | --- | --- |
| 住宿前台账号登录 | passed with issue | 页面进入首页，但 URL 仍停在 `?view=login`。 |
| 首页查看今日待办 | passed with issue | 可见今日任务中心，但任务状态表达有冲突。 |
| 工作台查看待办 | passed with issue | 可见 4 条工作，但住宿资源任务重复出现。 |
| 搜索页查看主动办理 | passed with issue | 可见主动办理入口，但点击“开始办理”未跳转也无反馈。 |
| 通过“查看案件”进入办理面 | passed | 进入“我要创建住宿资源 / 房间配置卡”。 |
| 房间备注为空提交 | passed | 系统阻断提交，字段标记 invalid，并提示“请先补齐必填字段：房间备注”。 |
| 补齐备注后正例提交 | not_completed | Browser 输入通道被虚拟剪贴板限制挡住，不能形成有效真实输入证据。 |
| 最近提交查看 | passed with issue | 页面显示阻断，但缺少对象、原因和下一步。 |
| 俄语 / 吉语切换 | failed | 俄语仍显示中文账号名；吉语页面混入俄语标题和段落。 |
| 修复后登录 URL 同步 | passed | 登录完成后 URL 为 `?view=home&lang=zh-CN&device=mobile`。 |
| 修复后吉语账号/学习状态 | passed | 账号显示为吉语角色；学习状态显示“Түзмөк ишеними”，未出现 `device/rejection`。 |
| 修复后提交前必填摘要 | passed | 房间备注为空时，提交前校验区初始显示“必填字段: 房间备注”。 |

## Findings

### P1

- URL state mismatch: fixed. `setView` / language / search navigation now synchronize URL state.
- Required field summary mismatch: fixed. 提交前校验摘要 now derives missing required fields from Definition, draft, default values, and carried case context before submission.
- Runtime connection contradiction: 顶部显示“运行服务已连接”，办理面内又显示“运行服务未连接”。同一页面的系统状态互相冲突。
- Action affordance mismatch: 搜索页“开始办理”按钮点击后没有跳转、没有加载、没有错误提示；“查看案件”能进入办理面。
- Language kernel leakage: partially fixed. 账号显示名、吉语最近提交/设备/学习文案、学习状态码已修复；部分运行时投影标题/下一步仍从后端中文事实或未翻译业务定义进入表面，需要 Definition/Projection 本地化补齐。
- OperationPanel deep link gap: `view=operationPanel&workspace=W-STAY-RESOURCE&card=roomSetup` without `workItem` is blocked as missing persisted WorkItem. Workspace/Card compatibility route can display the card, but OperationPanel deep link should either include `workItem` or route users to workspace with a clear explanation.

### P2

- Duplicate work items: 首页、工作台和搜索结果里“我要创建住宿资源 / 房间配置卡”重复出现。
- Conflicting task state copy: 卡片同时显示“当前可处理”和“暂不能直接办理”，业务含义冲突。
- Technical / untranslated status terms: 搜索学习内容中出现 `rejection`、`device` 等状态词。
- Prefilled stale-looking values: 房间配置卡初始出现 `D03`、`31`、`1` 等值，像旧测试数据或草稿带入；需要明确来源、可清空或提示“已带入上次草稿”。
- Recent submissions under-explained: 最近提交只显示“业务规则阻断 / 提交后绑定审计轨迹”，缺少对象、阻断原因、下一步和可恢复动作。

## Next Fix Priority

1. 修复 OperationPanel 深链：官方办理面 URL 必须携带 persisted WorkItem，缺失时应提供可恢复跳转而不是裸阻断。
2. 去重 WorkItem / Search / Home 结果，并统一“可处理 / 不能直接办理”的状态模型。
3. 给“开始办理”按钮增加真实跳转成功态或明确失败消息；当前已加搜索页 operation message 承载位，但仍需在真实创建链路上复测。
4. 给本机草稿值增加来源提示和清空入口，避免 `D03 / 31 / 1` 像旧测试数据。
5. 补齐 Definition/Projection 层多语言，避免后端投影把中文业务标题带到吉语/俄语表面。
