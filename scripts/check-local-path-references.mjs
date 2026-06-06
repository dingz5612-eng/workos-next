import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();

const scanRoots = [
  "docs/contracts",
  "docs/oam",
  "docs/business",
  "docs/surface",
  "schemas",
  "scripts",
  "tests",
  "tools"
];

const scanExtensions = new Set([".json", ".yml", ".yaml", ".md", ".mjs", ".js", ".cs"]);
const skipDirectories = new Set([".git", ".tmp", "node_modules", "bin", "obj", "dist", "coverage", "TestResults"]);
const generatedArtifactPrefixes = [
  "apps/mobile/dist",
  "apps/mobile/dist/",
  "artifacts/oam/checks",
  "artifacts/oam/checks/",
  "artifacts/oam/test-results",
  "artifacts/oam/test-results/",
  "artifacts/oam/evidence",
  "artifacts/oam/evidence/"
];

const localPathPattern = /[`"']((?:\.github[\\/]|apps[\\/]|docs[\\/]|infra[\\/]|modules[\\/]|packages[\\/]|schemas[\\/]|scripts[\\/]|services[\\/]|tests[\\/]|tools[\\/]|artifacts[\\/])[^`"'\s)\]}]+)[`"']/g;

export function validateLocalPathReferences(options = {}) {
  const files = options.files ?? scanRoots.flatMap((root) => listFiles(path.join(repoRoot, root)));
  const violations = [];

  for (const file of files) {
    const relativeFile = toRepoPath(file);
    if (shouldSkipFile(relativeFile)) continue;

    const text = options.textByFile?.get(relativeFile) ?? fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      for (const rawRef of extractLocalPathReferences(lines[index])) {
        const normalized = normalizeReference(rawRef);
        if (!normalized || shouldSkipReference(relativeFile, lines[index], normalized)) continue;
        if (!fs.existsSync(path.join(repoRoot, normalized))) {
          violations.push({
            file: relativeFile,
            line: index + 1,
            ref: rawRef,
            normalized,
            reason: "referenced path does not exist"
          });
        }
      }
    }
  }

  return violations;
}

export function extractLocalPathReferences(text) {
  const refs = [];
  for (const match of text.matchAll(localPathPattern)) {
    refs.push(match[1]);
  }
  return refs;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (skipDirectories.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(fullPath));
    } else if (entry.isFile() && scanExtensions.has(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }
  return output;
}

function normalizeReference(rawRef) {
  let normalized = rawRef
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/#.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/[.,;]+$/, "")
    .replace(/\/$/, "");

  if (!normalized || normalized.includes("${") || normalized.includes("*") || normalized.includes("{")) {
    return "";
  }

  return normalized;
}

function shouldSkipFile(relativeFile) {
  return relativeFile === "docs/oam/review-defect-record.md";
}

function shouldSkipReference(relativeFile, line, normalizedRef) {
  if (generatedArtifactPrefixes.some((prefix) => normalizedRef.startsWith(prefix))) {
    return true;
  }

  if (line.includes("当前不创建") || line.includes("只有当") || line.includes('"status": "absent"') || line.includes('"allowedDirectory"')) {
    return true;
  }

  if (line.includes("forbidden") || line.includes("forbid") || line.includes("不得") || line.includes("must not")) {
    return true;
  }

  if (relativeFile === "scripts/check-local-path-references.mjs") {
    return true;
  }

  if (relativeFile.endsWith(".mjs") && (line.includes("existsSync") || line.includes("exists(") || line.includes("existingFilesUnder") || line.includes("simulated"))) {
    return true;
  }

  if (relativeFile.endsWith(".mjs") && line.includes("OfficialSource.cs")) {
    return true;
  }

  return false;
}

function toRepoPath(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function runSelfTest() {
  const fakeFile = "docs/contracts/path-reference-self-test.json";
  const oldArtifactRef = ["artifacts", "finance", "old-result.json"].join("/");
  const textByFile = new Map([
    [
      fakeFile,
      JSON.stringify({
        migration: "infra/db/migrations/__missing_path_reference_self_test.sql",
        generated: "apps/mobile/dist",
        currentOamCheckOutput: "artifacts/oam/checks/",
        currentOamTestOutput: "artifacts/oam/test-results/",
        currentOamEvidenceOutput: "artifacts/oam/evidence/",
        oldArtifact: oldArtifactRef
      })
    ]
  ]);
  const violations = validateLocalPathReferences({
    files: [path.join(repoRoot, fakeFile)],
    textByFile
  });

  const rejected = new Set(violations.map((item) => item.normalized));
  if (
    violations.length !== 2 ||
    !rejected.has("infra/db/migrations/__missing_path_reference_self_test.sql") ||
    !rejected.has(oldArtifactRef)
  ) {
    throw new Error("Local path reference self-test must reject a nonexistent path.");
  }

  console.log("Local path reference self-test: PASS");
}

function runCli() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const violations = validateLocalPathReferences();
  if (violations.length > 0) {
    console.error("Local path reference check: FAIL");
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} -> ${violation.ref} (${violation.reason})`);
    }
    process.exit(1);
  }

  console.log("Local path reference check: PASS");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli();
}
