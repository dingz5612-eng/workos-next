$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Error $message
  exit 1
}

function Assert-NoMatches($paths, $pattern, $message, $excludePattern = $null) {
  $matches = rg -n $pattern $paths 2>$null
  if ($LASTEXITCODE -eq 1) {
    return
  }
  if ($LASTEXITCODE -ne 0) {
    Fail "rg failed while checking: $message"
  }

  if ($excludePattern) {
    $matches = $matches | Where-Object { $_ -notmatch $excludePattern }
  }

  if ($matches) {
    $matches
    Fail $message
  }
}

Assert-NoMatches @("apps", "services", "tests", "docs/product", "docs/ux") "scenarioFlows|data-task|data-scenario|taskView|objectView" "Old page/task/object model terms must not remain in the active baseline."
Assert-NoMatches @("docs") "local scaffold currently targets net9\.0" "Stale .NET 9 scaffold documentation is forbidden."
Assert-NoMatches @("services") "obsolete|legacy|temp|fallback|mock-only" "Runtime services must not carry obsolete, legacy, temp, fallback, or mock-only code."
Assert-NoMatches @("apps", "services", "tests") "mock-only" "Production runtime and mobile code must not reference mock-only files or flows."

$legacyFileNames = Get-ChildItem -Recurse -File -Path "apps", "services", "tests" |
  Where-Object { $_.Name -match "(legacy|obsolete|deprecated|mock-only|fallback)" }
if ($legacyFileNames) {
  $legacyFileNames | ForEach-Object { $_.FullName }
  Fail "Legacy or mock-only file names are not allowed in the active baseline."
}

$cleanBaselineNode = @'
const fs = require("node:fs");
const path = require("node:path");

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

function walk(dir, predicate, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, output);
    } else if (predicate(fullPath)) {
      output.push(path.normalize(fullPath));
    }
  }
  return output;
}

const mobileRoot = path.normalize("apps/mobile/src");
const jsFiles = walk(mobileRoot, (file) => file.endsWith(".js"));
const entryFiles = new Set([
  path.normalize("apps/mobile/src/main.js")
]);
const importedFiles = new Set(entryFiles);

for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/import\s+(?:[^"']+?\s+from\s+)?["'](.+?)["']/g)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    let target = path.normalize(path.join(path.dirname(file), specifier));
    if (!path.extname(target)) target += ".js";
    if (fs.existsSync(target)) importedFiles.add(target);
  }
}

const unreferencedJs = jsFiles.filter((file) => !importedFiles.has(file));
if (unreferencedJs.length > 0) {
  fail("Unreferenced mobile JS files are not allowed in the clean baseline.", unreferencedJs);
}

const allJsExceptI18nCopy = jsFiles
  .filter((file) => !file.includes(`${path.sep}i18n${path.sep}`))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const i18nFiles = jsFiles.filter((file) => file.includes(`${path.sep}i18n${path.sep}`));
const i18nKeys = new Set();
for (const file of i18nFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/"([A-Za-z][A-Za-z0-9]+)"\s*:/g)) {
    i18nKeys.add(match[1]);
  }
}

const unusedI18nKeys = [...i18nKeys].filter((key) => {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${key}(?![A-Za-z0-9])`);
  return !pattern.test(allJsExceptI18nCopy);
});
if (unusedI18nKeys.length > 0) {
  fail("Unused i18n keys are not allowed in the clean baseline.", unusedI18nKeys);
}

const cssFiles = walk(mobileRoot, (file) => file.endsWith(".css"));
const appSource = walk(mobileRoot, (file) => file.endsWith(".js") || file.endsWith(".html"))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const cssClasses = new Set();
for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)) {
    cssClasses.add(match[1]);
  }
}

const allowedUnusedCss = new Set([
  "next-card",
  "loop-steps"
]);
const unusedCssClasses = [...cssClasses].filter((className) => !appSource.includes(className) && !allowedUnusedCss.has(className));
if (unusedCssClasses.length > 0) {
  fail("Unused CSS classes are not allowed unless explicitly allowlisted.", unusedCssClasses);
}

console.log("Clean baseline JavaScript/i18n/CSS checks: PASS");
'@

$cleanBaselineNode | node -
if ($LASTEXITCODE -ne 0) {
  Fail "Clean baseline JavaScript/i18n/CSS checks failed."
}

Write-Host "Clean baseline gate: PASS"
