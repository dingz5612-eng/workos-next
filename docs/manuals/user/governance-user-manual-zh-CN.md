# 治理用户手册

## 今天应该看哪里

可信 PC session 下进入 Governance Center。移动端直达时应看到权限或设备诊断。

Governance Control Plane 只用于治理查看、审计和策略受控动作，不是业务事实写入入口。

## 工作台状态

关注 Gate、Invariant、ShadowCompare、Evidence Graph、Audit、Capability 和 Device Trust。

## 能办 / 不能办

只能执行治理允许的只读查看、导出或受策略保护的治理动作。

## 权限不足找谁

找 admin 或 releaseOwner 核对 governance capability。

## 缺证据怎么补

要求业务 owner 补齐证据；治理面不能伪造 evidence。

## 重复提交怎么办

看 CommandSubmission 和 idempotency 记录，不手工改 GateResult。

## 403 / 409 / 422

403：policy 或 device trust 阻断。409：重复或冲突。422：治理输入不满足合同。

## 提交结果与轨迹

查看 audit trail、trace、release-state artifact 和 guard report。

## 不能做

不能把 SurfaceGuard 当后端授权替代，不能直接写业务事实，不能手工改写 passed GateResult。
