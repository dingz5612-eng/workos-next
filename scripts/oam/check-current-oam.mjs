import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];
const mobileArtifactDir = ["apps", "mobile", "artifacts"].join("/");

const requiredJson = [
  "docs/oam/current-architecture.manifest.json",
  "docs/contracts/oam.current.json",
  "modules/accommodation/oam-module.manifest.json",
  "modules/finance-gate/oam-module.manifest.json",
  "modules/identity/oam-module.manifest.json",
  "modules/maintenance/oam-module.manifest.json"
];

for (const file of requiredJson) {
  readJson(file);
}

requireFile("docs/oam/current-architecture.md");
requireFile("docs/system/current-system-map.md");

checkDirectory("services", ["core-api"]);
checkDirectory("modules", ["accommodation", "finance-gate", "identity", "maintenance"]);
checkDirectory("packages", ["surface-view-models"]);

for (const moduleName of ["accommodation", "finance-gate", "identity", "maintenance"]) {
  const manifest = readJson(`modules/${moduleName}/oam-module.manifest.json`);
  for (const key of ["productCapability", "domainInvariant", "api", "database", "tests", "rules"]) {
    if (!Array.isArray(manifest?.[key]) || manifest[key].length === 0) {
      violations.push(v("module_manifest_incomplete", `模块 ${moduleName} 缺少 ${key} 绑定。`));
    }
  }
}

checkGithubText(".github/pull_request_template.md");
for (const file of filesUnder(".github/workflows")) {
  checkGithubText(file);
}
checkGlobalRetiredTerms();

if (exists(".github/workflows/oam_control_plane.yml")) {
  violations.push(v("retired_workflow_present", "旧 OAM current workflow 不得存在。"));
}

for (const file of existingFilesUnder("artifacts")) {
  const normalized = slash(file);
  if (!normalized.startsWith("artifacts/oam/")) {
    violations.push(v("retired_artifact_present", `非 OAM artifact 不得保留：${normalized}`));
  }
}

for (const file of existingFilesUnder(mobileArtifactDir)) {
  violations.push(v("mobile_artifact_present", `前端历史截图产物不得保留：${slash(file)}`));
}

const migrationNumbers = new Map();
for (const file of filesUnder("infra/db/migrations").filter((item) => item.endsWith(".sql"))) {
  const name = path.basename(file);
  const match = name.match(/^(\d+)/);
  if (!match) continue;
  const bucket = migrationNumbers.get(match[1]) || [];
  bucket.push(file);
  migrationNumbers.set(match[1], bucket);
}
for (const [number, files] of migrationNumbers) {
  if (files.length > 1) {
    violations.push(v("duplicate_migration_number", `数据库迁移序号重复 ${number}: ${files.map(slash).join(", ")}`));
  }
}

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.id}: ${item.message}`);
  }
  throw new Error(`OAM purity check failed: ${violations.length} violation(s).`);
}

console.log("OAM purity check: PASS");

function checkGithubText(file) {
  if (!exists(file)) return;
  const text = fs.readFileSync(abs(file), "utf8");
  const forbidden = retiredTermPatterns();
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      violations.push(v("github_retired_term", `${file} 含旧阶段语义 ${pattern}.`));
    }
  }
}

function checkGlobalRetiredTerms() {
  const forbidden = retiredGlobalTermPatterns();
  const forbiddenArtifactRefs = retiredArtifactReferencePatterns();
  for (const file of filesUnder(".")) {
    const normalized = slash(file);
    if (!shouldScanText(normalized)) continue;
    const text = fs.readFileSync(abs(file), "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        violations.push(v("global_retired_term", `${normalized} 含旧阶段语义 ${pattern}.`));
      }
    }
    for (const pattern of forbiddenArtifactRefs) {
      if (pattern.test(text)) {
        violations.push(v("retired_artifact_reference", `${normalized} 含旧 artifact 引用 ${pattern}.`));
      }
    }
  }
}

function checkDirectory(dir, allowed) {
  if (!exists(dir)) {
    violations.push(v("directory_missing", `目录缺失：${dir}`));
    return;
  }
  const actual = fs.readdirSync(abs(dir), { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();
  for (const name of actual) {
    if (!allowed.includes(name)) {
      violations.push(v("directory_not_allowed", `${dir}/${name} 不在 OAM 允许目录内。`));
    }
  }
  for (const name of allowed) {
    if (dir === "services" && name !== "core-api") continue;
    if (dir === "packages" && name !== "surface-view-models") continue;
    if (!actual.includes(name)) {
      violations.push(v("directory_required_missing", `${dir}/${name} 是当前 OAM 必需目录。`));
    }
  }
}

function readJson(file) {
  requireFile(file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    violations.push(v("json_invalid", `${file} 不是合法 JSON：${error.message}`));
    return null;
  }
}

function requireFile(file) {
  if (!exists(file)) {
    violations.push(v("file_missing", `文件缺失：${file}`));
  }
}

function filesUnder(dir) {
  if (!exists(dir)) return [];
  const result = [];
  walk(abs(dir), result);
  return result.map((file) => path.relative(root, file));
}

function shouldScanText(file) {
  if (file.startsWith(".git/")) return false;
  if (file.startsWith(".tmp/") || file.includes("/.tmp/")) return false;
  if (file === "scripts/oam/check-current-oam.mjs") return false;
  if (file.includes("/node_modules/")) return false;
  if (file.includes("/bin/") || file.includes("/obj/")) return false;
  if (file.includes("/TestResults/")) return false;
  if (file.startsWith("artifacts/oam/checks/")) return false;
  if (file.startsWith("artifacts/oam/test-results/")) return false;
  if (file === "apps/mobile/package-lock.json") return false;
  if (file === "package-lock.json") return false;
  return [".cs", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".sql", ".ps1"].includes(path.extname(file));
}

function existingFilesUnder(dir) {
  return filesUnder(dir).filter((file) => fs.existsSync(abs(file)));
}

function walk(current, result) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules", "bin", "obj", "dist", "TestResults"].includes(entry.name)) {
      continue;
    }
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, result);
    } else {
      result.push(full);
    }
  }
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function abs(file) {
  return path.join(root, file);
}

function slash(file) {
  return file.replace(/\\/g, "/");
}

function v(id, message) {
  return { id, message };
}

function retiredTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  return [
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    word(["O", "M", "A"]),
    exact(["R", "F", "6"]),
    exact(["R", "F", "7"]),
    exact(["W", "-", "R", "F", "7"]),
    exact(["tenant", "-", "r", "f", "7"]),
    word(["R", "T"]),
    word(["M", "R"]),
    exact(["Gate", "Result"]),
    exact(["WON", "-", "18"]),
    exact(["attes", "tation"]),
    exact(["Operations", " ", "Management", " ", "Architecture"]),
    word(["l", "e", "g", "a", "c", "y"]),
    word(["c", "o", "m", "p", "a", "t", "i", "b", "i", "l", "i", "t", "y"]),
    word(["a", "r", "c", "h", "i", "v", "e"])
  ];
}

function retiredGlobalTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  const prefix = (parts) => new RegExp(`\\b${parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  return [
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", "-", "4"]),
    word(["v", "5", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    exact(["O", "A", "M", "-", "A", "C", "F"]),
    exact(["O", "A", "M", "-", "C", "A", "B"]),
    exact(["o", "a", "m", "-", "c", "a", "b"]),
    word(["O", "M", "A"]),
    exact(["R", "F", "6"]),
    exact(["R", "F", "7"]),
    exact(["W", "-", "R", "F", "7"]),
    exact(["tenant", "-", "r", "f", "7"]),
    word(["R", "T"]),
    prefix(["R", "T", "-"]),
    word(["r", "t", "2"]),
    word(["r", "t", "3"]),
    prefix(["r", "t", "-", "s"]),
    word(["r", "t", "p"]),
    word(["r", "t", "b"]),
    exact(["B", "Stage"]),
    exact(["b", "_", "stage"]),
    exact(["B", "-", "stage"]),
    exact(["docs", "/", "oam", ".", "current"]),
    exact([".", "tmp", "/", "rt"]),
    exact(["attes", "tation"]),
    exact(["Operations", " ", "Management", " ", "Architecture"]),
    word(["l", "e", "g", "a", "c", "y"]),
    word(["c", "o", "m", "p", "a", "t", "i", "b", "i", "l", "i", "t", "y"]),
    word(["a", "r", "c", "h", "i", "v", "e"])
  ];
}

function retiredArtifactReferencePatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return [
    exact(["artifacts", "/", "local-demo"]),
    exact(["artifacts", "/", "screenshots"]),
    exact(["artifacts", "/", "o", "m", "a"]),
    exact(["apps", "/", "mobile", "/", "artifacts"]),
    exact(["browser", "-", "verification"]),
    exact(["evidence", "-", "ledger"])
  ];
}
