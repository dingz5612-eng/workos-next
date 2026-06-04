import { readJson, repositoryHead, workflowRunsForHead, pickWorkflowRun, normalizeRun, writeJson, writeText, repository, localHead } from "../oam/clean-baseline-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const repoHead = repositoryHead();
const postMergePrNumber = Number(process.env.OAM_POST_MERGE_PR_NUMBER || 72);
const requestedMergeCommitSha = process.env.OAM_POST_MERGE_MERGE_COMMIT_SHA || null;
const pullRequest = await readPullRequest(postMergePrNumber);
const runs = await workflowRunsForHead(repoHead);
const ci = normalizeRun(pickWorkflowRun(runs, "CI"));
const v54 = normalizeRun(pickWorkflowRun(runs, "V5.4 Control Plane Guards"));
const ciGreen = ci?.status === "completed" && ci?.conclusion === "success" && ci?.headSha === repoHead;
const v54Green = v54?.status === "completed" && v54?.conclusion === "success" && v54?.headSha === repoHead;
const requestedMergeMatches = !requestedMergeCommitSha || requestedMergeCommitSha === repoHead;
const prMergeMatches = !pullRequest?.merge_commit_sha || pullRequest.merge_commit_sha === repoHead;
const verified = ciGreen && v54Green && requestedMergeMatches && prMergeMatches;
const noGoItems = [];
if (!ciGreen) noGoItems.push("最新 main 的 CI 还没有可验证的成功证据。");
if (!v54Green) noGoItems.push("最新 main 的 V5.4 Guards 还没有可验证的成功证据。");
if (!requestedMergeMatches) noGoItems.push("请求绑定的 merge_commit_sha 与远端 main 不一致。");
if (!prMergeMatches) noGoItems.push("PR merge_commit_sha 与远端 main 不一致。");

const currentState = safeRead("artifacts/release-state/current-state.json");
const goNoGo = safeRead("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const day1 = safeRead("artifacts/operations/dormitory/observation-day-01.json");

const result = {
  generatedAtUtc,
  generatedBy: "build-post-merge-attestation",
  repository,
  repositoryHead: repoHead,
  verifiedMainHead: verified ? repoHead : null,
  status: verified ? "passed" : "WAITING_FOR_POST_MERGE_ATTESTATION",
  localHead: localHead(),
  prNumber: postMergePrNumber,
  prHead: pullRequest?.head?.sha ?? null,
  prBase: pullRequest?.base?.sha ?? null,
  prMergedAt: pullRequest?.merged_at ?? null,
  prHtmlUrl: pullRequest?.html_url ?? null,
  prMergeCommitSha: pullRequest?.merge_commit_sha ?? null,
  requestedMergeCommitSha,
  mergeCommit: repoHead,
  remoteMain: {
    repository,
    branch: "main",
    headSha: repoHead,
    verifiedAtUtc: generatedAtUtc
  },
  ci,
  v54ControlPlaneGuards: v54,
  artifacts: {
    currentState: {
      artifactPath: "artifacts/release-state/current-state.json",
      artifactHead: currentState?.currentMain?.headSha ?? null,
      artifactCiHead: currentState?.currentMain?.ci?.headSha ?? null,
      artifactV54Head: currentState?.currentMain?.v54ControlPlaneGuards?.headSha ?? null
    },
    internalPilotGoNoGo: {
      artifactPath: "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
      artifactHead: goNoGo?.latestMain?.commitSha ?? null,
      artifactCiHead: goNoGo?.latestMain?.ci?.headSha ?? null,
      artifactV54Head: goNoGo?.latestMain?.v54ControlPlaneGuards?.headSha ?? null
    },
    observationDay01: {
      artifactPath: "artifacts/operations/dormitory/observation-day-01.json",
      artifactHead: day1?.headSha ?? null,
      artifactBase: day1?.originMainHead ?? null,
      mergeCommit: repoHead
    }
  },
  controls: {
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHr: "L0 Contract Preview",
    day2AllowedByAttestation: verified
  },
  evidenceRefs: [
    "artifacts/release-state/post-merge-attestation.json",
    "artifacts/operations/dormitory/observation-day-01.json",
    "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
    "artifacts/release-state/current-state.json"
  ],
  noGoItems
};

writeJson("artifacts/release-state/post-merge-attestation.json", result);
writeText("docs/release-state/post-merge-attestation.md", renderReport(result));
console.log(`post-merge attestation: ${result.status}`);

function safeRead(relativePath) {
  try {
    return readJson(relativePath);
  } catch {
    return null;
  }
}

async function readPullRequest(prNumber) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "workosnext-oam-post-clean-attestation"
      }
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function renderReport(result) {
  return `# Post-Merge Attestation\n\n` +
    `生成时间：${result.generatedAtUtc}\n\n` +
    `- repositoryHead: \`${result.repositoryHead}\`\n` +
    `- verifiedMainHead: \`${result.verifiedMainHead ?? "WAITING"}\`\n` +
    `- PR: \`#${result.prNumber}\`\n` +
    `- PR merged_at: \`${result.prMergedAt ?? "missing"}\`\n` +
    `- PR merge commit: \`${result.prMergeCommitSha ?? "missing"}\`\n` +
    `- CI run id: \`${result.ci?.id ?? "missing"}\`\n` +
    `- V5.4 Guards run id: \`${result.v54ControlPlaneGuards?.id ?? "missing"}\`\n` +
    `- status: \`${result.status}\`\n\n` +
    `## 中文结论\n\n` +
    (result.status === "passed"
      ? "最新 main 已有 CI 与 V5.4 Guards 成功证据，可以作为 verifiedMainHead。"
      : "最新 main 暂无完整 post-merge attestation，不能把 Day-1 / Day-2 签成 accepted。") +
    `\n\n## 边界\n\n宿舍仍仅为 L1 Internal Pilot Observation；Dormitory L2 Production=false；Business Production=blocked；Repair / Parts / HR=L0 Contract Preview。\n`;
}

