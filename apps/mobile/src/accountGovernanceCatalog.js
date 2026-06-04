const operatorCapabilities = [
  "workos.write",
  "search.read",
  "operations.confirm",
  "evidence.write",
  "mobile.work"
];

const adminCapabilities = [
  "workos.write",
  "search.read",
  "operations.confirm",
  "case.close",
  "payment.confirm",
  "deposit.refund.pay",
  "correction.approve",
  "admin.role_capability.edit",
  "admin.device_session.revoke",
  "account.user.manage",
  "governance.center.view",
  "manager.control.view",
  "finance.control.view",
  "release.flight_deck.view",
  "pc.governance",
  "pc.governance.admin",
  "pc.export.all",
  "pc.export.ledger",
  "pc.export.case_timeline",
  "pc.export.evidence_audit",
  "pc.export.period_snapshot",
  "runtime.high_risk.all",
  "runtime.maintenance",
  "release.cutover"
];

export const accountRoleOptions = [
  { value: "operator", label: "住宿经办", capabilities: operatorCapabilities },
  { value: "frontdesk", label: "住宿前台", capabilities: operatorCapabilities },
  { value: "housekeeping", label: "客房执行", capabilities: operatorCapabilities },
  {
    value: "finance",
    label: "财务经办",
    capabilities: [
      "workos.write",
      "search.read",
      "operations.confirm",
      "finance.work",
      "payment.confirm",
      "finance.payment.confirm",
      "finance.deposit.confirm",
      "finance.deposit.refund",
      "finance.correction.apply",
      "correction.request",
      "pc.finance",
      "finance.control.view"
    ]
  },
  {
    value: "manager",
    label: "运营主管",
    capabilities: [
      "workos.write",
      "search.read",
      "operations.confirm",
      "case.close",
      "correction.approve",
      "pc.governance",
      "pc.export.all",
      "manager.control.view",
      "governance.center.view",
      "runtime.high_risk.all"
    ]
  },
  { value: "admin", label: "治理管理员", capabilities: adminCapabilities },
  { value: "releaseOwner", label: "发布负责人", capabilities: adminCapabilities }
];

export const accountCapabilityOptions = [
  { value: "workos.write", label: "业务写入" },
  { value: "search.read", label: "搜索读取" },
  { value: "operations.confirm", label: "办理确认" },
  { value: "evidence.write", label: "证据写入" },
  { value: "mobile.work", label: "移动工作台" },
  { value: "finance.work", label: "财务工作台" },
  { value: "payment.confirm", label: "付款确认" },
  { value: "finance.payment.confirm", label: "财务付款确认" },
  { value: "finance.deposit.confirm", label: "押金确认" },
  { value: "finance.deposit.refund", label: "押金退款" },
  { value: "finance.correction.apply", label: "财务修正执行" },
  { value: "correction.request", label: "修正申请" },
  { value: "case.close", label: "案件关闭" },
  { value: "correction.approve", label: "修正审批" },
  { value: "pc.governance", label: "治理中心查看" },
  { value: "pc.governance.admin", label: "治理管理员" },
  { value: "account.user.manage", label: "用户管理" },
  { value: "admin.role_capability.edit", label: "角色能力维护" },
  { value: "admin.device_session.revoke", label: "设备撤销" },
  { value: "pc.export.all", label: "全部导出" },
  { value: "pc.export.ledger", label: "账务导出" },
  { value: "pc.export.case_timeline", label: "案件时间线导出" },
  { value: "pc.export.evidence_audit", label: "证据审计导出" },
  { value: "pc.export.period_snapshot", label: "周期快照导出" },
  { value: "manager.control.view", label: "经理控制塔" },
  { value: "governance.center.view", label: "治理中心" },
  { value: "finance.control.view", label: "财务控制" },
  { value: "runtime.high_risk.all", label: "高风险动作" },
  { value: "runtime.maintenance", label: "运行维护" },
  { value: "release.flight_deck.view", label: "发布驾驶舱" },
  { value: "release.cutover", label: "发布切换" },
  { value: "deposit.refund.pay", label: "押金支付退款" },
  { value: "pc.finance", label: "财务治理视图" }
];

export function capabilitiesForAccountRole(role) {
  const normalized = String(role || "operator").trim().toLowerCase();
  return accountRoleOptions.find((option) => option.value.toLowerCase() === normalized)?.capabilities || operatorCapabilities;
}
