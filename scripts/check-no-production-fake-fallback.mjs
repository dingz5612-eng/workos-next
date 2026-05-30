#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

const banned = [
  literal("张三"),
  literal("A301"),
  literal("A301-02"),
  numericLiteral("3000"),
  numericLiteral("9300"),
  literal("PAY-2026-009"),
  literal("unknown-room"),
  literal("unknown-bed"),
  literal("demoQueue"),
  literal("workspaceProjections fallback"),
  literal("local fixture fallback"),
  literal("fake evidence"),
  literal("mock payment"),
  literal("hardcoded room"),
  literal("hardcoded resident")
];

const productionRoots = [
  "apps/mobile/src",
  "apps/mobile/dist",
  "services/core-api/WorkOS.Api"
];

const ignoredSegments = new Set([
  "__tests__",
  "devFixtures",
  "bin",
  "obj",
  "node_modules",
  "dist"
]);

if (args.has("--self-test")) {
  runSelfTest();
} else {
  const roots = productionRoots.map((entry) => path.join(repoRoot, entry));
  if (args.has("--dist") && !productionRoots.includes("apps/mobile/dist")) {
    roots.push(path.join(repoRoot, "apps/mobile/dist"));
  }

  const violations = scanRoots(roots);
  if (violations.length) {
    printViolations(violations);
    process.exit(1);
  }

  console.log(`no-production-fake-fallback: PASS (${roots.map((root) => path.relative(repoRoot, root)).join(", ")})`);
}

function literal(value) {
  return { label: value, pattern: new RegExp(escapeRegExp(value), "u") };
}

function numericLiteral(value) {
  return { label: value, pattern: new RegExp(`(?<!\\d)${escapeRegExp(value)}(?!\\d)`, "u") };
}

function scanRoots(roots) {
  const files = roots.flatMap((root) => collectFiles(root));
  return scanFiles(files);
}

function collectFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const stat = fs.statSync(root);
  if (stat.isFile()) {
    return isTextFile(root) ? [root] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredSegments.has(entry.name)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }
    if (entry.isFile() && isTextFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFiles(files) {
  const violations = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const term of banned) {
      const match = term.pattern.exec(content);
      if (!match) continue;
      violations.push({
        file,
        term: term.label,
        line: lineNumber(content, match.index)
      });
    }
  }
  return violations;
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workos-fake-fallback-check-"));
  try {
    const productionDir = path.join(tempRoot, "apps/mobile/src");
    fs.mkdirSync(productionDir, { recursive: true });
    const badFile = path.join(productionDir, "badProductionFallback.js");
    fs.writeFileSync(badFile, "export const fallback = 'A301-02';\n", "utf8");
    const violations = scanRoots([productionDir]);
    if (!violations.some((item) => item.file === badFile && item.term === "A301-02")) {
      console.error("no-production-fake-fallback self-test did not catch the simulated production fake literal.");
      process.exit(1);
    }
    console.log("no-production-fake-fallback self-test: PASS");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function printViolations(violations) {
  console.error("Production fake fallback literals are forbidden in runtime paths:");
  for (const violation of violations) {
    console.error(`- ${path.relative(repoRoot, violation.file)}:${violation.line} contains ${violation.term}`);
  }
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/u).length;
}

function isTextFile(file) {
  return /\.(cs|css|html|js|json|mjs|ts|tsx|jsx|md|ps1|sql|yml|yaml)$/iu.test(file);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
