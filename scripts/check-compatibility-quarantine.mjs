import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "docs/architecture/compatibility-quarantine-rules.md",
  "docs/architecture/compatibility-components.yml",
  "docs/architecture/active-components.yml",
  "docs/architecture/archive-candidates.yml"
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`缺少 compatibility quarantine 文件：${file}`);
}

if (failures.length === 0) {
  checkRulesDocument();
  checkRuntimeSource();
  checkCompatibilityRegistry();
  checkArchiveIsolation();
  checkGuardIntegration();
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("compatibility quarantine check failed.");
}

console.log("compatibility quarantine check: PASS");

function checkRulesDocument() {
  const text = read("docs/architecture/compatibility-quarantine-rules.md");
  for (const term of [
    "ProjectionRuntime 可以继续作为 compatibility facade",
    "ProjectionRuntime 不得新增业务写入职责",
    "Workspace/Card 可以继续作为 compatibility wrapper",
    "Workspace/Card 不得新增业务动作",
    "所有新业务写入必须进入",
    "POST /api/operations/work-items/{workItemId}/confirm",
    "Card 可以作为 surface 展示，但不得作为 command boundary",
    "`runtime_documents` 可以作为 snapshot/cache 保留",
    "不能作为 authoritative business fact source",
    "LensQueryService legacy search 可以保留",
    "必须被 SearchKernel 接管或包裹"
  ]) {
    if (!text.includes(term)) failures.push(`compatibility-quarantine-rules.md 缺少声明：${term}`);
  }
}

function checkRuntimeSource() {
  const runtimeFiles = listFiles("services/core-api/WorkOS.Api", [".cs"]);
  const activeRuntimeSource = runtimeFiles
    .filter((file) => !file.includes(`${path.sep}bin${path.sep}`) && !file.includes(`${path.sep}obj${path.sep}`))
    .map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));

  for (const { file, text } of activeRuntimeSource) {
    if (/ProjectionRuntime\s*\.\s*Confirm/.test(text)) {
      failures.push(`${rel(file)} 不得直接调用 ProjectionRuntime.Confirm 作为业务写入路径。`);
    }
    if (/shadow_runtime/i.test(text) && !isAllowedShadowTooling(file)) {
      failures.push(`${rel(file)} official runtime source 不得引用 shadow_runtime。`);
    }
  }

  const program = read("services/core-api/WorkOS.Api/Program.cs");
  const workspaceConfirmMatches = [...program.matchAll(/MapPost\("\/api\/workspaces\/\{workspaceId\}\/cards\/\{cardId\}\/confirm"/g)];
  if (workspaceConfirmMatches.length !== 1) {
    failures.push("Workspace/Card confirm route 只能保留一个登记过的 compatibility wrapper。");
  }
  if (!/MapPost\("\/api\/workspaces\/\{workspaceId\}\/cards\/\{cardId\}\/confirm"[\s\S]*WorkspaceCardCompatibilityAdapter\s+operations[\s\S]*operations\.ConfirmWorkspaceCard\s*\(/.test(program)) {
    failures.push("Workspace/Card confirm route 必须通过 WorkspaceCardCompatibilityAdapter.ConfirmWorkspaceCard。");
  }

  const forbiddenApiPatterns = [
    /MapPost\("\/api\/mobile\/[^"]*\/(confirm|refund|close)"/,
    /MapPost\("\/api\/payment\/confirm"/,
    /MapPost\("\/api\/deposit\/refund"/,
    /MapPost\("\/api\/checkout\/close"/,
    /MapPost\("\/api\/bed\/release"/,
    /MapPost\("\/api\/period\/close"/
  ];
  for (const pattern of forbiddenApiPatterns) {
    if (pattern.test(program)) failures.push(`新增 page-specific business write API 被禁止：${pattern}`);
  }
}

function checkCompatibilityRegistry() {
  const compatibility = read("docs/architecture/compatibility-components.yml");
  const active = read("docs/architecture/active-components.yml");
  const requiredComponents = [
    "ProjectionRuntime",
    "Workspace/Card prepare-confirm",
    "WorkspaceCardCompatibilityAdapter",
    "ActionRuntimeService legacy validation path",
    "RuntimeDocumentStorage / runtime_documents snapshot",
    "LensQueryService legacy search"
  ];

  for (const component of requiredComponents) {
    const block = componentBlock(compatibility, component);
    if (!block) {
      failures.push(`compatibility-components.yml 缺少组件：${component}`);
      continue;
    }
    if (!/removalCondition:\s*\S/.test(block)) failures.push(`${component} removalCondition 不得为空。`);
    if (componentBlock(active, component)) failures.push(`${component} 不得同时声明为 active 核心。`);
  }

  const routeSection = compatibility.match(/existingCompatibilityRoutes:[\s\S]*$/)?.[0] || "";
  for (const route of [
    "POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare",
    "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm"
  ]) {
    const block = routeBlock(routeSection, route);
    if (!block) {
      failures.push(`缺少 existing compatibility route 登记：${route}`);
      continue;
    }
    for (const field of ["owner", "whyStillNeeded", "removalCondition", "guard"]) {
      if (!new RegExp(`${field}:\\s*\\S`).test(block)) failures.push(`${route} 缺少非空 ${field}。`);
    }
  }
}

function checkArchiveIsolation() {
  const archive = read("docs/architecture/archive-candidates.yml");
  const activeDocs = [
    read("docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md"),
    read("docs/architecture/active-components.yml")
  ].join("\n");
  const paths = [...archive.matchAll(/path:\s*(\S+)/g)].map((match) => match[1]);
  for (const candidatePath of paths) {
    if (activeDocs.includes(candidatePath)) {
      failures.push(`archive candidate 不得被 active baseline 引用为当前权威：${candidatePath}`);
    }
  }
}

function checkGuardIntegration() {
  const guard = exists("scripts/guard-architecture.ps1") ? read("scripts/guard-architecture.ps1") : "";
  const ci = exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "";
  if (!guard.includes("scripts/check-compatibility-quarantine.mjs") && !ci.includes("scripts/check-compatibility-quarantine.mjs")) {
    failures.push("check-compatibility-quarantine.mjs 必须接入 architecture guard 或 CI。");
  }
}

function isAllowedShadowTooling(file) {
  const normalized = rel(file).replace(/\\/g, "/");
  return normalized.startsWith("tools/control-plane/") ||
    normalized.startsWith("scripts/v5_4/") ||
    normalized.includes("ShadowCompare") ||
    normalized.includes("ShadowRuntimeDbMapping");
}

function listFiles(dir, extensions, output = []) {
  const fullDir = path.join(root, dir);
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    if (entry.name === "bin" || entry.name === "obj" || entry.name === "node_modules") continue;
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) listFiles(path.relative(root, fullPath), extensions, output);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) output.push(fullPath);
  }
  return output;
}

function componentBlock(text, id) {
  const escaped = escapeRegex(id);
  const match = text.match(new RegExp(`(^|\\n)\\s*-\\s+id:\\s*${escaped}\\s*\\n[\\s\\S]*?(?=\\n\\s*-\\s+id:\\s|\\nexistingCompatibilityRoutes:|$)`));
  return match ? match[0] : "";
}

function routeBlock(text, route) {
  const escaped = escapeRegex(route);
  const match = text.match(new RegExp(`(^|\\n)\\s*-\\s+route:\\s*${escaped}\\s*\\n[\\s\\S]*?(?=\\n\\s*-\\s+route:\\s|$)`));
  return match ? match[0] : "";
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function rel(file) {
  return path.relative(root, file);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
