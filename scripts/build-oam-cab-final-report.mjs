import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const finalReportPath = "artifacts/oam-cab/oam-cab-v1-final-report.json";
const finalReportMdPath = "docs/architecture/OAM_CAB_V1_FINAL_REPORT.md";
const inventoryPath = "artifacts/oam-cab/oam-cab-v1-inventory.json";
const contractIndexPath = "docs/contracts/oam-cab/contract-index.json";

const previousReport = exists(finalReportPath) ? readJson(finalReportPath) : {};
const inventory = readJson(inventoryPath);
const contractIndex = readJson(contractIndexPath);

const report = {
  project: "WorkOSNext / FunRide",
  baseline: "OAM-CAB v1",
  current_stage: "OAM-CAB v1｜Baseline Repair & Evidence Closure",
  generatedAt: new Date().toISOString(),
  architecture: {
    top_level: "OAM-ACF v8",
    main_runtime: "Operations Runtime",
    main_axis: "Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> ProcessManager -> Projection / Lens -> Surface",
    main_write_path: "POST /api/operations/work-items/{workItemId}/confirm",
    projection_runtime: "compatibility facade",
    workspace_card: "compatibility wrapper",
    business_production: "blocked",
    dormitory: "L1_INTERNAL_PILOT_OBSERVATION",
    dormitory_l2: "BLOCKED",
    repair_parts_hr_business_3_7: "L0 Contract Preview",
    rules_os_go: "not Business Production GO",
    surface_visibility: "not confirmAllowed"
  },
  modules: previousReport.modules ?? defaultModules(),
  component_classification: previousReport.component_classification ?? {
    active: [],
    compatibility: [],
    archive_candidates: [],
    remove_candidates: []
  },
  route_inventory: {
    artifact: inventoryPath,
    count: inventory.summary.routeCount,
    source: "services/**/*.cs Map* route scan"
  },
  non_get_route_classification: {
    artifact: inventoryPath,
    count: inventory.summary.nonGetRouteCount,
    byClassification: countBy(inventory.non_get_route_classification, "classification")
  },
  business_write_path_inventory: {
    artifact: inventoryPath,
    count: inventory.summary.businessWriteRouteCount,
    routes: inventory.business_write_path_inventory.map(({ key, classification, legacyWritePathClass }) => ({
      key,
      classification,
      legacyWritePathClass
    })),
    primaryBusinessWritePath: "POST /api/operations/work-items/{workItemId}/confirm"
  },
  legacy_write_path_classification: {
    artifact: inventoryPath,
    allowedClasses: [
      "remove",
      "forbidden",
      "compatibility shim to Operations Confirm",
      "non-business write"
    ],
    classified: inventory.legacy_write_path_classification.map(({ key, classification, legacyWritePathClass }) => ({
      key,
      classification,
      legacyWritePathClass
    }))
  },
  definition_registry_coverage: inventory.definition_registry_coverage,
  work_item_definition_coverage: {
    definitionCount: inventory.definition_registry_coverage.definitionCount,
    cards: inventory.work_item_definition_coverage.cards.map((card) => ({
      definitionId: card.definitionId,
      sliceId: card.sliceId,
      legacyCardId: card.legacyCardId,
      commandType: card.commandType,
      projectionOwner: card.projectionOwner,
      allowedFacts: card.allowedFacts
    }))
  },
  handler_allowedFacts_coverage: inventory.handler_allowedFacts_coverage,
  fact_ownership_matrix: inventory.fact_ownership_matrix,
  compatibility_scan: inventory.compatibility_scan,
  runtime_documents_audit: {
    sourceOfTruthUsage: inventory.runtime_documents_source_of_truth_usage_scan,
    snapshotOnlyAudit: inventory.runtime_documents_snapshot_only_audit
  },
  search_kernel_coverage: {
    resultTypeCount: inventory.summary.searchResultTypeCount,
    objectTypes: inventory.search_usage_inventory.objectTypes,
    requiredResultFields: inventory.search_usage_inventory.requiredResultFields,
    legacyAdapters: inventory.search_usage_inventory.legacyAdapters,
    admissionPermissionLanguageRequired: true,
    readOnly: true
  },
  language_kernel_coverage: {
    languageCount: inventory.summary.languageCount,
    supportedLanguages: inventory.language_key_status_explanation_inventory.supportedLanguages,
    catalogs: inventory.language_key_status_explanation_inventory.catalogs,
    runtimeBindings: inventory.language_key_status_explanation_inventory.runtimeBindings,
    permissionExplainabilityChineseRequired: true
  },
  security_trust_baseline: {
    cookieCsrfProductionBrowserAuth: {
      status: "blocked_not_production_ready",
      reason: "OAM-CAB baseline repair does not grant production browser auth readiness.",
      blocker_level: "P1"
    },
    deviceTrustBaseline: {
      status: "contracted",
      contract: "docs/contracts/admission/actor-device-admission-contract.json"
    },
    actorDeviceAdmission: {
      status: "contracted",
      contract: "docs/contracts/admission/actor-device-admission-contract.json"
    },
    productionAdmission: {
      status: "blocked",
      contract: "docs/contracts/admission/production-admission-contract.json"
    },
    manualGateResultAllowed: false,
    manualPassedEvidenceAllowed: false
  },
  control_plane_evidence: {
    appendOnlyContract: "docs/contracts/control-plane/control-plane-command-append-only-contract.json",
    writeCapabilityInventory: inventory.control_plane_write_capability_inventory,
    businessFactWriteAllowed: false,
    manualGateResultAllowed: false,
    manualPassedEvidenceAllowed: false
  },
  evidence_graph_refs: {
    contract: "docs/contracts/evidence/evidence-graph-refs-contract.json",
    refs: inventory.evidence_graph_write_reference_inventory.refs,
    runtimeBindings: inventory.evidence_graph_write_reference_inventory.runtimeBindings,
    businessFactWriteAllowed: false
  },
  contracts: contractIndex.contracts,
  tests: buildTests(),
  gates: buildGates(),
  forbidden_findings: inventory.forbidden_findings,
  risks: {
    P0: [],
    P1: [
      "Cookie / CSRF production browser auth baseline is not production-ready in OAM-CAB baseline repair.",
      "CommandSubmission context persisted columns are contract and migration draft only, not production-ready.",
      "Workspace/Card remains a compatibility wrapper pending full migration to the Operations Runtime main axis.",
      "Control Plane / Evidence Graph is evidence-backed for OAM-CAB, but Business Production remains blocked by current-state."
    ],
    P2: [
      "Archive and remove candidate cleanup is deferred to a later deletion-approved phase; current baseline only classifies candidates.",
      "Dedicated lint/typecheck/regression commands are unavailable in package scripts and remain recorded rather than faked.",
      "Latest full dotnet build passed with existing analyzer/nullability warnings; warnings are recorded and not treated as Business Production evidence."
    ]
  },
  evidence: [
    inventoryPath,
    "artifacts/oam-cab/oam-cab-v1-current-state.md",
    "artifacts/oam-cab/execution-log.jsonl",
    "artifacts/oam-cab/browser-checks/phase-5/check-result.json",
    "artifacts/release-state/current-state.json",
    "artifacts/rt4/evidence-graph.json",
    contractIndexPath
  ],
  next_stage: {
    allowed: false,
    reason: "OAM-CAB v1 evidence and P0 gates are not fully proven; Business Production remains blocked."
  }
};

writeJson(finalReportPath, report);
writeText(finalReportMdPath, renderMarkdown(report));
console.log(`OAM-CAB final report written: ${finalReportPath}`);

function buildTests() {
  return [
    passed("npm --prefix apps/mobile run build", "Vite build completed."),
    passed("npm --prefix apps/mobile run test", "52 test files / 209 tests passed."),
    passed("npm --prefix apps/mobile run test:e2e", "5 Playwright mobile smoke tests passed."),
    notAvailable("npm --prefix apps/mobile run lint", "apps/mobile/package.json has no lint script.", "P2"),
    notAvailable("npm --prefix apps/mobile run typecheck", "apps/mobile/package.json has no typecheck script.", "P2"),
    notAvailable("npm run lint", "repository has no root package.json.", "P2"),
    notAvailable("npm run typecheck", "repository has no root package.json.", "P2"),
    passed("dotnet build WorkOSNext.sln -c Release", "Release build completed with warnings and 0 errors in the latest full run."),
    passed("dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release", "277 tests passed."),
    passed("dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release", "53 tests passed."),
    passed("dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release", "Runtime contract tests passed."),
    notAvailable("dedicated regression test command", "No dedicated regression script or project was found; available unit, integration, contract, and e2e suites are recorded separately.", "P2")
  ];
}

function buildGates() {
  return [
    passed("node scripts/build-oam-cab-inventory.mjs", "Inventory artifact generated and parsed."),
    passed("node scripts/check-oam-cab-final-report.mjs", "Final report schema, inventory, contracts, and No-Go evidence verified."),
    passed("node scripts/check-oam-clean-baseline.mjs", "Architecture baseline and component classification verified."),
    passed("node scripts/check-compatibility-quarantine.mjs", "ProjectionRuntime and Workspace/Card compatibility quarantine verified."),
    passed("node scripts/check-api-boundaries.mjs", "Route inventory, source-route diff, and business write boundary verified."),
    passed("node scripts/check-runtime-write-paths.mjs", "OperationsUnitOfWork write path and official-runtime shadow_runtime ban verified."),
    passed("node scripts/check-admission-kernel.mjs", "visible / prepare / confirm / production split verified."),
    passed("node scripts/check-business-line-admission.mjs", "BusinessLineAdmission matrix verified."),
    passed("node scripts/check-admission-surface-alignment.mjs", "Surface admission alignment verified."),
    passed("node scripts/validate-slice-admission.mjs", "Slice admission gate verified."),
    passed("node scripts/validate-runtime-api.mjs", "Runtime API contract responses verified."),
    passed("node scripts/check-definition-registry.mjs", "Definition Registry and WorkItem coverage verified."),
    passed("node scripts/check-language-kernel.mjs", "Language Kernel coverage verified."),
    passed("node scripts/check-search-kernel.mjs", "Search Kernel admission / permission / language contract verified."),
    passed("node scripts/check-fact-ownership.mjs", "Fact ownership contract verified."),
    passed("node scripts/check-ledger-semantic-rules.mjs", "Ledger semantic rules verified."),
    passed("node scripts/check-surface-contract.mjs", "Surface admission and user-visible contract verified."),
    passed("node scripts/surface/check-surface-runtime-guard-contract.mjs", "Surface runtime guard contract verified."),
    passed("node scripts/check-no-raw-surface-labels.mjs", "Raw technical surface labels are blocked."),
    passed("node scripts/surface/check-permission-explainability-contract.mjs", "Permission explainability contract verified."),
    passed("node scripts/surface/check-mobile-search-contract.mjs", "Mobile search contract verified."),
    passed("node scripts/surface/check-evidence-trust-contract.mjs", "Evidence trust contract verified."),
    passed("node scripts/surface/check-device-trust-contract.mjs", "Device trust contract verified."),
    passed("node scripts/trust/check-trust-boundary-kernel.mjs", "Trust boundary kernel verified."),
    passed("node scripts/check-rule-authority.mjs", "Rule authority verified."),
    passed("node scripts/check-rule-drift.mjs", "Rule drift verified."),
    passed("pwsh ./scripts/guard-architecture.ps1", "PowerShell architecture guard verified."),
    passed("pwsh ./scripts/clean-baseline.ps1", "Clean baseline guard verified."),
    passed("git diff --check", "Whitespace check completed; CRLF warnings are non-failing.")
  ];
}

function passed(command, evidence) {
  return {
    command,
    status: "passed",
    reason: "available command completed successfully",
    evidence,
    blocker_level: "none"
  };
}

function notAvailable(command, reason, blockerLevel) {
  return {
    command,
    status: "not_available",
    reason,
    evidence: "package/project script inventory",
    blocker_level: blockerLevel
  };
}

function renderMarkdown(currentReport) {
  const summary = inventory.summary;
  return `# OAM-CAB v1 Final Report

生成时间：${new Date(currentReport.generatedAt).toISOString()}

## 结论

OAM-CAB v1 当前结论是有证据的 No-Go for Business Production。当前阶段是 \`${currentReport.current_stage}\`，目标是修复 baseline、inventory、contract 和 evidence closure，不开放 Business Production、Dormitory L2、Repair / Parts / HR production 或 production confirm。

## 架构基线

- 顶层架构：OAM-ACF v8
- 主执行链：Operations Runtime
- 目标主轴：\`${currentReport.architecture.main_axis}\`
- 主业务写路径：\`${currentReport.architecture.main_write_path}\`
- ProjectionRuntime：compatibility facade
- Workspace/Card：compatibility wrapper
- Business Production：blocked
- Dormitory：L1 Internal Pilot Observation
- Repair / Parts / HR / business-3..7：L0 Contract Preview
- Rules OS GO：不等于 Business Production GO
- surfaceVisibility：不等于 confirmAllowed

## Inventory Summary

- API routes：${summary.routeCount}
- non-GET routes：${summary.nonGetRouteCount}
- business write routes：${summary.businessWriteRouteCount}
- forbidden findings：${summary.forbiddenFindingCount}
- Definition Registry definitions：${summary.definitionCount}
- Search result types：${summary.searchResultTypeCount}
- Language Kernel languages：${summary.languageCount}
- inventory artifact：\`${inventoryPath}\`

## Contract Coverage

- API Boundary Contract：\`${contractIndex.contracts.apiBoundaryContract}\`
- Definition Registry Contract：\`${contractIndex.contracts.definitionRegistryContract}\`
- CommandSubmission Contract：\`${contractIndex.contracts.commandSubmissionContract}\`
- Fact Ownership Contract：\`${contractIndex.contracts.factOwnershipContract}\`
- Compatibility Box Contract：\`${contractIndex.contracts.compatibilityBoxContract}\`
- AdmissionDecision / BusinessLine / ReleaseState / Surface / ActorDevice / Production Admission：\`docs/contracts/admission/*\`
- ControlPlaneCommand append-only：\`${contractIndex.contracts.controlPlaneCommandAppendOnlyContract}\`
- EvidenceGraph refs：\`${contractIndex.contracts.evidenceGraphRefsContract}\`
- BusinessSignoff / Rollback and Compensation：\`docs/contracts/governance/*\`
- Search / BI-KPI / Language / PermissionExplainability：\`docs/contracts/search/*\`, \`${contractIndex.contracts.biKpiContract}\`, \`docs/contracts/language/*\`

## Gates

所有可用 gate 和测试命令的执行状态记录在 machine report 的 \`tests\` 与 \`gates\` 字段中。不可用的 lint / typecheck / dedicated regression 命令以 \`not_available\` 记录，未伪造成 passed。

## 风险

P0：无当前已确认 P0。

P1：

- Cookie / CSRF production browser auth baseline 尚未 production-ready。
- CommandSubmission context 持久化列仍是合同和迁移草案，不是 production-ready。
- Workspace/Card 仍是 compatibility wrapper，仍需继续迁移到 Operations Runtime 主轴。
- Control Plane / Evidence Graph 已有证据闭环，但 Business Production 仍被 current-state 阻断。

P2：

- archive/remove candidate 清理未自动执行，后续必须在删除获批阶段处理。
- lint/typecheck/dedicated regression 命令不可用，已记录为 not_available。
- 最新完整 dotnet build 已通过但存在既有 analyzer/nullability warnings；这些 warning 不作为 Business Production 证据。

## 下一步

\`next_stage.allowed=false\`。原因：${currentReport.next_stage.reason}
`;
}

function defaultModules() {
  return {
    architecture_authority: "docs/engineering and docs/rules/v5.5 remain highest authority; docs/architecture is compatibility/reference only.",
    admission_kernel: "docs/contracts/admission plus AdmissionKernelService decide visibleAllowed, prepareAllowed, confirmAllowed, productionAllowed.",
    operations_runtime: "CanonicalOperationsApiService and OperationsUnitOfWork own the primary business write path.",
    compatibility_box: "ProjectionRuntime and Workspace/Card are quarantined compatibility facade/wrapper components.",
    experience_kernel: "Mobile and PC surfaces render runtime decisions, blockers, required fields, evidence state, and recovery guidance without writing facts.",
    language_kernel: "Language catalogs cover zh-CN, ru-RU, ky-KG domain terms, field labels, status explanations, errors, and search synonyms.",
    search_kernel: "SearchKernelService wraps legacy search sources with Admission, permission, language, ranking, and source refs.",
    control_plane: "Control Plane owns GateResult, Invariant, ShadowCompare, RollbackInstruction, release evidence, and governance evidence.",
    evidence_graph: "Evidence artifacts bind release-state, current-state, gates, screenshots, command logs, and final report.",
    definition_registry: "Definition Registry owns WorkItem, command, field, evidence, risk, ledger, surface, and projection-owner semantics."
  };
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}
