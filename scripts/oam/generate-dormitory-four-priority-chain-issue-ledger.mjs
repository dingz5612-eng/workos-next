import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const evidenceDir = "artifacts/oam/evidence/dormitory-four-priority-chains-in-app-browser";
const indexPath = `${evidenceDir}/index.json`;
const baselinePath = `${evidenceDir}/baseline-freeze.json`;
const ledgerPath = `${evidenceDir}/issue-ledger.json`;

const indexText = readText(indexPath);
const index = JSON.parse(indexText);
const records = (Array.isArray(index.records) ? index.records : [])
  .map((record, index) => enrichRecord(record, index));
const deferredIssues = Array.isArray(index.deferredIssues) ? index.deferredIssues : [];
const blockedRecords = records.filter(({ record }) => isBlockedRecord(record));
const indexDigest = digestText(indexText);
const gitStatus = command("git", ["status", "--short"]).split(/\r?\n/).filter(Boolean);
const currentHead = command("git", ["rev-parse", "HEAD"]);
const activeBlockerKey = currentActiveBlockerKey(blockedRecords);
const blockedIssues = blockedRecords.map((item) => classifyBlockedRecord(item, activeBlockerKey));
const deferredEntries = deferredIssues.map(classifyDeferredIssue);
const undiscoveredRisks = [
  ["undiscovered-A301-s13-after-checkout", "A301-main-1", "A301", "13-reporting-audit-review", "A301 scenario 13 still needs official browser evidence after scenario 9 checkout settlement is repaired and completed."],
  ["undiscovered-A302-main-chain", "A302-main-2", "A302", "1->2->3->4->5->6->7->8->9->13", "Second normal chain still needs browser evidence for repeatability and data isolation."],
  ["undiscovered-B401-cancel-chain", "B401-abnormal-cancel-1", "B401", "1->2->3->4->5->6->10->13", "Cancel/no-show chain still needs finance-request boundary verification."],
  ["undiscovered-B402-maintenance-chain", "B402-abnormal-maintenance-1", "B402", "1->2->7/8/9->11->2->13", "Maintenance/out-of-service and restore chain still needs Operations Runtime closure."]
].map(([id, chainId, resource, scenario, decision]) => ({
  id,
  severity: "P1",
  status: "undiscoveredRisk",
  layer: "browser-evidence",
  owningLayer: "browser-evidence",
  blockingStatus: "not-yet-discovered",
  chainId,
  resource,
  scenario,
  step: "not-yet-closed",
  checkpoint: checkpointText(chainId, resource, scenario, "not-yet-closed"),
  evidence: {
    source: "planned-four-priority-chain"
  },
  decision,
  fixPlan: "Run the legal Operations Runtime browser path and attach official in-app browser screenshots before claiming closure.",
  resolvedBy: null,
  resolutionEvidence: null,
  reverifyGate: [
    "official in-app browser screenshot evidence",
    "four-priority-chain issue ledger checker"
  ],
  notes: "Not a confirmed defect yet; must not be reported as problem-free until real browser evidence exists."
}));

const issues = [...blockedIssues, ...deferredEntries, ...undiscoveredRisks];
const activeBlockers = issues.filter((item) => item.status === "activeBlocker");
const fourChainUndiscoveredRisks = issues.filter((item) =>
  item.status === "undiscoveredRisk" &&
  ["A302-main-2", "B401-abnormal-cancel-1", "B402-abnormal-maintenance-1"].includes(item.chainId));
const a301SliceUndiscoveredRisks = issues.filter((item) =>
  item.status === "undiscoveredRisk" && item.chainId === "A301-main-1");
const currentSliceClosureAllowed = activeBlockers.length === 0 && a301SliceUndiscoveredRisks.length === 0;
const fourChainClosureAllowed = currentSliceClosureAllowed && fourChainUndiscoveredRisks.length === 0;

const baseline = {
  version: "oam.dormitory-four-priority-chain-baseline-freeze.v1",
  frozenAtUtc: new Date().toISOString(),
  currentHead,
  gitStatus,
  dirtyFileCount: gitStatus.length,
  sourceIndexPath: indexPath,
  sourceIndexDigest: indexDigest,
  sourceIndexUpdatedAt: index.updatedAt ?? null,
  sourceIndexFinalGoNoGo: index.finalGoNoGo ?? null,
  recordCount: records.length,
  blockedRecordCount: blockedRecords.length,
  deferredIssueCount: deferredIssues.length,
  activeBlocker: activeBlockers[0] ? summarizeIssue(activeBlockers[0]) : null,
  knownFocusedChecksAtFreeze: [
    "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj --no-restore --filter FullyQualifiedName~CanonicalOperationsApiServiceTests",
    "npx vitest run OperationActionStateContract OperationPanelRuntimeContract MobileOamHardeningMatrix OperationFieldKernelContract",
    "node scripts/oam/check-current-oam.mjs",
    "node scripts/oam/check-generated-files-not-manually-edited.mjs",
    "node scripts/business/check-dormitory-13-scenario-control-authority.mjs",
    "node scripts/business/check-dormitory-13-scenario-generated-contracts.mjs",
    "node scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs",
    "node scripts/oam/check-surface-language-v2.mjs",
    "node scripts/oam/check-surface-consumes-generated-surface-model.mjs",
    "node scripts/oam/check-visible-business-copy-contract.mjs"
  ],
  currentSliceClosureAllowed,
  fourChainClosureAllowed,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};

const ledger = {
  version: "oam.dormitory-four-priority-chain-issue-ledger.v1",
  generatedAtUtc: new Date().toISOString(),
  sourceIndexPath: indexPath,
  sourceIndexDigest: indexDigest,
  baselineFreezePath: baselinePath,
  baselineSourceIndexDigest: baseline.sourceIndexDigest,
  currentHead,
  finalGoNoGo: "NO_GO",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  currentSliceClosureAllowed,
  fourChainClosureAllowed,
  counts: {
    records: records.length,
    blockedRecords: blockedRecords.length,
    deferredIssues: deferredIssues.length,
    issues: issues.length,
    activeBlockers: activeBlockers.length,
    unresolvedBrowserRisks: issues.filter((item) => item.status === "undiscoveredRisk").length
  },
  rules: {
    officialScreenshotsRequired: true,
    domOrOsFallbackForbidden: true,
    activeBlockerPreventsChainPass: true,
    resolvedBlockedRecordRequiresReverifyGate: true,
    staleActiveBlockerForbiddenWhenLaterPassExists: true,
    baselineLedgerIndexDigestMustMatch: true,
    finalGoNoGoAlwaysNoGo: true
  },
  issues
};

writeJson(baselinePath, baseline, root);
writeJson(ledgerPath, ledger, root);

console.log(`Dormitory four-priority baseline frozen: ${baselinePath}`);
console.log(`Dormitory four-priority issue ledger generated: ${ledgerPath} (${issues.length} issues, ${activeBlockers.length} active blocker(s))`);

function classifyBlockedRecord(item, activeKey) {
  const { record, index, key } = item;
  const base = {
    id: key,
    severity: "P1",
    status: "resolvedNeedsRegression",
    layer: "runtime/surface/browser",
    owningLayer: "runtime/surface/browser",
    blockingStatus: "resolved-needs-regression",
    chainId: record.chainId ?? null,
    resource: record.resource ?? null,
    scenario: record.scenario ?? null,
    normalizedScenario: item.scenarioNo,
    step: record.step ?? null,
    normalizedStep: item.stepKey,
    checkpoint: checkpointText(record.chainId, record.resource, record.scenario, record.step),
    evidence: evidenceFor(item),
    decision: "Historical blocked browser record requires regression evidence before it can be treated as closed.",
    fixPlan: "Keep the blocked evidence in the ledger, then rerun the same legal browser checkpoint or focused runtime/surface check before final closure.",
    resolvedBy: "Later focused fix or rerun evidence must be checked before final four-chain closure.",
    resolutionEvidence: laterPositiveEvidence(item),
    reverifyGate: [
      "official browser screenshot for the affected step",
      "focused runtime/surface check"
    ],
    notes: stableActualSummary(record)
  };

  if (isHarnessOrSessionNoise(record)) {
    return {
      ...base,
      status: "harnessOrSessionNoise",
      layer: "browser-session/harness",
      owningLayer: "browser-session/harness",
      blockingStatus: "isolated-harness-noise",
      decision: "Browser session, role handoff, or harness navigation lost the operation panel; this is isolated from product defects unless it reproduces from a clean entry.",
      fixPlan: "Re-enter from login/search/work item using the current session and official screenshot channel.",
      resolvedBy: "Clean browser login and same scenario rerun from Search or legal work item entry.",
      resolutionEvidence: laterPositiveEvidence(item) ?? laterAnyOfficialEvidence(item),
      reverifyGate: [
        "clean login",
        "official screenshot on legal entry",
        "scenario-specific focused browser rerun"
      ]
    };
  }

  const resolution = laterPositiveEvidence(item);
  if (resolution) {
    return classifyResolved(item, base, resolution);
  }

  const superseding = laterUnresolvedBlockedEvidence(item);
  if (superseding) {
    return {
      ...base,
      status: "superseded",
      blockingStatus: "superseded-by-current-blocker",
      decision: "This blocked record is retained as evidence but no longer drives current closure because a later blocked attempt owns the same checkpoint.",
      fixPlan: "Follow the latest active blocker for this checkpoint; keep this evidence for chronology only.",
      resolvedBy: null,
      resolutionEvidence: superseding,
      supersededBy: activeIssueIdFor(superseding.normalized ?? item, superseding.record ?? record),
      reverifyGate: [
        "latest active blocker is fixed",
        "official browser rerun reaches the next legal step"
      ]
    };
  }

  if (key === activeKey) {
    return classifyActiveBlocker(item, base);
  }

  return {
    ...base,
    status: "superseded",
    blockingStatus: "superseded-by-newer-active-blocker",
    decision: "This unresolved historical blocked record is not the latest current blocker and must not drive current closure.",
    fixPlan: "Resolve the latest active blocker, then regenerate the ledger to reclassify this record.",
    resolvedBy: null,
    resolutionEvidence: activeKey ? { activeBlockerId: activeKey } : null,
    supersededBy: activeKey ? activeIssueIdFor(item, record) : null
  };
}

function classifyResolved(item, base, resolution) {
  if (item.scenarioNo === 8) {
    return {
      ...base,
      status: "resolvedNeedsRegression",
      layer: "generated-runtime-startContext/browser-evidence",
      owningLayer: "generated-runtime-startContext/browser-evidence",
      decision: "Scenario 8 earlier blocked records are superseded by the later official scenario-complete evidence.",
      fixPlan: "Keep scenario 8 regression gates in the final four-chain pass.",
      resolvedBy: "A301 scenario 8 target-fix rerun reached the read-only completed record.",
      resolutionEvidence: resolution,
      reverifyGate: [
        "scenario 8 generated contracts",
        "scenario 8 consumption boundary",
        "A301 scenario 8 official browser rerun"
      ]
    };
  }

  if (item.record.step === "screenshot-channel-recovery") {
    return {
      ...base,
      severity: "P0",
      status: "resolvedNeedsRegression",
      layer: "official-browser-evidence",
      owningLayer: "official-browser-evidence",
      decision: "The official screenshot channel blocker is historical because later official in-app screenshots were captured and scenario 8 completed.",
      fixPlan: "Keep screenshot health as a gate before each renewed browser slice.",
      resolvedBy: "Later official login/operationPanel/scenario screenshots were captured.",
      resolutionEvidence: resolution,
      reverifyGate: [
        "clean browser bootstrap",
        "official login-page screenshot",
        "official operationPanel screenshot",
        "official scenario checkpoint screenshot"
      ]
    };
  }

  return base;
}

function classifyActiveBlocker(item, base) {
  if (item.scenarioNo === 9 && item.stepKey === "2") {
    return {
      ...base,
      id: "active-A301-s9-step2",
      status: "activeBlocker",
      layer: "runtime/generated-field-canonicalization",
      owningLayer: "runtime/generated-field-canonicalization",
      blockingStatus: "blocking",
      decision: "A301 scenario 9 step 2 remains blocked in official browser evidence; generated UI field ids are not yet proven to canonicalize before runtime rules.",
      fixPlan: "Fix generated runtime field canonicalization and test assertions, rerun focused tests, then re-enter A301 checkout settlement from Search with a fresh work item.",
      resolvedBy: null,
      resolutionEvidence: null,
      reverifyGate: [
        "CanonicalOperationsApiService scenario9 generated field canonicalization test",
        "node scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs",
        "node scripts/oam/check-generated-files-not-manually-edited.mjs",
        "official A301 scenario 9 step 2 browser rerun reaches step 3"
      ]
    };
  }

  return {
    ...base,
    status: "activeBlocker",
    blockingStatus: "blocking",
    decision: "This is the latest unresolved blocked browser record and blocks the current slice.",
    fixPlan: "Return to the owning architecture layer, fix, regenerate if required, and rerun the official browser checkpoint.",
    resolvedBy: null,
    resolutionEvidence: null
  };
}

function classifyDeferredIssue(issue) {
  return {
    id: issue.id,
    severity: "P2",
    status: "deferred",
    layer: issue.layer ?? "surface/evidence",
    owningLayer: issue.layer ?? "surface/evidence",
    blockingStatus: "non-blocking-deferred",
    chainId: issue.chainId ?? null,
    resource: issue.resource ?? null,
    scenario: issue.scenario ?? null,
    step: issue.step ?? null,
    checkpoint: checkpointText(issue.chainId, issue.resource, issue.scenario, issue.step),
    evidence: {
      screenshot: issue.screenshot ?? null,
      source: "index.deferredIssues"
    },
    decision: issue.issue ?? "",
    fixPlan: "Batch with P2 copy/surface/evidence cleanup after the priority chains prove the blocker path.",
    resolvedBy: null,
    resolutionEvidence: null,
    reverifyGate: [
      "四链浏览器截图闭合后重新判级",
      "对应 surface/language/runtime focused check"
    ],
    notes: issue.whyDeferred ?? ""
  };
}

function currentActiveBlockerKey(items) {
  const unresolved = items
    .filter((item) => !isHarnessOrSessionNoise(item.record))
    .filter((item) => !laterPositiveEvidence(item));
  if (unresolved.length === 0) return null;
  return unresolved.at(-1).key;
}

function laterPositiveEvidence(item) {
  const later = records.slice(item.index + 1);
  if (item.record.step === "screenshot-channel-recovery") {
    const screenshotRecord = later.find((candidate) =>
      hasOfficialScreenshot(candidate.record) &&
      !isBlockedRecord(candidate.record));
    return screenshotRecord ? evidenceFor(screenshotRecord) : null;
  }

  const positive = later.find((candidate) =>
    sameChainResource(candidate, item) &&
    candidate.scenarioNo === item.scenarioNo &&
    isPositiveRecord(candidate.record) &&
    (candidate.stepKey === item.stepKey ||
      candidate.stepRank >= item.stepRank ||
      candidate.stepKey === "scenario-complete"));
  return positive ? evidenceFor(positive) : null;
}

function laterAnyOfficialEvidence(item) {
  const evidence = records.slice(item.index + 1).find((candidate) =>
    sameChainResource(candidate, item) &&
    hasOfficialScreenshot(candidate.record) &&
    !isBlockedRecord(candidate.record));
  return evidence ? evidenceFor(evidence) : null;
}

function laterUnresolvedBlockedEvidence(item) {
  const later = blockedRecords.slice(blockedRecords.findIndex((candidate) => candidate.key === item.key) + 1);
  const match = later.find((candidate) =>
    sameChainResource(candidate, item) &&
    candidate.scenarioNo === item.scenarioNo &&
    candidate.stepKey === item.stepKey &&
    !laterPositiveEvidence(candidate) &&
    !isHarnessOrSessionNoise(candidate.record));
  return match ? { ...evidenceFor(match), normalized: match, record: match.record } : null;
}

function isPositiveRecord(record) {
  const result = String(record.result ?? record.status ?? "").toLowerCase();
  const action = String(record.action ?? "").toLowerCase();
  return ["submitted", "passed", "started"].includes(result) ||
    action.includes("complete scenario") ||
    record.step === "scenario-complete";
}

function hasOfficialScreenshot(record) {
  return Boolean(record.screenshot) &&
    !isBlockedRecord(record) &&
    (Array.isArray(record.sourceRefs)
      ? record.sourceRefs.some((item) => String(item).includes("official in-app browser screenshot"))
      : true);
}

function isBlockedRecord(record) {
  const result = String(record.result ?? record.status ?? "");
  const action = String(record.action ?? "");
  return /BLOCKED|NO_GO|blocked/i.test(result) || /blocked/i.test(action);
}

function isHarnessOrSessionNoise(record) {
  const actual = stableActualSummary(record);
  const url = String(record.url ?? "");
  return actual.includes("登录办理系统") ||
    actual.includes("not on operationPanel") ||
    (url.includes("view=login") && !String(record.scenario ?? "").includes("9-checkout-settlement"));
}

function enrichRecord(record, index) {
  const scenarioNo = normalizeScenario(record.scenario);
  const stepKey = normalizeStep(record.step);
  return {
    record,
    index,
    key: blockedRecordKey(record, index),
    scenarioNo,
    stepKey,
    stepRank: stepRank(stepKey)
  };
}

function normalizeScenario(value) {
  const text = String(value ?? "");
  const match = text.match(/scenario\s*([0-9]+)/i) ?? text.match(/^([0-9]+)/);
  return match ? Number(match[1]) : null;
}

function normalizeStep(value) {
  const text = String(value ?? "").trim();
  if (!text) return "missing";
  if (/^scenario-complete$/i.test(text)) return "scenario-complete";
  if (/^screenshot-channel-recovery/i.test(text)) return text;
  const fraction = text.match(/^([0-9]+)\s*\/\s*[0-9]+$/);
  if (fraction) return fraction[1];
  const step = text.match(/^step[-_\s]*([0-9]+)$/i);
  if (step) return step[1];
  return text;
}

function stepRank(stepKey) {
  if (stepKey === "scenario-complete") return Number.MAX_SAFE_INTEGER;
  const value = Number(stepKey);
  return Number.isFinite(value) ? value : -1;
}

function sameChainResource(left, right) {
  return String(left.record.chainId ?? "") === String(right.record.chainId ?? "") &&
    String(left.record.resource ?? "") === String(right.record.resource ?? "");
}

function activeIssueIdFor(item, record) {
  if (item.scenarioNo === 9 && item.stepKey === "2") return "active-A301-s9-step2";
  return `active-${slug(record.chainId)}-${slug(record.scenario)}-${slug(record.step)}`;
}

function evidenceFor(item) {
  return {
    sourceBlockedRecordKey: isBlockedRecord(item.record) ? item.key : null,
    recordIndex: item.index,
    recordAt: item.record.at ?? null,
    screenshot: item.record.screenshot ?? null,
    url: item.record.url ?? null,
    result: item.record.result ?? null,
    action: item.record.action ?? null,
    sourceRefs: item.record.sourceRefs ?? []
  };
}

function blockedRecordKey(record, index) {
  return `blocked-${String(index + 1).padStart(2, "0")}-${slug(record.chainId)}-${slug(record.scenario)}-${slug(record.step)}`;
}

function summarizeIssue(issue) {
  return {
    id: issue.id,
    severity: issue.severity,
    chainId: issue.chainId,
    resource: issue.resource,
    scenario: issue.scenario,
    step: issue.step,
    layer: issue.layer,
    screenshot: issue.evidence?.screenshot ?? null,
    url: issue.evidence?.url ?? null,
    decision: issue.decision
  };
}

function checkpointText(chainId, resource, scenario, step) {
  return [chainId, resource, scenario, step].filter((item) => item !== null && item !== undefined && item !== "").join(" / ");
}

function stableActualSummary(record) {
  const actual = record.actual ?? record.summary ?? record.action ?? "";
  if (typeof actual === "string") return actual.slice(0, 800);
  if (actual && typeof actual === "object") {
    const summary = {};
    for (const key of ["url", "currentStep", "headings", "submitResult", "result", "error", "buttons", "alerts"]) {
      if (Object.prototype.hasOwnProperty.call(actual, key)) summary[key] = actual[key];
    }
    return stableStringify(Object.keys(summary).length > 0 ? summary : actual).slice(0, 800);
  }
  return String(actual).slice(0, 800);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slug(value) {
  return String(value ?? "missing")
    .replace(/[^0-9A-Za-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "missing";
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function digestText(text) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

function command(file, args) {
  try {
    return execFileSync(file, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
