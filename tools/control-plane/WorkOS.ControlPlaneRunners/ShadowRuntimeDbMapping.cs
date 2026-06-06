namespace WorkOS.ControlPlaneRunners;

public static class ShadowRuntimeDbMapping
{
    public const string Schema = "shadow_runtime";

    public static readonly IReadOnlyList<ShadowRuntimeTableContract> Tables = new[]
    {
        new ShadowRuntimeTableContract(
            Schema,
            "command_submissions",
            new[]
            {
                "command_submission_id", "release_id", "tenant_id", "slice_id",
                "workspace_id", "card_id", "idempotency_key", "submitted_at_utc",
                "actor_ref", "command_payload", "source_active_ref", "source_shadow_ref",
                "processing_status"
            }),
        new ShadowRuntimeTableContract(
            Schema,
            "domain_events",
            new[]
            {
                "shadow_event_id", "command_submission_id", "event_type", "aggregate_ref",
                "occurred_at_utc", "event_payload", "event_hash"
            }),
        new ShadowRuntimeTableContract(
            Schema,
            "ledger_entries",
            new[]
            {
                "shadow_ledger_entry_id", "command_submission_id", "ledger_type",
                "account_ref", "amount", "currency", "direction", "entry_payload",
                "created_at_utc"
            }),
        new ShadowRuntimeTableContract(
            Schema,
            "lens_snapshots",
            new[]
            {
                "lens_snapshot_id", "release_id", "tenant_id", "slice_id", "lens_id",
                "snapshot_at_utc", "lens_payload", "payload_hash"
            }),
        new ShadowRuntimeTableContract(
            Schema,
            "compare_inputs",
            new[]
            {
                "compare_input_id", "release_id", "tenant_id", "slice_id",
                "command_submission_id", "source_baseline_ref", "source_active_ref",
                "source_shadow_ref", "input_payload", "captured_at_utc"
            })
    };
}

public sealed record ShadowRuntimeTableContract(
    string Schema,
    string Table,
    IReadOnlyList<string> Columns);
