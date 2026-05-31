# Business Domain Kit

Business Domain Kit 是从 Dormitory Golden Domain 提炼出的业务域复制工厂。它复制经营合同、事实归属、WorkItem、证据、财务边界、Lens、风险、认证和 Go/No-Go，而不是复制页面。

当前用途是支持 Repair、Parts 和其它候选业务线进入 L0 Contract Preview / Admission。L0 只允许定义合同、owner、证据和认证缺口，不允许 production write route，不允许 production Workbench activation。

## Kit Sections

- Domain Object Kit
- Fact Ownership Kit
- WorkItem Catalog Kit
- Action Protocol Kit
- Evidence Policy Kit
- Ledger / Money Policy Kit
- Lens / Metrics Kit
- Risk / Exception Kit
- Surface Contract Kit
- Role / RACI / Shift Kit
- Certification Pack Kit
- Training / Learning Kit
- Go/No-Go Kit

## Promotion Rule

未通过 Business Line Admission Gate 的业务线必须保持 `productionAllowed=false`。Repair / Parts 可以进入 L0 Discovery / Admission，但不能进入 production。
