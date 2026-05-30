using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class V54ControlPlaneGuardTests
{
    private static string RepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return current!.FullName;
    }

    private static string RepoPath(params string[] segments)
    {
        return Path.Combine(new[] { RepoRoot() }.Concat(segments).ToArray());
    }

    [TestMethod]
    public void V54WorkflowDeclaresFirstBatchGuardSkeleton()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "v5_4_control_plane.yml"));
        var localCommand = File.ReadAllText(RepoPath("scripts", "v5_4", "run-control-plane-checks.ps1"));
        var docs = File.ReadAllText(RepoPath("docs", "v5.4", "ci-control-plane.md"));

        foreach (var guard in new[]
        {
            "architecture-guard",
            "api-boundary-check",
            "control-plane-migration",
            "control-plane-schema-verify",
            "shadow-namespace-isolation",
            "invariant-runner",
            "shadow-compare-runner",
            "gate-runner",
            "generate-release-manifest",
            "release-manifest-validate"
        })
        {
            Assert.IsTrue(workflow.Contains(guard), $"workflow must include {guard}");
            Assert.IsTrue(localCommand.Contains(guard), $"local command must include {guard}");
            Assert.IsTrue(docs.Contains(guard), $"docs must include {guard}");
        }

        Assert.IsTrue(workflow.Contains("docs/v5.4/releases/mr-00-control-plane-bootstrap.json"), "workflow must write MR-00 release manifest");
        Assert.IsTrue(workflow.Contains("docs/v5.4/rollback/mr-00-rollback-instruction.json"), "workflow must consume MR-00 rollback instruction");
        Assert.IsFalse(workflow.Contains("--manifest=docs/v5.4/release-manifest.fixture.json"), "workflow must not validate only the fixture manifest");
        Assert.IsTrue(workflow.Contains("--mode=semantic"), "workflow shadow compare must run semantic mode");
        Assert.IsTrue(localCommand.Contains("--mode=semantic"), "local shadow compare must run semantic mode");
        Assert.IsTrue(workflow.Contains("--formal-release-gate=true"), "workflow gate-runner must run as a formal release gate");
        Assert.IsTrue(localCommand.Contains("--formal-release-gate=true"), "local control-plane command must run gate-runner as a formal release gate");
        Assert.IsTrue(workflow.Contains("--rollback=docs/v5.4/rollback/mr-00-rollback-instruction.json"), "formal gate-runner must receive rollback evidence");
    }

    [TestMethod]
    public void ControlPlaneSchemaVerifyScriptRunsDatabaseBackedGuard()
    {
        var script = File.ReadAllText(RepoPath("scripts", "v5_4", "control-plane-schema-verify.mjs"));
        var runner = File.ReadAllText(RepoPath("tools", "control-plane", "WorkOS.ControlPlaneRunners", "ControlPlaneSchemaVerifyJob.cs"));

        Assert.IsTrue(script.Contains("schema-verify"), "schema verify script must invoke the database-backed runner");
        Assert.IsTrue(runner.Contains("information_schema.tables"), "schema verify must query information_schema.tables");
        Assert.IsTrue(runner.Contains("shadow_compare_reports.grade"), "schema verify must probe shadow compare grade");
        Assert.IsTrue(runner.Contains("runtime_invariant_checks.mode"), "schema verify must probe invariant mode");
        Assert.IsTrue(runner.Contains("runtime_invariant_checks.severity"), "schema verify must probe invariant severity");
        Assert.IsTrue(runner.Contains("rollback_instructions.instruction_type"), "schema verify must probe rollback instruction type");
        Assert.IsTrue(runner.Contains("PostgresErrorCodes.CheckViolation"), "schema verify must require PostgreSQL check violations");
    }

    [TestMethod]
    public void FirstBatchInvariantDefinitionsUseRealBlockingChecks()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "invariant-definitions.json")));
        var byKey = document.RootElement.GetProperty("invariants")
            .EnumerateArray()
            .ToDictionary(item => item.GetProperty("invariant_key").GetString()!, StringComparer.Ordinal);

        Assert.AreEqual("sql", byKey["runtime.control_plane_tables_exist"].GetProperty("source_type").GetString());
        Assert.IsTrue(byKey["runtime.control_plane_tables_exist"].GetProperty("check_sql").GetString()!.Contains("information_schema.tables", StringComparison.Ordinal));

        Assert.AreEqual("api-boundary-check-v2", byKey["api.no_page_specific_business_write"].GetProperty("source_type").GetString());
        Assert.AreEqual("service-db-file", byKey["shadow.no_shadow_event_consumed_by_official_projector"].GetProperty("source_type").GetString());
        Assert.AreEqual("file+dist-scan", byKey["runtime.no_production_demo_fallback"].GetProperty("source_type").GetString());

        Assert.AreEqual("sql", byKey["gate.gate_result_machine_generated"].GetProperty("source_type").GetString());
        var gateSql = byKey["gate.gate_result_machine_generated"].GetProperty("check_sql").GetString()!;
        Assert.IsTrue(gateSql.Contains("generated_by <> 'gate-runner'", StringComparison.Ordinal));
        Assert.IsTrue(gateSql.Contains("gate_type <> 'automated'", StringComparison.Ordinal));
        Assert.IsTrue(gateSql.Contains("input_hash", StringComparison.Ordinal));
        Assert.IsTrue(gateSql.Contains("result_hash", StringComparison.Ordinal));

        Assert.AreEqual("sql", byKey["release.release_manifest_has_ci_run"].GetProperty("source_type").GetString());
        Assert.IsTrue(byKey["release.release_manifest_has_ci_run"].GetProperty("check_sql").GetString()!.Contains("ci_run_id", StringComparison.Ordinal));

        var runner = File.ReadAllText(RepoPath("tools", "control-plane", "WorkOS.ControlPlaneRunners", "InvariantRunner.cs"));
        Assert.IsTrue(runner.Contains("ApiBoundaryCheckV2", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("ProjectionCheckpointShadowNamespaceCheck", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("file+dist-scan", StringComparison.Ordinal));

        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "028_projection_checkpoint_source_namespace.sql"));
        Assert.IsTrue(migration.Contains("source_namespace", StringComparison.Ordinal));
        Assert.IsTrue(migration.Contains("<> 'shadow_runtime'", StringComparison.Ordinal));
    }

    [TestMethod]
    public void ShadowCompareSemanticRulesDefineFirstGroup()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "shadow-compare-semantic-rules.json")));
        var root = document.RootElement;
        Assert.AreEqual(1, root.GetProperty("version").GetInt32());
        Assert.AreEqual("v5.4-first-semantic-shadow-compare", root.GetProperty("name").GetString());

        var checks = root.GetProperty("checks")
            .EnumerateArray()
            .Select(item => item.GetProperty("check_id").GetString())
            .ToArray();
        CollectionAssert.Contains(checks, "shadow.official_contamination");
        CollectionAssert.Contains(checks, "shadow.command_submission_compare");
        CollectionAssert.Contains(checks, "operations.contract_response_schema");
        CollectionAssert.Contains(checks, "shadow.business_fact_safety");

        var requiredFields = root.GetProperty("operations_contract_required_fields")
            .EnumerateArray()
            .Select(item => item.GetString())
            .ToArray();
        CollectionAssert.AreEqual(new[] { "workItemId", "submissionId", "commitStatus", "projectionStatus" }, requiredFields);

        var redRules = string.Join("\n", root.GetProperty("grade_rules").GetProperty("red").EnumerateArray().Select(item => item.GetString()));
        Assert.IsTrue(redRules.Contains("shadow facts in official tables", StringComparison.Ordinal));
        Assert.IsTrue(redRules.Contains("missing submissionId", StringComparison.Ordinal));
        Assert.IsTrue(redRules.Contains("missing commitStatus", StringComparison.Ordinal));
        Assert.IsTrue(redRules.Contains("money/evidence/ledger contamination", StringComparison.Ordinal));
    }

    [TestMethod]
    public void ShadowCompareRunnerSupportsSemanticModeAndKeepsCountCompare()
    {
        var runner = File.ReadAllText(RepoPath("tools", "control-plane", "WorkOS.ControlPlaneRunners", "ShadowCompareRunner.cs"));
        var database = File.ReadAllText(RepoPath("tools", "control-plane", "WorkOS.ControlPlaneRunners", "ControlPlaneDatabase.cs"));

        Assert.IsTrue(runner.Contains("CompareSemantic", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("CountCompareResult", StringComparison.Ordinal), "semantic compare must preserve row count compare");
        Assert.IsTrue(runner.Contains("OfficialContaminationCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("CommandSubmissionCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("OperationsContractCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("BusinessFactSafetyCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("same_command_payload_hash_must_match", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("missing_required_field", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("shadow_fact_contamination", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("shadow-compare-semantic-rules.json", StringComparison.Ordinal));
        Assert.IsTrue(database.Contains("ShadowLedgerOfficialContaminationCheck", StringComparison.Ordinal));
        Assert.IsTrue(database.Contains("ShadowDomainEventOfficialContaminationCheck", StringComparison.Ordinal));
        Assert.IsTrue(database.Contains("shadow.shadow_ledger_entry_id", StringComparison.Ordinal));
        Assert.IsTrue(database.Contains("shadow.shadow_event_id", StringComparison.Ordinal));
    }

    [TestMethod]
    public void ShadowCompareSemanticContractCheckFailsWithoutSubmissionIdOrCommitStatus()
    {
        var rules = RunnerJson.Read<ShadowSemanticRules>(RepoPath("docs", "v5.4", "shadow-compare-semantic-rules.json"));
        const string contractWithoutRequiredFields = """
            public sealed record ConfirmWorkItemResult(string WorkItemId, string ProjectionStatus);

            private static object LegacyConfirmPayload() => new Dictionary<string, object?>
            {
                ["workItemId"] = "wi-1",
                ["projectionStatus"] = "projected"
            };
            """;

        var result = ShadowSemanticChecks.CompareOperationsContract(rules, contractWithoutRequiredFields, "test-source");
        var samples = JsonSerializer.Serialize(result.Samples, RunnerJson.Options);

        Assert.AreEqual("operations.contract_response_schema", result.CheckId);
        Assert.AreEqual("red", result.Grade);
        Assert.AreEqual("missing_required_field", result.Status);
        Assert.IsTrue(samples.Contains("submissionId", StringComparison.Ordinal), "semantic compare must detect missing submissionId");
        Assert.IsTrue(samples.Contains("commitStatus", StringComparison.Ordinal), "semantic compare must detect missing commitStatus");
    }

    [TestMethod]
    public void ShadowCompareSemanticContractCheckPassesCurrentOperationsCompatibilityFields()
    {
        var rules = RunnerJson.Read<ShadowSemanticRules>(RepoPath("docs", "v5.4", "shadow-compare-semantic-rules.json"));
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeService.cs"));

        var result = ShadowSemanticChecks.CompareOperationsContract(rules, source, "OperationsRuntimeService.cs");

        Assert.AreEqual("green", result.Grade);
        Assert.AreEqual(0, result.ViolationCount);
    }

    [TestMethod]
    public async Task InvariantRunnerConsumesApiBoundaryV2JsonReport()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-api-invariant-{Guid.NewGuid():N}"));
        try
        {
            var definitionsPath = Path.Combine(temp.FullName, "invariants.json");
            var outputPath = Path.Combine(temp.FullName, "out.json");
            RunnerJson.Write(definitionsPath, new InvariantDefinitionFile(new[]
            {
                new InvariantDefinition(
                    "api.no_page_specific_business_write",
                    "All non-GET /api/* write routes must be classified by the v2 API boundary guard.",
                    "blocking",
                    "P0",
                    "api-boundary-check-v2",
                    null,
                    "scripts/check-api-boundaries.mjs")
            }));

            var previousDirectory = Directory.GetCurrentDirectory();
            Directory.SetCurrentDirectory(RepoRoot());
            IReadOnlyList<InvariantCheckEvidence> results;
            try
            {
                results = await InvariantRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--dry-run=true",
                    $"--definitions={definitionsPath}",
                    $"--out={outputPath}"
                }));
            }
            finally
            {
                Directory.SetCurrentDirectory(previousDirectory);
            }

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual("passed", results[0].Status);
            Assert.AreEqual("api-boundary-check-v2", results[0].SourceType);
            Assert.AreEqual(0, results[0].ViolationCount);
            Assert.AreEqual(3, Convert.ToInt32(results[0].ObservedValue["version"]));
            Assert.AreEqual(0, Convert.ToInt32(results[0].ObservedValue["unclassified_write_route_count"]));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void GenerateReleaseManifestUsesGateEvidenceAndCiRunId()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-manifest-{Guid.NewGuid():N}"));
        try
        {
            var gatePath = Path.Combine(temp.FullName, "gate.json");
            var rollbackPath = Path.Combine(temp.FullName, "rollback.json");
            var manifestPath = Path.Combine(temp.FullName, "release-manifest.generated.json");
            RunnerJson.Write(gatePath, new GateResultEvidence(
                "gate-ci-123",
                "v5.4-control-plane",
                "MR-00",
                null,
                null,
                "v5.4-control-plane",
                "automated",
                "passed",
                "P2",
                "ci-123",
                ["test"],
                ["inv-1"],
                ["scr-1"],
                [],
                [],
                ["generated"],
                [],
                "gate-runner",
                DateTimeOffset.UtcNow,
                "input",
                "result"));
            File.WriteAllText(rollbackPath, """
                {
                  "rollback_instruction_id": "rollback-ci-123",
                  "instruction_type": "rollback",
                  "rollback_kind": "migration_down"
                }
                """);

            RunNode(
                "scripts/v5_4/generate-release-manifest.mjs",
                $"--releaseId=v5.4-control-plane",
                "--mrId=MR-00",
                "--releaseName=V5.4 Control Plane CI Gate",
                "--status=planned",
                $"--gateResultFile={gatePath}",
                $"--rollbackInstructionFile={rollbackPath}",
                "--commitSha=sha-123",
                "--ciRunId=ci-123",
                $"--out={manifestPath}");
            RunNode(
                "scripts/v5_4/release-manifest-validate.mjs",
                $"--manifest={manifestPath}",
                $"--gate={gatePath}",
                "--require-ci-run-id=true");

            using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
            var root = manifest.RootElement;
            Assert.AreEqual("ci-123", root.GetProperty("ci_run_id").GetString());
            Assert.AreEqual("gate-ci-123", root.GetProperty("gate_result_id").GetString());
            Assert.AreEqual("rollback-ci-123", root.GetProperty("rollback_instruction_id").GetString());
            Assert.AreEqual("inv-1", root.GetProperty("invariant_check_ids")[0].GetString());
            Assert.AreEqual("scr-1", root.GetProperty("shadow_compare_report_ids")[0].GetString());
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void Mr00ReleaseManifestAndRollbackInstructionAreValid()
    {
        var manifestPath = RepoPath("docs", "v5.4", "releases", "mr-00-control-plane-bootstrap.json");
        var rollbackPath = RepoPath("docs", "v5.4", "rollback", "mr-00-rollback-instruction.json");
        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        using var rollback = JsonDocument.Parse(File.ReadAllText(rollbackPath));
        var root = manifest.RootElement;
        var rollbackRoot = rollback.RootElement;

        Assert.AreEqual("MR-00", root.GetProperty("mr_id").GetString());
        Assert.AreEqual("V5.4 Control Plane Bootstrap", root.GetProperty("release_name").GetString());
        CollectionAssert.Contains(new[] { "built", "shadow" }, root.GetProperty("status").GetString());
        CollectionAssert.AreEqual(new[] { "platform", "runtime", "qa", "release" }, root.GetProperty("owners").EnumerateArray().Select(item => item.GetString()).ToArray());
        Assert.AreEqual("015_control_plane_shadow_runtime", root.GetProperty("migration_version").GetString());
        Assert.AreEqual(rollbackRoot.GetProperty("rollback_instruction_id").GetString(), root.GetProperty("rollback_instruction_id").GetString());
        Assert.IsFalse(string.IsNullOrWhiteSpace(root.GetProperty("commit_sha").GetString()));
        Assert.IsFalse(string.IsNullOrWhiteSpace(root.GetProperty("ci_run_id").GetString()));
        Assert.IsFalse(string.IsNullOrWhiteSpace(root.GetProperty("gate_result_id").GetString()));
        Assert.IsTrue(root.GetProperty("go_criteria").GetArrayLength() > 0);
        Assert.IsTrue(root.GetProperty("no_go_criteria").GetArrayLength() > 0);
        Assert.IsTrue(root.GetProperty("invariant_check_ids").GetArrayLength() > 0);
        Assert.IsTrue(root.GetProperty("shadow_compare_report_ids").GetArrayLength() > 0);
        Assert.IsTrue(root.GetProperty("acceptance_scenarios").GetArrayLength() > 0);

        Assert.AreEqual("rollback", rollbackRoot.GetProperty("instruction_type").GetString());
        CollectionAssert.Contains(new[] { "migration_down", "shadow_cleanup" }, rollbackRoot.GetProperty("rollback_kind").GetString());
        var rollbackText = File.ReadAllText(rollbackPath);
        Assert.IsTrue(rollbackText.Contains("Control Plane has not yet carried business release evidence", StringComparison.Ordinal));
        Assert.IsTrue(rollbackText.Contains("do not directly drop either schema", StringComparison.Ordinal));

        var gatePath = Path.Combine(Path.GetTempPath(), $"workos-mr00-gate-{Guid.NewGuid():N}.json");
        try
        {
            RunnerJson.Write(gatePath, new GateResultEvidence(
                root.GetProperty("gate_result_id").GetString()!,
                root.GetProperty("release_id").GetString()!,
                root.GetProperty("mr_id").GetString()!,
                null,
                null,
                "v5.4-control-plane",
                "automated",
                "passed",
                "P2",
                root.GetProperty("ci_run_id").GetString(),
                ["test"],
                root.GetProperty("invariant_check_ids").EnumerateArray().Select(item => item.GetString()!).ToArray(),
                root.GetProperty("shadow_compare_report_ids").EnumerateArray().Select(item => item.GetString()!).ToArray(),
                [],
                [],
                ["generated"],
                [],
                "gate-runner",
                DateTimeOffset.UtcNow,
                "input",
                "result"));
            RunNode(
                "scripts/v5_4/release-manifest-validate.mjs",
                $"--manifest={manifestPath}",
                $"--gate={gatePath}",
                $"--rollback={rollbackPath}",
                "--require-ci-run-id=true");
        }
        finally
        {
            File.Delete(gatePath);
        }
    }

    [TestMethod]
    public void Mr00Mr01Mr02GatePackagesUseExecutableEvidence()
    {
        var packages = new[]
        {
            new
            {
                MrId = "MR-00",
                Manifest = RepoPath("docs", "v5.4", "releases", "mr-00-control-plane-bootstrap.json"),
                Gate = RepoPath("docs", "v5.4", "mr-00-gate-result.json"),
                Invariants = RepoPath("docs", "v5.4", "mr-00-invariant-checks.json"),
                Shadow = RepoPath("docs", "v5.4", "mr-00-shadow-compare-report.json"),
                Rollback = RepoPath("docs", "v5.4", "rollback", "mr-00-rollback-instruction.json")
            },
            new
            {
                MrId = "MR-01",
                Manifest = RepoPath("docs", "v5.4", "releases", "mr-01-stop-bad-facts.json"),
                Gate = RepoPath("docs", "v5.4", "mr-01-gate-result.json"),
                Invariants = RepoPath("docs", "v5.4", "mr-01-invariant-checks.json"),
                Shadow = RepoPath("docs", "v5.4", "mr-01-shadow-compare-report.json"),
                Rollback = RepoPath("docs", "v5.4", "rollback", "mr-01-rollback-instruction.json")
            },
            new
            {
                MrId = "MR-02",
                Manifest = RepoPath("docs", "v5.4", "releases", "mr-02-runtime-kernel.json"),
                Gate = RepoPath("docs", "v5.4", "mr-02-gate-result.json"),
                Invariants = RepoPath("docs", "v5.4", "mr-02-invariant-checks.json"),
                Shadow = RepoPath("docs", "v5.4", "mr-02-shadow-compare-report.json"),
                Rollback = RepoPath("docs", "v5.4", "rollback", "mr-02-rollback-instruction.json")
            }
        };

        foreach (var package in packages)
        {
            using var manifest = JsonDocument.Parse(File.ReadAllText(package.Manifest));
            using var gate = JsonDocument.Parse(File.ReadAllText(package.Gate));
            using var invariants = JsonDocument.Parse(File.ReadAllText(package.Invariants));
            using var shadow = JsonDocument.Parse(File.ReadAllText(package.Shadow));
            using var rollback = JsonDocument.Parse(File.ReadAllText(package.Rollback));

            var manifestRoot = manifest.RootElement;
            var gateRoot = gate.RootElement;
            Assert.AreEqual(package.MrId, manifestRoot.GetProperty("mr_id").GetString(), package.MrId);
            Assert.AreEqual(gateRoot.GetProperty("gate_result_id").GetString(), manifestRoot.GetProperty("gate_result_id").GetString(), package.MrId);
            Assert.AreEqual(rollback.RootElement.GetProperty("rollback_instruction_id").GetString(), manifestRoot.GetProperty("rollback_instruction_id").GetString(), package.MrId);

            Assert.AreEqual("passed", gateRoot.GetProperty("status").GetString(), package.MrId);
            Assert.AreEqual("automated", gateRoot.GetProperty("gate_type").GetString(), package.MrId);
            Assert.AreEqual("gate-runner", gateRoot.GetProperty("generated_by").GetString(), package.MrId);
            Assert.IsFalse(gateRoot.GetProperty("gate_result_id").GetString()!.Contains("skeleton", StringComparison.OrdinalIgnoreCase), package.MrId);
            Assert.IsFalse(string.IsNullOrWhiteSpace(gateRoot.GetProperty("ci_run_id").GetString()), package.MrId);
            Assert.IsFalse(string.IsNullOrWhiteSpace(gateRoot.GetProperty("input_hash").GetString()), package.MrId);
            Assert.IsFalse(string.IsNullOrWhiteSpace(gateRoot.GetProperty("result_hash").GetString()), package.MrId);
            Assert.IsTrue(gateRoot.GetProperty("invariant_check_refs").GetArrayLength() > 0, package.MrId);
            Assert.IsTrue(gateRoot.GetProperty("shadow_compare_report_refs").GetArrayLength() > 0, package.MrId);

            var invariantRows = invariants.RootElement.EnumerateArray().ToArray();
            var sourceTypes = invariantRows.Select(item => item.GetProperty("source_type").GetString()).ToHashSet(StringComparer.Ordinal);
            if (package.MrId == "MR-01")
            {
                CollectionAssert.Contains(sourceTypes.ToArray(), "file+dist-scan", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "dotnet-test", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "dotnet-test+runtime-contract", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "dotnet-integration-test+runtime-contract", package.MrId);
                Assert.IsTrue(invariantRows.All(item => item.GetProperty("source_type").GetString() != "skeleton"), package.MrId);
                var invariantKeys = invariantRows.Select(item => item.GetProperty("invariant_key").GetString()).ToArray();
                CollectionAssert.Contains(invariantKeys, "runtime.no_production_fake_fallback", package.MrId);
                CollectionAssert.Contains(invariantKeys, "runtime.no_side_effects_for_403_409_422", package.MrId);
                CollectionAssert.Contains(invariantKeys, "runtime.outbox_minimum_hardening", package.MrId);
            }
            else
            {
                CollectionAssert.Contains(sourceTypes.ToArray(), "api-boundary-check-v2", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "service-db-file", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "file+dist-scan", package.MrId);
                CollectionAssert.Contains(sourceTypes.ToArray(), "sql", package.MrId);
                Assert.IsTrue(invariantRows.Count(item => item.GetProperty("source_type").GetString() != "skeleton") >= 6, package.MrId);
            }

            var shadowRoot = shadow.RootElement;
            Assert.AreEqual("green", shadowRoot.GetProperty("grade").GetString(), package.MrId);
            Assert.AreNotEqual("skeleton_green", shadowRoot.GetProperty("summary").GetProperty("status").GetString(), package.MrId);
        }
    }

    [TestMethod]
    public void Mr01GateResultIsMachineGeneratedWithExplicitStatus()
    {
        using var gate = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-01-gate-result.json")));
        var root = gate.RootElement;
        var status = root.GetProperty("status").GetString();

        CollectionAssert.Contains(new[] { "passed", "failed", "blocked" }, status);
        Assert.AreEqual("gate-runner", root.GetProperty("generated_by").GetString());
        Assert.AreEqual("automated", root.GetProperty("gate_type").GetString());
        Assert.IsFalse(string.IsNullOrWhiteSpace(root.GetProperty("input_hash").GetString()));
        Assert.IsFalse(string.IsNullOrWhiteSpace(root.GetProperty("result_hash").GetString()));

        var refs = root.GetProperty("invariant_check_refs").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.Contains(refs, "inv-mr-01-no-production-fake-fallback");
        CollectionAssert.Contains(refs, "inv-mr-01-confirm-commit-projection-semantics");
        CollectionAssert.Contains(refs, "inv-mr-01-field-validation");
        CollectionAssert.Contains(refs, "inv-mr-01-no-side-effects-harness");
        CollectionAssert.Contains(refs, "inv-mr-01-outbox-minimum-hardening");
    }

    [TestMethod]
    public void Mr01GateWrapperBlocksWhenRequiredEvidenceIsMissing()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-mr01-gate-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "missing-invariants.json");
            var effectivePath = Path.Combine(temp.FullName, "effective-invariants.json");
            var gatePath = Path.Combine(temp.FullName, "gate.json");
            File.WriteAllText(invariantPath, "[]");

            RunNode(
                "scripts/v5_4/mr-01-stop-bad-facts-gate.mjs",
                "--releaseId=release-mr-01-test",
                "--mrId=MR-01",
                "--ciRunId=test-missing-evidence",
                $"--invariant={invariantPath}",
                $"--effectiveInvariantOut={effectivePath}",
                $"--out={gatePath}");

            using var gate = JsonDocument.Parse(File.ReadAllText(gatePath));
            var root = gate.RootElement;
            Assert.AreEqual("blocked", root.GetProperty("status").GetString());
            Assert.AreEqual("gate-runner", root.GetProperty("generated_by").GetString());
            var noGo = string.Join("\n", root.GetProperty("no_go_items").EnumerateArray().Select(item => item.GetString()));
            Assert.IsTrue(noGo.Contains("P0 blocking invariant failed: runtime.no_production_fake_fallback", StringComparison.Ordinal));
            Assert.IsTrue(File.ReadAllText(effectivePath).Contains("\"source_type\": \"missing-evidence\"", StringComparison.Ordinal));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public async Task GateRunnerGeneratesNotRunGateResultFixture()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-v54-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariant-check.not_run.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow-compare-report.not_run.json");
            var gatePath = Path.Combine(temp.FullName, "gate-result.not_run.json");

            RunnerJson.Write(invariantPath, new[]
            {
                Invariant("inv-v5-4-skeleton-not-run", "api.no_page_specific_business_write", "blocking", "P0", "passed")
            });
            RunnerJson.Write(shadowPath, Report("scr-v5-4-skeleton-not-run", "green"));
            await GateRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--id=gate-v5-4-skeleton-not-run",
                $"--invariant={invariantPath}",
                $"--shadow={shadowPath}",
                $"--out={gatePath}"
            }));

            using var gate = JsonDocument.Parse(File.ReadAllText(gatePath));
            var root = gate.RootElement;
            Assert.AreEqual("gate-v5-4-skeleton-not-run", root.GetProperty("gate_result_id").GetString());
            Assert.AreEqual("not_run", root.GetProperty("status").GetString());
            Assert.AreEqual("gate-runner", root.GetProperty("generated_by").GetString());
            Assert.AreEqual("inv-v5-4-skeleton-not-run", root.GetProperty("invariant_check_refs")[0].GetString());
            Assert.AreEqual("scr-v5-4-skeleton-not-run", root.GetProperty("shadow_compare_report_refs")[0].GetString());
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void ReleaseManifestValidateRejectsNotRunAndSkeletonFormalGateEvidence()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-v54-formal-{Guid.NewGuid():N}"));
        try
        {
            var manifestPath = RepoPath("docs", "v5.4", "releases", "mr-00-control-plane-bootstrap.json");
            var rollbackPath = RepoPath("docs", "v5.4", "rollback", "mr-00-rollback-instruction.json");
            using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
            var gateId = manifest.RootElement.GetProperty("gate_result_id").GetString()!;
            var ciRunId = manifest.RootElement.GetProperty("ci_run_id").GetString();
            var invariantRefs = manifest.RootElement.GetProperty("invariant_check_ids").EnumerateArray().Select(item => item.GetString()!).ToArray();
            var shadowRefs = manifest.RootElement.GetProperty("shadow_compare_report_ids").EnumerateArray().Select(item => item.GetString()!).ToArray();
            var skeletonGatePath = Path.Combine(temp.FullName, "gate-result.json");
            var notRunGatePath = Path.Combine(temp.FullName, "gate-result.not_run.json");

            RunnerJson.Write(skeletonGatePath, new GateResultEvidence(
                gateId,
                manifest.RootElement.GetProperty("release_id").GetString()!,
                manifest.RootElement.GetProperty("mr_id").GetString()!,
                null,
                null,
                "v5.4-control-plane",
                "automated",
                "passed",
                "P2",
                ciRunId,
                ["test"],
                invariantRefs,
                shadowRefs,
                [],
                [],
                ["generated"],
                [],
                "gate-runner",
                DateTimeOffset.UtcNow,
                "input",
                "result")
            {
                SourceMode = "skeleton"
            });

            RunnerJson.Write(notRunGatePath, new GateResultEvidence(
                gateId,
                manifest.RootElement.GetProperty("release_id").GetString()!,
                manifest.RootElement.GetProperty("mr_id").GetString()!,
                null,
                null,
                "v5.4-control-plane",
                "automated",
                "not_run",
                "P2",
                ciRunId,
                ["test"],
                invariantRefs,
                shadowRefs,
                [],
                ["Business signoff refs are missing."],
                [],
                [],
                "gate-runner",
                DateTimeOffset.UtcNow,
                "input",
                "result"));

            RunNodeExpectFailure(
                "sourceMode=skeleton",
                "scripts/v5_4/release-manifest-validate.mjs",
                $"--manifest={manifestPath}",
                $"--gate={skeletonGatePath}",
                $"--rollback={rollbackPath}",
                "--require-ci-run-id=true");

            RunNodeExpectFailure(
                "not_run artifact",
                "scripts/v5_4/release-manifest-validate.mjs",
                $"--manifest={manifestPath}",
                $"--gate={notRunGatePath}",
                $"--rollback={rollbackPath}",
                "--require-ci-run-id=true");
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static InvariantCheckEvidence Invariant(string id, string key, string mode, string severity, string status)
    {
        return new InvariantCheckEvidence(
            id,
            "v5.4-first-batch",
            "tenant-a",
            "slice-a",
            key,
            key,
            mode,
            severity,
            "skeleton",
            null,
            null,
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            "test",
            "ci-test",
            DateTimeOffset.UtcNow);
    }

    private static ShadowCompareEvidence Report(string id, string grade)
    {
        return new ShadowCompareEvidence(
            id,
            "v5.4-first-batch",
            "tenant-a",
            "slice-a",
            new Dictionary<string, object>(),
            null,
            "public.audit_events",
            "shadow_runtime.domain_events",
            DateTimeOffset.UtcNow,
            grade,
            0,
            0,
            grade == "green" ? 0 : 1,
            0,
            0,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object>(),
            "test",
            "ci-test");
    }

    private static void RunNode(string scriptPath, params string[] arguments)
    {
        using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("node", string.Join(" ", new[] { RepoPath(scriptPath) }.Concat(arguments).Select(QuoteArgument)))
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        });

        Assert.IsNotNull(process, "Could not start node.");
        process!.WaitForExit(30000);
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        Assert.AreEqual(0, process.ExitCode, output + error);
    }

    private static void RunNodeExpectFailure(string expectedOutput, string scriptPath, params string[] arguments)
    {
        using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("node", string.Join(" ", new[] { RepoPath(scriptPath) }.Concat(arguments).Select(QuoteArgument)))
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        });

        Assert.IsNotNull(process, "Could not start node.");
        process!.WaitForExit(30000);
        var output = process.StandardOutput.ReadToEnd() + process.StandardError.ReadToEnd();
        Assert.AreNotEqual(0, process.ExitCode, output);
        Assert.IsTrue(output.Contains(expectedOutput, StringComparison.OrdinalIgnoreCase), output);
    }

    private static string QuoteArgument(string value) =>
        "\"" + value.Replace("\"", "\\\"", StringComparison.Ordinal) + "\"";
}
