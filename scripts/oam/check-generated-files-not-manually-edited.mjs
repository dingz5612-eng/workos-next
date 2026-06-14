import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workos-generated-check-"));
const reportPath = "artifacts/oam/checks/generated-files-not-manually-edited-result.json";
const generatedFiles = [
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];
const failures = [];

try {
  execFileSync(process.execPath, ["scripts/oam/compile-current-kernel-graph.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_KERNEL_COMPILE_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });

  for (const file of generatedFiles) {
    const actualPath = path.join(root, file);
    const expectedPath = path.join(tempRoot, file);
    if (!fs.existsSync(actualPath)) {
      failures.push(`${file} is missing.`);
      continue;
    }
    if (!fs.existsSync(expectedPath)) {
      failures.push(`${file} was not produced by compiler.`);
      continue;
    }
    const actual = fs.readFileSync(actualPath, "utf8").replace(/\r\n/g, "\n");
    const expected = fs.readFileSync(expectedPath, "utf8").replace(/\r\n/g, "\n");
    if (actual !== expected) {
      failures.push(`${file} differs from compiler output; regenerate instead of editing generated files manually.`);
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

writeReport();

if (failures.length > 0) {
  console.error("Generated files manual edit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated files manual edit check: PASS");

function writeReport() {
  const report = {
    version: "oam.generated-files-not-manually-edited-result.v1",
    checkedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "passed" : "failed",
    generatedFileCount: generatedFiles.length,
    failures,
    generatedFiles: generatedFiles.map((file) => ({
      path: file,
      present: fs.existsSync(path.join(root, file)),
      doNotEditVerifiedBy: "scripts/oam/check-generated-files-not-manually-edited.mjs"
    })),
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    runtimeConsumptionReady: false
  };
  fs.mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
  fs.writeFileSync(path.join(root, reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
