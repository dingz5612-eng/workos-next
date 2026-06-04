import fs from "node:fs";

const requiredFiles = [
  "README.md",
  "docs/architecture/WORKOS_ENGINEERING_RULES.md",
  "docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md",
  "docs/oam-acf/00-oam-acf-architecture.md",
  "docs/oam-acf/01-rule-and-state-authority.md",
  "docs/oam-acf/02-architecture-term-policy.md"
];

const failures = [];
const fileText = new Map(requiredFiles.map((file) => [file, read(file)]));

requireText("README.md", "docs/engineering/00-rule-authority.md");
requireText("README.md", "docs/rules/v5.5/rule-authority.yml");
requireText("README.md", "docs/architecture/*");
requireText("README.md", "compatibility");
requireText("README.md", "OAM-ACF v8");
requireText("README.md", "Operations Runtime");
requireText("README.md", "ProjectionRuntime");
requireText("README.md", "current-state");
forbidText("README.md", "The center model is `IntentWorkspaceProjection + WorkspaceCardProjection`");

for (const file of [
  "docs/architecture/WORKOS_ENGINEERING_RULES.md",
  "docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md"
]) {
  requireText(file, "compatibility");
  requireText(file, "docs/engineering/00-rule-authority.md");
  requireText(file, "docs/rules/v5.5/rule-authority.yml");
  requireText(file, "OAM-ACF v8");
  requireText(file, "Operations Runtime");
  requireText(file, "ProjectionRuntime");
  requireText(file, "Workspace/Card");
}

for (const file of requiredFiles.filter((file) => file.startsWith("docs/oam-acf/"))) {
  requireText(file, "OAM-ACF");
}

for (const [file, text] of fileText) {
  if (/Day-2\s+started/i.test(text)) failures.push(`${file}: must not contain Day-2 started wording.`);
  if (/Dormitory\s+L2\s+ready/i.test(text)) failures.push(`${file}: must not contain Dormitory L2 ready wording.`);
  if (/Business\s+Production\s+allowed/i.test(text)) failures.push(`${file}: must not contain Business Production allowed wording.`);
  if (/ProjectionRuntime\s+is\s+(the\s+)?(target\s+)?top-level architecture/i.test(text)) {
    failures.push(`${file}: ProjectionRuntime must not be described as top-level architecture.`);
  }
  if (/Workspace\/Card\s+is\s+(the\s+)?(new business extension point|primary extension model)/i.test(text)) {
    failures.push(`${file}: Workspace/Card must not be described as a new business extension point.`);
  }
  if (/Workspace\/Card\s+(remains\s+)?(a\s+)?compatibility wrapper/i.test(text)) {
    failures.push(`${file}: Workspace/Card must not be described as a current compatibility wrapper; it is projection/display input only.`);
  }
  if (/old(er)?\s+Workspace\/Card\s+(prepare\s+and\s+confirm\s+)?(routes|endpoints).*(remain reachable|remain supported|available for compatibility|compatibility layer only)/i.test(text)) {
    failures.push(`${file}: retired Workspace/Card write routes must not be described as reachable or supported.`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-ACF architecture term check failed.");
}

console.log("OAM-ACF architecture term check: PASS");

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing required file.`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function requireText(file, needle) {
  if (!fileText.get(file)?.includes(needle)) failures.push(`${file}: missing required text '${needle}'.`);
}

function forbidText(file, needle) {
  if (fileText.get(file)?.includes(needle)) failures.push(`${file}: forbidden text remains '${needle}'.`);
}
