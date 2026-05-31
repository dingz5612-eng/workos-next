# RT4 Central Merge Plan

Central Merge Train starts only after `RT-FINAL LOCAL_PASSED`.

Current status: `STACKED_PRECONSTRUCTION`

## Merge Order

1. RF4 `codex/rf4-fact-ownership-deep-scanner`
2. RF5 `codex/rf5-gate-result-full-append-only`
3. RF6 PR #22
4. RF7 PR #24
5. RF8 PR #25
6. RT-X `codex/rtx-problem-ledger-closure-matrix`
7. RT-0 `codex/rt0-final-gate-evidence-closure`
8. RT-1 `codex/rt1-runtime-spine-non-bypass`
9. RT-DB `codex/rtdb-db-role-isolation-shadow-defense`
10. RT-2 `codex/rt2-btos-compiler-mvp`
11. RT-2A `codex/rt2a-shared-governance-identity-kernel`
12. RT-P `codex/rtp-policy-as-code-control-plane`
13. RT-3 `codex/rt3-finance-truth-production-kernel`
14. RT-S `codex/rts-executable-scenario-factory`
15. RT-B `codex/rtb-b-stage-gate-closure`
16. RT-4 `codex/rt4-dormitory-golden-domain-l1`
17. RT-5 `codex/rt5-workitem-native-experience`
18. RT-6 `codex/rt6-operating-control-tower`
19. RT-F `codex/rtf-operating-feedback-loop`
20. RT-FINAL `codex/rtfinal-completion-assurance-report`

## Rules

- Rebase one PR at a time onto latest `main`.
- Confirm PR CI and V5.4 Guards green.
- Merge one PR only.
- Wait for `main` CI and V5.4 Guards green.
- Update evidence graph and completion dashboard before the next PR.
- Stop the train on any red gate.
