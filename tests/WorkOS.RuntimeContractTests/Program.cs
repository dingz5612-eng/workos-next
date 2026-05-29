using WorkOS.Api.Runtime;
using Npgsql;
using System.Text.Json;

var connectionString = Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
    ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev";

ResetPostgres(connectionString);

{
    var runtime = ProjectionRuntime.OpenPostgres(connectionString);
    var projection = runtime.GetAll();
    var cards = projection.Workspaces.SelectMany(workspace => workspace.Cards).ToArray();

    ValidateProjectionContractFiles();
    ValidateGeneratedDtos();
    ValidateSliceManifest(projection);
    ValidateProjectionEnvelopeAgainstContract(projection);

    Assert(projection.Workspaces.Count == 16, $"expected 16 workspaces, got {projection.Workspaces.Count}");
    Assert(cards.Length == 78, $"expected 78 cards, got {cards.Length}");

    foreach (var card in cards)
    {
        Assert(card.Fields.Business.Count > 0, $"{card.Id} missing business fields");
        Assert(card.Fields.System.Count > 0, $"{card.Id} missing system fields");
        Assert(card.Fields.Analytics.Count > 0, $"{card.Id} missing analytics fields");
        Assert(card.Evidence.Count > 0, $"{card.Id} missing evidence");
        Assert(card.Checks.Count > 0, $"{card.Id} missing system checks");
        Assert(card.Events.Count > 0, $"{card.Id} missing events");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} missing prepare transition");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} missing confirm transition");
        Assert(card.Confirmation.ForbiddenForAi, $"{card.Id} must forbid AI confirmation");
    }

    var resource = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    AssertSequence(resource, "room", "bed", "activate");
    ValidateFieldContracts(resource);

    var checkin = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    AssertSequence(checkin, "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard");
    ValidateFieldContracts(checkin);
    ValidateAccommodationWorkOS20Contracts(projection);
    ValidateAccommodationFactOwnership();
    ValidatePeriodAnalyticsContract();

    var prepared = runtime.Prepare("W-STAY-RESOURCE", "room");
    Assert(prepared is not null, "prepare should return room card payload");
    Assert(runtime.Login(new LoginRequest("operator", "wrong-password")) is null, "login must reject invalid password");

    var operatorToken = LoginToken(runtime, "operator");
    var financeToken = LoginToken(runtime, "finance");
    var managerToken = LoginToken(runtime, "manager");
    var aiToken = LoginToken(runtime, "ai");

    var missingToken = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("missing-token-finance"), ""));
    Assert(missingToken.Status == ConfirmStatus.Forbidden, "confirm must require a trusted backend session token");
    var missingIdempotencyKey = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-RESOURCE", "room", new ConfirmCardRequest("zh-CN", "", new Dictionary<string, string>(), Array.Empty<string>()), operatorToken));
    Assert(missingIdempotencyKey.Status == ConfirmStatus.Invalid, "confirm must require idempotency key");

    var aiFinance = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("ai-finance"), aiToken));
    Assert(aiFinance.Status == ConfirmStatus.Forbidden, "AI finance confirmation must be rejected");
    Assert(aiFinance.Reason?.StartsWith("ai_confirmation_forbidden:") == true, "AI rejection must use stable policy decision code");

    var operatorFinance = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("operator-finance"), operatorToken));
    Assert(operatorFinance.Status == ConfirmStatus.Forbidden, "operator must not confirm finance card");
    Assert(operatorFinance.Reason?.StartsWith("role_confirmation_forbidden:") == true, "role rejection must use stable policy decision code");

    var contractOnlyPrepare = runtime.Prepare("W-STAY-LEAD-RESERVATION", "leadCapture");
    Assert(contractOnlyPrepare is not null, "contract-only slices should still allow prepare");
    var contractOnlyConfirm = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-LEAD-RESERVATION", "leadCapture", Human("contract-only-lead-capture"), managerToken));
    Assert(contractOnlyConfirm.Status == ConfirmStatus.Forbidden, "contract-only slice confirm must be forbidden until runtime status is upgraded");
    Assert(contractOnlyConfirm.Reason == "slice_runtime_forbidden:Accommodation.LeadReservation:contract-only", "contract-only rejection must name the owning slice");
    ValidateAllContractOnlySlicesAreGated(runtime, connectionString, projection, managerToken);

    var humanRoom = runtime.Confirm("W-STAY-RESOURCE", "room", Human("resource-room", new Dictionary<string, string> { ["房间号"] = "A302" }), operatorToken);
    Assert(humanRoom.Status == ConfirmStatus.Confirmed, "human room confirmation should pass");
    runtime.ProcessPendingOutbox();

    var duplicateRoom = runtime.Confirm("W-STAY-RESOURCE", "room", Human("resource-room"), operatorToken);
    Assert(duplicateRoom.Status == ConfirmStatus.Duplicate, "same idempotency key should return duplicate instead of writing another event");

    Assert(runtime.Confirm("W-STAY-RESOURCE", "bed", Human("resource-bed"), operatorToken).Status == ConfirmStatus.Confirmed, "bed confirmation should pass");
    runtime.ProcessPendingOutbox();
    Assert(runtime.Confirm("W-STAY-RESOURCE", "activate", Human("resource-activate"), operatorToken).Status == ConfirmStatus.Confirmed, "resource activation should pass");
    runtime.ProcessPendingOutbox();

    foreach (var cardId in new[] { "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard" })
    {
        var token = cardId == "finance" ? financeToken : operatorToken;
        var result = runtime.Confirm("W-STAY-CHECKIN", cardId, Human($"checkin-{cardId}"), token);
        Assert(result.Status == ConfirmStatus.Confirmed, $"{cardId} confirmation should pass");
        runtime.ProcessPendingOutbox();
    }

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositAssessment", Human("deposit-assessment", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["应收押金金额"] = "3000",
        ["币种"] = "KGS"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "deposit assessment should pass after DepositLedger runtime upgrade");
    runtime.ProcessPendingOutbox();

    var missingDepositEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", Human("deposit-receipt-missing-evidence", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["实收押金金额"] = "3000",
        ["支付方式"] = "MBank"
    }), operatorToken));
    Assert(missingDepositEvidence.Status == ConfirmStatus.Forbidden, "non-cash deposit receipt without evidence must be forbidden");
    Assert(missingDepositEvidence.Reason == "deposit_evidence_required:non_cash_deposit", "deposit evidence policy must use stable reason");

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", HumanWithEvidence("deposit-receipt", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["实收押金金额"] = "3000",
        ["币种"] = "KGS",
        ["支付方式"] = "MBank"
    }, "deposit-proof-001"), operatorToken).Status == ConfirmStatus.Confirmed, "deposit receipt with evidence should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositConfirmation", Human("deposit-confirmation", new Dictionary<string, string>
    {
        ["押金收款记录"] = "deposit-ledger-001",
        ["确认金额"] = "3000",
        ["确认结果"] = "确认"
    }), financeToken).Status == ConfirmStatus.Confirmed, "finance should confirm deposit receipt");
    runtime.ProcessPendingOutbox();

    var overRefund = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundApproval", Human("deposit-refund-over-held", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["当前持有押金"] = "3000",
        ["扣除金额"] = "2000",
        ["抵扣欠款金额"] = "2000"
    }), operatorToken));
    Assert(overRefund.Status == ConfirmStatus.Forbidden, "deposit refund approval must reject more than held deposit");

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundApproval", Human("deposit-refund-approval", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["当前持有押金"] = "3000",
        ["扣除金额"] = "500",
        ["抵扣欠款金额"] = "500",
        ["应退金额"] = "2000"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "deposit refund approval within held amount should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundPayment", HumanWithEvidence("deposit-refund-payment", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["应退金额"] = "2000",
        ["退款方式"] = "MBank",
        ["付款时间"] = "2026-05-29T18:00"
    }, "deposit-refund-proof-001"), operatorToken).Status == ConfirmStatus.Confirmed, "deposit refund payment should pass");
    runtime.ProcessPendingOutbox();

    var missingPaymentEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", Human("payment-receipt-missing-evidence", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["收款金额"] = "9300",
        ["支付方式"] = "MBank"
    }), operatorToken));
    Assert(missingPaymentEvidence.Status == ConfirmStatus.Forbidden, "non-cash payment receipt without evidence must be forbidden");
    Assert(missingPaymentEvidence.Reason == "payment_evidence_required:non_cash_payment", "payment evidence policy must use stable reason");

    Assert(runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", HumanWithEvidence("payment-receipt", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["收款记录"] = "payment-ledger-001",
        ["收款金额"] = "9300",
        ["币种"] = "KGS",
        ["支付方式"] = "MBank",
        ["收款用途"] = "房租"
    }, "payment-proof-001"), operatorToken).Status == ConfirmStatus.Confirmed, "payment receipt with evidence should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentConfirmation", Human("payment-confirmation", new Dictionary<string, string>
    {
        ["收款记录"] = "payment-ledger-001",
        ["确认金额"] = "9300",
        ["确认结果"] = "确认"
    }), financeToken).Status == ConfirmStatus.Confirmed, "finance should confirm ordinary payment");
    runtime.ProcessPendingOutbox();

    var overAllocation = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentAllocation", Human("payment-allocation-over", new Dictionary<string, string>
    {
        ["收款记录"] = "payment-ledger-001",
        ["确认金额"] = "9300",
        ["分配金额"] = "10000"
    }), operatorToken));
    Assert(overAllocation.Status == ConfirmStatus.Forbidden, "payment allocation must reject more than confirmed amount");

    Assert(runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentAllocation", Human("payment-allocation", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["收款记录"] = "payment-ledger-001",
        ["确认金额"] = "9300",
        ["分配金额"] = "9300",
        ["总应收"] = "9300"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "payment allocation within confirmed amount should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "checkoutStart", Human("checkout-start", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["当前余额"] = "0",
        ["持有押金"] = "2000"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout start should pass after runtime upgrade");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "roomInspection", HumanWithEvidence("room-inspection", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["房间状态"] = "需清洁",
        ["床位状态"] = "正常",
        ["是否需要清洁"] = "是"
    }, "inspection-photo-001"), operatorToken).Status == ConfirmStatus.Confirmed, "room inspection should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "depositSettlement", Human("deposit-settlement-request", new Dictionary<string, string>
    {
        ["押金单"] = "deposit-ledger-001",
        ["扣除金额"] = "500",
        ["抵扣欠款金额"] = "500"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout should request deposit settlement without owning deposit transaction");
    runtime.ProcessPendingOutbox();

    var checkoutWithoutDepositSettlement = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "finalBalanceClose", Human("checkout-close-without-deposit", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["押金结算已请求"] = "否"
    }), operatorToken));
    Assert(checkoutWithoutDepositSettlement.Status == ConfirmStatus.Forbidden, "checkout final balance must require deposit settlement request");

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "finalBalanceClose", Human("checkout-final-balance", new Dictionary<string, string>
    {
        ["入住单"] = "stay-ledger-001",
        ["押金结算已请求"] = "是",
        ["结算结果"] = "已关闭"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout final balance should pass after deposit settlement request");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "bedRelease", Human("checkout-bed-release", new Dictionary<string, string>
    {
        ["退住已开始"] = "是",
        ["床位"] = "A301-02",
        ["释放床位"] = "是"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout bed release should pass after checkout start");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "postCheckoutCleaning", Human("checkout-cleaning", new Dictionary<string, string>
    {
        ["房间"] = "A301",
        ["床位"] = "A301-02",
        ["任务类型"] = "清洁"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "post-checkout cleaning request should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskCreate", HumanWithEvidence("service-task-create", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["任务类型"] = "清洁",
        ["房间"] = "A301",
        ["床位"] = "A301-02",
        ["是否阻断可售"] = "是"
    }, "task-photo-001"), operatorToken).Status == ConfirmStatus.Confirmed, "service task create should pass after runtime upgrade");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskAssign", Human("service-task-assign", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["负责人"] = "运营经办人"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service task assign should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskComplete", HumanWithEvidence("service-task-complete", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["完成结果"] = "已完成",
        ["实际成本"] = "800"
    }, "completion-photo-001"), operatorToken).Status == ConfirmStatus.Confirmed, "service task complete should pass without releasing room");
    runtime.ProcessPendingOutbox();

    var releaseBeforeVerify = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-SERVICE-TASK", "roomReleaseAfterService", Human("service-release-before-verify", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["服务任务已验收"] = "否"
    }), operatorToken));
    Assert(releaseBeforeVerify.Status == ConfirmStatus.Forbidden, "service release must require verification first");

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskVerify", Human("service-task-verify", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["验收结果"] = "通过"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service task verify should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "roomReleaseAfterService", Human("service-release-after-verify", new Dictionary<string, string>
    {
        ["任务"] = "task-phase3-001",
        ["服务任务已验收"] = "是",
        ["房间"] = "A301",
        ["床位"] = "A301-02"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service release request should pass after verification");
    runtime.ProcessPendingOutbox();

    var expenseWithoutEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseRecord", Human("expense-without-evidence", new Dictionary<string, string>
    {
        ["支出金额"] = "800",
        ["支付方式"] = "MBank"
    }), operatorToken));
    Assert(expenseWithoutEvidence.Status == ConfirmStatus.Forbidden, "non-cash expense without evidence must be forbidden");

    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseRecord", HumanWithEvidence("expense-record", new Dictionary<string, string>
    {
        ["支出记录"] = "expense-phase3-001",
        ["支出类别"] = "清洁",
        ["支出金额"] = "800",
        ["币种"] = "KGS",
        ["支付方式"] = "MBank"
    }, "expense-proof-001"), operatorToken).Status == ConfirmStatus.Confirmed, "expense record with evidence should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseApproval", Human("expense-approval", new Dictionary<string, string>
    {
        ["支出记录"] = "expense-phase3-001",
        ["确认金额"] = "800",
        ["审批结果"] = "通过"
    }), financeToken).Status == ConfirmStatus.Confirmed, "expense approval should pass by finance");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseLink", Human("expense-link", new Dictionary<string, string>
    {
        ["支出记录"] = "expense-phase3-001",
        ["关联房间"] = "A301",
        ["关联床位"] = "A301-02",
        ["关联任务"] = "task-phase3-001"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "expense link should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodScope", Human("period-scope", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["periodYear"] = "2026",
        ["periodNo"] = "15",
        ["periodStartAt"] = "2026-05-01T00:00:00Z",
        ["periodEndAt"] = "2026-05-10T23:59:59Z"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "period scope should pass after PeriodAnalytics runtime upgrade");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodMetricsReview", Human("period-metrics-zero-denominator", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["availableBedNight"] = "0",
        ["bedNightSold"] = "0",
        ["newLeadCount"] = "0",
        ["reservationCount"] = "0",
        ["checkInCount"] = "0"
    }), financeToken).Status == ConfirmStatus.Confirmed, "period metrics should allow zero denominator and freeze a snapshot");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodMetricsReview", Human("period-metrics-late-replay", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["availableBedNight"] = "100",
        ["bedNightSold"] = "99",
        ["newLeadCount"] = "20",
        ["reservationCount"] = "10",
        ["checkInCount"] = "9"
    }), financeToken).Status == ConfirmStatus.Confirmed, "late metric replay should not mutate the frozen snapshot");
    runtime.ProcessPendingOutbox();

    var periodDepositRevenue = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodFinanceReview", Human("period-finance-deposit-as-revenue", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["depositReceivedIncludedInRevenue"] = "true"
    }), financeToken));
    Assert(periodDepositRevenue.Status == ConfirmStatus.Forbidden, "period finance must reject deposit received as revenue");
    Assert(periodDepositRevenue.Reason == "period_deposit_revenue_forbidden", "period finance deposit revenue rejection must use stable reason");

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodFinanceReview", Human("period-finance", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["rentRevenue"] = "9300",
        ["otherRevenue"] = "200",
        ["confirmedPaymentAmount"] = "9300",
        ["pendingPaymentAmount"] = "0",
        ["depositReceivedAmount"] = "3000",
        ["depositRefundedAmount"] = "2000",
        ["depositDeductedAmount"] = "500",
        ["depositAppliedToBalanceAmount"] = "500",
        ["approvedExpenseAmount"] = "800",
        ["pendingExpenseAmount"] = "0",
        ["endingDebtAmount"] = "0",
        ["financeExceptionCount"] = "0"
    }), financeToken).Status == ConfirmStatus.Confirmed, "period finance review should pass without counting deposit as revenue or expense");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodOperationsDiagnosis", Human("period-operations-diagnosis", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["issueCategory"] = "入住率",
        ["issueSummary"] = "周中空床偏高",
        ["rootCause"] = "预订转化慢",
        ["blockedBedDays"] = "2",
        ["unfinishedTaskCount"] = "1",
        ["overdueTaskCount"] = "0",
        ["debtorCount"] = "0"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "period operations diagnosis should pass");
    runtime.ProcessPendingOutbox();

    var periodCloseWithoutActionPlan = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodClose", Human("period-close-without-action-plan", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["metricsReviewed"] = "true",
        ["financeReviewed"] = "true",
        ["operationsDiagnosed"] = "true",
        ["blockingIssueCount"] = "1",
        ["actionPlanCount"] = "0"
    }), managerToken));
    Assert(periodCloseWithoutActionPlan.Status == ConfirmStatus.Forbidden, "high-risk period close must require an action plan");
    Assert(periodCloseWithoutActionPlan.Reason == "period_close_requires_action_plan_for_high_risk", "period close high-risk rejection must use stable reason");

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodActionPlan", Human("period-action-plan", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["actionPlanId"] = "period-plan-001",
        ["actionTitle"] = "提升周中预订转化",
        ["actionType"] = "提升入住率",
        ["targetMetric"] = "平均入住率",
        ["targetValue"] = "0.75",
        ["ownerName"] = "manager",
        ["priority"] = "高",
        ["actionStatus"] = "进行中"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "period action plan should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodClose", Human("period-close", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["metricsReviewed"] = "true",
        ["financeReviewed"] = "true",
        ["operationsDiagnosed"] = "true",
        ["blockingIssueCount"] = "1",
        ["actionPlanCount"] = "1",
        ["closeResult"] = "closed"
    }), managerToken).Status == ConfirmStatus.Confirmed, "period close should pass after required reviews and action plan");
    runtime.ProcessPendingOutbox();

    var behavior = runtime.AppendBehaviorEvent(new BehaviorEventRecord("beh-test", "WorkspaceOpened", "workspace", "W-STAY-CHECKIN", "zh-CN", "contract-test", DateTimeOffset.UtcNow));
    Assert(behavior.EventId == "beh-test", "behavior event should append");

    var reloaded = ProjectionRuntime.OpenPostgres(connectionString).GetAll();
    var reloadedResource = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    Assert(reloaded.Events.Any(item => item.EventType == "RoomCreated"), "RoomCreated event should be persisted");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "audit events must include correlationId");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "audit events must include requestId");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-RESOURCE").Select(item => item.EventType).ToArray(), "RoomCreated", "BedCreated", "BedActivated");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-CHECKIN").Select(item => item.EventType).ToArray(), "LeadCaptured", "BookingConfirmed", "ResidentRegistered", "BedAssigned", "TariffAssigned", "DepositRequired", "PaymentRecordedByFrontDesk", "PaymentConfirmedByFinance", "StayCheckedIn", "OperatingMetricsReviewed");
    Assert(reloadedResource.Cards.Single(card => card.Id == "room").Status == "done", "room status should persist as done");
    Assert(reloadedResource.Cards.All(card => card.Status == "done"), "resource cards should all be done");

    var reloadedCheckin = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    Assert(reloadedCheckin.Cards.All(card => card.Status == "done"), "check-in cards should all be done");
    var reloadedRuntime = ProjectionRuntime.OpenPostgres(connectionString);
    Assert(CountRows(connectionString, "schema_migrations") >= 9, "schema migrations should be recorded in PostgreSQL");
    Assert(CountRows(connectionString, "accommodation_rooms") >= 1, "Room aggregate should persist in accommodation_rooms");
    Assert(CountRows(connectionString, "accommodation_beds") >= 1, "Bed aggregate should persist in accommodation_beds");
    Assert(CountRows(connectionString, "accommodation_deposits") >= 1, "Deposit aggregate should persist in accommodation_deposits");
    Assert(CountRows(connectionString, "finance_confirmations") >= 1, "FinanceConfirmation aggregate should persist in finance_confirmations");
    Assert(CountRows(connectionString, "hostel_leads") >= 1, "Hostel lead should persist in hostel_leads");
    Assert(CountRows(connectionString, "hostel_bookings") >= 1, "Hostel booking should persist in hostel_bookings");
    Assert(CountRows(connectionString, "hostel_stays") >= 1, "Hostel stay should persist in hostel_stays");
    Assert(CountRows(connectionString, "guest_folios") >= 1, "Guest folio should persist in guest_folios");
    Assert(CountRows(connectionString, "deposit_liabilities") >= 1, "Deposit liability should persist in deposit_liabilities");
    Assert(CountRows(connectionString, "hostel_payments") >= 1, "Payment should persist in hostel_payments");
    Assert(CountRows(connectionString, "finance_reconciliations") >= 1, "Finance reconciliation should persist in finance_reconciliations");
    Assert(CountRows(connectionString, "hostel_operating_metrics") >= 1, "Operating metrics should persist in hostel_operating_metrics");
    Assert(CountRows(connectionString, "deposit_transactions") >= 4, "DepositLedger transactions should persist in deposit_transactions");
    Assert(CountRows(connectionString, "payment_allocations") >= 1, "PaymentLedger allocations should persist in payment_allocations");
    Assert(CountRows(connectionString, "stay_balances") >= 1, "PaymentLedger balances should persist in stay_balances");
    Assert(CountRows(connectionString, "checkout_settlements") >= 1, "CheckOutSettlement should persist checkout_settlements");
    Assert(CountRows(connectionString, "room_inspections") >= 1, "CheckOutSettlement should persist room_inspections");
    Assert(CountRows(connectionString, "service_tasks") >= 1, "ServiceTask should persist service_tasks");
    Assert(CountRows(connectionString, "expenses") >= 1, "ExpenseLedger should persist expenses");
    Assert(CountRows(connectionString, "expense_links") >= 1, "ExpenseLedger should persist expense_links");
    Assert(CountRows(connectionString, "period_reviews") >= 1, "PeriodAnalytics should persist period_reviews");
    Assert(CountRows(connectionString, "period_metric_snapshots") >= 1, "PeriodAnalytics should persist frozen metric snapshots");
    Assert(CountRows(connectionString, "period_finance_snapshots") >= 1, "PeriodAnalytics should persist finance snapshots");
    Assert(CountRows(connectionString, "period_operation_diagnoses") >= 1, "PeriodAnalytics should persist operation diagnoses");
    Assert(CountRows(connectionString, "period_action_plans") >= 1, "PeriodAnalytics should persist action plans");
    Assert(CountRows(connectionString, "period_late_adjustments") >= 3, "PeriodAnalytics late adjustments should append events");
    Assert(ScalarDecimal(connectionString, "select average_occupancy_rate from period_metric_snapshots where period_id = 'PER-2026-05-01'") == 0m, "zero denominator should produce numeric zero");
    Assert(ScalarText(connectionString, "select average_occupancy_rate_status from period_metric_snapshots where period_id = 'PER-2026-05-01'") == "not_applicable", "zero denominator should mark formula not_applicable");
    Assert(ScalarDecimal(connectionString, "select bed_night_sold from period_metric_snapshots where period_id = 'PER-2026-05-01'") == 0m, "frozen period snapshot must not be mutated by a late metric replay");
    Assert(ScalarDecimal(connectionString, "select period_net_cash_flow from period_finance_snapshots where period_id = 'PER-2026-05-01'") == 8700m, "period net cash flow must exclude deposit received and deposit refund");
    Assert(ScalarDecimal(connectionString, "select deposit_liability_end from period_finance_snapshots where period_id = 'PER-2026-05-01'") == 0m, "deposit liability end formula should be persisted");
    Assert(CountRows(connectionString, "repair_stations") >= 2, "RepairStation aggregate roots should persist in repair_stations");
    Assert(CountRows(connectionString, "repair_technicians") >= 2, "Technician aggregate roots should persist in repair_technicians");
    Assert(CountRows(connectionString, "repair_vehicles") >= 2, "Vehicle aggregate roots should persist in repair_vehicles");
    Assert(reloadedRuntime.GetAuditEvents("W-STAY-CHECKIN").Count == 10, "check-in audit events should persist in PostgreSQL");
    Assert(reloadedRuntime.GetBehaviorEvents().Any(item => item.EventId == "beh-test"), "behavior event should persist in PostgreSQL");
    var outbox = reloadedRuntime.GetOutboxMessages();
    Assert(outbox.Count == reloaded.Events.Count, $"outbox count should match successful audit events, got {outbox.Count} outbox and {reloaded.Events.Count} audit events");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "outbox messages must include correlationId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "outbox messages must include requestId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CausationId)), "outbox messages must include causationId");
    Assert(outbox.All(item => item.ProcessedAtUtc is not null), "all outbox messages should be processed by projector");
    Assert(reloadedRuntime.ProcessPendingOutbox() == 0, "outbox projector should be idempotent after processing");
    var observation = reloadedRuntime.Observe();
    Assert(observation.WorkspaceCount == 16, $"observability workspaceCount expected 16, got {observation.WorkspaceCount}");
    Assert(observation.CardCount == 78, $"observability cardCount expected 78, got {observation.CardCount}");
    Assert(observation.AuditEventCount == reloaded.Events.Count, $"observability auditEventCount should match successful audit events, got {observation.AuditEventCount}");
    Assert(observation.OutboxCount == outbox.Count, $"observability outboxCount should match persisted outbox messages, got {observation.OutboxCount}");
    Assert(observation.PendingOutboxCount == 0, "observability pending outbox count should be zero after processing");
    Assert(observation.BehaviorEventCount >= 1, "observability behavior event count should include persisted behavior events");

    Console.WriteLine("WorkOS.RuntimeContractTests: PASS");
}

static void AssertSequence(WorkspaceProjection workspace, params string[] expected)
{
    var actual = workspace.Cards.Select(card => card.Id).ToArray();
    Assert(actual.SequenceEqual(expected), $"{workspace.Id} sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static void AssertEventSequence(string[] actual, params string[] expected)
{
    Assert(actual.SequenceEqual(expected), $"event sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static void ValidateFieldContracts(WorkspaceProjection workspace)
{
    foreach (var card in workspace.Cards)
    {
        foreach (var field in card.Fields.Business)
        {
            var label = field.Label["zh-CN"];
            if (new[] { "房间号", "床位号", "凭证编号", "付款人", "姓名", "电话" }.Contains(label))
            {
                Assert(field.Type != "searchSelect", $"{workspace.Id}.{card.Id}.{label} creates or records data and must not be searchSelect");
                Assert(field.Ui.Control != "searchSelect", $"{workspace.Id}.{card.Id}.{label} must not render as searchSelect");
                Assert(field.Source == "userInput", $"{workspace.Id}.{card.Id}.{label} must come from userInput");
            }

            if (field.Type == "readonly" || field.Ui.Readonly)
            {
                Assert(field.Source is "system" or "projection", $"{workspace.Id}.{card.Id}.{label} readonly field must declare system or projection source");
                Assert(field.Ui.Control == "readonly", $"{workspace.Id}.{card.Id}.{label} readonly field must render with readonly control");
            }

            if (IsDateLabel(label))
            {
                Assert(field.Type == "dateTime", $"{workspace.Id}.{card.Id}.{label} must use dateTime type");
                Assert(field.Ui.Control is "dateTime" or "dateTimeRange", $"{workspace.Id}.{card.Id}.{label} must render with date/time control");
            }

            if (field.Ui.Control == "select")
            {
                Assert(!string.IsNullOrWhiteSpace(field.Ui.OptionSet), $"{workspace.Id}.{card.Id}.{label} select must declare optionSet");
                Assert(field.Ui.Options.Count > 0, $"{workspace.Id}.{card.Id}.{label} select must include options");
            }
        }
    }

    var room = workspace.Cards.FirstOrDefault(card => card.Id == "room");
    if (room is not null)
    {
        Assert(Field(room, "房间号").Ui.Control == "text", "房间号 must be text on room creation");
        Assert(Field(room, "容量").Ui.Control == "readonly", "容量 must be readonly derived field");
        Assert(Field(room, "容量").Ui.DerivedFrom == "房型", "容量 must derive from 房型");
    }

    var bed = workspace.Cards.FirstOrDefault(card => card.Id == "bed");
    if (bed is not null)
    {
        Assert(Field(bed, "所属房间").Ui.Control == "searchSelect", "所属房间 must select an existing room");
        Assert(Field(bed, "床位号").Ui.Control == "text", "床位号 must be text on bed creation");
    }
}

static void ValidateAccommodationWorkOS20Contracts(ProjectionEnvelope projection)
{
    var expected = new Dictionary<string, string[]>
    {
        ["W-STAY-LEAD-RESERVATION"] = new[] { "leadCapture", "leadFollowUp", "reservationCreate", "reservationCancel", "reservationConvert" },
        ["W-STAY-LIFECYCLE"] = new[] { "residentProfile", "checkInBedAssign", "chargeAssessment", "stayExtension" },
        ["W-STAY-DEPOSIT-LEDGER"] = new[] { "depositAssessment", "depositReceipt", "depositConfirmation", "depositDeduction", "depositRefundApproval", "depositRefundPayment", "depositClose" },
        ["W-STAY-PAYMENT-LEDGER"] = new[] { "paymentReceipt", "paymentConfirmation", "paymentAllocation", "paymentAdjustment", "debtFollowUp" },
        ["W-STAY-CHECKOUT-SETTLEMENT"] = new[] { "checkoutStart", "roomInspection", "depositSettlement", "finalBalanceClose", "bedRelease", "postCheckoutCleaning" },
        ["W-STAY-SERVICE-TASK"] = new[] { "serviceTaskCreate", "serviceTaskAssign", "serviceTaskComplete", "serviceTaskVerify", "roomReleaseAfterService" },
        ["W-STAY-EXPENSE-LEDGER"] = new[] { "expenseRecord", "expenseApproval", "expenseLink" },
        ["W-STAY-PERIOD-ANALYTICS"] = new[] { "periodScope", "periodMetricsReview", "periodFinanceReview", "periodOperationsDiagnosis", "periodActionPlan", "periodClose" }
    };

    foreach (var (workspaceId, cardIds) in expected)
    {
        var workspace = projection.Workspaces.Single(item => item.Id == workspaceId);
        AssertSequence(workspace, cardIds);
        ValidateFieldContracts(workspace);
        foreach (var card in workspace.Cards)
        {
            Assert(card.BlockerRules.Count > 0, $"{workspaceId}.{card.Id} must declare blocker rules");
            Assert(card.Confirmation.ForbiddenForAi, $"{workspaceId}.{card.Id} must forbid AI confirmation");
            foreach (var field in card.Fields.Business)
            {
                if (field.Ui.Control == "select")
                {
                    Assert(!string.IsNullOrWhiteSpace(field.Ui.OptionSet), $"{workspaceId}.{card.Id}.{field.Id} select must bind optionSet");
                    Assert(field.Ui.Options.Count > 0, $"{workspaceId}.{card.Id}.{field.Id} select must expose options");
                }

                if (field.Ui.Readonly || field.Type == "readonly")
                {
                    Assert(field.Source is "system" or "projection", $"{workspaceId}.{card.Id}.{field.Id} readonly source must be system/projection");
                }
            }
        }
    }

    AssertEventTypes(projection, "W-STAY-DEPOSIT-LEDGER",
        "Accommodation.DepositAssessed",
        "Accommodation.DepositReceived",
        "Accommodation.DepositEvidenceSubmitted",
        "Accommodation.DepositConfirmed",
        "Accommodation.DepositRejected",
        "Accommodation.DepositDeducted",
        "Accommodation.DepositAppliedToBalance",
        "Accommodation.DepositRefundApproved",
        "Accommodation.DepositRefundPaid",
        "Accommodation.DepositClosed");
    AssertEventTypes(projection, "W-STAY-PAYMENT-LEDGER",
        "Accommodation.PaymentReceived",
        "Accommodation.PaymentEvidenceSubmitted",
        "Accommodation.PaymentConfirmed",
        "Accommodation.PaymentRejected",
        "Accommodation.PaymentAllocated",
        "Accommodation.PaymentAdjusted",
        "Accommodation.DebtFollowUpRecorded",
        "Accommodation.BalanceRecalculated");

    var periodFinance = projection.Workspaces.Single(item => item.Id == "W-STAY-PERIOD-ANALYTICS").Cards.Single(card => card.Id == "periodFinanceReview");
    Assert(periodFinance.Checks.Any(check => check.Label["zh-CN"].Contains("押金不计收入")), "period finance contract must guard deposit revenue separation");
    Assert(periodFinance.Checks.Any(check => check.Label["zh-CN"].Contains("押金退款不计支出")), "period finance contract must guard deposit refund expense separation");
    Assert(periodFinance.BlockerRules.Any(rule => rule.Id.Contains("cannot_count_deposit_received_as_revenue")), "period finance blockers must prevent deposit as revenue");
    Assert(periodFinance.BlockerRules.Any(rule => rule.Id.Contains("cannot_count_deposit_refund_as_expense")), "period finance blockers must prevent deposit refund as expense");

    var depositRefundApproval = projection.Workspaces.Single(item => item.Id == "W-STAY-DEPOSIT-LEDGER").Cards.Single(card => card.Id == "depositRefundApproval");
    var depositRefundPayment = projection.Workspaces.Single(item => item.Id == "W-STAY-DEPOSIT-LEDGER").Cards.Single(card => card.Id == "depositRefundPayment");
    Assert(depositRefundApproval.Events.Any(item => item.EventType == "Accommodation.DepositRefundApproved"), "deposit refund approval card must emit only approval");
    Assert(!depositRefundApproval.Events.Any(item => item.EventType == "Accommodation.DepositRefundPaid"), "deposit refund approval card must not emit payment");
    Assert(depositRefundPayment.Events.Any(item => item.EventType == "Accommodation.DepositRefundPaid"), "deposit refund payment card must emit payment");
    Assert(!depositRefundPayment.Events.Any(item => item.EventType == "Accommodation.DepositRefundApproved"), "deposit refund payment card must not emit approval");
    Assert(depositRefundApproval.Checks.Any(check => check.Label["zh-CN"].Contains("不超过持有押金")), "deposit refund contract must guard held amount");
    Assert(depositRefundApproval.BlockerRules.Any(rule => rule.Id.Contains("cannot_refund_more_than_held_deposit")), "deposit refund blocker must prevent over-refund");

    var paymentAllocation = projection.Workspaces.Single(item => item.Id == "W-STAY-PAYMENT-LEDGER").Cards.Single(card => card.Id == "paymentAllocation");
    Assert(paymentAllocation.Checks.Any(check => check.Label["zh-CN"].Contains("不超过确认金额")), "payment allocation contract must guard confirmed amount");
    Assert(paymentAllocation.BlockerRules.Any(rule => rule.Id.Contains("cannot_allocate_payment_more_than_confirmed_amount")), "payment allocation blocker must prevent over-allocation");

    var periodClose = projection.Workspaces.Single(item => item.Id == "W-STAY-PERIOD-ANALYTICS").Cards.Single(card => card.Id == "periodClose");
    foreach (var blocker in new[] { "cannot_close_period_without_metrics_review", "cannot_close_period_without_finance_review", "cannot_close_period_with_blocking_finance_exceptions" })
    {
        Assert(periodClose.BlockerRules.Any(rule => rule.Id.Contains(blocker)), $"period close blocker missing {blocker}");
    }

    var checkoutSettlement = projection.Workspaces.Single(item => item.Id == "W-STAY-CHECKOUT-SETTLEMENT");
    AssertEventTypes(projection, "W-STAY-CHECKOUT-SETTLEMENT", "Accommodation.DepositSettlementRequested");
    Assert(!checkoutSettlement.Cards.SelectMany(card => card.Events).Any(item => item.EventType == "Accommodation.DepositSettledForCheckout"), "checkout settlement must not emit actual deposit settlement transactions");

    var serviceTask = projection.Workspaces.Single(item => item.Id == "W-STAY-SERVICE-TASK");
    var serviceTaskComplete = serviceTask.Cards.Single(card => card.Id == "serviceTaskComplete");
    Assert(!serviceTaskComplete.Fields.Business.Any(field => field.Label["zh-CN"] == "完成后释放房间"), "serviceTaskComplete must not release room directly");
    var roomReleaseAfterService = serviceTask.Cards.Single(card => card.Id == "roomReleaseAfterService");
    Assert(roomReleaseAfterService.Checks.Any(check => check.Label["zh-CN"].Contains("服务任务已验收")), "roomReleaseAfterService must require ServiceTaskVerified first");
    Assert(roomReleaseAfterService.Events.All(item => item.EventType.EndsWith("Requested", StringComparison.Ordinal)), "service task release card must request resource release, not mutate bed status");
}

static void ValidateAccommodationFactOwnership()
{
    var expected = new Dictionary<string, string>
    {
        ["Deposit"] = "Accommodation.DepositLedger",
        ["Payment"] = "Accommodation.PaymentLedger",
        ["StayBalance"] = "Accommodation.PaymentLedger",
        ["BedStatus"] = "Accommodation.ResourceSetup",
        ["Expense"] = "Accommodation.ExpenseLedger",
        ["PeriodSnapshot"] = "Accommodation.PeriodAnalytics"
    };

    foreach (var (fact, owner) in expected)
    {
        Assert(AccommodationFactOwnershipCatalog.OwnerOf(fact) == owner, $"{fact} owner slice must be {owner}");
        Assert(AccommodationFactOwnershipCatalog.IsOwner(fact, owner), $"{owner} must own {fact}");
    }

    Assert(!AccommodationFactOwnershipCatalog.IsOwner("Deposit", "Accommodation.CheckOutSettlement"), "checkout settlement must not own Deposit facts");
    Assert(!AccommodationFactOwnershipCatalog.IsOwner("Payment", "Accommodation.DepositLedger"), "deposit ledger must not own Payment facts");
    Assert(!AccommodationFactOwnershipCatalog.IsOwner("BedStatus", "Accommodation.ServiceTask"), "service task must not own BedStatus facts");
}

static void ValidatePeriodAnalyticsContract()
{
    using var contract = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "period-analytics-contract.json")));
    var root = contract.RootElement;
    Assert(root.GetProperty("sliceId").GetString() == "Accommodation.PeriodAnalytics", "period analytics contract must belong to PeriodAnalytics slice");
    Assert(root.GetProperty("zeroDenominator").GetProperty("status").GetString() == "not_applicable", "zero denominator behavior must be explicit");
    Assert(root.GetProperty("snapshotPolicy").GetProperty("snapshotType").GetString() == "frozen-period-snapshot", "period snapshot must be frozen");
    Assert(root.GetProperty("snapshotPolicy").GetProperty("lateAdjustmentPolicy").GetString() == "append-adjustment-event", "late adjustments must append events");

    var formulas = root.GetProperty("formulas").EnumerateArray().ToArray();
    foreach (var formula in new[] { "averageOccupancyRate", "leadToReservationRate", "reservationToCheckInRate", "periodNetCashFlow", "depositLiabilityEnd" })
    {
        Assert(formulas.Any(item => item.GetProperty("id").GetString() == formula), $"period analytics formula missing {formula}");
    }

    var netCashFlow = formulas.Single(item => item.GetProperty("id").GetString() == "periodNetCashFlow");
    var excluded = netCashFlow.GetProperty("excludes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    Assert(excluded.Contains("depositReceivedAmount"), "period net cash flow must exclude deposit received");
    Assert(excluded.Contains("depositRefundedAmount"), "period net cash flow must exclude deposit refunds");
}

static void ValidateAllContractOnlySlicesAreGated(
    ProjectionRuntime runtime,
    string connectionString,
    ProjectionEnvelope projection,
    string managerToken)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var contractOnlySlices = manifest.RootElement
        .GetProperty("slices")
        .EnumerateArray()
        .Where(slice => slice.GetProperty("status").GetString() == "contract-only")
        .ToArray();

    Assert(contractOnlySlices.Length > 0, "at least one contract-only slice must remain covered by the status gate tests");
    foreach (var slice in contractOnlySlices)
    {
        var sliceId = slice.GetProperty("id").GetString()!;
        var workspaceId = slice.GetProperty("workspaceId").GetString()!;
        var cardId = slice.GetProperty("cards").EnumerateArray().First().GetString()!;
        Assert(projection.Workspaces.Any(workspace => workspace.Id == workspaceId), $"contract-only slice {sliceId} must reference an existing workspace");
        Assert(runtime.Prepare(workspaceId, cardId) is not null, $"contract-only slice {sliceId} should allow prepare");
        var result = AssertNoSideEffects(connectionString, () => runtime.Confirm(workspaceId, cardId, Human($"contract-only-{workspaceId}-{cardId}"), managerToken));
        Assert(result.Status == ConfirmStatus.Forbidden, $"contract-only slice {sliceId} must forbid confirm");
        Assert(result.Reason == $"slice_runtime_forbidden:{sliceId}:contract-only", $"contract-only slice {sliceId} rejection must name status and owner");
    }
}

static void AssertEventTypes(ProjectionEnvelope projection, string workspaceId, params string[] expected)
{
    var workspace = projection.Workspaces.Single(item => item.Id == workspaceId);
    var actual = workspace.Cards.SelectMany(card => card.Events).Select(item => item.EventType).ToHashSet();
    foreach (var eventType in expected)
    {
        Assert(actual.Contains(eventType), $"{workspaceId} missing event contract {eventType}");
    }
}

static bool IsDateLabel(string label) =>
    label.Contains("日期") ||
    label.Contains("时间") ||
    new[] { "预计入住/退房", "入住周期" }.Contains(label);

static FieldProjection Field(CardProjection card, string zhLabel) =>
    card.Fields.Business.Single(field => field.Label["zh-CN"] == zhLabel);

static ConfirmCardRequest Human(string idempotencyKey, IReadOnlyDictionary<string, string>? fieldValues = null) =>
    new("zh-CN", idempotencyKey, fieldValues ?? new Dictionary<string, string>(), Array.Empty<string>());

static ConfirmCardRequest HumanWithEvidence(string idempotencyKey, IReadOnlyDictionary<string, string> fieldValues, params string[] evidenceIds) =>
    new("zh-CN", idempotencyKey, fieldValues, evidenceIds);

static ConfirmResult AssertNoSideEffects(string connectionString, Func<ConfirmResult> action)
{
    var auditBefore = CountRows(connectionString, "audit_events");
    var outboxBefore = CountRows(connectionString, "outbox_messages");
    var aggregateBefore = TotalAggregateRows(connectionString);
    var result = action();
    Assert(CountRows(connectionString, "audit_events") == auditBefore, $"{result.Status} confirm must not append AuditEvent");
    Assert(CountRows(connectionString, "outbox_messages") == outboxBefore, $"{result.Status} confirm must not append OutboxMessage");
    Assert(TotalAggregateRows(connectionString) == aggregateBefore, $"{result.Status} confirm must not write aggregate tables");
    return result;
}

static void ValidateProjectionContractFiles()
{
    using var projectionSchema = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "projection-contract.schema.json")));
    var required = projectionSchema.RootElement.GetProperty("required").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var field in new[] { "projection", "version", "languages", "sourceOfTruth", "workspaces", "events" })
    {
        Assert(required.Contains(field), $"projection schema must require {field}");
    }

    var eventRequired = projectionSchema.RootElement
        .GetProperty("$defs")
        .GetProperty("workspaceEvent")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "correlationId", "causationId", "requestId" })
    {
        Assert(eventRequired.Contains(field), $"projection schema workspaceEvent must require {field}");
    }

    using var openApi = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "workos-runtime.openapi.json")));
    var confirm = openApi.RootElement
        .GetProperty("paths")
        .GetProperty("/api/workspaces/{workspaceId}/cards/{cardId}/confirm")
        .GetProperty("post");

    var hasActorHeader = confirm.GetProperty("parameters").EnumerateArray().Any(item =>
        item.GetProperty("name").GetString() == "X-WorkOS-Actor-Token" &&
        item.GetProperty("in").GetString() == "header" &&
        item.GetProperty("required").GetBoolean());
    Assert(hasActorHeader, "OpenAPI confirm must require X-WorkOS-Actor-Token");

    var confirmRequired = openApi.RootElement
        .GetProperty("components")
        .GetProperty("schemas")
        .GetProperty("ConfirmCardRequest")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "language", "idempotencyKey", "fieldValues", "evidenceIds" })
    {
        Assert(confirmRequired.Contains(field), $"OpenAPI ConfirmCardRequest must require {field}");
    }

    Assert(openApi.RootElement.GetProperty("paths").TryGetProperty("/api/observability/runtime", out _), "OpenAPI must include runtime observability endpoint");

    using var policyContract = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "policy-contract.json")));
    var decisionCodes = policyContract.RootElement.GetProperty("decisionCodes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var code in new[] { "allowed", "ai_confirmation_forbidden", "role_confirmation_forbidden" })
    {
        Assert(decisionCodes.Contains(code), $"policy contract must include decision code {code}");
    }

    foreach (var code in new[]
    {
        "slice_runtime_forbidden",
        "deposit_evidence_required",
        "deposit_refund_exceeds_held_amount",
        "payment_evidence_required",
        "payment_allocation_exceeds_confirmed_amount",
        "checkout_deposit_settlement_required",
        "checkout_start_required_before_bed_release",
        "service_task_verification_required_before_release",
        "expense_evidence_required",
        "period_deposit_revenue_forbidden",
        "period_deposit_refund_expense_forbidden",
        "period_close_requires_metrics_review",
        "period_close_requires_finance_review",
        "period_close_requires_operations_diagnosis",
        "period_close_requires_action_plan_for_high_risk"
    })
    {
        Assert(decisionCodes.Contains(code), $"policy contract must include runtime decision code {code}");
    }
}

static void ValidateGeneratedDtos()
{
    var generated = File.ReadAllText(Path.Combine("apps", "mobile", "src", "generated", "workosContracts.d.ts"));
    foreach (var typeName in new[] { "ProjectionEnvelope", "WorkspaceProjection", "CardProjection", "ConfirmCardRequest", "RuntimeObservation" })
    {
        Assert(generated.Contains($"export type {typeName}"), $"generated DTOs must include {typeName}");
    }
    Assert(generated.Contains("correlationId: string"), "generated DTOs must include WorkspaceEvent correlationId");
    Assert(File.Exists(Path.Combine("apps", "mobile", "src", "generated", "runtimeApiPaths.js")), "generated runtime API paths module must exist");
}

static void ValidateSliceManifest(ProjectionEnvelope projection)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var slices = manifest.RootElement.GetProperty("slices").EnumerateArray().ToArray();
    foreach (var slice in slices)
    {
        var required = slice.GetProperty("id").GetString()!;
        var workspaceId = slice.GetProperty("workspaceId").GetString();
        var workspace = projection.Workspaces.FirstOrDefault(item => item.Id == workspaceId);
        Assert(workspace is not null, $"slice {required} references missing workspace {workspaceId}");
        Assert(slice.GetProperty("cards").GetArrayLength() > 0, $"slice {required} must own cards");
        Assert(slice.GetProperty("events").GetArrayLength() > 0, $"slice {required} must own events");
        Assert(slice.GetProperty("ownsAggregates").GetArrayLength() > 0, $"slice {required} must declare aggregate ownership");
        Assert(new[] { "contract-only", "runtime-skeleton", "production-slice" }.Contains(slice.GetProperty("status").GetString()), $"slice {required} must declare a supported runtime status");
        if (slice.GetProperty("status").GetString() == "runtime-skeleton")
        {
            var policyPath = Path.Combine("services", "core-api", "WorkOS.Api", "Slices", Path.Combine(required.Split('.')), "Policies", $"{required.Split('.').Last()}Policy.cs");
            Assert(File.Exists(policyPath), $"runtime-skeleton slice {required} must have an explicit skeleton policy");
        }

        foreach (var cardId in slice.GetProperty("cards").EnumerateArray().Select(item => item.GetString()))
        {
            Assert(workspace!.Cards.Any(card => card.Id == cardId), $"slice {required} card {cardId} missing from projection workspace {workspaceId}");
        }
    }
}

static void ValidateProjectionEnvelopeAgainstContract(ProjectionEnvelope projection)
{
    Assert(projection.Projection == "IntentWorkspaceProjection", "projection envelope type must match contract");
    Assert(!string.IsNullOrWhiteSpace(projection.Version), "projection envelope missing version");
    Assert(projection.Languages.Contains("zh-CN") && projection.Languages.Contains("ru-RU"), "projection languages must include zh-CN and ru-RU");
    Assert(!string.IsNullOrWhiteSpace(projection.SourceOfTruth), "projection sourceOfTruth missing");
    Assert(projection.Workspaces.Count > 0, "projection workspaces missing");

    foreach (var workspace in projection.Workspaces)
    {
        Assert(workspace.ProjectionType == "IntentWorkspaceProjection", $"{workspace.Id} projectionType mismatch");
        AssertLocalized(workspace.Title, $"{workspace.Id} title");
        AssertLocalized(workspace.Summary, $"{workspace.Id} summary");
        Assert(workspace.Cards.Count > 0, $"{workspace.Id} cards missing");
        foreach (var card in workspace.Cards)
        {
            Assert(card.ProjectionType == "WorkspaceCardProjection", $"{card.Id} projectionType mismatch");
            AssertLocalized(card.Title, $"{card.Id} title");
            Assert(new[] { "notStarted", "ready", "blocked", "inProgress", "done" }.Contains(card.Status), $"{card.Id} status invalid");
            Assert(card.Fields.System.Count > 0 && card.Fields.Business.Count > 0 && card.Fields.Analytics.Count > 0, $"{card.Id} fields incomplete");
            foreach (var field in card.Fields.Business)
            {
                AssertLocalized(field.Label, $"{card.Id}.{field.Id} field label");
                AssertLocalized(field.Help, $"{card.Id}.{field.Id} field help");
                Assert(!string.IsNullOrWhiteSpace(field.Ui.Control), $"{card.Id}.{field.Id} missing ui control");
                if (field.Ui.Control is "select" or "searchSelect")
                {
                    Assert(field.Ui.Options.Count > 0, $"{card.Id}.{field.Id} selectable field missing contract options");
                    Assert(field.Ui.Options.All(option => !string.IsNullOrWhiteSpace(option.Value)), $"{card.Id}.{field.Id} option missing value");
                    foreach (var option in field.Ui.Options)
                    {
                        AssertLocalized(option.Label, $"{card.Id}.{field.Id} option {option.Value}");
                    }
                }
            }
            Assert(card.Evidence.Count > 0, $"{card.Id} evidence missing");
            Assert(card.Checks.Count > 0, $"{card.Id} checks missing");
            Assert(card.Events.Count > 0, $"{card.Id} events missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} onPrepare missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} onConfirm missing");
            Assert(!string.IsNullOrWhiteSpace(card.Confirmation.RequiredRole), $"{card.Id} confirmation requiredRole missing");
            AssertLocalized(card.Confirmation.Label, $"{card.Id} confirmation label");
        }
    }
}

static void AssertLocalized(IReadOnlyDictionary<string, string> value, string label)
{
    Assert(value.TryGetValue("zh-CN", out var zh) && !string.IsNullOrWhiteSpace(zh), $"{label} missing zh-CN");
    Assert(value.TryGetValue("ru-RU", out var ru) && !string.IsNullOrWhiteSpace(ru), $"{label} missing ru-RU");
}

static string LoginToken(ProjectionRuntime runtime, string username)
{
    var login = runtime.Login(new LoginRequest(username, "dev"));
    if (login is null)
    {
        throw new InvalidOperationException($"login should succeed for {username}");
    }

    var token = login.GetType().GetProperty("token")?.GetValue(login)?.ToString();
    Assert(!string.IsNullOrWhiteSpace(token), $"login token should be issued for {username}");
    return token!;
}

static int CountRows(string connectionString, string tableName)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = $"select count(*) from {tableName}";
    return Convert.ToInt32(command.ExecuteScalar());
}

static int TotalAggregateRows(string connectionString)
{
    var tables = new[]
    {
        "accommodation_rooms",
        "accommodation_beds",
        "accommodation_deposits",
        "finance_confirmations",
        "hostel_leads",
        "hostel_bookings",
        "hostel_stays",
        "guest_folios",
        "deposit_liabilities",
        "hostel_payments",
        "finance_reconciliations",
        "hostel_operating_metrics",
        "deposit_transactions",
        "payment_allocations",
        "stay_balances",
        "checkout_settlements",
        "room_inspections",
        "service_tasks",
        "expenses",
        "expense_links",
        "period_reviews",
        "period_metric_snapshots",
        "period_finance_snapshots",
        "period_operation_diagnoses",
        "period_action_plans",
        "period_late_adjustments",
        "repair_stations",
        "repair_technicians",
        "repair_vehicles"
    };

    return tables.Sum(table => CountRows(connectionString, table));
}

static decimal ScalarDecimal(string connectionString, string sql)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    return Convert.ToDecimal(command.ExecuteScalar());
}

static string ScalarText(string connectionString, string sql)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
}

static void ResetPostgres(string connectionString)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = """
        drop table if exists finance_confirmations;
        drop table if exists accommodation_deposits;
        drop table if exists period_late_adjustments;
        drop table if exists period_action_plans;
        drop table if exists period_operation_diagnoses;
        drop table if exists period_finance_snapshots;
        drop table if exists period_metric_snapshots;
        drop table if exists period_reviews;
        drop table if exists expense_links;
        drop table if exists expenses;
        drop table if exists service_tasks;
        drop table if exists room_inspections;
        drop table if exists checkout_settlements;
        drop table if exists stay_balances;
        drop table if exists payment_allocations;
        drop table if exists deposit_transactions;
        drop table if exists hostel_operating_metrics;
        drop table if exists finance_reconciliations;
        drop table if exists hostel_payments;
        drop table if exists deposit_liabilities;
        drop table if exists guest_folios;
        drop table if exists hostel_stays;
        drop table if exists hostel_bookings;
        drop table if exists hostel_leads;
        drop table if exists accommodation_beds;
        drop table if exists accommodation_rooms;
        drop table if exists repair_vehicles;
        drop table if exists repair_technicians;
        drop table if exists repair_stations;
        drop table if exists behavior_events;
        drop table if exists runtime_sessions;
        drop table if exists outbox_messages;
        drop table if exists audit_events;
        drop table if exists runtime_documents;
        drop table if exists schema_migrations;
        """;
    command.ExecuteNonQuery();
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
