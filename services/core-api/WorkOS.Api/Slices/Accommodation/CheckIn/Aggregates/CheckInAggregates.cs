namespace WorkOS.Api.Slices.Accommodation.CheckIn.Aggregates;

public sealed record HostelLeadAggregate(
    string LeadId,
    string WorkspaceId,
    string GuestName,
    string Phone,
    int BedsNeeded,
    string StayDuration,
    string SourceChannel,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record HostelBookingAggregate(
    string BookingId,
    string WorkspaceId,
    string LeadId,
    string ReservedRoomBed,
    int BedsReserved,
    DateTimeOffset CheckInDate,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record HostelStayAggregate(
    string StayId,
    string WorkspaceId,
    string ResidentName,
    string Phone,
    string RoomBed,
    DateTimeOffset CheckInDate,
    DateTimeOffset PlannedCheckoutDate,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record GuestFolioAggregate(
    string FolioId,
    string WorkspaceId,
    string StayId,
    string TariffType,
    decimal UnitPrice,
    decimal Quantity,
    decimal ChargeAmount,
    decimal PaidAmount,
    decimal Balance,
    string Currency,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record DepositLiabilityAggregate(
    string DepositId,
    string WorkspaceId,
    string FolioId,
    decimal RequiredAmount,
    decimal ReceivedAmount,
    decimal LiabilityBalance,
    string Currency,
    string Rule,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record HostelPaymentAggregate(
    string PaymentId,
    string WorkspaceId,
    string FolioId,
    string DepositId,
    string Payer,
    decimal Amount,
    string Currency,
    string Method,
    string Purpose,
    string ReceiptNo,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record FinanceReconciliationAggregate(
    string ReconciliationId,
    string WorkspaceId,
    string PaymentId,
    string Channel,
    decimal ConfirmedAmount,
    string Currency,
    string MatchResult,
    decimal VarianceAmount,
    string Status,
    string ConfirmedBy,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record HostelOperatingMetricAggregate(
    string MetricsId,
    string WorkspaceId,
    decimal OccupancyRate,
    decimal LeadBookingConversionRate,
    decimal BookingCheckInConversionRate,
    decimal DepositLiabilityBalance,
    decimal UnconfirmedPaymentAmount,
    decimal FinanceVarianceAmount,
    decimal FolioBalance,
    string Decision,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record DepositAggregate(
    string DepositId,
    string WorkspaceId,
    string StayOrderId,
    decimal Amount,
    string Currency,
    string PaymentMethod,
    string EvidenceId,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record FinanceConfirmationAggregate(
    string FinanceConfirmationId,
    string WorkspaceId,
    string DepositId,
    decimal ConfirmedAmount,
    string Currency,
    string Status,
    string ConfirmedBy,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);
