namespace WorkOS.Api.Runtime;

internal static class AcceptedCapabilityRuntimeProjection
{
    public const string CapabilityId = "Dormitory.FirstGoldenChain";
    public const string WorkspaceId = CapabilityId;
    public const string LegacyResourceWorkspaceId = "W-STAY-RESOURCE";
    public const string AcceptedGeneratedBundleDigest = "sha256:8d1db539de418a889ec3e741c921fb0436ef7d7d3ce43ac6f966ebf4e1e13b8e";
    public const string RoomSetupConfirmCardId = "Dorm.RoomSetupConfirm";
    public const string BedSetupConfirmCardId = "Dorm.BedSetupConfirm";
    public const string ResourceReadinessConfirmCardId = "Dorm.ResourceReadinessConfirm";

    public static WorkspaceProjection Workspace() =>
        new(
            "AcceptedCapabilityRuntimeProjection",
            WorkspaceId,
            "stay",
            "Dormitory.FirstGoldenChain",
            ContractText.Text("宿舍第一金链", "Первая золотая цепочка общежития"),
            ContractText.Text(
                "当前运行时只消费已接受的 capability bundle projection：房间配置、床位配置、资源就绪确认。",
                "Runtime читает только принятый projection: комната, койка, готовность ресурса."),
            Cards(),
            ContractText.Text(
                "按 1/3 房间配置、2/3 床位配置、3/3 资源就绪确认顺序办理。",
                "Выполняйте 1/3 комната, 2/3 койка, 3/3 готовность."),
            Array.Empty<BlockerRule>());

    private static IReadOnlyList<CardProjection> Cards() =>
        new[]
        {
            Card(
                RoomSetupConfirmCardId,
                "ready",
                "1/3 房间配置确认",
                "1/3 Подтверждение комнаты",
                new[] { "roomNo", "floor", "capacity" },
                new[] { "room-photo", "room-basic-info" }),
            Card(
                BedSetupConfirmCardId,
                "notStarted",
                "2/3 床位配置确认",
                "2/3 Подтверждение койки",
                new[] { "roomId", "bedNo", "bedType" },
                new[] { "bed-photo", "room-link-proof" }),
            Card(
                ResourceReadinessConfirmCardId,
                "notStarted",
                "3/3 资源就绪确认",
                "3/3 Подтверждение готовности",
                new[] { "roomId", "bedId", "readinessState" },
                new[] { "completion-photo", "verification-check" })
        };

    private static CardProjection Card(
        string cardId,
        string status,
        string zhTitle,
        string ruTitle,
        IReadOnlyList<string> businessFieldIds,
        IReadOnlyList<string> evidenceIds) =>
        new(
            "AcceptedCapabilityCardProjection",
            cardId,
            status,
            ContractText.Text(zhTitle, ruTitle),
            new FieldSet(
                Array.Empty<FieldProjection>(),
                businessFieldIds.Select(BusinessField).ToArray(),
                Array.Empty<FieldProjection>()),
            evidenceIds.Select(Evidence).ToArray(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            new[] { new EventDefinition($"{cardId}.confirmed", true, new[] { "accepted-capability-runtime-projection" }) },
            new TransitionDefinition($"{cardId}.prepared", $"{cardId}.confirmed", $"{cardId}.blocked"),
            new ConfirmationPolicy(false, true, "operator", ContractText.Text("仅测试消费确认", "Только тестовое подтверждение")));

    private static FieldProjection BusinessField(string fieldId) =>
        new(
            fieldId,
            FieldLabel(fieldId),
            "business",
            FieldType(fieldId),
            true,
            FieldSource(fieldId),
            true,
            string.Empty,
            FieldUi(fieldId),
            ContractText.Text("来自 accepted capability bundle projection。", "Из принятого projection capability bundle."));

    private static EvidenceRequirement Evidence(string evidenceId) =>
        new(
            evidenceId,
            FieldLabel(evidenceId),
            true,
            "accepted-capability-runtime-projection",
            evidenceId,
            ContractText.Text("测试消费证据，不开放生产确认。", "Тестовое доказательство без production confirm."));

    private static FieldUi FieldUi(string fieldId) =>
        fieldId switch
        {
            "bedType" => new FieldUi(
                "select",
                "bunkType",
                new[]
                {
                    Option("upper", "全部上铺", "Все верхние"),
                    Option("lower", "全部下铺", "Все нижние"),
                    Option("whole", "全部平铺", "Обычные койки")
                },
                "whole",
                string.Empty,
                false),
            "roomId" or "bedId" => new FieldUi("stableRef", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, true),
            _ => new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false)
        };

    private static FieldOption Option(string value, string zhLabel, string ruLabel) =>
        new(value, ContractText.Text(zhLabel, ruLabel));

    private static string FieldType(string fieldId) =>
        fieldId is "capacity" ? "number" : "text";

    private static string FieldSource(string fieldId) =>
        fieldId is "roomId" or "bedId" ? "selectedStableRef" : "userInput";

    private static IReadOnlyDictionary<string, string> FieldLabel(string fieldId) =>
        fieldId switch
        {
            "roomNo" => ContractText.Text("房间号", "Номер комнаты"),
            "floor" => ContractText.Text("楼层", "Этаж"),
            "capacity" => ContractText.Text("床位数", "Количество коек"),
            "roomId" => ContractText.Text("所属房间", "Комната"),
            "bedNo" => ContractText.Text("床位号", "Номер койки"),
            "bedType" => ContractText.Text("床位类型", "Тип койки"),
            "bedId" => ContractText.Text("床位", "Койка"),
            "readinessState" => ContractText.Text("就绪状态", "Статус готовности"),
            "room-photo" => ContractText.Text("房间照片", "Фото комнаты"),
            "room-basic-info" => ContractText.Text("房间基础信息", "Основная информация комнаты"),
            "bed-photo" => ContractText.Text("床位照片", "Фото койки"),
            "room-link-proof" => ContractText.Text("房间关联证明", "Подтверждение связи с комнатой"),
            "completion-photo" => ContractText.Text("完成照片", "Фото завершения"),
            "verification-check" => ContractText.Text("核验记录", "Запись проверки"),
            _ => ContractText.Text(fieldId, fieldId)
        };
}
