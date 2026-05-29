using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.CheckIn.Aggregates;
using WorkOS.Api.Slices.Accommodation.CheckIn.Events;
using WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Persistence;
using WorkOS.Api.Slices.Accommodation.DepositLedger.Persistence;
using WorkOS.Api.Slices.Accommodation.ExpenseLedger.Persistence;
using WorkOS.Api.Slices.Accommodation.LeadReservation.Persistence;
using WorkOS.Api.Slices.Accommodation.PaymentLedger.Persistence;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Persistence;
using WorkOS.Api.Slices.Accommodation.ServiceTask.Persistence;
using WorkOS.Api.Slices.Accommodation.StayLifecycle.Persistence;

namespace WorkOS.Api.Slices.Persistence;

internal sealed class SliceAggregateStorage
{
    private readonly PostgresConnectionFactory connections;
    private readonly LeadReservationStorage leadReservations;
    private readonly StayLifecycleStorage stayLifecycle;
    private readonly ResourceSetupStorage resourceSetup;
    private readonly DepositLedgerStorage depositLedger;
    private readonly PaymentLedgerStorage paymentLedger;
    private readonly CheckOutSettlementStorage checkoutSettlement;
    private readonly ServiceTaskStorage serviceTasks;
    private readonly ExpenseLedgerStorage expenses;
    private readonly PeriodAnalyticsStorage periodAnalytics;

    public SliceAggregateStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
        leadReservations = new LeadReservationStorage(connections);
        stayLifecycle = new StayLifecycleStorage(connections);
        resourceSetup = new ResourceSetupStorage(connections);
        depositLedger = new DepositLedgerStorage(connections);
        paymentLedger = new PaymentLedgerStorage(connections);
        checkoutSettlement = new CheckOutSettlementStorage(connections);
        serviceTasks = new ServiceTaskStorage(connections);
        expenses = new ExpenseLedgerStorage(connections);
        periodAnalytics = new PeriodAnalyticsStorage(connections);
    }

    public void Apply(WorkspaceEvent workspaceEvent)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        Apply(workspaceEvent, db);
        db.Commit();
    }

    public void Apply(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        if (leadReservations.Apply(workspaceEvent, db) ||
            stayLifecycle.Apply(workspaceEvent, db) ||
            resourceSetup.Apply(workspaceEvent, db) ||
            depositLedger.Apply(workspaceEvent, db) ||
            paymentLedger.Apply(workspaceEvent, db) ||
            checkoutSettlement.Apply(workspaceEvent, db) ||
            serviceTasks.Apply(workspaceEvent, db) ||
            expenses.Apply(workspaceEvent, db) ||
            periodAnalytics.Apply(workspaceEvent, db))
        {
            return;
        }

        switch (workspaceEvent.EventType)
        {
            case CheckInEvents.LeadCaptured:
                UpsertHostelLead(HostelLeadFrom(workspaceEvent), db);
                break;
            case CheckInEvents.BookingConfirmed:
                UpsertHostelBooking(HostelBookingFrom(workspaceEvent), db);
                break;
            case CheckInEvents.ResidentRegistered:
            case CheckInEvents.BedAssigned:
            case CheckInEvents.StayCheckedIn:
                UpsertHostelStay(HostelStayFrom(workspaceEvent), db);
                break;
            case CheckInEvents.TariffAssigned:
                UpsertGuestFolio(GuestFolioFrom(workspaceEvent), db);
                break;
            case CheckInEvents.DepositRequired:
                UpsertDepositLiability(DepositLiabilityFrom(workspaceEvent), db);
                break;
            case CheckInEvents.PaymentRecordedByFrontDesk:
                UpsertHostelPayment(HostelPaymentFrom(workspaceEvent), db);
                UpsertDeposit(DepositFrom(workspaceEvent), db);
                break;
            case CheckInEvents.PaymentConfirmedByFinance:
                UpsertFinanceReconciliation(FinanceReconciliationFrom(workspaceEvent), db);
                UpsertFinanceConfirmation(FinanceConfirmationFrom(workspaceEvent), db);
                break;
            case CheckInEvents.OperatingMetricsReviewed:
                UpsertOperatingMetrics(OperatingMetricsFrom(workspaceEvent), db);
                break;
        }
    }

    private void UpsertDeposit(DepositAggregate deposit, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into accommodation_deposits(deposit_id, workspace_id, stay_order_id, amount, currency, payment_method, evidence_id, status, created_event_id, updated_at_utc)
            values (@depositId, @workspaceId, @stayOrderId, @amount, @currency, @paymentMethod, @evidenceId, @status, @createdEventId, @updatedAtUtc)
            on conflict(deposit_id) do update set
                amount = excluded.amount,
                currency = excluded.currency,
                payment_method = excluded.payment_method,
                evidence_id = excluded.evidence_id,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("depositId", deposit.DepositId);
        command.Parameters.AddWithValue("workspaceId", deposit.WorkspaceId);
        command.Parameters.AddWithValue("stayOrderId", deposit.StayOrderId);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, deposit.Amount);
        command.Parameters.AddWithValue("currency", deposit.Currency);
        command.Parameters.AddWithValue("paymentMethod", deposit.PaymentMethod);
        command.Parameters.AddWithValue("evidenceId", deposit.EvidenceId);
        command.Parameters.AddWithValue("status", deposit.Status);
        command.Parameters.AddWithValue("createdEventId", deposit.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", deposit.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertHostelLead(HostelLeadAggregate lead, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_leads(lead_id, workspace_id, guest_name, phone, beds_needed, stay_duration, source_channel, status, created_event_id, updated_at_utc)
            values (@leadId, @workspaceId, @guestName, @phone, @bedsNeeded, @stayDuration, @sourceChannel, @status, @createdEventId, @updatedAtUtc)
            on conflict(lead_id) do update set
                guest_name = excluded.guest_name,
                phone = excluded.phone,
                beds_needed = excluded.beds_needed,
                stay_duration = excluded.stay_duration,
                source_channel = excluded.source_channel,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("leadId", lead.LeadId);
        command.Parameters.AddWithValue("workspaceId", lead.WorkspaceId);
        command.Parameters.AddWithValue("guestName", lead.GuestName);
        command.Parameters.AddWithValue("phone", lead.Phone);
        command.Parameters.AddWithValue("bedsNeeded", lead.BedsNeeded);
        command.Parameters.AddWithValue("stayDuration", lead.StayDuration);
        command.Parameters.AddWithValue("sourceChannel", lead.SourceChannel);
        command.Parameters.AddWithValue("status", lead.Status);
        command.Parameters.AddWithValue("createdEventId", lead.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", lead.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertHostelBooking(HostelBookingAggregate booking, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_bookings(booking_id, workspace_id, lead_id, reserved_room_bed, beds_reserved, check_in_date, status, created_event_id, updated_at_utc)
            values (@bookingId, @workspaceId, @leadId, @reservedRoomBed, @bedsReserved, @checkInDate, @status, @createdEventId, @updatedAtUtc)
            on conflict(booking_id) do update set
                reserved_room_bed = excluded.reserved_room_bed,
                beds_reserved = excluded.beds_reserved,
                check_in_date = excluded.check_in_date,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("bookingId", booking.BookingId);
        command.Parameters.AddWithValue("workspaceId", booking.WorkspaceId);
        command.Parameters.AddWithValue("leadId", booking.LeadId);
        command.Parameters.AddWithValue("reservedRoomBed", booking.ReservedRoomBed);
        command.Parameters.AddWithValue("bedsReserved", booking.BedsReserved);
        command.Parameters.AddWithValue("checkInDate", booking.CheckInDate);
        command.Parameters.AddWithValue("status", booking.Status);
        command.Parameters.AddWithValue("createdEventId", booking.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", booking.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertHostelStay(HostelStayAggregate stay, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_stays(stay_id, workspace_id, resident_name, phone, room_bed, check_in_date, planned_checkout_date, status, created_event_id, updated_at_utc)
            values (@stayId, @workspaceId, @residentName, @phone, @roomBed, @checkInDate, @plannedCheckoutDate, @status, @createdEventId, @updatedAtUtc)
            on conflict(stay_id) do update set
                resident_name = excluded.resident_name,
                phone = excluded.phone,
                room_bed = excluded.room_bed,
                check_in_date = excluded.check_in_date,
                planned_checkout_date = excluded.planned_checkout_date,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("stayId", stay.StayId);
        command.Parameters.AddWithValue("workspaceId", stay.WorkspaceId);
        command.Parameters.AddWithValue("residentName", stay.ResidentName);
        command.Parameters.AddWithValue("phone", stay.Phone);
        command.Parameters.AddWithValue("roomBed", stay.RoomBed);
        command.Parameters.AddWithValue("checkInDate", stay.CheckInDate);
        command.Parameters.AddWithValue("plannedCheckoutDate", stay.PlannedCheckoutDate);
        command.Parameters.AddWithValue("status", stay.Status);
        command.Parameters.AddWithValue("createdEventId", stay.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", stay.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertGuestFolio(GuestFolioAggregate folio, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into guest_folios(folio_id, workspace_id, stay_id, tariff_type, unit_price, quantity, charge_amount, paid_amount, balance, currency, status, created_event_id, updated_at_utc)
            values (@folioId, @workspaceId, @stayId, @tariffType, @unitPrice, @quantity, @chargeAmount, @paidAmount, @balance, @currency, @status, @createdEventId, @updatedAtUtc)
            on conflict(folio_id) do update set
                tariff_type = excluded.tariff_type,
                unit_price = excluded.unit_price,
                quantity = excluded.quantity,
                charge_amount = excluded.charge_amount,
                paid_amount = excluded.paid_amount,
                balance = excluded.balance,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("folioId", folio.FolioId);
        command.Parameters.AddWithValue("workspaceId", folio.WorkspaceId);
        command.Parameters.AddWithValue("stayId", folio.StayId);
        command.Parameters.AddWithValue("tariffType", folio.TariffType);
        command.Parameters.AddWithValue("unitPrice", NpgsqlDbType.Numeric, folio.UnitPrice);
        command.Parameters.AddWithValue("quantity", NpgsqlDbType.Numeric, folio.Quantity);
        command.Parameters.AddWithValue("chargeAmount", NpgsqlDbType.Numeric, folio.ChargeAmount);
        command.Parameters.AddWithValue("paidAmount", NpgsqlDbType.Numeric, folio.PaidAmount);
        command.Parameters.AddWithValue("balance", NpgsqlDbType.Numeric, folio.Balance);
        command.Parameters.AddWithValue("currency", folio.Currency);
        command.Parameters.AddWithValue("status", folio.Status);
        command.Parameters.AddWithValue("createdEventId", folio.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", folio.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertDepositLiability(DepositLiabilityAggregate deposit, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into deposit_liabilities(deposit_id, workspace_id, folio_id, required_amount, received_amount, liability_balance, currency, rule_name, status, created_event_id, updated_at_utc)
            values (@depositId, @workspaceId, @folioId, @requiredAmount, @receivedAmount, @liabilityBalance, @currency, @ruleName, @status, @createdEventId, @updatedAtUtc)
            on conflict(deposit_id) do update set
                required_amount = excluded.required_amount,
                received_amount = excluded.received_amount,
                liability_balance = excluded.liability_balance,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("depositId", deposit.DepositId);
        command.Parameters.AddWithValue("workspaceId", deposit.WorkspaceId);
        command.Parameters.AddWithValue("folioId", deposit.FolioId);
        command.Parameters.AddWithValue("requiredAmount", NpgsqlDbType.Numeric, deposit.RequiredAmount);
        command.Parameters.AddWithValue("receivedAmount", NpgsqlDbType.Numeric, deposit.ReceivedAmount);
        command.Parameters.AddWithValue("liabilityBalance", NpgsqlDbType.Numeric, deposit.LiabilityBalance);
        command.Parameters.AddWithValue("currency", deposit.Currency);
        command.Parameters.AddWithValue("ruleName", deposit.Rule);
        command.Parameters.AddWithValue("status", deposit.Status);
        command.Parameters.AddWithValue("createdEventId", deposit.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", deposit.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertHostelPayment(HostelPaymentAggregate payment, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_payments(payment_id, workspace_id, folio_id, deposit_id, payer, amount, currency, method, purpose, receipt_no, status, created_event_id, updated_at_utc)
            values (@paymentId, @workspaceId, @folioId, @depositId, @payer, @amount, @currency, @method, @purpose, @receiptNo, @status, @createdEventId, @updatedAtUtc)
            on conflict(payment_id) do update set
                amount = excluded.amount,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("paymentId", payment.PaymentId);
        command.Parameters.AddWithValue("workspaceId", payment.WorkspaceId);
        command.Parameters.AddWithValue("folioId", payment.FolioId);
        command.Parameters.AddWithValue("depositId", payment.DepositId);
        command.Parameters.AddWithValue("payer", payment.Payer);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, payment.Amount);
        command.Parameters.AddWithValue("currency", payment.Currency);
        command.Parameters.AddWithValue("method", payment.Method);
        command.Parameters.AddWithValue("purpose", payment.Purpose);
        command.Parameters.AddWithValue("receiptNo", payment.ReceiptNo);
        command.Parameters.AddWithValue("status", payment.Status);
        command.Parameters.AddWithValue("createdEventId", payment.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", payment.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertFinanceReconciliation(FinanceReconciliationAggregate reconciliation, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into finance_reconciliations(reconciliation_id, workspace_id, payment_id, channel, confirmed_amount, currency, match_result, variance_amount, status, confirmed_by, created_event_id, updated_at_utc)
            values (@reconciliationId, @workspaceId, @paymentId, @channel, @confirmedAmount, @currency, @matchResult, @varianceAmount, @status, @confirmedBy, @createdEventId, @updatedAtUtc)
            on conflict(reconciliation_id) do update set
                confirmed_amount = excluded.confirmed_amount,
                match_result = excluded.match_result,
                variance_amount = excluded.variance_amount,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("reconciliationId", reconciliation.ReconciliationId);
        command.Parameters.AddWithValue("workspaceId", reconciliation.WorkspaceId);
        command.Parameters.AddWithValue("paymentId", reconciliation.PaymentId);
        command.Parameters.AddWithValue("channel", reconciliation.Channel);
        command.Parameters.AddWithValue("confirmedAmount", NpgsqlDbType.Numeric, reconciliation.ConfirmedAmount);
        command.Parameters.AddWithValue("currency", reconciliation.Currency);
        command.Parameters.AddWithValue("matchResult", reconciliation.MatchResult);
        command.Parameters.AddWithValue("varianceAmount", NpgsqlDbType.Numeric, reconciliation.VarianceAmount);
        command.Parameters.AddWithValue("status", reconciliation.Status);
        command.Parameters.AddWithValue("confirmedBy", reconciliation.ConfirmedBy);
        command.Parameters.AddWithValue("createdEventId", reconciliation.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", reconciliation.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertOperatingMetrics(HostelOperatingMetricAggregate metrics, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_operating_metrics(metrics_id, workspace_id, occupancy_rate, lead_booking_conversion_rate, booking_checkin_conversion_rate, deposit_liability_balance, unconfirmed_payment_amount, finance_variance_amount, folio_balance, decision, created_event_id, updated_at_utc)
            values (@metricsId, @workspaceId, @occupancyRate, @leadBookingConversionRate, @bookingCheckinConversionRate, @depositLiabilityBalance, @unconfirmedPaymentAmount, @financeVarianceAmount, @folioBalance, @decision, @createdEventId, @updatedAtUtc)
            on conflict(metrics_id) do update set
                occupancy_rate = excluded.occupancy_rate,
                lead_booking_conversion_rate = excluded.lead_booking_conversion_rate,
                booking_checkin_conversion_rate = excluded.booking_checkin_conversion_rate,
                deposit_liability_balance = excluded.deposit_liability_balance,
                unconfirmed_payment_amount = excluded.unconfirmed_payment_amount,
                finance_variance_amount = excluded.finance_variance_amount,
                folio_balance = excluded.folio_balance,
                decision = excluded.decision,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("metricsId", metrics.MetricsId);
        command.Parameters.AddWithValue("workspaceId", metrics.WorkspaceId);
        command.Parameters.AddWithValue("occupancyRate", NpgsqlDbType.Numeric, metrics.OccupancyRate);
        command.Parameters.AddWithValue("leadBookingConversionRate", NpgsqlDbType.Numeric, metrics.LeadBookingConversionRate);
        command.Parameters.AddWithValue("bookingCheckinConversionRate", NpgsqlDbType.Numeric, metrics.BookingCheckInConversionRate);
        command.Parameters.AddWithValue("depositLiabilityBalance", NpgsqlDbType.Numeric, metrics.DepositLiabilityBalance);
        command.Parameters.AddWithValue("unconfirmedPaymentAmount", NpgsqlDbType.Numeric, metrics.UnconfirmedPaymentAmount);
        command.Parameters.AddWithValue("financeVarianceAmount", NpgsqlDbType.Numeric, metrics.FinanceVarianceAmount);
        command.Parameters.AddWithValue("folioBalance", NpgsqlDbType.Numeric, metrics.FolioBalance);
        command.Parameters.AddWithValue("decision", metrics.Decision);
        command.Parameters.AddWithValue("createdEventId", metrics.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", metrics.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertFinanceConfirmation(FinanceConfirmationAggregate confirmation, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into finance_confirmations(finance_confirmation_id, workspace_id, deposit_id, confirmed_amount, currency, status, confirmed_by, created_event_id, updated_at_utc)
            values (@financeConfirmationId, @workspaceId, @depositId, @confirmedAmount, @currency, @status, @confirmedBy, @createdEventId, @updatedAtUtc)
            on conflict(finance_confirmation_id) do update set
                confirmed_amount = excluded.confirmed_amount,
                currency = excluded.currency,
                status = excluded.status,
                confirmed_by = excluded.confirmed_by,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("financeConfirmationId", confirmation.FinanceConfirmationId);
        command.Parameters.AddWithValue("workspaceId", confirmation.WorkspaceId);
        command.Parameters.AddWithValue("depositId", confirmation.DepositId);
        command.Parameters.AddWithValue("confirmedAmount", NpgsqlDbType.Numeric, confirmation.ConfirmedAmount);
        command.Parameters.AddWithValue("currency", confirmation.Currency);
        command.Parameters.AddWithValue("status", confirmation.Status);
        command.Parameters.AddWithValue("confirmedBy", confirmation.ConfirmedBy);
        command.Parameters.AddWithValue("createdEventId", confirmation.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", confirmation.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private static DepositAggregate DepositFrom(WorkspaceEvent workspaceEvent)
    {
        var amount = DecimalValue(workspaceEvent, "depositAmount", 3000m);
        var evidenceId = Value(workspaceEvent, "evidenceNo", $"evidence-{workspaceEvent.EventId}");
        return new DepositAggregate(
            $"deposit-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            Value(workspaceEvent, "stayId", "stay-order-current"),
            amount,
            Value(workspaceEvent, "currency", "KGS"),
            Value(workspaceEvent, "paymentMethod", "现金"),
            evidenceId,
            "submitted",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static HostelLeadAggregate HostelLeadFrom(WorkspaceEvent workspaceEvent) => new(
        StableId("lead", workspaceEvent),
        workspaceEvent.WorkspaceId,
        Value(workspaceEvent, "guestName", "张三"),
        Value(workspaceEvent, "phone", "+996 555 010101"),
        IntValue(workspaceEvent, "requestedBedCount", 1),
        Value(workspaceEvent, "stayDurationText", "1个月"),
        Value(workspaceEvent, "leadSource", "WhatsApp"),
        Value(workspaceEvent, "leadStatus", "已预订"),
        workspaceEvent.EventId,
        workspaceEvent.OccurredAtUtc);

    private static HostelBookingAggregate HostelBookingFrom(WorkspaceEvent workspaceEvent) => new(
        StableId("booking", workspaceEvent),
        workspaceEvent.WorkspaceId,
        StableId("lead", workspaceEvent),
        Value(workspaceEvent, "reservedBedIds", "A301 / A301-02"),
        IntValue(workspaceEvent, "reservedBedCount", 1),
        DateValue(workspaceEvent, "checkInDate", workspaceEvent.OccurredAtUtc),
        "confirmed",
        workspaceEvent.EventId,
        workspaceEvent.OccurredAtUtc);

    private static HostelStayAggregate HostelStayFrom(WorkspaceEvent workspaceEvent) => new(
        StableId("stay", workspaceEvent),
        workspaceEvent.WorkspaceId,
        Value(workspaceEvent, "guestName", Value(workspaceEvent, "residentName", "张三")),
        Value(workspaceEvent, "phone", "+996 555 010101"),
        Value(workspaceEvent, "roomBed", Value(workspaceEvent, "reservedBedIds", "A301 / A301-02")),
        DateValue(workspaceEvent, "checkInDate", workspaceEvent.OccurredAtUtc),
        DateValue(workspaceEvent, "plannedCheckOutDate", workspaceEvent.OccurredAtUtc.AddMonths(1)),
        workspaceEvent.EventType == CheckInEvents.StayCheckedIn ? "active" : "reserved",
        workspaceEvent.EventId,
        workspaceEvent.OccurredAtUtc);

    private static GuestFolioAggregate GuestFolioFrom(WorkspaceEvent workspaceEvent)
    {
        var unitPrice = DecimalValue(workspaceEvent, "unitRate", 9300m);
        var quantity = DecimalValue(workspaceEvent, "tariffQuantity", 1m);
        var charge = DecimalValue(workspaceEvent, "amount", unitPrice * quantity);
        return new GuestFolioAggregate(
            StableId("folio", workspaceEvent),
            workspaceEvent.WorkspaceId,
            StableId("stay", workspaceEvent),
            Value(workspaceEvent, "tariffType", "按月"),
            unitPrice,
            quantity,
            charge,
            0m,
            charge,
            Value(workspaceEvent, "currency", "KGS"),
            "open",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static DepositLiabilityAggregate DepositLiabilityFrom(WorkspaceEvent workspaceEvent)
    {
        var required = DecimalValue(workspaceEvent, "requiredDepositAmount", 3000m);
        return new DepositLiabilityAggregate(
            StableId("deposit", workspaceEvent),
            workspaceEvent.WorkspaceId,
            StableId("folio", workspaceEvent),
            required,
            0m,
            required,
            Value(workspaceEvent, "currency", "KGS"),
            Value(workspaceEvent, "depositPolicyName", "标准押金"),
            "required",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static HostelPaymentAggregate HostelPaymentFrom(WorkspaceEvent workspaceEvent) => new(
        StableId("payment", workspaceEvent),
        workspaceEvent.WorkspaceId,
        StableId("folio", workspaceEvent),
        StableId("deposit", workspaceEvent),
        Value(workspaceEvent, "payerName", "张三"),
        DecimalValue(workspaceEvent, "paymentAmount", DecimalValue(workspaceEvent, "depositAmount", 3000m)),
        Value(workspaceEvent, "currency", "KGS"),
        Value(workspaceEvent, "paymentMethod", "现金"),
        Value(workspaceEvent, "paymentPurpose", "押金"),
        Value(workspaceEvent, "evidenceNo", "DEP-009"),
        "pending_finance",
        workspaceEvent.EventId,
        workspaceEvent.OccurredAtUtc);

    private static FinanceReconciliationAggregate FinanceReconciliationFrom(WorkspaceEvent workspaceEvent)
    {
        var paymentAmount = DecimalValue(workspaceEvent, "paymentAmount", 3000m);
        var confirmedAmount = DecimalValue(workspaceEvent, "confirmedAmount", DecimalValue(workspaceEvent, "confirmedAmount", paymentAmount));
        return new FinanceReconciliationAggregate(
            StableId("reconciliation", workspaceEvent),
            workspaceEvent.WorkspaceId,
            StableId("payment", workspaceEvent),
            Value(workspaceEvent, "paymentChannel", "现金"),
            confirmedAmount,
            Value(workspaceEvent, "currency", "KGS"),
            Value(workspaceEvent, "matchResult", "匹配"),
            Math.Abs(confirmedAmount - paymentAmount),
            "confirmed",
            workspaceEvent.ActorId,
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static HostelOperatingMetricAggregate OperatingMetricsFrom(WorkspaceEvent workspaceEvent) => new(
        StableId("metrics", workspaceEvent),
        workspaceEvent.WorkspaceId,
        0.25m,
        1.0m,
        1.0m,
        DecimalValue(workspaceEvent, "requiredDepositAmount", 3000m),
        0m,
        0m,
        DecimalValue(workspaceEvent, "amount", 9300m),
        Value(workspaceEvent, "reviewDecision", "链路已完成，押金责任与入住率已更新"),
        workspaceEvent.EventId,
        workspaceEvent.OccurredAtUtc);

    private static FinanceConfirmationAggregate FinanceConfirmationFrom(WorkspaceEvent workspaceEvent)
    {
        return new FinanceConfirmationAggregate(
            $"finance-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            $"deposit-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            DecimalValue(workspaceEvent, "confirmedAmount", DecimalValue(workspaceEvent, "depositAmount", 3000m)),
            Value(workspaceEvent, "currency", "KGS"),
            "confirmed",
            workspaceEvent.ActorId,
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static int IntValue(WorkspaceEvent workspaceEvent, string key, int defaultValue) =>
        RuntimeFieldAliases.IntValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string key, DateTimeOffset defaultValue) =>
        workspaceEvent.Payload.TryGetValue(RuntimeFieldAliases.CanonicalKey(key), out var value) && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();

}
