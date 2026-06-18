import { execFileSync } from "node:child_process";
import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  buildProjectionFromLedger,
  digestObject,
  eventDigest,
  loadCapabilityDocuments,
  readJsonIfExists,
  validateAuthorityLedger,
  validateCapabilityRegistry,
  validateCurrentProjection,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  validateGeneratedCandidateAcceptanceAuthority
} from "./lib/generated-candidate-subject.mjs";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  validateDormitoryRuntimeAdmissionAuthority
} from "./lib/dormitory-runtime-admission.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/capability-ledger-projection-replay-result.json";
const { registry, ledger } = loadCapabilityDocuments(root);
const failures = [];
const appendedEvents = [];

const registryStateBefore = validateCapabilityRegistry({ registry, root });
failures.push(...registryStateBefore.failures);

const normalizedLedger = failures.length === 0
  ? appendCurrentAcceptedRuntimeEvents(ledger)
  : ledger;
const ledgerState = validateAuthorityLedger({ ledger: normalizedLedger, root });
failures.push(...ledgerState.failures);

if (failures.length === 0) {
  if (appendedEvents.length > 0) {
    writeJson(CAPABILITY_LEDGER_PATH, normalizedLedger, root);
  }
  const projection = buildProjectionFromLedger(normalizedLedger, root);
  const nextRegistry = {
    ...registry,
    activeAuthority: projection.activeAuthority
  };
  writeJson(CAPABILITY_PROJECTION_PATH, projection, root);
  writeJson(CAPABILITY_REGISTRY_PATH, nextRegistry, root);

  const refreshed = loadCapabilityDocuments(root);
  const projectionState = validateCurrentProjection({
    registry: refreshed.registry,
    ledger: refreshed.ledger,
    projection: refreshed.projection,
    root
  });
  failures.push(...projectionState.failures);
}

const result = {
  version: "oam.capability-ledger-projection-replay.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityLedgerRef: CAPABILITY_LEDGER_PATH,
  currentProjectionRef: CAPABILITY_PROJECTION_PATH,
  registryRef: CAPABILITY_REGISTRY_PATH,
  replayMode: "append_current_acceptance_events_then_replay_projection",
  appendedEventCount: appendedEvents.length,
  appendedEvents,
  registryActiveAuthorityUpdatedFromProjection: failures.length === 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Capability ledger projection replay: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Capability ledger projection replay: PASS");

function appendCurrentAcceptedRuntimeEvents(sourceLedger) {
  const nextLedger = {
    ...sourceLedger,
    events: [...(sourceLedger?.events ?? [])]
  };
  const acceptanceAuthority = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
  const acceptance = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: acceptanceAuthority,
    root,
    currentHead: gitHead()
  });
  if (acceptance.status !== "PASS" || acceptance.generatedCandidateAcceptedBy00 !== true) {
    failures.push("generated candidate acceptance must PASS before capability ledger can append current accepted bundle.");
    failures.push(...(acceptance.failures ?? []));
    return nextLedger;
  }

  const runtimeAuthority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
  const runtimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
    authority: runtimeAuthority,
    root,
    currentHead: gitHead(),
    writeProof: false
  });
  if (runtimeAdmission.status !== "PASS") {
    failures.push("dormitory runtime admission must PASS before capability ledger can append runtime admission event.");
    failures.push(...(runtimeAdmission.failures ?? []));
    return nextLedger;
  }

  const acceptedDigest = acceptance.acceptedGeneratedBundleDigest;
  const subjectDigest = acceptance.subjectDigest;
  const sourceClosureDigest = acceptance.generatedFieldBindingClosureDigest;
  const runtimeAdmissionDigest = digestObject(runtimeAuthority);
  const now = new Date().toISOString();

  if (lastEventOfType(nextLedger.events, "GENERATED_BUNDLE_BUILT")?.bundleDigest !== acceptedDigest) {
    pushEvent(nextLedger, {
      eventType: "GENERATED_BUNDLE_BUILT",
      bundleDigest: acceptedDigest,
      inputDigests: {
        sourceClosureDigest
      },
      outputDigests: {
        generatedBundleDigest: acceptedDigest
      },
      decision: "GENERATED_BUNDLE_REBUILT_AS_IMMUTABLE_DIGEST_ONLY",
      decidedAtUtc: now,
      forbiddenInterpretations: [
        "generated bundle rebuild is not generated bundle acceptance",
        "generated bundle rebuild is not runtime admission",
        "generated bundle rebuild is not business landing",
        "generated bundle rebuild is not production confirmation",
        "generated bundle rebuild is not release authority"
      ]
    });
  }

  const acceptedEvent = lastEventOfType(nextLedger.events, "GENERATED_BUNDLE_ACCEPTED_BY_00");
  if (acceptedEvent?.bundleDigest !== acceptedDigest ||
    acceptedEvent?.outputDigests?.acceptedGeneratedBundleDigest !== acceptedDigest) {
    pushEvent(nextLedger, {
      eventType: "GENERATED_BUNDLE_ACCEPTED_BY_00",
      subjectDigest,
      bundleDigest: acceptedDigest,
      inputDigests: {
        generatedBundleDigest: acceptedDigest
      },
      outputDigests: {
        acceptedGeneratedBundleDigest: acceptedDigest
      },
      decision: "ACCEPTED_BY_00_FOR_GENERATED_BUNDLE_ONLY",
      decidedAtUtc: now,
      forbiddenInterpretations: [
        "generated bundle acceptance is not runtime admission",
        "generated bundle acceptance is not business landing",
        "generated bundle acceptance is not production confirmation",
        "generated bundle acceptance is not release authority",
        "generated bundle acceptance is not final GO"
      ]
    });
  }

  const runtimeEvent = lastEventOfType(nextLedger.events, "RUNTIME_TEST_ADMITTED");
  if (runtimeEvent?.bundleDigest !== acceptedDigest ||
    runtimeEvent?.outputDigests?.runtimeConsumedBundleDigest !== acceptedDigest) {
    pushEvent(nextLedger, {
      eventType: "RUNTIME_TEST_ADMITTED",
      subjectDigest: runtimeAdmissionDigest,
      bundleDigest: acceptedDigest,
      inputDigests: {
        acceptedGeneratedBundleDigest: acceptedDigest
      },
      outputDigests: {
        runtimeConsumedBundleDigest: acceptedDigest,
        runtimeAdmissionDigest
      },
      decision: "RUNTIME_TEST_ADMITTED_ONLY_NO_BUSINESS_LANDING",
      decidedAtUtc: now,
      forbiddenInterpretations: [
        "runtime test admission is not business landing",
        "runtime test admission is not production confirmation",
        "runtime test admission is not release authority",
        "runtime test admission is not final GO",
        "browser audit PASS is not production confirmation"
      ]
    });
  }

  return nextLedger;
}

function pushEvent(targetLedger, event) {
  const eventNumber = String((targetLedger.events?.length ?? 0) + 1).padStart(4, "0");
  const previous = targetLedger.events?.at(-1) ?? null;
  const nextEvent = {
    eventId: `${CAPABILITY_ID}:${eventNumber}:${event.eventType}`,
    capabilityId: CAPABILITY_ID,
    previousEventDigest: previous ? eventDigest(previous) : null,
    decidedBy: "00｜OAM 总控",
    ...event
  };
  targetLedger.events.push(nextEvent);
  appendedEvents.push({
    eventId: nextEvent.eventId,
    eventType: nextEvent.eventType,
    bundleDigest: nextEvent.bundleDigest ?? null,
    subjectDigest: nextEvent.subjectDigest ?? null
  });
}

function lastEventOfType(events = [], type) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.eventType === type) return events[index];
  }
  return null;
}

function gitHead() {
  try {
    return process.env.GIT_HEAD_OVERRIDE ??
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
