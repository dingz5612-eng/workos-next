export {
  AuditTraceVM,
  DeviceTrustVM,
  EvidenceTrustVM,
  GovernanceTraceVM,
  LearningRecommendationVM,
  OperationPanelVM,
  PcFinanceCaseVM,
  PcManagerTowerVM,
  QueueStateVM,
  ReleaseControlVM,
  SearchResultVM,
  TrustedConfirmVM,
  WorkItemDecisionVM,
  sourceRefsFrom
} from "../../../../packages/surface-view-models/src/index.js";

export const mobileViewModelCopyKeys = [
  "noPendingEvidenceUpload",
  "noPendingSubmission",
  "evidenceUploadWaiting",
  "submissionWaiting",
  "deviceTrusted",
  "deviceUnknown",
  "deviceContextIssueBody",
  "canHandleNow",
  "cannotHandleNow",
  "missingEvidenceBlocks",
  "trustedConfirmImpact",
  "ledgerImpactPresent",
  "ledgerNoImpact",
  "listSeparator",
  "sentenceSeparator",
  "sentenceEnd",
  "rollbackCompensationReady"
];
