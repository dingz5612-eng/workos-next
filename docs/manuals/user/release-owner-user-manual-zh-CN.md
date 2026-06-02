# 发布负责人用户手册

## 今天应该看哪里

可信 PC / release session 下进入 Release Flight Deck。移动端不能直接进入发布控制面。

Release Control Plane 只用于发布控制、签注、回滚演练和证据检查，不是业务生产放行声明。

## 工作台状态

关注 CI、V5.4 Guards、post-merge attestation、release evidence baseline、artifact git binding 和 no-go。

## 能办 / 不能办

只能在所有阶段门禁通过后推进下一阶段。远端未全绿时不得声明完成。

## 权限不足找谁

releaseOwner capability 缺失时找 admin 复核账号和 device trust。

## 缺证据怎么补

补齐 artifact、TRX、coverage、Playwright report、runtime contract report 或 guard evidence。

## 重复提交怎么办

检查 PR、commit SHA、CI run id 与 artifact binding，避免 stale evidence。

## 403 / 409 / 422

403：release policy 或设备不满足。409：重复发布动作。422：release contract 不满足。

## 提交结果与轨迹

查看 Release Flight Deck、post-merge attestation、current-state、baseline 和 PR checks。

## 不能做

不能合并未全绿 PR，不能声明 L2 或 production，不能启动 Day-2。
