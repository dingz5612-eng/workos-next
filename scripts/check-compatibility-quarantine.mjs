import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const retiredWritePaths = [
  "/api/workspaces/resource-setup/start",
  "/api/workspaces/start",
  "/api/workspaces/{workspaceId}/cards/{cardId}/prepare",
  "/api/workspaces/{workspaceId}/cards/{cardId}/confirm"
];

const forbiddenSourceTokens = [
  "WorkspaceCardCompatibilityAdapter",
  "ConfirmWorkspaceCard",
  "PrepareWorkspaceCard",
  "CompatibilityApiResult",
  "compatibilityRoute"
];

checkRuntimeSource();
checkContracts();
checkGuardsStayConnected();

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("retired compatibility write path check failed.");
}

console.log("retired compatibility write path check: PASS");

function checkRuntimeSource() {
  const runtimeFiles = listFiles("services/core-api/WorkOS.Api", [".cs"])
    .filter((file) => !file.includes(`${path.sep}bin${path.sep}`) && !file.includes(`${path.sep}obj${path.sep}`));
  const program = read("services/core-api/WorkOS.Api/Program.cs");

  for (const retired of retiredWritePaths) {
    if (program.includes(retired)) {
      failures.push(`Program.cs 不得保留旧兼容写路径：${retired}`);
    }
  }

  for (const file of runtimeFiles) {
    const normalized = rel(file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8");
    if (/shadow_runtime/i.test(text) && !isAllowedShadowTooling(file)) {
      failures.push(`${normalized} official runtime source 不得引用 shadow_runtime。`);
    }
    if (normalized.endsWith("WorkspaceCardCompatibilityAdapter.cs")) {
      failures.push("WorkspaceCardCompatibilityAdapter.cs 已退役，必须删除。");
    }
    for (const token of forbiddenSourceTokens) {
      if (text.includes(token)) failures.push(`${normalized} 不得保留旧兼容写实现标记：${token}`);
    }
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

function checkContracts() {
  const openApi = read("docs/contracts/workos-runtime.openapi.json");
  for (const retired of retiredWritePaths) {
    if (openApi.includes(retired)) failures.push(`OpenAPI 不得声明旧兼容写路径：${retired}`);
  }
  if (!openApi.includes("/api/operations/workspaces/start")) {
    failures.push("OpenAPI 必须声明 Operations Runtime workspace start。");
  }
  if (!openApi.includes("/api/operations/work-items/{workItemId}/confirm")) {
    failures.push("OpenAPI 必须声明 Operations WorkItem confirm。");
  }
}

function checkGuardsStayConnected() {
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

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function rel(file) {
  return path.relative(root, file);
}
