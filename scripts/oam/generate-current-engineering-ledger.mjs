import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const ledgerPath = "docs/oam/current-engineering-ledger.json";
const auditPath = "artifacts/oam/checks/current-engineering-ledger-audit.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const lifecyclePolicyPath = "docs/oam/file-lifecycle-policy.json";

const files = listCurrentFiles();
const graph = readJson(graphPath);
const lifecyclePolicy = readJson(lifecyclePolicyPath);
const fileNodeByPath = new Map((graph.nodes ?? [])
  .filter((node) => node.nodeType === "File")
  .map((node) => [slash(node.sourceFile), node]));
const entries = files.map(classifyFile);
const byIdentity = entries.reduce((acc, entry) => {
  acc[entry.currentIdentity] = (acc[entry.currentIdentity] ?? 0) + 1;
  return acc;
}, {});

const ledger = {
  version: "oam.current-engineering-ledger.v1",
  status: "authoritative",
  architecture: "oam.current",
  authorityEntry: "docs/oam/current-authority-index.json",
  sourceGraph: graphPath,
  sourceLifecyclePolicy: lifecyclePolicyPath,
  defaultPolicy: "unregistered_files_are_not_allowed",
  fileCount: entries.length,
  identityCounts: byIdentity,
  files: entries
};

writeJson(ledgerPath, ledger);
writeJson(auditPath, {
  version: "oam.current-engineering-ledger-audit.v1",
  status: "generated",
  architecture: "oam.current",
  commitSha: git(["rev-parse", "HEAD"]),
  branch: git(["branch", "--show-current"]),
  fileCount: entries.length,
  identityCounts: byIdentity,
  unknownIdentityCount: entries.filter((entry) => entry.currentIdentity === "unclassified").length,
  files: entries.map((entry) => ({
    path: entry.path,
    currentIdentity: entry.currentIdentity,
    owner: entry.owner,
    gates: entry.gates
  }))
});

console.log(`Current engineering ledger generated: ${ledgerPath}`);
console.log(`files=${entries.length}`);

function listCurrentFiles() {
  const output = git(["ls-files", "--cached", "--others", "--exclude-standard"]);
  const values = output
    .split(/\r?\n/)
    .map((item) => slash(item.trim()))
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/authority-cleanup/"))
    .filter((item) => !item.startsWith("artifacts/oam/checks/"))
    .filter((item) => !item.startsWith("artifacts/oam/evidence/"))
    .filter((item) => !item.startsWith("artifacts/oam/proofs/"))
    .filter((item) => !item.startsWith("artifacts/oam/test-results/"))
    .filter((item) => item !== "artifacts/oam/final-report.json");
  const required = [
    ledgerPath,
    "scripts/oam/generate-current-engineering-ledger.mjs",
    "scripts/oam/check-current-engineering-ledger.mjs"
  ];
  for (const item of required) {
    if (!values.includes(item)) {
      values.push(item);
    }
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function classifyFile(file) {
  const fileNode = fileNodeByPath.get(file);
  if (fileNode) {
    return {
      path: file,
      currentIdentity: identityFromLifecycle(fileNode.lifecycleState),
      lifecycleState: fileNode.lifecycleState,
      responsibilityScopeZh: scopeFromLifecycle(fileNode.lifecycleState),
      forbiddenScopeZh: forbiddenFromLifecycle(fileNode.lifecycleState),
      currentFactAuthorityAllowed: fileNode.currentTruthAllowed,
      currentFactAuthorityAllowedByGraph: fileNode.currentTruthAllowed,
      upstreamSource: graphPath,
      downstreamConsumers: fileNode.consumers,
      owner: fileNode.owner,
      sourceKernel: fileNode.sourceKernel,
      graphBinding: fileNode.nodeId,
      gates: fileNode.gateBinding,
      evidence: [fileNode.evidence],
      manualEditAllowed: fileNode.manualEditAllowed,
      ciReferenceAllowed: fileNode.ciReferenceAllowed,
      replacementPath: fileNode.replacementPath,
      absorbedBy: fileNode.absorbedBy,
      removalProofGate: fileNode.removalProofGate,
      deletionConditionZh: fileNode.deletionConditionZh
    };
  }
  const rule = classificationFor(file);
  return {
    path: file,
    currentIdentity: rule.identity,
    responsibilityScopeZh: rule.scope,
    forbiddenScopeZh: rule.forbidden,
    currentFactAuthorityAllowed: rule.factAuthority,
    upstreamSource: rule.upstream,
    downstreamConsumers: rule.consumers,
    owner: rule.owner,
    gates: rule.gates,
    evidence: rule.evidence,
    lifecycleState: "active_validation",
    sourceKernel: rule.upstream,
    graphBinding: "graph.oam",
    manualEditAllowed: true,
    ciReferenceAllowed: true,
    replacementPath: file,
    absorbedBy: file,
    removalProofGate: rule.gates[0],
    deletionConditionZh: rule.deletionCondition
  };
}

function identityFromLifecycle(state) {
  switch (state) {
    case "active_authority":
    case "active_contract":
      return "authority_file";
    case "active_runtime":
      return "implementation_file";
    case "active_validation":
      return "validation_file";
    case "active_evidence":
      return "generated_evidence";
    case "derived_view":
      return "derived_view";
    case "human_manual":
      return "human_manual";
    default:
      return "validation_file";
  }
}

function scopeFromLifecycle(state) {
  const scopes = {
    active_authority: "当前 OAM 权威入口或系统权威。",
    active_contract: "当前 OAM 机器合同。",
    active_runtime: "当前 OAM 运行实现。",
    active_validation: "当前 OAM 机器门禁、CI 或测试。",
    active_evidence: "当前 OAM 机器证据。",
    derived_view: "由系统内核或 OAM 图谱派生的只读视图。",
    human_manual: "当前 OAM 人读说明。"
  };
  return scopes[state] ?? "当前项目支撑文件。";
}

function forbiddenFromLifecycle(state) {
  const rules = {
    active_authority: "不得承载运行时代码或生成证据。",
    active_contract: "不得绕过系统内核、图谱、门禁或证据根。",
    active_runtime: "不得定义业务真值或绕过 Admission / Unit of Work。",
    active_validation: "不得定义业务事实，只能检查或生成指定产物。",
    active_evidence: "不得定义业务事实或人工放行。",
    derived_view: "不得手工修改，不得替代源内核。",
    human_manual: "不得定义当前事实。"
  };
  return rules[state] ?? "不得定义当前业务事实。";
}

function classificationFor(file) {
  if (file === ledgerPath) {
    return authority("工程文件身份、职责、owner、门禁和删除条件总账。", "不得替代 OAM 架构总纲或业务事实合同。", "oam-release-owner", ["scripts/oam/check-current-engineering-ledger.mjs"]);
  }
  if (file === "docs/oam/current-authority-index.json" || file === "docs/contracts/oam.current.json" || file.startsWith("docs/contracts/")) {
    return authority("当前 OAM 机器合同和权威索引。", "不得承载运行时代码或生成证据。", "oam-release-owner", ["scripts/validate-contracts.mjs", "scripts/oam/check-current-authority-index.mjs"]);
  }
  if (file.startsWith("docs/business/dormitory/") || file.startsWith("docs/scenarios/dormitory/")) {
    return authority("宿舍业务闭环、字段、场景、证据和账务合同。", "不得绕过 Definition、Admission、Runtime 或 DB owner。", "business-contract-owner", ["scripts/check-dormitory-golden-domain.mjs", "scripts/business/check-canonical-scenario-map.mjs"]);
  }
  if (file.startsWith("docs/business/") || file.startsWith("docs/finance/")) {
    return authority("当前业务、finance、ledger、truth owner 合同。", "不得作为前端状态或后端实现。", "business-contract-owner", ["scripts/check-truth-owners.mjs", "scripts/check-finance-truth.mjs"]);
  }
  if (file.startsWith("docs/oam/") || file.startsWith("docs/system/")) {
    return manualOrAuthority(file);
  }
  if (file.startsWith("docs/")) {
    return manual("当前说明、手册或辅助合同。", "不得替代机器合同、Runtime 或证据根。", "documentation-owner", ["scripts/check-local-path-references.mjs"]);
  }
  if (file.startsWith("services/")) {
    return implementation("后端 Runtime、API、Admission、Search、finance、ledger、数据库执行实现。", "不得新增未登记写入口或绕过 Unit of Work。", "runtime-kernel-owner", ["dotnet build WorkOSNext.sln -c Release", "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release"]);
  }
  if (file.startsWith("apps/mobile/") || file.startsWith("apps/pc/") || file.startsWith("packages/")) {
    return implementation("前端 surface、移动端、PC 治理面和共享 view model 实现。", "不得拥有业务事实或绕过 AdmissionDecision。", "surface-owner", ["npm --prefix apps/mobile run test", "npm --prefix apps/mobile run test:coverage"]);
  }
  if (file.startsWith("scripts/")) {
    return validation("当前 OAM 门禁、生成器或检查器。", "不得成为业务事实源；检查器只检查，生成器只生成指定产物。", "oam-release-owner", ["scripts/oam/run-control-plane-checks.ps1"]);
  }
  if (file.startsWith("tests/")) {
    return validation("后端、Runtime、策略、数据库、安全、发布证据或前端行为测试。", "不得定义当前业务事实。", "test-owner", ["dotnet test", "npm --prefix apps/mobile run test"]);
  }
  if (file.startsWith("infra/db/") || file.startsWith("schemas/") || file.startsWith("modules/")) {
    return authority("数据库迁移、schema 或模块清单。", "不得绕过 DB owner、迁移顺序或模块边界。", "runtime-db-owner", ["scripts/oam/check-db-ownership-map.mjs", "scripts/oam/check-current-oam.mjs"]);
  }
  if (file.startsWith(".github/")) {
    return validation("CI、PR 模板和远端门禁配置。", "不得弱于本地 OAM 总门禁。", "ci-owner", ["scripts/oam/check-current-evidence-root.mjs"]);
  }
  if (file.startsWith("artifacts/oam/")) {
    return generatedEvidence("当前 OAM 机器证据。", "不得定义业务事实或人工放行。", "release-evidence-owner", ["scripts/oam/check-current-evidence-root.mjs"]);
  }
  if (file === "README.md" || file === "WorkOSNext.sln" || file === ".gitignore" || file === ".env.example") {
    return manual("项目入口、解决方案或本地环境说明。", "不得替代当前 OAM 合同或门禁。", "project-owner", ["scripts/oam/check-current-oam.mjs"]);
  }
  return validation("当前项目支撑文件。", "不得定义当前业务事实。", "project-owner", ["scripts/oam/check-current-engineering-ledger.mjs"]);
}

function manualOrAuthority(file) {
  if (file.endsWith(".json") || file.includes("rule") || file.includes("authority") || file.includes("registry")) {
    return authority("当前 OAM 系统合同、规则或权威索引。", "不得承载运行时代码。", "oam-release-owner", ["scripts/oam/check-current-authority-index.mjs", "scripts/oam/check-p0-rule-ledger.mjs"]);
  }
  return manual("当前 OAM 人读说明和执行手册。", "不得替代机器合同或门禁结果。", "documentation-owner", ["scripts/check-local-path-references.mjs"]);
}

function authority(scope, forbidden, owner, gates) {
  return base("authority_file", scope, forbidden, true, owner, gates);
}

function implementation(scope, forbidden, owner, gates) {
  return base("implementation_file", scope, forbidden, false, owner, gates);
}

function validation(scope, forbidden, owner, gates) {
  return base("validation_file", scope, forbidden, false, owner, gates);
}

function manual(scope, forbidden, owner, gates) {
  return base("human_manual", scope, forbidden, false, owner, gates);
}

function generatedEvidence(scope, forbidden, owner, gates) {
  return base("generated_evidence", scope, forbidden, false, owner, gates);
}

function base(identity, scope, forbidden, factAuthority, owner, gates) {
  return {
    identity,
    scope,
    forbidden,
    factAuthority,
    upstream: "docs/oam/current-authority-index.json",
    consumers: gates,
    owner,
    gates,
    evidence: ["artifacts/oam/evidence/evidence-graph.json"],
    deletionCondition: "当且仅当内容已被当前权威吸收且无消费者、无门禁、无证据引用时删除。"
  };
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function slash(value) {
  return value.replace(/\\/g, "/");
}
