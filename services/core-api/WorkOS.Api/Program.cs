var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowAnyOrigin();
    });
});

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Redirect("/health"));

app.MapGet("/health", () => new
{
    status = "ok",
    service = "WorkOSNext Core API",
    version = "0.1.0-phase-0-1",
    runtimeTarget = ".NET 10 LTS",
    timestampUtc = DateTimeOffset.UtcNow
});

app.MapGet("/api/bootstrap", () => DemoBootstrap.Create());

app.MapGet("/api/workspaces", () => DemoWorkspaceProjection.Create());

app.MapPost("/api/behavior-events", (BehaviorEventRequest request) => Results.Ok(new
{
    accepted = true,
    eventId = $"beh-{Guid.NewGuid():N}",
    eventType = request.EventType,
    objectType = request.ObjectType,
    objectId = request.ObjectId,
    language = request.Language,
    receivedAtUtc = DateTimeOffset.UtcNow
}));

app.Run();

internal sealed record BehaviorEventRequest(
    string EventType,
    string? ObjectType,
    string? ObjectId,
    string Language,
    string? Source);

internal static class DemoBootstrap
{
    public static object Create() => new
    {
        supportedLanguages = new[] { "zh-CN", "ru-RU" },
        product = new
        {
            name = "WorkOSNext",
            phase = "Phase 0-1",
            principles = new[]
            {
                "Mobile-first",
                "Bilingual-first",
                "Intent-first",
                "Task-first",
                "Human-confirmed",
                "Audit-ready"
            }
        },
        domains = new[]
        {
            new { id = "accommodation", labelKey = "domain.accommodation" },
            new { id = "maintenance", labelKey = "domain.maintenance" }
        },
        routes = new[]
        {
            "/home",
            "/intent",
            "/workbench",
            "/objects/{type}/{id}",
            "/tasks/{taskId}",
            "/confirm/{actionId}",
            "/result/{actionId}",
            "/help"
        }
    };
}

internal static class DemoWorkspaceProjection
{
    public static object Create() => new
    {
        projection = "IntentWorkspaceProjection",
        version = "0.2.0-workspace-card-contract",
        languages = new[] { "zh-CN", "ru-RU" },
        sourceOfTruth = "IntentWorkspaceProjection + WorkspaceCardProjection",
        workspaces = new[]
        {
            Workspace("W-STAY-CHECKIN", "stay", "我要安排入住", new[]
            {
                Card("stayOrder", "住宿单卡", new[] { "已审批申请", "房间床位", "入住周期", "押金/费用规则" }, new[] { "床位可用", "入住周期无冲突", "押金/费用规则可用" }, new[] { "StayOrderPrepared", "BedSelected" }),
                Card("deposit", "押金卡", new[] { "押金金额", "币种", "付款方式", "凭证编号" }, new[] { "金额匹配", "付款人匹配", "凭证清晰" }, new[] { "DepositEvidenceSubmitted", "DepositBlocked" }),
                Card("finance", "财务卡", new[] { "到账状态", "确认金额", "退回原因", "财务确认人" }, new[] { "到账状态有效", "确认金额一致", "财务角色可确认" }, new[] { "FinanceDepositConfirmed" }),
                Card("checkin", "入住确认卡", new[] { "实际入住时间", "钥匙/物品交接", "人工确认摘要" }, new[] { "押金已通过", "床位仍锁定", "人工确认完整" }, new[] { "CheckInConfirmed" })
            }),
            Workspace("W-STAY-CHECKOUT", "stay", "我要办理退房", new[]
            {
                Card("checkoutStart", "退房发起卡", new[] { "退房人", "退房原因", "预计退房时间" }, new[] { "住宿单在住", "退房人身份匹配" }, new[] { "CheckoutStarted" }),
                Card("roomInspection", "房间检查卡", new[] { "房间状态", "物品/损坏检查", "照片证据" }, new[] { "房间检查完成", "损坏记录已处理" }, new[] { "RoomInspectionSubmitted" }),
                Card("feeSettlement", "费用结算卡", new[] { "住宿费用", "额外费用", "押金抵扣", "应退/应补" }, new[] { "费用规则完整", "应退应补计算完成" }, new[] { "CheckoutSettlementPrepared" }),
                Card("checkoutClose", "退房关闭卡", new[] { "释放床位", "关闭住宿单", "人工确认摘要" }, new[] { "费用已确认", "床位释放成功", "关闭权限满足" }, new[] { "CheckoutCompleted" })
            }),
            Workspace("W-REPAIR-REQUEST", "repair", "我要处理报修", new[]
            {
                Card("customerVehicle", "客户车辆卡", new[] { "客户", "车牌", "车型", "VIN", "联系方式" }, new[] { "客户存在", "车牌/VIN 未重复" }, new[] { "RepairCustomerVehicleLinked" }),
                Card("request", "报修信息卡", new[] { "故障描述", "车辆位置", "司机", "紧急程度" }, new[] { "故障描述完整", "车辆位置明确" }, new[] { "RepairRequestCreated" }),
                Card("arrival", "到场确认卡", new[] { "到场时间", "车辆状态", "接车人", "初步风险" }, new[] { "车辆已到场", "接车人有权限" }, new[] { "VehicleArrived" })
            }),
            Workspace("W-REPAIR-DISPATCH", "repair", "我要安排维修", new[]
            {
                Card("dispatch", "派工卡", new[] { "技师", "工位", "预计开始时间", "优先级" }, new[] { "技师可用", "工位可用", "时间不冲突" }, new[] { "RepairDispatched" }),
                Card("diagnosis", "诊断卡", new[] { "故障分类", "诊断结论", "所需配件", "预计费用" }, new[] { "诊断结论完整", "费用已告知" }, new[] { "RepairDiagnosisSubmitted" }),
                Card("execution", "维修执行卡", new[] { "维修项目", "工时", "配件", "过程照片" }, new[] { "维修项目明确", "配件可用", "过程证据完整" }, new[] { "RepairExecutionUpdated" })
            }),
            Workspace("W-REPAIR-CLOSE", "repair", "我要验收关闭", new[]
            {
                Card("inspection", "验收卡", new[] { "维修结果", "试车结果", "验收照片", "验收人" }, new[] { "维修结果可验收", "试车结果完整" }, new[] { "RepairInspectionSubmitted" }),
                Card("feeMaterial", "费用材料卡", new[] { "工时费", "配件费", "其它费用", "财务材料" }, new[] { "工时费完整", "配件费完整", "财务材料齐全" }, new[] { "RepairFeeMaterialSubmitted" }),
                Card("close", "关闭卡", new[] { "关闭摘要", "车辆恢复状态", "人工确认关闭" }, new[] { "验收通过", "费用材料通过", "关闭权限满足" }, new[] { "RepairClosed" })
            })
        }
    };

    private static object Workspace(string id, string domain, string title, object[] cards) => new
    {
        projectionType = "IntentWorkspaceProjection",
        id,
        domain,
        title,
        cards
    };

    private static object Card(string id, string title, string[] businessFields, string[] systemChecks, string[] events) => new
    {
        projectionType = "WorkspaceCardProjection",
        id,
        title,
        businessFields,
        systemChecks,
        events,
        confirmationPolicy = new { required = true, forbiddenForAi = true },
        projectionTargets = new[] { "SearchProjection", "WorkQueueProjection", "ScenarioCoachProjection", "AiContextProjection" }
    };
}
