# OAM 当前迭代内核说明

本文件只做人读说明，不定义当前事实。当前事实以 `docs/oam/iteration-kernel.json`、`docs/oam/system-change-governance-contract.json`、`docs/oam/system-operating-kernel.json`、`docs/oam/oam-kernel-graph.json` 和本地总门禁结果为准。

当前迭代目标是把项目收敛为唯一生效 OAM 编译链：先冻结本地事实，再把权威、系统内核、领域内核、图谱、文件生命周期、派生合同、运行实现、门禁、测试和证据根串成一条可失败、可修复、可复验的闭环。

执行规则很硬：阶段之间串行；阶段内只读扫描和交叉比对可以并行；任何门禁失败必须先修复并重跑；不能用远端 CI 绿色替代本地当前工作区；不能保留无法证明服务当前 OAM 的历史材料；人读手册只能解释当前权威。

宿舍业务唯一源头是 `docs/business/domains/dormitory/dormitory-operating-kernel.json`。非当前内核口径、非当前角色、多套解释、只读报表冒充 WorkItem 和绕过 finance-gate 的账务事实都不能作为当前事实源。
