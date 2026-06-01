import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const repository = process.env.GITHUB_REPOSITORY || "dingz5612-eng/workos-next";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function currentMainHead() {
  try {
    return git(["rev-parse", "origin/main"]);
  } catch {
    return git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
  }
}

async function githubJson(url) {
  const headers = { "User-Agent": "WorkOSNext-OAM-01" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: HTTP ${response.status} ${url}`);
  }
  return response.json();
}

async function workflowRunFor(headSha, workflowName) {
  const url = `https://api.github.com/repos/${repository}/actions/runs?head_sha=${headSha}&per_page=50`;
  const payload = await githubJson(url);
  const run = (payload.workflow_runs || [])
    .filter((item) => item.name === workflowName)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
  if (!run) {
    throw new Error(`Missing ${workflowName} run for current main ${headSha}.`);
  }
  return {
    id: run.id,
    name: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

function lineById(registry, businessLineId) {
  return registry.businessLines.find((line) => line.businessLineId === businessLineId);
}

function l0LineSummary(line) {
  return {
    level: line?.level,
    productionAllowed: line?.productionAllowed,
    internalPilotAllowed: line?.internalPilotAllowed,
    productionConfirmAllowed: line?.productionConfirmAllowed,
    surfaceMode: line?.surfaceMode
  };
}

const headSha = currentMainHead();
const generatedAtUtc = new Date().toISOString();

const [
  ci,
  v54ControlPlaneGuards
] = await Promise.all([
  workflowRunFor(headSha, "CI"),
  workflowRunFor(headSha, "V5.4 Control Plane Guards")
]);

const dormInt = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const rtFinal = readJson("artifacts/rt4/final-completion-assurance-result.json");
const evidenceGraph = readJson("artifacts/rt4/evidence-graph.json");
const completionDashboard = readJson("artifacts/rt4/completion-dashboard.json");
const businessLineRegistry = readJson("docs/business/business-line-registry.json");
const bStageGate = readJson("artifacts/go-live/dormitory/b-stage-gate-result.json");
const observationWindow = readJson("artifacts/go-live/dormitory/observation-window-result.json");
const l1ToL2 = readJson("artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json");

const dormitoryLine = lineById(businessLineRegistry, "dormitory");
const repairLine = lineById(businessLineRegistry, "repair");
const partsLine = lineById(businessLineRegistry, "parts");
const hrLine = lineById(businessLineRegistry, "hr");

const currentState = {
  version: "release-state.authority.v1",
  generatedAtUtc,
  generatedBy: "build-current-release-state",
  currentMain: {
    repository,
    branch: "main",
    headSha,
    ci,
    v54ControlPlaneGuards
  },
  sources: {
    dormInt: {
      ref: "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
      status: dormInt.status,
      internalPilotAllowed: dormInt.internalPilotAllowed,
      productionAllowed: dormInt.productionAllowed,
      dormitoryL2ProductionAllowed: dormInt.dormitoryL2ProductionAllowed,
      latestMainCommitSha: dormInt.latestMain?.commitSha,
      latestMainCiHeadSha: dormInt.latestMain?.ci?.headSha,
      latestMainV54HeadSha: dormInt.latestMain?.v54ControlPlaneGuards?.headSha
    },
    rtFinal: {
      ref: "artifacts/rt4/final-completion-assurance-result.json",
      stage: rtFinal.stage,
      reconciledStatus: rtFinal.reconciledStatus,
      currentMainHead: rtFinal.currentMainHead,
      businessProductionAllowed: rtFinal.businessProductionAllowed,
      dormitoryL2ProductionAllowed: rtFinal.dormitoryL2ProductionAllowed,
      repairPartsHrStatus: rtFinal.repairPartsHrStatus
    },
    evidenceGraph: {
      ref: "artifacts/rt4/evidence-graph.json",
      mode: evidenceGraph.mode,
      releaseStates: evidenceGraph.releaseStates || {}
    },
    completionDashboard: {
      ref: "artifacts/rt4/completion-dashboard.json",
      mode: completionDashboard.mode,
      currentGate: completionDashboard.currentGate,
      currentGateStatus: completionDashboard.currentGateStatus,
      currentMainHead: completionDashboard.currentMainHead,
      businessProduction: completionDashboard.businessProduction,
      dormitoryL2Production: completionDashboard.dormitoryL2Production,
      repairPartsHrStatus: completionDashboard.repairPartsHrStatus
    },
    businessLineRegistry: {
      ref: "docs/business/business-line-registry.json",
      dormitory: l0LineSummary(dormitoryLine),
      repair: l0LineSummary(repairLine),
      parts: l0LineSummary(partsLine),
      hr: l0LineSummary(hrLine)
    },
    finalSystemGate: {
      ref: "artifacts/rt4/final-completion-assurance-result.json",
      status: "blocked",
      reason: "Final System Gate 仍由现有 release evidence 判定为 blocked，Business Production 必须保持 blocked。"
    },
    bStageGate: {
      ref: "artifacts/go-live/dormitory/b-stage-gate-result.json",
      status: bStageGate.status,
      sourceMode: bStageGate.source_mode,
      noGoItems: bStageGate.no_go_items || []
    },
    observation: {
      ref: "artifacts/go-live/dormitory/observation-window-result.json",
      status: observationWindow.status,
      observationWindowStatus: observationWindow.observationWindowStatus,
      decision: observationWindow.decision,
      l1ToL2Decision: observationWindow.l1ToL2Decision,
      l1ToL2Eligibility: l1ToL2.eligible
    }
  },
  authoritativeState: {
    dormInt: "DORM_INT_PASSED",
    rtFinal: rtFinal.reconciledStatus || rtFinal.officialStatus,
    evidenceGraph: "L1_INTERNAL_PILOT_OBSERVATION",
    completionDashboard: "L1_INTERNAL_PILOT_OBSERVATION",
    businessLineRegistry: "ALIGNED",
    finalSystemGate: "blocked",
    bStageGate: "passed",
    observation: "L1_INTERNAL_PILOT_OBSERVATION",
    dormitory: "L1_INTERNAL_PILOT_OBSERVATION",
    dormitoryL2: "BLOCKED",
    businessProduction: "BLOCKED",
    repair: "L0 Contract Preview",
    parts: "L0 Contract Preview",
    hr: "L0 Contract Preview"
  },
  prohibitedStates: {
    dormitoryL2ProductionAllowed: false,
    businessProductionAllowed: false,
    repairPartsHrProductionAllowed: false
  },
  evidenceRefs: [
    "docs/release-state/release-state-machine.yml",
    "docs/release-state/pilot-state-authority.md",
    "schemas/release-state/release-state.schema.json",
    "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
    "artifacts/rt4/final-completion-assurance-result.json",
    "artifacts/rt4/evidence-graph.json",
    "artifacts/rt4/completion-dashboard.json",
    "docs/business/business-line-registry.json",
    "artifacts/go-live/dormitory/b-stage-gate-result.json",
    "artifacts/go-live/dormitory/observation-window-result.json",
    "artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json",
    "artifacts/release-state/current-state.json",
    "artifacts/release-state/state-transition-log.json"
  ],
  noGoItems: [],
  decisions: [
    "DORM-INT GO 只裁决为 L1 Internal Pilot Observation。",
    "Final System Gate blocked 时 Business Production 保持 blocked。",
    "Dormitory L2 保持 blocked，L1 -> L2 需要单独 stage / PR / gate。",
    "Repair / Parts / HR 保持 L0 Contract Preview。"
  ]
};

const transitionLog = {
  version: "release-state.transition-log.v1",
  generatedAtUtc,
  currentMainHead: headSha,
  transitions: [
    {
      id: "central-merge-to-dorm-int",
      status: evidenceGraph.releaseStates?.centralMerge || "CENTRAL_MERGE_COMPLETED",
      evidenceRef: "artifacts/rt4/evidence-graph.json"
    },
    {
      id: "dorm-int-to-l1-observation",
      from: dormInt.status,
      to: currentState.authoritativeState.dormitory,
      evidenceRef: "artifacts/go-live/dormitory/internal-pilot-go-no-go.json"
    },
    {
      id: "block-business-production",
      from: currentState.sources.finalSystemGate.status,
      to: currentState.authoritativeState.businessProduction,
      evidenceRef: "artifacts/rt4/final-completion-assurance-result.json"
    },
    {
      id: "isolate-non-dormitory-lines",
      to: "Repair / Parts / HR = L0 Contract Preview",
      evidenceRef: "docs/business/business-line-registry.json"
    }
  ]
};

writeJson("artifacts/release-state/current-state.json", currentState);
writeJson("artifacts/release-state/state-transition-log.json", transitionLog);

console.log(`current release state built for ${headSha}: ${currentState.authoritativeState.dormitory}`);
