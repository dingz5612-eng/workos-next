# ADR-0002 当前 OAM 权威

## 状态

已接受。

## 决策

WorkOSNext 只有一个顶层架构权威：OAM。当前事实来源是 `docs/oam/current-architecture.md`、`docs/oam/current-architecture.manifest.json`、`docs/contracts/oam.current.json` 和 `docs/system/current-system-map.md`。

任何拼写错误的架构标识、已退场阶段词、重复权威文件、未使用占位包、空服务壳或未引用模板，都必须删除或重写为当前 OAM 内容，不得作为别名保留。

## 影响

- Operations Runtime 保持主执行链。
- `POST /api/operations/work-items/{workItemId}/confirm` 保持主业务写路径。
- Projection、Lens、Search、BI、Dashboard、Profile 和共享回执保持读侧或投影侧定位，不得写业务事实或财务事实。
- Management Cockpit 和 Control Plane 只能发出 ControlPlaneCommand，不得直接修改业务事实。
- 当前模块和包 manifest 必须绑定 Product Capability、Domain Invariant、API、database、tests 和 rules；否则删除空壳。
- Business Production 和 production_confirm 在当前 OAM 准入、证据、认证、回滚和 CI 门禁全部通过前保持阻断。
