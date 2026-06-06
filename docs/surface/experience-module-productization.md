# OMA Surface Experience Module Productization

中文目标：把 Operation Panel、Trusted Confirm、Action Result、Evidence、Queue、Device Trust、Permission Diagnostic 从工程组件展示整理为用户体验模块。

模块规则：
- 普通展示容器只呈现用户语义，不直接暴露 `caseId`、`payloadHash`、`commandSubmissionId` 等技术字段。
- `data-work-item-id` 只允许作为点击打开持久化 WorkItem 的交互绑定。
- 技术引用只能进入调试详情、轨迹详情或审计视图。
- Evidence 必须表现为可信证据状态，不是普通上传按钮。
- Queue 必须表现为“上传队列 / 提交队列 / 同步状态”，不得出现组件名。
- Device Trust 必须表现为“当前设备 / 设备可信状态”，移动端读到 PC 上下文时显示诊断。
- Permission Diagnostic 必须说明原因、负责人、所需权限和下一步动作。

边界：
- ViewModel 只能派生展示，不得成为业务事实源。
- UI 不写业务事实，Mobile BFF 不写业务事实。
- Dormitory 仍保持 L1 Internal Pilot Observation，不声明 L2 Production。

