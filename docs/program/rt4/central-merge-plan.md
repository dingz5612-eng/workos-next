# Central Merge Plan

当前计划只允许在 RT-FINAL `LOCAL_PASSED / STACKED_READY / LOCKED_UNTIL_CENTRAL_MERGE` 后启动。启动后仍必须逐个 PR rebase、验证、合并；不一次性 merge 多个 stacked PR，不跳过上游 PR，不在 main red 时继续。

## Merge Order

1. RF4
2. RF5
3. RF6
4. RF7
5. RF8
6. RT-X
7. RT-0
8. RT-1
9. RT-DB
10. RT-2
11. RT-2A
12. RT-P
13. RT-3
14. RT-S
15. RT-B
16. RT-4
17. RT-5
18. RT-6
19. RT-F
20. RT-FINAL

## Per PR Guard

每个 PR 必须完成：rebase 到 latest main，确认 diff 只包含当前任务，PR CI green，PR V5.4 Control Plane Guards green，merge 后 main green。main green 后再处理下一个 PR。

## Evidence Updates

每个 PR merge main 后必须更新 Evidence Graph 与 Completion Dashboard。不得用 PR body、本地 PASS、旧 run id 替代机器证据。

## Stop Conditions

任一 PR CI 失败、main CI 失败、V5.4 Guards 失败、Evidence Graph 不可验证、Completion Dashboard 无 evidence refs 时停止后续合并，回到失败分支修复。
