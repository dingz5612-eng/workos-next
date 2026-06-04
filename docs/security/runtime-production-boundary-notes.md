# Runtime Production Boundary Notes

## 中文摘要

本说明记录当前 Runtime 生产边界加固要求。它不授予 Dormitory L2 Production，不授予 Business Production，也不放开 Repair / Parts / HR production。

Dormitory remains L1 Internal Pilot Observation only。Dormitory L2 Production = false。Business Production = blocked。Repair / Parts / HR = L0 Contract Preview。

## 认证边界

服务端身份只允许来自 `account_users` 和 runtime session storage 校验过的 actor session。请求体中的 `ActorId`、`ApproverId`、`ActorCapabilities`、`DeviceTrustStatus` 只能作为审计输入或一致性校验输入，不能作为授权来源。

Account / User / Actor Kernel 是账号真值边界。用户名、昵称、部门、业务线、角色、能力、状态、密码凭据、租户、会话和设备可信均为后端真值对象。登录页只允许用户名和密码；部门、业务线、角色、能力必须由有权限的管理员或主管在 PC 治理面分配，并写入账号审计。

Development 可以使用 `X-WorkOS-Actor-Token` compatibility flow。Production 必须使用 HttpOnly cookie `workosnext_session`，并且 non-GET 请求必须带 `X-CSRF-Token`。Production 登录响应不得在 JSON body 暴露 actor token，移动端也不得把 actor token 写入 `localStorage`。

## 配置边界

Production / Pilot 必须使用真实账号表和慢哈希密码凭据。`account_users.password_hash` 必须使用 versioned `pbkdf2-sha256`。Development-only demo accounts 只能在 Development 且 `AllowDevelopmentAccounts=true` 时启用。

Production 必须显式配置：

- `ConnectionStrings:WorkOSRuntime`
- `Cors:AllowedOrigins`
- `AllowedHosts`
- `Migrations:RunOnStartup`

Production 禁止启用 development-only demo accounts，禁止使用 development password、legacy SHA-256 password hash、空连接串、`localhost` / `127.0.0.1` / `workosnext_dev` 测试连接串、空 CORS allowlist、空 `AllowedHosts` 或 `AllowedHosts=*`。如果历史 `Auth:PasswordSha256ByUsername` 被临时配置为启动凭据，也必须是 versioned slow hash，不能作为长期账号真值来源。

Production 默认不自动执行 startup migration。`Migrations:RunOnStartup=true` 只能在受控发布窗口由发布负责人明确启用。

## 前端边界

移动端启动未登录时只允许访问 public health/bootstrap 或登录所需请求，不得批量 hydrate 受保护 projection、workspace、work queue、control-plane 数据。

Production 不允许通过 URL query `?api=` 持久化 API base URL。允许来源仅限 `VITE_WORKOS_API_BASE_URL`、同源 API 或 `VITE_WORKOS_ALLOWED_API_BASE_URLS` 明确 allowlist。

当前设备可信状态默认必须是 `unknown` 或 `pending`。只有后端设备注册或会话接口返回可信状态后，前端才允许更新为 trusted。URL、`localStorage` debug 字段、客户端 payload 不能提升 device trust。

## XSS 输出边界

Runtime payload、搜索词、业务备注、错误 reason、tenant/workspace/card 文案进入 DOM 前必须使用 `escapeHtml`、`escapeAttr`、`ctx.tr` 或 `ctx.tx` 等安全输出路径。禁止把 raw server payload 直接拼入 HTML。

## 仍然禁止

- 不得新增 page-specific business write API。
- 不得让 UI / ViewModel / Mobile BFF 写业务事实。
- 不得让 PC Governance / Finance / Release 绕过 Operations Runtime。
- 不得恢复 Workspace/Card compatibility path 为 ordinary confirm path。
- 不得把 fake fallback 当作 Production 证据。
