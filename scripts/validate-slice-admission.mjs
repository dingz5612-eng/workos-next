import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const rulesIndex = JSON.parse(fs.readFileSync("docs/architecture/rules/index.json", "utf8"));
const exceptions = JSON.parse(fs.readFileSync("docs/architecture/architecture-exceptions.json", "utf8"));

const eventCatalogSource = fs.readFileSync("services/core-api/WorkOS.Api/Runtime/EventContractCatalog.cs", "utf8");
const eventSelectionSource = fs.readFileSync("services/core-api/WorkOS.Api/Runtime/EventSelectionPolicy.cs", "utf8");
const optionSetSource = fs.readFileSync("services/core-api/WorkOS.Api/Runtime/OptionSetRegistry.cs", "utf8");
const fieldValidatorSource = fs.readFileSync("services/core-api/WorkOS.Api/Runtime/FieldContractValidator.cs", "utf8");
const runtimeContractTests = fs.readFileSync("tests/WorkOS.RuntimeContractTests/Program.cs", "utf8");

const policiesBySlice = new Map((surfacePolicy.policies || []).map((policy) => [policy.sliceId, policy]));
const policiesByWorkspace = new Map((surfacePolicy.policies || []).map((policy) => [policy.workspaceId, policy]));
const lensById = new Map((lensContract.lenses || []).map((lens) => [lens.id, lens]));
const eventTypesByCard = parseEventCatalog(eventCatalogSource);

assert(surfacePolicy.version, "runtime-surface-policy.json must declare version");
assert((surfacePolicy.policies || []).length >= (manifest.slices || []).length, "Every manifest slice must have a surface policy entry.");

const productionSlices = (manifest.slices || []).filter((slice) => slice.status === "production-slice");
const aggregateOwners = new Map();
for (const slice of manifest.slices || []) {
  const policy = policiesBySlice.get(slice.id);
  assert(policy, `Slice ${slice.id} missing runtime surface policy.`);
  assert(policy.workspaceId === slice.workspaceId, `Slice ${slice.id} surface policy workspaceId mismatch.`);
  assert(policiesByWorkspace.get(slice.workspaceId)?.sliceId === slice.id, `Workspace ${slice.workspaceId} has duplicate or mismatched surface policy.`);
  assertCardsMatch(slice, policy);
  assertSurfaceDeclarations(slice, policy);

  if (slice.status === "production-slice") {
    assertProductionAdmission(slice, policy);
    for (const aggregate of slice.ownsAggregates || []) {
      const currentOwner = aggregateOwners.get(aggregate);
      assert(!currentOwner, `Production aggregate ownership conflict for ${aggregate}: ${currentOwner} and ${slice.id}`);
      aggregateOwners.set(aggregate, slice.id);
    }
  }

  if (slice.status === "contract-only") {
    assert(runtimeContractTests.includes("ValidateAllContractOnlySlicesAreGated"), "Contract-only slices must be covered by manifest-driven gate tests.");
  }
}

for (const requiredLens of ["payment-risk", "checkout-queue", "service-task-queue", "risk-command", "period-performance", "room-revenue-potential", "lead-funnel"]) {
  const lens = lensById.get(requiredLens);
  assert(lens, `Lens contract missing ${requiredLens}.`);
  assert(lens.sourceOfTruthTables?.length > 0, `${requiredLens} must list source-of-truth tables.`);
  assert(lens.freshness?.lagMetric === "projectionLagSeconds", `${requiredLens} must declare projection lag freshness metric.`);
  assert(lens.crossCheck, `${requiredLens} must declare a cross-check rule.`);
}

for (const ruleId of ["WON16-SURFACE-002", "WON16-ADMISSION-001", "WON16-LENS-001", "WON16-OBS-001"]) {
  assert((rulesIndex.rules || []).some((rule) => rule.id === ruleId), `Rule registry missing ${ruleId}.`);
}

for (const exception of exceptions.exceptions || []) {
  assert(exception.owner && exception.reason && exception.expiresAt && exception.linkedTest && exception.removalCondition, "Architecture exceptions must be fully described.");
  assert(Date.parse(exception.expiresAt) >= Date.now(), `Architecture exception expired: ${exception.ruleId}`);
}

console.log("Slice admission gate: PASS");

function assertProductionAdmission(slice, policy) {
  assert(policy.defaultLens && policy.lenses?.includes(policy.defaultLens), `Production slice ${slice.id} must declare a default lens present in lenses.`);
  for (const lens of policy.lenses || []) {
    assert(lensById.has(lens) || ["bed-inventory", "room-readiness", "rate-plan", "today-operations", "active-stay", "deposit-liability", "stay-balance", "expense-analytics"].includes(lens),
      `Production slice ${slice.id} references lens without contract or known base lens: ${lens}`);
  }

  for (const cardId of slice.cards || []) {
    const eventTypes = eventTypesByCard.get(cardId) || [];
    if (eventTypes.length > 1) {
      assert(eventSelectionSource.includes(`"${cardId}"`), `Multi-event card ${slice.id}/${cardId} must have EventSelectionPolicy coverage.`);
    }
  }

  assert(fieldValidatorSource.includes("FieldContractValidator"), "Production admission requires FieldContractValidator.");
  assert(!/DEP-2026|PAY-2026|APP-2026|LEAD-2026|RES-2026|STAY-2026|DREC-2026|CHG-2026|TASK-2026|EXP-2026|PER-2026|张三|A301/.test(optionSetSource),
    "Production option registry must not contain fake candidates or defaults.");
  assert(runtimeContractTests.includes("AssertNoSideEffects"), "Production admission requires no-side-effects tests.");
  assert(runtimeContractTests.includes("ValidateProductionSliceAdmission"), "Production admission must be covered by runtime contract tests.");
}

function assertCardsMatch(slice, policy) {
  const manifestCards = [...(slice.cards || [])].sort();
  const policyCards = [...(policy.cards || []).map((card) => card.cardId)].sort();
  assert(JSON.stringify(manifestCards) === JSON.stringify(policyCards), `Surface policy cards mismatch for ${slice.id}.`);
}

function assertSurfaceDeclarations(slice, policy) {
  for (const surface of ["home", "workbench", "search", "learning"]) {
    assert(policy[surface], `Slice ${slice.id} missing ${surface} surface policy.`);
    assert(policy[surface].visible === true || Boolean(policy.hiddenReason), `Slice ${slice.id} ${surface} must be visible or have hiddenReason.`);
  }

  for (const card of policy.cards || []) {
    for (const field of ["cardId", "searchKeywords", "intentTags", "learningSection", "defaultLens", "hiddenReason"]) {
      assert(field in card, `Slice ${slice.id} card ${card.cardId || "<missing>"} missing ${field}.`);
    }
    assert(card.home === true || Boolean(card.hiddenReason), `Slice ${slice.id} card ${card.cardId} missing Home visibility or hiddenReason.`);
    assert(card.workbench === true || Boolean(card.hiddenReason), `Slice ${slice.id} card ${card.cardId} missing Workbench visibility or hiddenReason.`);
  }
}

function parseEventCatalog(source) {
  const result = new Map();
  const pattern = /"([^"]+)"\s*=>\s*new\[\]\s*\{([^}]+)\}/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const events = match[2]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    result.set(match[1], events);
  }

  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
