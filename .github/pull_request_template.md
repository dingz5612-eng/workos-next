## 摘要

-

## OAM 检查

- [ ] 已阅读 `docs/oam/current-architecture.md`
- [ ] 已确认改动映射到 `docs/oam/current-architecture.manifest.json`
- [ ] 已确认机器合同 `docs/contracts/oam.current.json` 覆盖本次改动
- [ ] 没有引入历史阶段命名、旧兼容入口、旧证据产物或旧规则口径

## 职责和边界

- Product Capability:
- Domain module manifest:
- API boundary:
- database / data boundary:
- Permission / Trust Boundary:
- Evidence / Trace / Audit Boundary:

## 文件处置

- [ ] 新增文件已归类到 OAM manifest
- [ ] 删除文件不再被代码、测试、CI、文档或 Schema 引用
- [ ] 重写文件已删除旧语义并对齐当前 OAM
- [ ] 没有空服务壳、空模块壳、空包或未来占位包

## 验证

- [ ] `node scripts/oam/check-current-oam.mjs`
- [ ] `npm --prefix apps/mobile run test`
- [ ] `npm --prefix apps/mobile run test:coverage`
- [ ] `npm --prefix apps/mobile run build`
- [ ] `dotnet build WorkOSNext.sln -c Release`
- [ ] 后端相关测试：
- [ ] 数据库相关测试：
- [ ] 真实浏览器证据（涉及用户可见交互时必须填写）：

## 风险

- P0:
- P1:
- P2:
