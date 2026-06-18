# 项目整体瘦身与长期可维护性治理报告

本报告只证明本地/测试环境的维护治理闭环，不改变住宿经营 13 场景业务语义，也不声明生产发布、业务上线或 final GO。

## 当前结论

- 当前唯一 active mainline 仍是“住宿经营 13 场景总控”。
- Source Authority、generated 合同、Evidence Root 必需产物、历史审计证据、迁移映射和活跃引用文件均列入保护范围。
- 本次实际瘦身只删除已证明无引用的脚本死函数 `Test-TcpReady`。
- 13 场景浏览器脚本、Evidence Root 大生成器、旧链历史证据等重复或体量较大的内容暂不删除，只登记为后续抽象或归档治理项。
- 生产发布、业务上线、releaseAuthority、final GO 继续保持 NO_GO。

## 复杂度清单

复杂度总账已落地到 `docs/oam/project-maintainability-governance.json`，覆盖：

- 重复脚本与 check/generate 成对脚本。
- 13 场景正反向浏览器审计脚本重复。
- Evidence Root 大生成器与证据摘要逻辑重复。
- 旧链兼容残留和历史证据体量。
- 移动端 bundle、慢新建、慢提交、搜索投影与 runtime 校验重叠。
- 文档归档漂移、失效内容和删除前无引用证明。

## 安全瘦身

已处理：

- `scripts/surface/run-dormitory-real-browser-audits.ps1` 中未被调用的 `Test-TcpReady` 函数。

暂不处理：

- 13 场景浏览器脚本：当前承担硬门禁、截图索引和 Evidence Root 节点。
- `artifacts/oam/evidence` 历史证据：删除会造成审计断链。
- generated 文件：只能由 compiler 生成，不手工编辑。
- 旧链迁移映射和兼容盒：只读保留，用于解释旧数据和历史证据。

## 长期维护治理

新增 `scripts/oam/check-project-maintainability-governance.mjs`，并接入：

- `.github/workflows/ci.yml`
- `scripts/oam/run-control-plane-checks.ps1`
- `scripts/oam/check-dormitory-ci-hard-gates.mjs`
- `scripts/oam/check-evidence-root-hard-gate-matrix.mjs`
- 主链激活事务生成与校验

这使“删除必须有无引用证明、旧链必须分类、generated 不得手改、浏览器截图必须保留、Evidence Root 不得伪造”等规则不再只是文档说明。

## 复验口径

维护治理检查：

```powershell
node scripts/oam/check-project-maintainability-governance.mjs
```

主链与 Evidence Root 复验仍按既有硬门禁执行：

```powershell
node scripts/oam/check-dormitory-ci-hard-gates.mjs
node scripts/oam/check-evidence-root-hard-gate-matrix.mjs
node scripts/oam/generate-dormitory-mainline-activation-transaction.mjs
node scripts/oam/check-dormitory-mainline-activation-transaction.mjs
```
