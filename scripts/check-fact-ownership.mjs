import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));
const registryPath = "docs/rules/v5.5/fact-ownership.yml";
const writeMapPath = "docs/rules/v5.5/fact-write-map.yml";
const defaultOut = ".tmp/v5_5/fact-ownership-report.json";
const requiredFacts = [
  "Room",
  "Bed",
  "BedStatus",
  "RatePlan",
  "Resident",
  "Stay",
  "Charge",
  "Payment",
  "PaymentAllocation",
  "DepositAccount",
  "DepositEntry",
  "CheckoutCase",
  "ServiceTask",
  "PeriodSnapshot",
  "EvidenceObject",
  "EvidenceFile",
  "LedgerEntry",
  "DomainEvent",
  "WorkItem",
  "CommandSubmission",
  "LensSnapshot"
];

const requiredFields = [
  "owner",
  "allowedWriters",
  "forbiddenWriters",
  "allowedReaders",
  "allowedRequesters",
  "domainEvents",
  "ledgerEntries",
  "invariants",
  "appendOnly",
  "correctionPath",
  "projectionOwners"
];

const requiredMapFields = [
  "owner",
  "allowedWriters",
  "forbiddenWriters",
  "tableNames",
  "domainEventNames",
  "commandHandlerNames",
  "storageClasses",
  "sqlWritePatterns",
  "correctionPath",
  "allowedAppendOnlyServices"
];

const scanRoots = [
  "services/core-api/WorkOS.Api/Runtime",
  "services/core-api/WorkOS.Api/Slices",
  "services/core-api/WorkOS.Api/Slices/Persistence",
  "infra/db/migrations",
  "tools/control-plane",
  "tests"
];

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const registrySource = readText(registryPath);
  const registry = parseFactBlocks(registrySource);
  const mapSource = readText(writeMapPath);
  const writeMap = parseWriteMap(mapSource);

  const violations = [
    ...validateRegistry(registry),
    ...validateOwnershipDoc(),
    ...validateWriteMap(writeMap),
    ...validateHandlerOutputGuard()
  ];

  const files = collectScanFiles(scanRoots);
  const findings = scanFactWrites(files, writeMap);
  violations.push(...findings);

  const report = buildReport(violations, writeMap, files.length);
  writeReport(cli.get("out", defaultOut), report);

  if (violations.length > 0) {
    fail("Fact ownership check failed.", violations.map(formatViolation));
  }

  console.log(`Fact ownership check: PASS (deep scanner files=${files.length}, facts=${writeMap.size})`);
}

function readText(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function sourceFile(file) {
  return {
    path: file,
    text: readText(file)
  };
}

function parseFactBlocks(source) {
  const blocks = new Map();
  const factMatches = [...source.matchAll(/^\s*-\s+fact:\s*([A-Za-z0-9_]+)\s*$/gm)];
  for (let index = 0; index < factMatches.length; index += 1) {
    const match = factMatches[index];
    const next = factMatches[index + 1];
    blocks.set(match[1], source.slice(match.index, next?.index ?? source.length));
  }
  return blocks;
}

function parseWriteMap(source) {
  const blocks = parseFactBlocks(source);
  const entries = new Map();
  for (const [fact, block] of blocks) {
    entries.set(fact, {
      fact,
      owner: fieldValue(block, "owner"),
      allowedWriters: fieldList(block, "allowedWriters"),
      forbiddenWriters: fieldList(block, "forbiddenWriters"),
      tableNames: fieldList(block, "tableNames").map(normalizeSqlIdentifier),
      domainEventNames: fieldList(block, "domainEventNames"),
      commandHandlerNames: fieldList(block, "commandHandlerNames"),
      storageClasses: fieldList(block, "storageClasses"),
      sqlWritePatterns: fieldList(block, "sqlWritePatterns"),
      appendOnly: fieldValue(block, "appendOnly") === "true",
      correctionPath: fieldValue(block, "correctionPath"),
      allowedAppendOnlyServices: fieldList(block, "allowedAppendOnlyServices")
    });
  }
  return entries;
}

function fieldValue(block, field) {
  return block.match(new RegExp(`^\\s*${escapeRegExp(field)}:\\s*(.+?)\\s*$`, "m"))?.[1]?.trim() ?? "";
}

function fieldList(block, field) {
  const value = fieldValue(block, field);
  const match = value.match(/^\[(.*)\]$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRegistry(blocks) {
  const violations = [];
  const missingFacts = requiredFacts.filter((fact) => !blocks.has(fact));
  for (const fact of missingFacts) {
    violations.push(registryViolation("P0", fact, `Fact ownership registry missing required fact: ${fact}`));
  }

  for (const fact of requiredFacts) {
    const block = blocks.get(fact) ?? "";
    for (const field of requiredFields) {
      if (!new RegExp(`^\\s*${field}:`, "m").test(block)) {
        violations.push(registryViolation("P0", fact, `${fact} missing ${field}`));
      }
    }
    if (!/forbiddenWriters:.*(mobile-bff|pc-governance-direct-sql|non-owner-slice)/.test(block.replace(/\n/g, " "))) {
      violations.push(registryViolation("P0", fact, `${fact} must explicitly block at least one non-owner writer class`));
    }
    if (!/invariants:\s*\[[^\]]+\]/.test(block)) {
      violations.push(registryViolation("P0", fact, `${fact} must declare at least one invariant`));
    }
  }

  return violations;
}

function validateOwnershipDoc() {
  const ownershipDoc = readText("docs/engineering/02-runtime-ownership-rules.md");
  return [
    "Process managers create WorkItems",
    "Mobile BFF never writes business facts",
    "Corrections are append-only"
  ]
    .filter((requiredTerm) => !ownershipDoc.includes(requiredTerm))
    .map((requiredTerm) => registryViolation("P0", "ownership-doc", `docs/engineering/02-runtime-ownership-rules.md missing: ${requiredTerm}`));
}

function validateWriteMap(writeMap) {
  const violations = [];
  for (const fact of requiredFacts) {
    const entry = writeMap.get(fact);
    if (!entry) {
      violations.push(registryViolation("P0", fact, `Fact write map missing required fact: ${fact}`));
      continue;
    }
    for (const field of requiredMapFields) {
      const value = entry[field];
      if (Array.isArray(value) ? value.length === 0 : !value) {
        violations.push(registryViolation("P0", fact, `Fact write map ${fact} missing ${field}`));
      }
    }
  }
  return violations;
}

function validateHandlerOutputGuard() {
  return validateHandlerOutputGuardSources({
    unitOfWork: sourceFile("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"),
    canonical: sourceFile("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs"),
    program: sourceFile("services/core-api/WorkOS.Api/Program.cs")
  });
}

function validateHandlerOutputGuardSources(sources) {
  const violations = [];
  const requiredRuntimeTerms = [
    "DefinitionRegistry",
    "SliceCommandHandlerRegistry",
    "SliceCommandHandlerDefinition",
    "AllowedFacts",
    "LedgerPolicy",
    "RequiredEvidence",
    "ProjectionOwner",
    "ValidateDeclaredOutputFacts",
    "OutputFactsFor",
    "operations_handler_fact_not_allowed"
  ];
  for (const term of requiredRuntimeTerms) {
    if (!sources.unitOfWork.text.includes(term)) {
      violations.push(handlerGuardViolation(
        sources.unitOfWork.path,
        `Operations runtime handler output fact guard missing term: ${term}`));
    }
  }

  const confirmDefinitionTerms = [
    "ConfirmCommandDefinition",
    "SliceCommandHandlerDefinition",
    "DomainEvent",
    "WorkItem",
    "LedgerEntry",
    "confirm-request.evidenceIds",
    "balanced-ledger-or-none",
    "OperationsRuntimeProjection"
  ];
  for (const term of confirmDefinitionTerms) {
    if (!sources.canonical.text.includes(term)) {
      violations.push(handlerGuardViolation(
        sources.canonical.path,
        `Official confirm handler definition missing term: ${term}`));
    }
  }

  if (!sources.program.text.includes("Register(CanonicalOperationsApiService.ConfirmCommandDefinition")) {
    violations.push(handlerGuardViolation(
      sources.program.path,
      "Official runtime must register confirm handler through ConfirmCommandDefinition, not commandType-only registration."));
  }

  return violations;
}

function collectScanFiles(roots) {
  const files = [];
  const seen = new Set();
  for (const root of roots) {
    const fullRoot = path.join(repoRoot, root);
    if (!fs.existsSync(fullRoot)) continue;
    for (const file of listFiles(fullRoot)) {
      if (/\.(cs|sql|mjs|js|ts|tsx)$/i.test(file)) {
        const relativePath = normalizePath(path.relative(repoRoot, file));
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);
        const text = fs.readFileSync(file, "utf8");
        if (relativePath.startsWith("tests/") && !/fact-owner-writer:/i.test(text)) continue;
        files.push({
          path: relativePath,
          text
        });
      }
    }
  }
  return files;
}

function scanFactWrites(files, writeMap) {
  const violations = [];
  const tableIndex = buildTableIndex(writeMap);
  const eventIndex = buildEventIndex(writeMap);

  for (const file of files) {
    const writer = inferWriter(file.path, file.text);
    const storageNames = classNames(file.path, file.text);
    const sqlWrites = findSqlWrites(file.text);
    for (const write of sqlWrites) {
      const facts = tableIndex.get(write.table) ?? [];
      for (const entry of facts) {
        const allowed = isAllowedWrite(entry, writer, storageNames);
        const appendOnlyUpdate = entry.appendOnly &&
          ["update", "delete"].includes(write.operation) &&
          !entry.allowedAppendOnlyServices.includes(writer);

        if (!allowed || appendOnlyUpdate) {
          violations.push(writeViolation({
            id: appendOnlyUpdate ? "fact.append_only.mutated" : "fact.non_owner_write",
            fact: entry.fact,
            writer,
            owner: entry.owner,
            file: file.path,
            line: lineForOffset(file.text, write.index),
            operation: write.operation,
            target: write.table,
            allowedPath: allowedPath(entry),
            message: appendOnlyUpdate
              ? `${writer} attempted ${write.operation} on append-only fact ${entry.fact}`
              : `${writer} is not allowed to ${write.operation} ${entry.fact}`
          }));
        }
      }
    }

    for (const event of findEventWrites(file.text, eventIndex)) {
      const facts = eventIndex.get(event.event.toLowerCase()) ?? [];
      for (const entry of facts) {
        const allowed = isAllowedWrite(entry, writer, storageNames);
        if (!allowed) {
          violations.push(writeViolation({
            id: "fact.non_owner_event_write",
            fact: entry.fact,
            writer,
            owner: entry.owner,
            file: file.path,
            line: lineForOffset(file.text, event.index),
            operation: "event-token",
            target: event.event,
            allowedPath: allowedPath(entry),
            message: `${writer} is not allowed to emit ${event.event} for ${entry.fact}`
          }));
        }
      }
    }
  }

  return violations;
}

function buildTableIndex(writeMap) {
  const index = new Map();
  for (const entry of writeMap.values()) {
    for (const table of entry.tableNames) {
      const key = normalizeSqlIdentifier(table);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  return index;
}

function buildEventIndex(writeMap) {
  const index = new Map();
  for (const entry of writeMap.values()) {
    for (const event of entry.domainEventNames) {
      const key = event.toLowerCase();
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  return index;
}

function findSqlWrites(text) {
  const writes = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const pattern = /\b(insert\s+into|update|delete\s+from)\s+("?[\w.]+"?)/gi;
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    const prefix = normalized.slice(Math.max(0, match.index - 40), match.index).toLowerCase();
    if (prefix.includes("before ") || prefix.includes("after ") || prefix.includes("for ")) continue;
    const line = lineTextAtOffset(normalized, match.index);
    if (line.includes("new[]") || line.includes("string[]")) continue;
    writes.push({
      operation: match[1].toLowerCase().startsWith("insert")
        ? "insert"
        : match[1].toLowerCase().startsWith("delete")
          ? "delete"
          : "update",
      table: normalizeSqlIdentifier(match[2]),
      index: match.index
    });
  }
  return writes;
}

function findEventWrites(text, eventIndex) {
  const events = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let offset = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (line.includes("new[]") || line.includes("string[]")) {
      offset += line.length + 1;
      continue;
    }
    const looksLikeWrite = /\b(emit|append|add|insert|event_type|domainevent|record)\b/i.test(line) &&
      !/\b(assert|contains|select|where|isowner|lenscontains)\b/i.test(line);
    if (looksLikeWrite) {
      for (const event of eventIndex.keys()) {
        if (lower.includes(event)) {
          events.push({ event, index: offset + lower.indexOf(event) });
        }
      }
    }
    offset += line.length + 1;
  }
  return events;
}

function inferWriter(filePath, text) {
  const marker = text.match(/fact-owner-writer:\s*([A-Za-z0-9_.-]+)/i);
  if (marker) return marker[1];

  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("mobile") || normalized.includes("bff")) return "mobile-bff";
  if (normalized.endsWith(".sql")) return "migration";
  if (normalized.includes("/slices/accommodation/depositledger/")) return "finance.deposit-ledger";
  if (normalized.includes("/slices/accommodation/paymentledger/")) return "finance.payment-ledger";
  if (normalized.includes("/slices/accommodation/periodanalytics/")) return "accommodation.period-analytics";
  if (normalized.includes("/slices/accommodation/resourcesetup/")) return "accommodation.resource";
  if (normalized.includes("/slices/accommodation/servicetask/")) return "service-task";
  if (normalized.includes("/slices/accommodation/staylifecycle/")) return "accommodation.stay";
  if (normalized.includes("/slices/persistence/sliceaggregatestorage")) return "operations-runtime";
  if (normalized.includes("runtimecorrectioncenter") || normalized.includes("correctioncenter")) return "correction-center-append-only";
  if (normalized.includes("reconciliation") || normalized.includes("bankstatement")) return "reconciliation";
  if (normalized.includes("checkout")) return "checkout-settlement";
  if (normalized.includes("servicetask")) return "service-task";
  if (normalized.includes("evidence")) return "evidence";
  if (normalized.includes("processmanager")) return "process-manager";
  if (normalized.includes("projection")) return "official-projector";
  if (normalized.includes("controlplane") || normalized.includes("control-plane")) return "control-plane";
  if (normalized.includes("operations") || normalized.includes("workspacecardcompatibilityadapter")) return "operations-runtime";
  if (normalized.includes("ledger") || normalized.includes("balancedmoneykernel")) return "runtime-ledger";
  if (normalized.includes("tests/") || normalized.includes("tests\\")) return "test-fixture";
  return "unknown-runtime-writer";
}

function classNames(filePath, text) {
  const names = new Set([path.basename(filePath, path.extname(filePath))]);
  for (const match of text.matchAll(/\b(?:class|record|interface)\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]);
  }
  return names;
}

function isAllowedWrite(entry, writer, storageNames) {
  return entry.allowedWriters.includes(writer) ||
    entry.allowedAppendOnlyServices.includes(writer) ||
    entry.storageClasses.some((storage) => storageNames.has(storage));
}

function allowedPath(entry) {
  return [
    `owner=${entry.owner}`,
    `allowedWriters=${entry.allowedWriters.join("|")}`,
    `storageClasses=${entry.storageClasses.join("|")}`,
    `correctionPath=${entry.correctionPath}`
  ].join("; ");
}

function buildReport(violations, writeMap, scannedFileCount) {
  return {
    generated_at_utc: new Date().toISOString(),
    status: violations.length > 0 ? "failed" : "passed",
    scanned_file_count: scannedFileCount,
    fact_count: writeMap.size,
    violation_count: violations.length,
    violations
  };
}

function writeReport(outFile, report) {
  const full = path.join(repoRoot, outFile);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function registryViolation(severity, fact, message) {
  return {
    severity,
    id: "fact.registry.invalid",
    fact,
    writer: "registry",
    file: registryPath,
    line: 1,
    owner: null,
    allowedPath: null,
    message
  };
}

function handlerGuardViolation(file, message) {
  return {
    severity: "P0",
    id: "fact.handler_output_guard_missing",
    fact: "handler-output-fact-ownership",
    writer: "operations-runtime",
    file,
    line: 1,
    owner: "operations-runtime",
    allowedPath: "DefinitionRegistry -> SliceCommandHandlerRegistry -> handler output fact validation",
    message
  };
}

function writeViolation(input) {
  return {
    severity: "P0",
    ...input
  };
}

function formatViolation(item) {
  return `${item.severity} ${item.id}: ${item.message} (${item.file}:${item.line}, fact=${item.fact}, writer=${item.writer}, owner=${item.owner ?? "unknown"}, allowed=${item.allowedPath ?? "n/a"})`;
}

function normalizeSqlIdentifier(value) {
  return value
    .replace(/"/g, "")
    .split(".")
    .pop()
    .trim()
    .toLowerCase();
}

function lineForOffset(text, index) {
  return text.slice(0, index).split(/\r\n|\r|\n/).length;
}

function lineTextAtOffset(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["bin", "obj", "node_modules", ".git"].includes(entry.name)) continue;
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

function runSelfTest() {
  const writeMap = new Map([
    ["DepositEntry", {
      fact: "DepositEntry",
      owner: "finance.deposit-ledger",
      allowedWriters: ["finance.deposit-ledger"],
      forbiddenWriters: ["mobile-bff", "checkout-settlement-direct-write"],
      tableNames: ["deposit_transactions"],
      domainEventNames: ["DepositReceived", "Accommodation.DepositReceived"],
      commandHandlerNames: ["DepositReceipt"],
      storageClasses: ["OperationsUnitOfWork"],
      sqlWritePatterns: ["insert into deposit_transactions"],
      appendOnly: true,
      correctionPath: "correction-center",
      allowedAppendOnlyServices: ["correction-center-append-only"]
    }],
    ["Payment", {
      fact: "Payment",
      owner: "finance.payment-ledger",
      allowedWriters: ["finance.payment-ledger"],
      forbiddenWriters: ["mobile-bff", "reconciliation-direct-confirm"],
      tableNames: ["hostel_payments"],
      domainEventNames: ["PaymentConfirmed", "Accommodation.PaymentConfirmed"],
      commandHandlerNames: ["PaymentReceipt"],
      storageClasses: ["OperationsUnitOfWork"],
      sqlWritePatterns: ["insert into hostel_payments"],
      appendOnly: true,
      correctionPath: "correction-center",
      allowedAppendOnlyServices: ["correction-center-append-only"]
    }],
    ["BedStatus", {
      fact: "BedStatus",
      owner: "accommodation.resource",
      allowedWriters: ["accommodation.resource"],
      forbiddenWriters: ["service-task"],
      tableNames: ["accommodation_beds"],
      domainEventNames: ["BedStatusChanged"],
      commandHandlerNames: ["ResourceSetup"],
      storageClasses: ["OperationsUnitOfWork"],
      sqlWritePatterns: ["update accommodation_beds"],
      appendOnly: false,
      correctionPath: "resource-workitem",
      allowedAppendOnlyServices: []
    }]
  ]);

  const badFiles = [
    virtualFile("services/core-api/WorkOS.Api/Runtime/MobileBffFake.cs", "// fact-owner-writer: mobile-bff\ninsert into deposit_transactions(transaction_id) values ('x');"),
    virtualFile("infra/db/migrations/999_bad.sql", "-- fact-owner-writer: checkout-settlement-direct-write\nupdate deposit_transactions set amount = 1;"),
    virtualFile("services/core-api/WorkOS.Api/Runtime/ServiceTaskFake.cs", "// fact-owner-writer: service-task\nupdate accommodation_beds set status = 'blocked';"),
    virtualFile("services/core-api/WorkOS.Api/Runtime/ReconciliationFake.cs", "// fact-owner-writer: reconciliation-direct-confirm\nEmit(\"PaymentConfirmed\");")
  ];
  const bad = scanFactWrites(badFiles, writeMap);
  assertSelfTest(bad.some((item) => item.fact === "DepositEntry" && item.writer === "mobile-bff"), "mobile-bff deposit write must fail");
  assertSelfTest(bad.some((item) => item.id === "fact.append_only.mutated"), "append-only update must fail");
  assertSelfTest(bad.some((item) => item.fact === "BedStatus" && item.writer === "service-task"), "service-task BedStatus write must fail");
  assertSelfTest(bad.some((item) => item.fact === "Payment" && item.writer === "reconciliation-direct-confirm"), "reconciliation PaymentConfirmed must fail");

  const goodFiles = [
    virtualFile("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs", "public class OperationsUnitOfWork {}\ninsert into deposit_transactions(transaction_id) values ('x');"),
    virtualFile("services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs", "public class RuntimeCorrectionCenterStorage {}\ninsert into deposit_transactions(transaction_id) values ('x');")
  ];
  const good = scanFactWrites(goodFiles, writeMap);
  assertSelfTest(good.length === 0, `legal UoW/correction paths must pass: ${good.map(formatViolation).join("; ")}`);

  const goodHandlerGuard = validateHandlerOutputGuardSources({
    unitOfWork: virtualFile(
      "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs",
      "DefinitionRegistry SliceCommandHandlerRegistry SliceCommandHandlerDefinition AllowedFacts LedgerPolicy RequiredEvidence ProjectionOwner ValidateDeclaredOutputFacts OutputFactsFor operations_handler_fact_not_allowed"),
    canonical: virtualFile(
      "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
      "ConfirmCommandDefinition SliceCommandHandlerDefinition DomainEvent WorkItem LedgerEntry confirm-request.evidenceIds balanced-ledger-or-none OperationsRuntimeProjection"),
    program: virtualFile(
      "services/core-api/WorkOS.Api/Program.cs",
      "Register(CanonicalOperationsApiService.ConfirmCommandDefinition")
  });
  assertSelfTest(goodHandlerGuard.length === 0, `valid handler output guard terms must pass: ${goodHandlerGuard.map(formatViolation).join("; ")}`);

  const badHandlerGuard = validateHandlerOutputGuardSources({
    unitOfWork: virtualFile(
      "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs",
      "SliceCommandHandlerDefinition AllowedFacts"),
    canonical: virtualFile(
      "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
      "ConfirmCommandDefinition DomainEvent"),
    program: virtualFile(
      "services/core-api/WorkOS.Api/Program.cs",
      "Register(CanonicalOperationsApiService.ConfirmCommandType")
  });
  assertSelfTest(
    badHandlerGuard.some((item) => item.id === "fact.handler_output_guard_missing"),
    "missing handler output guard must fail self-test");

  console.log("Fact ownership deep scanner self-test: PASS");
}

function virtualFile(filePath, text) {
  return { path: filePath, text };
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(`check-fact-ownership self-test failed: ${message}`);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=", 2);
    if (value === undefined) {
      flags.add(key);
    } else {
      values.set(key, value);
    }
  }
  return {
    has: (key) => flags.has(key) || values.has(key),
    get: (key, fallback) => values.get(key) ?? fallback
  };
}

main();
