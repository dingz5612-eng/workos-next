# 财务用户手册

## 今天应该看哪里

移动端先看 Today / Work；可信 PC session 下可以进入 Finance Control。

## 工作台状态

确认类事项需要看 ownerRole、evidenceState、账务影响和 trace。blocked 表示不能直接确认。

## 能办 / 不能办

能办时确认收款、押金负债或退款语义。不能办时先看证据、权限、金额和账务规则。

## 权限不足找谁

Finance Control 权限不足时找 admin 或 manager 核对 `finance.control.view`。

## 缺证据怎么补

银行流水、押金、退款等证据必须是当前办理作用域内的真实附件，并通过可信校验。

## 重复提交怎么办

409 时检查 idempotency key 与 payload；不得新写 money fact。

## 403 / 409 / 422

403：角色、capability 或 device trust 不满足。409：重复或冲突。422：缺证据、金额非法、币种非法或业务 blocker。

## 提交结果与轨迹

看 ActionResult、LedgerTransaction、CommandSubmission 和 recentTraces。

## 不能做

不能把 deposit 当 revenue，不能 update/delete old LedgerEntry，不能没有 LedgerTransaction 写 money fact。
