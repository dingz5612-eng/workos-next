import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md",
  "docs/architecture/active-components.yml",
  "docs/architecture/compatibility-components.yml",
  "docs/architecture/archive-candidates.yml",
  "docs/architecture/remove-candidates.yml",
  "docs/architecture/CODEX_EXECUTION_PLAYBOOK.md",
  "docs/contracts/company-kernels/company-kernel-alignment-contract.json",
  "docs/architecture/business-reality-oam-kernel-map.json"
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`缺少 OAM clean baseline 文件：${file}`);
}

if (failures.length === 0) {
  checkBaselineDoc();
  checkActiveComponents();
  checkCompatibilityComponents();
  checkCandidateFiles();
  checkPlaybook();
  checkGuardIntegration();
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM clean baseline check failed.");
}

console.log("OAM clean baseline check: PASS");

function checkBaselineDoc() {
  const text = read("docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md");
  for (const term of [
    "OAM-ACF v8",
    "Operations Runtime",
    "POST /api/operations/work-items/{workItemId}/confirm",
    "ProjectionRuntime 是当前 compatibility facade",
    "Workspace/Card 只能作为投影展示对象",
    "Control Plane",
    "Rules OS",
    "Business Line Registry",
    "Surface Policy",
    "current-state 是状态裁决权威",
    "Business Production 当前 blocked",
    "Admission Kernel",
    "Definition Registry",
    "Language Kernel",
    "Search Kernel",
    "OAM-CAB v1.1 公司级内核对齐",
    "Business Domain Kernel",
    "Master Object Kernel",
    "Truth Boundary Kernel",
    "Finance Truth Kernel",
    "Event-State-Summary Kernel",
    "BI/KPI Kernel",
    "Account/Application Boundary Kernel",
    "不进入下一业务阶段"
  ]) {
    if (!text.includes(term)) failures.push(`CURRENT_ARCHITECTURE_BASELINE.md 缺少必需声明：${term}`);
  }
  assertNoForbiddenProductionLanguage(text, "CURRENT_ARCHITECTURE_BASELINE.md");
}

function checkActiveComponents() {
  const text = read("docs/architecture/active-components.yml");
  for (const component of [
    "ArchitectureAuthority",
    "AdmissionKernel",
    "OperationsRuntime",
    "CompatibilityBox",
    "ExperienceKernel",
    "LanguageKernel",
    "SearchKernel",
    "AdmissionKernel",
    "DefinitionRegistry",
    "ControlPlane",
    "EvidenceGraph",
    "BusinessDomainKernel",
    "MasterObjectKernel",
    "TruthBoundaryKernel",
    "FinanceTruthKernel",
    "EventStateSummaryKernel",
    "BIKPIKernel",
    "AccountApplicationBoundaryKernel"
  ]) {
    if (!componentBlock(text, component)) failures.push(`active-components.yml 缺少 active/planned 组件：${component}`);
  }
  for (const component of ["ArchitectureAuthority", "AdmissionKernel", "OperationsRuntime", "CompatibilityBox", "ExperienceKernel", "LanguageKernel", "SearchKernel", "ControlPlane", "EvidenceGraph", "DefinitionRegistry", "BusinessDomainKernel", "MasterObjectKernel", "TruthBoundaryKernel", "FinanceTruthKernel", "EventStateSummaryKernel", "BIKPIKernel", "AccountApplicationBoundaryKernel"]) {
    const block = componentBlock(text, component);
    if (!/status:\s*active/.test(block)) failures.push(`${component} 必须标记为 active。`);
    for (const field of ["name", "path", "status", "owner_domain", "reason", "allowed_usage", "forbidden_usage", "evidence"]) {
      if (!new RegExp(`${field}:\\s*\\S`).test(block)) failures.push(`${component} 缺少 OAM-CAB v1 必需字段：${field}。`);
    }
  }
  if (componentBlock(text, "ProjectionRuntime")) failures.push("ProjectionRuntime 不得在 active-components.yml 中声明为 active 核心。");
  if (componentBlock(text, "Workspace/Card")) failures.push("Workspace/Card 不得在 active-components.yml 中声明为 active 核心。");
}

function checkCompatibilityComponents() {
  const text = read("docs/architecture/compatibility-components.yml");
  for (const component of [
    "ProjectionRuntime",
    "RuntimeDocumentStorage / runtime_documents snapshot",
    "LensQueryService projection search adapter"
  ]) {
    const block = componentBlock(text, component);
    if (!block) {
      failures.push(`compatibility-components.yml 缺少组件：${component}`);
      continue;
    }
    for (const field of ["currentUse", "allowed", "forbidden", "owner", "removalCondition"]) {
      if (!new RegExp(`${field}:\\s*\\S`).test(block)) failures.push(`${component} 缺少非空 ${field}。`);
    }
  }
  for (const retired of ["Workspace/Card prepare-confirm", "ActionRuntimeService legacy validation path"]) {
    if (componentBlock(text, retired)) failures.push(`compatibility-components.yml 不得继续声明已退役组件：${retired}`);
  }
  if (text.includes("WorkspaceCardCompatibilityAdapter")) {
    failures.push("compatibility-components.yml 不得继续引用已删除的 Workspace/Card write adapter。");
  }
}

function checkCandidateFiles() {
  const archiveText = read("docs/architecture/archive-candidates.yml");
  if (!archiveText.includes("archiveCandidates:")) failures.push("archive-candidates.yml 必须声明 archiveCandidates。");
  for (const candidate of ["V1_ARCHITECTURE.md", "PHASE_PLAN.md", "WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md"]) {
    if (!archiveText.includes(candidate)) failures.push(`archive-candidates.yml 缺少历史文档候选：${candidate}`);
  }

  const removeText = read("docs/architecture/remove-candidates.yml");
  if (!removeText.includes("removeCandidates:")) failures.push("remove-candidates.yml 必须声明 removeCandidates。");
  const candidateBlocks = removeText.split(/\n\s*-\s+/).slice(1);
  for (const block of candidateBlocks) {
    for (const field of ["owner", "reason", "replacement", "proofNotUsed", "deleteStage", "requiredGate"]) {
      if (!new RegExp(`${field}:\\s*\\S`).test(block)) failures.push(`remove candidate 缺少非空 ${field}。`);
    }
  }
}

function checkPlaybook() {
  const text = read("docs/architecture/CODEX_EXECUTION_PLAYBOOK.md");
  for (const term of [
    "读取 `docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md`",
    "判断任务层级",
    "active、compatibility、archive candidate 还是 remove candidate",
    "判断是否影响 Admission",
    "先改 contract",
    "再改实现",
    "再改测试",
    "再生成 evidence",
    "中文 No-Go / Risk",
    "不得擅自扩展 compatibility",
    "不得绕过 Operations Runtime",
    "不得局部修补 language、search 或 surface"
  ]) {
    if (!text.includes(term)) failures.push(`CODEX_EXECUTION_PLAYBOOK.md 缺少必需步骤：${term}`);
  }
}

function checkGuardIntegration() {
  const guard = exists("scripts/guard-architecture.ps1") ? read("scripts/guard-architecture.ps1") : "";
  const ci = exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "";
  if (!guard.includes("scripts/check-oam-clean-baseline.mjs") && !ci.includes("scripts/check-oam-clean-baseline.mjs")) {
    failures.push("check-oam-clean-baseline.mjs 必须接入 architecture guard 或 CI。");
  }
}

function assertNoForbiddenProductionLanguage(text, label) {
  for (const pattern of [/Day-2\s+started/i, /Dormitory\s+L2\s+ready/i, /Business\s+Production\s+allowed/i]) {
    if (pattern.test(text)) failures.push(`${label} 包含禁止的生产放开暗示：${pattern}`);
  }
}

function componentBlock(text, id) {
  const escaped = escapeRegex(id);
  const match = text.match(new RegExp(`(^|\\n)\\s*-\\s+id:\\s*${escaped}\\s*\\n(?<block>[\\s\\S]*?)(?=\\n\\s*-\\s+id:\\s|$)`));
  return match ? match[0] : "";
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
