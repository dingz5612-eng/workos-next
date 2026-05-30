import { describe, expect, it } from "vitest";
import { releaseControlView } from "../views/releaseControlView.js";

describe("Release Control Center", () => {
  it("release_control_center_lists_all_mrs", () => {
    const selectedRelease = releaseDetail();
    const html = releaseControlView(ctx(selectedRelease, [
      selectedRelease.overview,
      { ...selectedRelease.overview, releaseId: "release-43", mrId: "MR-43", releaseStatus: "pilot" }
    ]));

    expect(html).toContain("All MRs");
    expect(html).toContain("MR-42");
    expect(html).toContain("MR-43");
  });

  it("release_control_center_can_serve_as_launch_console", () => {
    const base = releaseDetail();
    const html = releaseControlView(ctx(releaseDetail({
      overview: { ...base.overview, gateResultStatus: "passed", shadowGrade: "green" },
      gateResult: { ...base.gateResult, status: "passed", businessSignoffRefs: ["business-signoff-1"] },
      shadowReports: [report("green")],
      invariantChecks: [invariant("runtime.ok", "blocking", "P0", "passed", 0)]
    })));

    expect(html).toContain("data-launch-control-console=\"true\"");
    expect(html).toContain("Launch Control");
    expect(html).toContain("active readiness");
    expect(html).toContain("locked readiness");
    expect(html).toContain("Business Signoff");
    expect(html).toContain("go");
  });

  it("loads release manifest overview and read-only GateResult status", () => {
    const html = releaseControlView(ctx(releaseDetail()));

    expect(html).toContain("MR-42");
    expect(html).toContain("release status");
    expect(html).toContain("shadow");
    expect(html).toContain("GateResult status");
    expect(html).toContain("blocked");
    expect(html).not.toContain("data-submit-card");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("active</button>");
  });

  it("gate_result_readonly", () => {
    const html = releaseControlView(ctx(releaseDetail({
      gateResult: {
        gateResultId: "gate-42",
        status: "passed",
        generatedBy: "gate-runner",
        gateType: "release",
        severity: "P0",
        invariantCheckRefs: ["inv-p0"],
        businessSignoffRefs: ["business-signoff-1"]
      }
    })));

    expect(html).toContain("data-gate-result-readonly=\"true\"");
    expect(html).toContain("GateResult status");
    expect(html).toContain("passed");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("name=\"status\"");
  });

  it("shows Shadow grades green yellow red", () => {
    const html = releaseControlView(ctx(releaseDetail({
      shadowReports: [
        report("green"),
        report("yellow"),
        report("red")
      ]
    })));

    expect(html).toContain("grade-green");
    expect(html).toContain("grade-yellow");
    expect(html).toContain("grade-red");
  });

  it("shows invariant modes blocking and observing", () => {
    const html = releaseControlView(ctx(releaseDetail({
      invariantChecks: [
        invariant("runtime.control_plane_tables_exist", "blocking", "P0"),
        invariant("runtime.warning", "observing", "P2")
      ]
    })));

    expect(html).toContain("blocking");
    expect(html).toContain("observing");
  });

  it("shows rollback and compensating instruction types", () => {
    const rollbackHtml = releaseControlView(ctx(releaseDetail({
      rollbackInstruction: rollback("rollback")
    })));
    const compensatingHtml = releaseControlView(ctx(releaseDetail({
      rollbackInstruction: rollback("compensating")
    })));

    expect(rollbackHtml).toContain("instruction_type");
    expect(rollbackHtml).toContain("rollback");
    expect(compensatingHtml).toContain("compensating");
  });

  it("red_shadow_report_blocks_active", () => {
    const html = releaseControlView(ctx(releaseDetail({
      overview: {
        ...releaseDetail().overview,
        gateResultStatus: "passed",
        shadowGrade: "red"
      },
      gateResult: {
        ...releaseDetail().gateResult,
        status: "passed",
        businessSignoffRefs: ["business-signoff-1"]
      },
      shadowReports: [report("red")],
      invariantChecks: [invariant("runtime.ok", "blocking", "P0", "passed", 0)]
    })));

    expect(html).toContain("active transition");
    expect(html).toContain("blocked");
    expect(html).toContain("red_shadow_report");
  });

  it("missing_rollback_instruction_blocks_active", () => {
    const base = releaseDetail();
    const html = releaseControlView(ctx(releaseDetail({
      overview: { ...base.overview, gateResultStatus: "passed", shadowGrade: "green", rollbackInstructionId: null },
      gateResult: { ...base.gateResult, status: "passed", businessSignoffRefs: ["business-signoff-1"] },
      shadowReports: [report("green")],
      invariantChecks: [invariant("runtime.ok", "blocking", "P0", "passed", 0)],
      rollbackInstruction: null
    })));

    expect(html).toContain("rollback_instruction_missing");
    expect(html).toContain("active transition");
    expect(html).toContain("blocked");
  });

  it("business_signoff_required_for_locked", () => {
    const base = releaseDetail();
    const html = releaseControlView(ctx(releaseDetail({
      overview: { ...base.overview, gateResultStatus: "passed", shadowGrade: "green" },
      gateResult: { ...base.gateResult, status: "passed", businessSignoffRefs: [] },
      shadowReports: [report("green")],
      invariantChecks: [invariant("runtime.ok", "blocking", "P0", "passed", 0)]
    })));

    expect(html).toContain("Business Signoff");
    expect(html).toContain("business_signoff_missing");
    expect(html).toContain("locked admission");
    expect(html).toContain("blocked");
  });
});

function ctx(selectedRelease, releases = [selectedRelease.overview]) {
  return {
    state: {
      releaseControl: {
        releases,
        selectedRelease
      }
    },
    shell: (content) => content,
    escapeHtml: (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
  };
}

function releaseDetail(overrides = {}) {
  return {
    overview: {
      releaseId: "release-42",
      mrId: "MR-42",
      releaseStatus: "shadow",
      owner: "platform",
      gateResultId: "gate-42",
      gateResultStatus: "blocked",
      shadowCompareReportId: "shadow-42",
      shadowGrade: "red",
      invariantCounts: { p0: 1, p1: 2, p2: 3 },
      featureFlagStatus: "shadow",
      sliceRuntimeMode: "pilot",
      rollbackInstructionId: "rollback-42",
      acceptanceProgress: { completed: 2, total: 4, percent: 50 }
    },
    gateResult: {
      gateResultId: "gate-42",
      status: "blocked",
      generatedBy: "gate-runner",
      invariantCheckRefs: ["inv-p0"]
    },
    shadowReports: [report("red")],
    invariantChecks: [invariant("runtime.control_plane_tables_exist", "blocking", "P0")],
    featureFlags: [{ status: "shadow" }],
    sliceCutoverStates: [{ runtimeMode: "pilot" }],
    rollbackInstruction: rollback("rollback"),
    manifest: {
      releaseId: "release-42",
      mrId: "MR-42",
      releaseName: "Mission Loop",
      status: "shadow",
      owners: ["platform"],
      ciRunId: "ci-42",
      createdAtUtc: "2026-05-30T00:00:00Z",
      updatedAtUtc: "2026-05-30T01:00:00Z"
    },
    ...overrides
  };
}

function report(grade) {
  return {
    shadowCompareReportId: `shadow-${grade}`,
    grade
  };
}

function invariant(invariantKey, mode, severity, status = undefined, violationCount = undefined) {
  return {
    invariantKey,
    mode,
    severity,
    status: status ?? (severity === "P0" ? "failed" : "warning"),
    violationCount: violationCount ?? (severity === "P0" ? 1 : 0)
  };
}

function rollback(instructionType) {
  return {
    rollbackInstructionId: `rollback-${instructionType}`,
    instructionType,
    rollbackKind: instructionType === "rollback" ? "runtime_mode" : "manual_compensation",
    owner: "architecture"
  };
}
