import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml";
const resultPath = "artifacts/oam/checks/dormitory-scenario-package-matrix-result.json";
const requiredPackages = [
  "resource-saleability",
  "lead-reservation",
  "check-in",
  "ordinary-payment",
  "deposit-liability",
  "service-task",
  "expense-governance",
  "bed-transfer-extend",
  "checkout-settlement",
  "period-review",
  "exception-correction"
];
const violations = [];
const text = read(matrixPath);

checkSourceIdentity();
checkGlobalRules();
checkPackages();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory scenario package matrix check: PASS");

function checkSourceIdentity() {
  for (const line of [
    "version: oam.dormitory.scenario-package-matrix.v1",
    "status: authoritative",
    "layer: source",
    "manualEditAllowed: true",
    "generated: false",
    "doNotEdit: false",
    "matrixNameZh: 宿舍场景包矩阵与衔接合同"
  ]) {
    requireValue(text.includes(line), "matrix.source_identity_missing", `场景矩阵缺少 Source 标记：${line}`, { line });
  }
  for (const item of ["cardId", "sourceCardId", "workspace card", "old catalog id", "old seed id"]) {
    requireValue(section("businessIdentity").includes(`- ${item}`), "matrix.forbidden_identity_missing", `禁止身份缺少 ${item}。`, { item });
  }
}

function checkGlobalRules() {
  for (const line of [
    "sourceOnly: true",
    "generatedViewMayNotOverride: true",
    "uiMayNotInferAdmission: true",
    "dashboardSearchSurfaceMayNotWriteFacts: true",
    "financeKernelOwnsLedgerEntry: true"
  ]) {
    requireValue(text.includes(line), "matrix.global_rule_missing", `全局规则缺少 ${line}。`, { line });
  }
}

function checkPackages() {
  const seen = [...text.matchAll(/^\s{2}- packageId:\s*([^\r\n]+)/gm)].map((match) => match[1].trim());
  requireValue(JSON.stringify(seen) === JSON.stringify(requiredPackages), "matrix.package_order_invalid", "宿舍场景包必须按指定 11 包顺序定义。", { seen });
  for (const packageId of requiredPackages) {
    const block = packageBlock(packageId);
    requireValue(Boolean(block), "matrix.package_missing", `缺少场景包 ${packageId}。`, { packageId });
    if (!block) continue;
    for (const key of [
      "nameZh:",
      "businessGoalZh:",
      "inScope:",
      "outOfScope:",
      "mainFlowZh:",
      "branchFlows:",
      "fields:",
      "handoff:",
      "roles:",
      "factOwnership:",
      "admission:",
      "evidence:",
      "ledger:",
      "readSideOutputs:",
      "uiUxBoundary:",
      "goNoGo:"
    ]) {
      requireValue(block.includes(key), "matrix.package_section_missing", `${packageId} 缺少 ${key}`, { packageId, key });
    }
    requireValue(/nameZh:\s*[\u4e00-\u9fff]/.test(block), "matrix.name_not_chinese", `${packageId} 必须有中文名称。`, { packageId });
    requireValue((block.match(/fieldId:/g) ?? []).length >= 2, "matrix.field_count_too_low", `${packageId} 至少需要两个字段定义。`, { packageId });
    for (const key of [
      "fieldId:",
      "displayNameZh:",
      "type:",
      "category:",
      "editable:",
      "source:",
      "truthOwner:",
      "fallbackAllowed: false",
      "validationRules:",
      "evidenceRequirements:"
    ]) {
      requireValue(block.includes(key), "matrix.field_contract_missing", `${packageId} 字段合同缺少 ${key}`, { packageId, key });
    }
    for (const key of ["produces:", "enablesNext:", "carryForwardReadonly:", "nextAdmission:"]) {
      requireValue(block.includes(key), "matrix.handoff_missing", `${packageId} handoff 缺少 ${key}`, { packageId, key });
    }
    requireValue(block.includes("readonlyCarryForward: true"), "matrix.readonly_carry_forward_missing", `${packageId} UI 必须只读带入上一环上下文。`, { packageId });
    requireValue(block.includes("confirmPathOnly: true") && block.includes("noInlineConfirm: true"), "matrix.confirm_path_boundary_missing", `${packageId} UI 必须只允许 WorkItem confirm path。`, { packageId });
    requireValue(block.includes("SearchResult: readonly") && block.includes("Dashboard: readonly"), "matrix.readside_readonly_missing", `${packageId} 读侧输出必须只读。`, { packageId });
    requireValue(block.includes("productionConfirmAllowed: false"), "matrix.production_block_missing", `${packageId} 必须禁止 production confirm。`, { packageId });
    requireValue(block.includes("ledgerEntryAllowed: false"), "matrix.ledger_write_block_missing", `${packageId} 必须禁止场景包直接写 LedgerEntry。`, { packageId });
    requireValue(block.includes("untilAllSatisfied: NO_GO"), "matrix.no_go_missing", `${packageId} 必须声明未满足前 NO_GO。`, { packageId });
  }

  const handoffs = new Map(requiredPackages.map((item) => [item, packageBlock(item).match(/enablesNext:\s*([^\r\n]+)/)?.[1]?.trim()]));
  for (const [from, to] of [
    ["resource-saleability", "lead-reservation"],
    ["lead-reservation", "check-in"],
    ["check-in", "ordinary-payment"],
    ["ordinary-payment", "deposit-liability"],
    ["deposit-liability", "service-task"],
    ["service-task", "expense-governance"],
    ["expense-governance", "bed-transfer-extend"],
    ["bed-transfer-extend", "checkout-settlement"],
    ["checkout-settlement", "period-review"],
    ["period-review", "exception-correction"],
    ["exception-correction", "resource-saleability"]
  ]) {
    requireValue(handoffs.get(from) === to, "matrix.handoff_chain_invalid", `${from} 必须衔接到 ${to}。`, { from, to, actual: handoffs.get(from) });
  }
}

function packageBlock(packageId) {
  const marker = `  - packageId: ${packageId}`;
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const rest = text.slice(start + marker.length);
  const next = /\n\s{2}- packageId:\s*/.exec(rest);
  return marker + (next ? rest.slice(0, next.index) : rest);
}

function section(name) {
  const match = new RegExp(`^${escapeRegExp(name)}:\\s*$`, "m").exec(text);
  if (!match) return "";
  const rest = text.slice(match.index + match[0].length);
  const next = /^\S.*:\s*$/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeResult() {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-scenario-package-matrix-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    packageCount: requiredPackages.length,
    requiredPackages,
    violations
  }, null, 2)}\n`, "utf8");
}
