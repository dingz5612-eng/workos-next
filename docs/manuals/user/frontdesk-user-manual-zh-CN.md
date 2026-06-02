# 前台经办人用户手册

## 今天应该看哪里

先看 Today，再进入 Work。Today 显示今日关键阻断、影响和建议动作。

## 工作台状态

可办理表示当前角色、设备、证据和字段满足办理前提。已阻断表示需要补权限、证据或等待其他角色。等待他人表示当前不应重复提交。

## 能办 / 不能办

能办时进入 OperationPanel，检查当前状态、所需权限、证据和确认影响。不能办时看阻断原因和下一步动作。

## 权限不足找谁

按权限诊断中的 owner 联系 manager、finance、admin 或 releaseOwner。

## 缺证据怎么补

证据需求未满足时，先生成证据草稿，再上传真实附件，等待可信校验通过。缺少证据时提交会被阻断。

## 重复提交怎么办

409 表示重复或 payload 不一致。不要连续点击，先查看最近提交和 trace。

## 403 / 409 / 422

403：权限或设备不满足。409：重复提交或 payload 冲突。422：业务字段或证据不满足。

## 提交结果与轨迹

提交后查看 ActionResult 和 recentTraces。Projection pending 只是同步中。

## 不能做

不能进入 PC Governance，不能绕过 Operations Runtime，不能把 compatibility path 当普通办理路径。
