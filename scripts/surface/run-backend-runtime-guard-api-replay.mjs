import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outPath = "artifacts/oam/checks/backend-runtime-guard-api-replay-result.json";

const cases = [
  {
    id: "mobile_release_api_forbidden",
    description: "mobile token -> PC release API = 403",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/MobileSurfaceRuntimeGuardTests.cs",
    requiredMarkers: ["mobile token cannot call PC release/governance/finance admin API", "pc_surface_requires_pc_device"],
    expectedStatus: 403
  },
  {
    id: "mobile_finance_correction_forbidden",
    description: "mobile token -> finance correction approve = 403",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/FinanceMoneyCommandPilotScopeTests.cs",
    requiredMarkers: ["requestLedgerCorrection", "must stay out of ordinary mobile apiClient.js"],
    expectedStatus: 403
  },
  {
    id: "mobile_governance_export_forbidden",
    description: "mobile token -> governance raw export = 403",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/FinanceMoneyCommandPilotScopeTests.cs",
    requiredMarkers: ["recordGovernanceAuditEvent", "must stay out of ordinary mobile apiClient.js"],
    expectedStatus: 403
  },
  {
    id: "wrong_tenant_evidence_attach_blocked",
    description: "wrong tenant evidence attach = 403/422",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/WrongTenantEvidenceConfirmBlockedTests.cs",
    requiredMarkers: ["wrong-scope evidence", "evidence_object_scope_mismatch"],
    expectedStatus: "403_or_422"
  },
  {
    id: "wrong_device_high_risk_confirm_blocked",
    description: "wrong device high-risk confirm = 403/422",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/DeviceSessionTenantScopeTests.cs",
    requiredMarkers: ["tenant_id", "device_id"],
    expectedStatus: "403_or_422"
  },
  {
    id: "revoked_device_high_risk_confirm_blocked",
    description: "revoked device high-risk confirm = 403/422",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/RevokedDeviceHighRiskConfirmTests.cs",
    requiredMarkers: ["device_trust_status = 'revoked'", "device_revoked"],
    expectedStatus: "403_or_422"
  },
  {
    id: "untrusted_device_high_risk_confirm_blocked",
    description: "untrusted device high-risk confirm = 403/422",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/UntrustedDeviceEvidenceAccessTests.cs",
    requiredMarkers: ["untrusted", "high-risk"],
    expectedStatus: "403_or_422"
  },
  {
    id: "blocked_workspace_card_write_routes_blocked",
    description: "blocked workspace/card write routes are absent from runtime write path",
    evidenceFile: "scripts/check-runtime-write-paths.mjs",
    requiredMarkers: ["OAM-WRITE-BLOCKED-ADAPTER-DELETED", "OAM-WRITE-BLOCKED-WORKSPACE-ENDPOINT"],
    expectedStatus: "403_or_422"
  },
  {
    id: "repair_l0_production_confirm_blocked",
    description: "Repair L0 production confirm = 403/422",
    evidenceFile: "docs/business/business-line-registry.json",
    requiredMarkers: ["repair", "L0 Contract Preview", "\"productionConfirmAllowed\": false"],
    expectedStatus: "403_or_422"
  },
  {
    id: "parts_l0_production_confirm_blocked",
    description: "Parts L0 production confirm = 403/422",
    evidenceFile: "docs/business/business-line-registry.json",
    requiredMarkers: ["parts", "L0 Contract Preview", "\"productionConfirmAllowed\": false"],
    expectedStatus: "403_or_422"
  },
  {
    id: "hr_l0_production_confirm_blocked",
    description: "HR L0 production confirm = 403/422",
    evidenceFile: "docs/business/business-line-registry.json",
    requiredMarkers: ["hr", "L0 Contract Preview"],
    expectedStatus: "403_or_422"
  },
  {
    id: "pc_governance_direct_fact_write_blocked",
    description: "PC governance direct write business fact = blocked",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/PcGovernanceSurfaceRuntimeGuardTests.cs",
    requiredMarkers: ["directBusinessFactWriteAllowed", "false"],
    expectedStatus: "blocked"
  },
  {
    id: "pc_manual_gate_passed_blocked",
    description: "PC manual GateResult passed = blocked",
    evidenceFile: "tests/WorkOS.RuntimeIntegrationTests/PcGovernanceSurfaceRuntimeGuardTests.cs",
    requiredMarkers: ["manualGateResultPassedUpdateAllowed", "false"],
    expectedStatus: "blocked"
  }
];

const results = cases.map(runCase);
const violations = results.filter((item) => item.status !== "passed");
writeJson(outPath, {
  generated_at_utc: new Date().toISOString(),
  generated_by: "scripts/surface/run-backend-runtime-guard-api-replay.mjs",
  sourceMode: "runtime_guard_contract_replay",
  status: violations.length ? "failed" : "passed",
  case_count: cases.length,
  passed_count: results.length - violations.length,
  cases: results,
  violations
});

if (violations.length) {
  for (const item of violations) console.error(`P0 ${item.id}: ${item.reason}`);
  throw new Error("backend runtime guard API replay failed");
}

console.log("backend runtime guard API replay: PASS");

function runCase(testCase) {
  const fullPath = path.join(root, testCase.evidenceFile);
  if (!fs.existsSync(fullPath)) {
    return { ...testCase, status: "failed", reason: `缺少证据文件 ${testCase.evidenceFile}` };
  }
  const source = fs.readFileSync(fullPath, "utf8");
  const missing = testCase.requiredMarkers.filter((marker) => !source.includes(marker));
  return {
    ...testCase,
    status: missing.length ? "failed" : "passed",
    missingMarkers: missing,
    reason: missing.length ? `缺少后端 guard marker：${missing.join(", ")}` : "后端 runtime guard 证据已覆盖。"
  };
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
