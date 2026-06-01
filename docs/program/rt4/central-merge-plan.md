# RT4 Central Merge Plan

Central Merge Train starts only after `RT-FINAL LOCAL_PASSED`.

Current status: `STACKED_PRECONSTRUCTION`

## Current Main Evidence

Latest remote `main` already contains RF4 through RF7 evidence commits through
merge `c9f9bb0f6591fb01cada33431b780af9d94a70ab`.

Remaining stacked preconstruction must continue from RF8. The later Central
Merge Train must still process one stage at a time and stop on any red gate.

## Remaining Merge Order

1. RF8 `codex/rf8-governance-closure-report`
2. RT-X `codex/rtx-problem-ledger-closure-matrix`
3. RT-0 `codex/rt0-final-gate-evidence-closure`
4. RT-1 `codex/rt1-runtime-spine-non-bypass`
5. RT-DB `codex/rtdb-db-role-isolation-shadow-defense`
6. RT-2 `codex/rt2-btos-compiler-mvp`
7. RT-2A `codex/rt2a-shared-governance-identity-kernel`
8. RT-P `codex/rtp-policy-as-code-control-plane`
9. RT-3 `codex/rt3-finance-truth-production-kernel`
10. RT-S `codex/rts-executable-scenario-factory`
11. RT-B `codex/rtb-b-stage-gate-closure`
12. RT-4 `codex/rt4-dormitory-golden-domain-l1`
13. RT-5 `codex/rt5-workitem-native-experience`
14. RT-6 `codex/rt6-operating-control-tower`
15. RT-F `codex/rtf-operating-feedback-loop`
16. RT-FINAL `codex/rtfinal-completion-assurance-report`

## Rules

- Rebase one PR at a time onto latest `main`.
- Confirm PR CI and V5.4 Guards green.
- Merge one PR only.
- Wait for `main` CI and V5.4 Guards green.
- Update evidence graph and completion dashboard before the next PR.
- Stop the train on any red gate.
