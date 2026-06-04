# Compatibility 隔离规则

本文件定义 OAM-CAB v1 阶段 2 的 compatibility quarantine。它只说明兼容层允许继续存在的边界，不提升任何 compatibility 组件的架构地位。

## ProjectionRuntime

ProjectionRuntime 可以继续作为 compatibility facade，承接当前 projection、Lens、observability 和既有 facade 行为。

ProjectionRuntime 不得新增业务写入职责，不得成为顶层架构，不得读取或消费 `shadow_runtime`，不得绕过 Operations Runtime 写业务事实。

## Retired Workspace/Card Write Routes

Workspace/Card prepare / confirm 写路由已退役，不得继续作为 compatibility wrapper 承接旧 surface。

Workspace/Card 不得新增业务动作，不得新增业务扩展点，不得新增 page-specific business write API。Card 可以作为 surface 展示，但不得作为 command boundary。

Workspace/Card 不得决定 confirmAllowed，不得绕过 Admission Kernel，不得绕过 Operations Runtime，不得承载 Business Production 放行。

所有新业务写入必须进入：

```text
POST /api/operations/work-items/{workItemId}/confirm
```

## runtime_documents

`runtime_documents` 可以作为 snapshot/cache 保留，不能作为 authoritative business fact source。

如果后续 runtime 仍需要读取 snapshot，必须由 projection / Lens contract 说明来源、owner、freshness 和 replacement。

## LensQueryService

LensQueryService projection search adapter 可以保留，但必须被 SearchKernel 接管或包裹。

Projection search adapter 不得作为最终 Search Kernel，不得只依赖局部 contains 匹配，不得绕过 Language Kernel、Search Kernel permission policy 或 Admission Kernel。

## 已登记兼容路径

当前允许保留的 Workspace/Card compatibility write routes 数量必须为 0。旧路由若再次出现在 Program.cs、OpenAPI 或移动端 API 客户端，必须被 `scripts/check-compatibility-quarantine.mjs` 和 `scripts/check-runtime-write-paths.mjs` 阻断。

新增 compatibility 路径默认禁止。确需引入任何兼容层能力时必须先证明它不是业务写入口，并更新 API boundary、compatibility registry、quarantine guard 和 release evidence。

## 兼容层通用硬规则

1. ProjectionRuntime 只能作为 compatibility facade。
2. Workspace/Card 只能作为展示/投影对象，不得作为 compatibility write wrapper。
3. 兼容层不得新增业务写语义。
4. 兼容层不得决定 confirmAllowed。
5. 兼容层不得绕过 Operations Runtime。
6. 兼容层不得绕过 Admission Kernel。
7. 兼容层不得承载 Business Production 放行。
8. 兼容层只能通过受控接口读取、展示、映射、适配。
9. 任何兼容层扩大职责必须被 gate 阻断。
