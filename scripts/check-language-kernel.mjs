import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const requiredLanguages = ["zh-CN", "ru-RU", "ky-KG"];

const contract = readJson("docs/contracts/language/language-contract.json");
const domainTerms = readJson("docs/contracts/language/domain-term-catalog.json");
const errorCopy = readJson("docs/contracts/language/error-code-copy.json");
const fieldLabels = readJson("docs/contracts/language/field-label-catalog.json");
const surfaceCopy = readJson("docs/contracts/language/surface-copy-catalog.json");
const searchSynonyms = readJson("docs/contracts/language/search-synonyms.json");
const fieldRefs = readJson("docs/contracts/definition/field-contract-refs.json");

checkContract();
checkRuntimeBindings();
checkCatalogLanguages();
checkFieldCoverage();
checkHighRiskReasons();

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Language Kernel check failed.");
}

console.log("Language Kernel check: PASS");

function checkContract() {
  if (contract.version !== "oam.language-contract.v1") failures.push("language-contract version mismatch.");
  if (contract.status !== "authoritative-read-side-kernel") failures.push("language-contract must be current authoritative read-side kernel.");
  if ("blockedAdapters" in contract) failures.push("language-contract must not retain blockedAdapters.");
  assertSameLanguages(contract.supportedLanguages, "language-contract.supportedLanguages");
  for (const file of Object.values(contract.authoritativeCatalogs || {})) {
    if (!exists(file)) failures.push(`language-contract references missing catalog: ${file}.`);
  }
  for (const file of Object.values(contract.runtimeBindings || {})) {
    if (!exists(file)) failures.push(`language-contract references missing runtime binding: ${file}.`);
  }
}

function checkRuntimeBindings() {
  const i18n = read("apps/mobile/src/i18n.js");
  const match = i18n.match(/const\s+languages\s*=\s*\[([^\]]+)\]/);
  if (!match) {
    failures.push("apps/mobile/src/i18n.js must declare languages.");
  } else {
    const frontendLanguages = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    assertSameLanguages(frontendLanguages, "frontend i18n languages");
  }

  for (const [file, label] of [
    ["services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs", "RuntimeQueryService.Envelope"],
    ["services/core-api/WorkOS.Api/Program.cs", "DemoBootstrap.supportedLanguages"]
  ]) {
    const text = read(file);
    for (const language of requiredLanguages) {
      if (!text.includes(`"${language}"`)) failures.push(`${label} missing ${language}.`);
    }
  }
}

function checkCatalogLanguages() {
  for (const term of domainTerms.terms || []) {
    assertLocalized(term.copy, `domain term ${term.termId}`);
  }
  for (const code of errorCopy.codes || []) {
    assertLocalized(code.copy, `error code ${code.code}`);
  }
  for (const field of fieldLabels.fields || []) {
    assertLocalized(field.label, `field label ${field.fieldId}`);
  }
  for (const copy of surfaceCopy.copies || []) {
    assertLocalized(copy.copy, `surface copy ${copy.copyId}`);
  }
  for (const synonym of searchSynonyms.synonyms || []) {
    for (const language of requiredLanguages) {
      if (!Array.isArray(synonym.languages?.[language]) || synonym.languages[language].length === 0) {
        failures.push(`search synonym ${synonym.canonical} missing ${language}.`);
      }
    }
  }
}

function checkFieldCoverage() {
  const labelIds = new Set((fieldLabels.fields || []).map((field) => field.fieldId));
  const requiredFieldIds = new Set((fieldRefs.refs || []).flatMap((ref) => ref.requiredFieldIds || []));
  for (const fieldId of requiredFieldIds) {
    if (!labelIds.has(fieldId)) failures.push(`field-label-catalog missing required field: ${fieldId}.`);
  }
}

function checkHighRiskReasons() {
  const copyIds = new Set((surfaceCopy.copies || []).map((copy) => copy.copyId));
  for (const copyId of [
    "admission.paymentConfirmation.reason",
    "admission.depositConfirmation.reason",
    "admission.depositRefund.reason",
    "admission.periodClose.reason",
    "admission.ledgerCorrection.reason",
    "permission.explain.title",
    "permission.reason.roleNotAllowed",
    "permission.reason.capabilityMissing",
    "permission.reason.deviceUntrusted",
    "permission.next.contactOwner",
    "permission.next.switchAllowedSurface",
    "semantic.summary.notConfirmBasis",
    "semantic.receipt.notProductionRelease",
    "semantic.amountBasis.notFinanceResult",
    "semantic.managementCockpit.readonly",
    "semantic.financeTruth.explain"
  ]) {
    if (!copyIds.has(copyId)) failures.push(`surface-copy-catalog missing high-risk reason ${copyId}.`);
  }
  const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
  for (const copyKey of [
    "permission.reason.role_surface_not_allowed",
    "permission.reason.capability_missing",
    "permission.reason.device_not_trusted",
    "permission.next.contactOwner",
    "permission.next.switchAllowedSurface"
  ]) {
    if (!operationCopy.includes(`"${copyKey}"`)) failures.push(`operation copy missing Language Kernel key ${copyKey}.`);
  }
  for (const forbidden of ["写入 DomainEvent", "LedgerEntry 后", "ProcessManager 会", "运行时 Lens", "slice 状态不允许"]) {
    if (operationCopy.includes(forbidden)) failures.push(`ordinary user copy exposes internal runtime term: ${forbidden}.`);
  }
}

function assertLocalized(value, label) {
  for (const language of requiredLanguages) {
    if (typeof value?.[language] !== "string" || value[language].trim().length === 0) {
      failures.push(`${label} missing ${language}.`);
    }
  }
}

function assertSameLanguages(actual = [], label) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...requiredLanguages].sort();
  if (actualSorted.length !== expectedSorted.length || actualSorted.some((value, index) => value !== expectedSorted[index])) {
    failures.push(`${label} must exactly match ${requiredLanguages.join(", ")}.`);
  }
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}
