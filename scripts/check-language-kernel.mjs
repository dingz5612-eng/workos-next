import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const proofPath = "artifacts/oam/proofs/language/language-glossary-generated-proof.json";
const failures = [];
const requiredLanguages = ["zh-CN", "ru-RU", "ky-KG"];
const requiredInformationAreas = [
  "objectKind",
  "resultType",
  "metric",
  "dashboard",
  "lineage",
  "readiness",
  "tokenizer",
  "searchIntent",
  "permissionReason",
  "admissionReason",
  "evidenceReason",
  "financeTruthReason",
  "noGoReason"
];
const requiredInformationCopyKeys = [
  "resultType.workItemList",
  "resultType.metricValue",
  "resultType.reportDataset",
  "metric.dormitory.resourceReadiness.name",
  "metric.finance.receivedAmount.name",
  "metric.governance.blockerAging.name",
  "dashboard.widget.resourceReadiness.title",
  "dashboard.widget.financeReceived.title",
  "lineage.sourceFacts.title",
  "lineage.freshness.title",
  "readiness.noGo.title",
  "searchIntent.findRoom.label",
  "searchIntent.openWorkItem.label",
  "admission.reason.financeReviewRequired",
  "evidence.reason.proofOnly",
  "financeTruth.reason.amountBasisReviewedRequired",
  "noGo.reason.ciGreenNotGo"
];
const requiredCanonicalKeys = [
  "surface.permission.title",
  "surface.permission.reason.actorSessionRequired",
  "surface.permission.reason.roleSurfaceNotAllowed",
  "surface.permission.reason.capabilityMissing",
  "surface.permission.reason.deviceNotTrusted",
  "surface.permission.reason.pcSurfaceRequiresPcDevice",
  "surface.permission.reason.releaseSurfaceRestricted",
  "surface.permission.reason.businessAdmissionBlocked",
  "surface.permission.reason.pilotScopeBlocked",
  "surface.permission.nextStep.contactOwner",
  "surface.permission.nextStep.switchAllowedSurface",
  "surface.permission.owner.releaseOwner",
  "surface.permission.owner.admin",
  "surface.permission.owner.finance",
  "surface.permission.owner.manager",
  "surface.permission.owner.operator",
  "surface.kind.workItem",
  "surface.kind.truthRecord",
  "surface.kind.summary",
  "surface.kind.receipt",
  "surface.kind.blocker",
  "surface.kind.readonlyRecord",
  "explain.visibleNotConfirm",
  "explain.summaryNotConfirm",
  "explain.receiptNotProduction",
  "explain.businessBasisNotFinancialTruth",
  "explain.managementReadonly",
  "explain.financeTruthRequired",
  "truth.owner.sharedGovernance",
  "truth.owner.financeTruth",
  "truth.owner.moneyKernel",
  "truth.owner.projectionKernel",
  "truth.owner.accommodation",
  "truth.owner.identity",
  "truth.owner.maintenance",
  "operations.error.safe.403",
  "operations.error.safe.409",
  "operations.error.safe.422",
  "operations.error.safe.generic"
];
const requiredAliasKeys = {
  "permission.reason.actor_session_required": "surface.permission.reason.actorSessionRequired",
  "permission.reason.role_surface_not_allowed": "surface.permission.reason.roleSurfaceNotAllowed",
  "permission.reason.capability_missing": "surface.permission.reason.capabilityMissing",
  "permission.reason.device_not_trusted": "surface.permission.reason.deviceNotTrusted",
  "permission.reason.pc_surface_requires_pc_device": "surface.permission.reason.pcSurfaceRequiresPcDevice",
  "permission.reason.release_surface_restricted": "surface.permission.reason.releaseSurfaceRestricted",
  "permission.reason.business_line_admission_blocked": "surface.permission.reason.businessAdmissionBlocked",
  "permission.reason.pilot_scope_blocked": "surface.permission.reason.pilotScopeBlocked"
};

const contract = readJson("docs/contracts/language/language-contract.json");
const domainTerms = readJson("docs/contracts/language/domain-term-catalog.json");
const errorCopy = readJson("docs/contracts/language/error-code-copy.json");
const fieldLabels = readJson("docs/contracts/language/field-label-catalog.json");
const objectKinds = readJson("docs/contracts/language/object-kind-catalog.json");
const surfaceCopy = readJson("docs/contracts/language/surface-copy-catalog.json");
const searchSynonyms = readJson("docs/contracts/language/search-synonyms.json");
const multilingualCopy = readJson("docs/contracts/language/multilingual-copy-catalog.json");
const glossary = readJson("docs/contracts/language/glossary.json");
const tokenizerDictionary = readJson("docs/contracts/language/tokenizer-dictionary.json");
const searchIntentDictionary = readJson("docs/contracts/language/search-intent-dictionary.json");
const internalTermFirewall = readJson("docs/contracts/language/internal-term-firewall.json");
const aliasRegistry = readJson("docs/contracts/language/alias-registry.json");
const fieldRefs = readJson("docs/contracts/definition/field-contract-refs.json");
const { operationCopy } = await import(pathToFileURL(path.join(root, "apps/mobile/src/i18n/operationCopy.js")).href);
const { shellCopy } = await import(pathToFileURL(path.join(root, "apps/mobile/src/i18n/shellCopy.js")).href);

checkContract();
checkRuntimeBindings();
checkCatalogLanguages();
checkFieldCoverage();
checkHighRiskReasons();
checkCanonicalSurfaceCopy();
checkInformationLanguageKernel();
writeProof();

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
  for (const area of requiredInformationAreas) {
    if (!(contract.informationLanguageKernel?.coverage ?? []).includes(area)) {
      failures.push(`information language kernel missing coverage area ${area}.`);
    }
  }
  if (contract.informationLanguageKernel?.tokenizerTruthInferenceAllowed !== false) {
    failures.push("tokenizer must not infer business facts.");
  }
  if (contract.informationLanguageKernel?.searchIntentTruthInferenceAllowed !== false) {
    failures.push("search intent must not infer business facts.");
  }
  if (contract.informationLanguageKernel?.oldSnakeCaseKeySourceOfTruthAllowed !== false) {
    failures.push("old snake_case keys must not be source of truth.");
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
  for (const objectKind of objectKinds.objectKinds || []) {
    assertLocalized(objectKind.copy, `object kind ${objectKind.objectKind}`);
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
  for (const canonicalKey of ["objectKind.workItem", "surface.visibleDoesNotImplyConfirm", "permission.reason.deviceUntrusted"]) {
    if (!(contract.canonicalKeys ?? []).includes(canonicalKey)) failures.push(`language-contract missing canonical key ${canonicalKey}.`);
  }
  for (const forbidden of ["写入 DomainEvent", "LedgerEntry 后", "ProcessManager 会", "运行时 Lens", "slice 状态不允许"]) {
    if (read("apps/mobile/src/i18n/operationCopy.js").includes(forbidden)) failures.push(`ordinary user copy exposes internal runtime term: ${forbidden}.`);
  }
}

function checkCanonicalSurfaceCopy() {
  const contractKeys = new Set(contract.canonicalKeys ?? []);
  const surfaceCopyById = new Map((surfaceCopy.copies ?? []).map((copy) => [copy.copyId, copy]));
  for (const key of requiredCanonicalKeys) {
    if (!contractKeys.has(key)) failures.push(`language-contract missing canonical key ${key}.`);
    const catalogCopy = surfaceCopyById.get(key);
    if (!catalogCopy) {
      failures.push(`surface-copy-catalog missing canonical key ${key}.`);
    } else {
      assertLocalized(catalogCopy.copy, `surface copy canonical ${key}`);
    }
    for (const language of requiredLanguages) {
      const value = operationCopy?.[language]?.[key];
      if (typeof value !== "string" || value.trim().length === 0 || value === key) {
        failures.push(`operation copy missing canonical key ${key} for ${language}.`);
      }
    }
  }
  for (const [alias, canonical] of Object.entries(requiredAliasKeys)) {
    if (contract.aliasKeys?.[alias] !== canonical) {
      failures.push(`language-contract alias ${alias} must point to canonical key ${canonical}.`);
    }
  }
  for (const forbidden of ["Confirm Runtime", "Unit of Work", "DomainEvent", "LedgerEntry", "ProcessManager"]) {
    for (const language of requiredLanguages) {
      for (const [key, value] of Object.entries(operationCopy?.[language] ?? {})) {
        if (requiredCanonicalKeys.includes(key) && String(value).includes(forbidden)) {
          failures.push(`ordinary user canonical copy ${key} exposes internal runtime term ${forbidden}.`);
        }
      }
    }
  }
}

function checkInformationLanguageKernel() {
  const contractKeys = new Set(contract.canonicalKeys ?? []);
  const multilingualCopyById = new Map((multilingualCopy.copies ?? []).map((copy) => [copy.copyId, copy]));
  for (const key of requiredInformationCopyKeys) {
    if (!contractKeys.has(key)) failures.push(`language-contract missing information canonical key ${key}.`);
    const copy = multilingualCopyById.get(key);
    if (!copy) {
      failures.push(`multilingual-copy-catalog missing ${key}.`);
    } else {
      assertLocalized(copy.copy, `multilingual copy ${key}`);
    }
  }

  const glossaryIds = new Set((glossary.entries ?? []).map((entry) => entry.termId));
  for (const area of requiredInformationAreas) {
    if (!glossaryIds.has(area)) failures.push(`glossary missing information area ${area}.`);
  }
  for (const entry of glossary.entries ?? []) {
    assertLocalized(entry.copy, `glossary ${entry.termId}`);
  }

  if (tokenizerDictionary.truthInferenceAllowed !== false || tokenizerDictionary.canCreateBusinessFact !== false) {
    failures.push("tokenizer dictionary must be read-only and unable to create business facts.");
  }
  for (const token of tokenizerDictionary.tokens ?? []) {
    if (!token.canonicalKey || !contractKeys.has(token.canonicalKey)) failures.push(`tokenizer token ${token.tokenId} references non-canonical key ${token.canonicalKey}.`);
    assertLanguageArrays(token.aliases, `tokenizer token ${token.tokenId}`);
  }

  if (searchIntentDictionary.truthInferenceAllowed !== false || searchIntentDictionary.canCreateBusinessFact !== false) {
    failures.push("search intent dictionary must be read-only and unable to create business facts.");
  }
  for (const intent of searchIntentDictionary.intents ?? []) {
    if (!intent.canonicalKey || !contractKeys.has(intent.canonicalKey)) failures.push(`search intent ${intent.intentId} references non-canonical key ${intent.canonicalKey}.`);
    if (!["readonly_search", "navigate_only"].includes(intent.allowedAction)) failures.push(`search intent ${intent.intentId} must be readonly_search or navigate_only.`);
    assertLanguageArrays(intent.phrases, `search intent ${intent.intentId}`);
  }

  if (aliasRegistry.aliasesAreSourceOfTruth !== false) failures.push("alias registry must state aliasesAreSourceOfTruth=false.");
  for (const alias of aliasRegistry.aliases ?? []) {
    if (alias.sourceOfTruth !== false) failures.push(`alias ${alias.aliasKey} must not be source of truth.`);
    if (!contractKeys.has(alias.canonicalKey)) failures.push(`alias ${alias.aliasKey} points to missing canonical key ${alias.canonicalKey}.`);
  }
  for (const [alias, canonical] of Object.entries(contract.aliasKeys ?? {})) {
    if (!contractKeys.has(canonical)) failures.push(`language-contract alias ${alias} points to missing canonical key ${canonical}.`);
  }

  const forbiddenTerms = [
    ...(internalTermFirewall.forbiddenVisibleTerms ?? []),
    ...(internalTermFirewall.forbiddenLocalizedHints ?? [])
  ];
  for (const term of [
    "Confirm Runtime",
    "Unit of Work",
    "DomainEvent",
    "LedgerEntry",
    "ProcessManager",
    "Projection",
    "Lens",
    "truthOwnerDomain",
    "definitionId",
    "payloadHash",
    "commandSubmissionId",
    "rawReason",
    "rawCode"
  ]) {
    if (!(internalTermFirewall.forbiddenVisibleTerms ?? []).includes(term)) failures.push(`internal-term-firewall missing ${term}.`);
  }

  const userVisibleSources = [
    { label: "surface-copy-catalog", values: collectCopyValues(surfaceCopy.copies ?? [], "copy") },
    { label: "multilingual-copy-catalog", values: collectCopyValues(multilingualCopy.copies ?? [], "copy") },
    { label: "operationCopy", values: collectObjectStringValues(operationCopy) },
    { label: "shellCopy", values: collectObjectStringValues(shellCopy) }
  ];
  for (const source of userVisibleSources) {
    for (const value of source.values) {
      for (const term of forbiddenTerms) {
        if (typeof value === "string" && value.includes(term)) {
          failures.push(`${source.label} exposes internal term ${term}.`);
        }
      }
    }
  }
}

function assertLocalized(value, label) {
  for (const language of requiredLanguages) {
    if (typeof value?.[language] !== "string" || value[language].trim().length === 0) {
      failures.push(`${label} missing ${language}.`);
    }
  }
}

function assertLanguageArrays(value, label) {
  for (const language of requiredLanguages) {
    if (!Array.isArray(value?.[language]) || value[language].length === 0) {
      failures.push(`${label} missing ${language}.`);
    }
  }
}

function collectCopyValues(items, field) {
  const values = [];
  for (const item of items) {
    const copy = item?.[field] ?? {};
    for (const language of requiredLanguages) {
      if (typeof copy?.[language] === "string") values.push(copy[language]);
    }
  }
  return values;
}

function collectObjectStringValues(value) {
  const values = [];
  visit(value);
  return values;

  function visit(node) {
    if (typeof node === "string") {
      values.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const item of Object.values(node)) visit(item);
    }
  }
}

function writeProof() {
  const fullPath = path.join(root, proofPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const proof = {
    version: "oam.language-glossary-generated-proof.v1",
    checkedAtUtc: "pending",
    status: failures.length ? "failed" : "passed",
    proves: [
      "Language Kernel covers objectKind, resultType, metric, dashboard, lineage, readiness, tokenizer, search intent, permission reason, admission reason, evidence reason, finance truth reason, and noGo reason.",
      "Canonical keys are covered by zh-CN, ru-RU, and ky-KG copy.",
      "Tokenizer and search intent dictionaries cannot infer or create business facts.",
      "Old snake_case keys are aliases and are not source of truth.",
      "Ordinary user copy does not expose internal runtime, definition, payload, command, or owner terms."
    ],
    informationAreas: requiredInformationAreas,
    canonicalKeys: requiredInformationCopyKeys,
    violations: failures
  };
  proof.checkedAtUtc = stableTimestamp(proofPath, proof, "checkedAtUtc");
  fs.writeFileSync(fullPath, `${JSON.stringify(proof, null, 2)}\n`);
}

function stableTimestamp(file, nextDocument, field) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return new Date().toISOString();
  try {
    const previous = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (sameExceptField(previous, nextDocument, field)) {
      return previous[field] ?? new Date().toISOString();
    }
  } catch {
    return new Date().toISOString();
  }
  return new Date().toISOString();
}

function sameExceptField(left, right, field) {
  const leftClone = { ...left };
  const rightClone = { ...right };
  delete leftClone[field];
  delete rightClone[field];
  return JSON.stringify(leftClone) === JSON.stringify(rightClone);
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
