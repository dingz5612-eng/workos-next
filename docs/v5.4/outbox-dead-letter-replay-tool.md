# Outbox Dead-Letter Replay Tool

The Final Ops dead-letter replay tool handles failed async side effects without
creating new business facts.

## Commands

```bash
scripts/outbox/dead-letter list --tenant T1
scripts/outbox/dead-letter inspect --message-id outbox-EVT-1
scripts/outbox/dead-letter replay --message-id outbox-EVT-1 --actor ops-user --reason "projector fix deployed" --actor-role operator --capabilities deadletter.replay --device-id pc-1 --device-trust trusted
scripts/outbox/dead-letter replay --event-type Accommodation.PaymentConfirmed --actor ops-user --reason "payment projector fix" --actor-role operator --capabilities deadletter.replay --device-id pc-1 --device-trust trusted
scripts/outbox/dead-letter replay --tenant T1 --actor ops-user --reason "tenant projection rebuild" --actor-role operator --capabilities deadletter.replay --device-id pc-1 --device-trust trusted
scripts/outbox/dead-letter ignore --message-id outbox-EVT-1 --actor release-manager --reason "obsolete notification" --actor-role release --capabilities deadletter.replay --device-id pc-1 --device-trust trusted
```

## Replay Semantics

- Replay reuses the original `outbox_messages.message_id` and `event_id`.
- Replay clears `dead_lettered_at_utc`, claim ownership, lease fields, and
  `last_error`, so the normal outbox worker can claim the same message again.
- Replay does not insert `audit_events`, DomainEvents, aggregate facts, ledger
  facts, or CommandSubmissions.
- Replay and ignore are high-risk operations and require
  `deadletter.replay` capability, a trusted PC/device, and a non-empty reason.
- Projectors, process managers, and notification handlers must remain
  idempotent when they consume replayed outbox messages.
- Every replay or ignore operation writes
  `outbox_dead_letter_replay_audits` with `actor_id`, reason, and authorization
  context in the audit details.

## Release Rule

Unhandled dead-letter messages are P0 release blockers. A final locked release
must have `unhandledP0DeadLetterCount = 0`, or each remaining dead-letter must
be explicitly ignored with a reviewed reason in the replay audit table.
