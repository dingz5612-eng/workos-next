# 当前 OAM Warning 基线

本基线用于阶段 9 的非阻断风险记录。Warning 不作为当前 P0 阻断项，但不得新增未说明的后端 build warning。

## 当前结论

- 基线命令：`dotnet build WorkOSNext.sln -c Release`
- 当前结果：0 warning / 0 error
- ActionRuntimeService nullable warning：已修复
- 非阻断风险：无新增 build warning

## 处理规则

1. 后续若出现业务运行时、准入、写路径、财务或高风险信任相关 warning，必须先判断是否可低风险修复。
2. 若 warning 会扩大修改范围，必须在本文件记录原因、影响和后续专项，不得把 P0 失败降级为 warning。
3. MSTest analyzer 风格建议不等同 P0，但若重新出现，也必须保持可审计记录。
