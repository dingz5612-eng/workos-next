# 经理用户手册

## 今天应该看哪里

移动端看 Today / Work；可信 PC session 下看 Manager Control Tower。

## 工作台状态

关注 blocked、waiting、missing evidence、transferable 和 SLA。

## 能办 / 不能办

能办项可分派、跟进或确认管理动作。不能办项需要判断 owner、证据缺口或权限升级路径。

## 权限不足找谁

管理控制塔权限不足时找 admin 检查 `manager.control.view`。

## 缺证据怎么补

要求经办人补齐真实附件，不能用 runtime-evidence 占位表示完成。

## 重复提交怎么办

要求经办人查看 recentSubmissions 和 trace，不要手动重造业务事实。

## 403 / 409 / 422

403：权限或设备。409：重复提交。422：业务 blocker 或证据缺口。

## 提交结果与轨迹

通过 Manager Control Tower 看风险、队列、阻断和 trace。

## 不能做

不能绕过 Operations Runtime，不能替 finance 写账务事实，不能放开 L2 或 production。
