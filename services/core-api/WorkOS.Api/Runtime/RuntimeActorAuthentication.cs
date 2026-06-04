using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace WorkOS.Api.Runtime;

public static class RuntimeActorAuthenticationDefaults
{
    public const string Scheme = "WorkOSRuntimeActor";
    public const string SessionCookieName = "workosnext_session";
    public const string CsrfCookieName = "workosnext_csrf";
}

public static class RuntimeActorPolicies
{
    public const string WorkOSAuthenticated = "WorkOSAuthenticated";
    public const string WorkOSWrite = "WorkOSWrite";
    public const string OperationsConfirmPolicy = "OperationsConfirmPolicy";
    public const string HighRiskActionPolicy = "HighRiskActionPolicy";
    public const string RuntimeMaintenancePolicy = "RuntimeMaintenancePolicy";
    public const string GovernanceExportPolicy = "GovernanceExportPolicy";
}

public static class RuntimeActorClaims
{
    public const string ActorId = "workos.actorId";
    public const string Role = "workos.role";
    public const string TenantId = "workos.tenantId";
    public const string Capability = "workos.capability";
    public const string AuthSource = "workos.authSource";
    public const string SessionToken = "workos.sessionToken";
}

public sealed record RuntimeActorContext(
    string ActorId,
    string Role,
    string TenantId,
    IReadOnlyList<string> Capabilities,
    string AuthSource,
    string SessionToken);

public sealed class RuntimeActorAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly ProjectionRuntime runtime;

    public RuntimeActorAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ProjectionRuntime runtime)
        : base(options, logger, encoder)
    {
        this.runtime = runtime;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = TokenFromRequest(Request, out var source);
        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var user = runtime.FindUserBySessionToken(token);
        if (user is null)
        {
            return Task.FromResult(AuthenticateResult.Fail("runtime_session_not_found"));
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role),
            new(RuntimeActorClaims.ActorId, user.UserId),
            new(RuntimeActorClaims.Role, user.Role),
            new(RuntimeActorClaims.TenantId, user.TenantId),
            new(RuntimeActorClaims.AuthSource, source),
            new(RuntimeActorClaims.SessionToken, token)
        };
        claims.AddRange(user.EffectiveCapabilities
            .Select(capability => new Claim(RuntimeActorClaims.Capability, capability)));

        var identity = new ClaimsIdentity(claims, RuntimeActorAuthenticationDefaults.Scheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, RuntimeActorAuthenticationDefaults.Scheme);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

    private static string? TokenFromRequest(HttpRequest request, out string source)
    {
        var authorization = request.Headers.Authorization.FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(authorization) &&
            authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            source = "bearer";
            return authorization["Bearer ".Length..].Trim();
        }

        var compatibility = request.Headers["X-WorkOS-Actor-Token"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(compatibility))
        {
            source = "compatibility-header";
            return compatibility.Trim();
        }

        if (request.Cookies.TryGetValue(RuntimeActorAuthenticationDefaults.SessionCookieName, out var cookie) &&
            !string.IsNullOrWhiteSpace(cookie))
        {
            source = "cookie";
            return cookie.Trim();
        }

        source = "none";
        return null;
    }
}

public static class RuntimeActorAuthorization
{
    public const string DefaultTenantId = "tenant-1";

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(RuntimeActorPolicies.WorkOSAuthenticated, policy =>
            policy.RequireAuthenticatedUser());
        options.AddPolicy(RuntimeActorPolicies.WorkOSWrite, policy =>
            policy.RequireAuthenticatedUser().RequireClaim(RuntimeActorClaims.Capability, "workos.write"));
        options.AddPolicy(RuntimeActorPolicies.OperationsConfirmPolicy, policy =>
            policy.RequireAuthenticatedUser().RequireClaim(RuntimeActorClaims.Capability, "operations.confirm"));
        options.AddPolicy(RuntimeActorPolicies.HighRiskActionPolicy, policy =>
            policy.RequireAuthenticatedUser().RequireClaim(RuntimeActorClaims.Capability, "runtime.high_risk.all"));
        options.AddPolicy(RuntimeActorPolicies.RuntimeMaintenancePolicy, policy =>
            policy.RequireAuthenticatedUser().RequireClaim(RuntimeActorClaims.Capability, "runtime.maintenance"));
        options.AddPolicy(RuntimeActorPolicies.GovernanceExportPolicy, policy =>
            policy.RequireAuthenticatedUser().RequireClaim(RuntimeActorClaims.Capability, "pc.export.all"));
    }

    public static IReadOnlyList<string> CapabilitiesForRoles(IEnumerable<string> roles) =>
        roles
            .SelectMany(CapabilitiesForRole)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public static IReadOnlyList<string> CapabilitiesForRole(string role) =>
        role.ToLowerInvariant() switch
        {
            "operator" or "frontdesk" or "housekeeping" => new[]
            {
                "workos.write",
                "search.read",
                "operations.confirm",
                "evidence.write",
                "mobile.work"
            },
            "finance" => new[]
            {
                "workos.write",
                "search.read",
                "operations.confirm",
                "finance.work",
                "payment.confirm",
                "finance.payment.confirm",
                "finance.deposit.confirm",
                "finance.deposit.refund",
                "finance.correction.apply",
                "correction.request",
                "pc.finance",
                "finance.control.view"
            },
            "manager" => new[]
            {
                "workos.write",
                "search.read",
                "operations.confirm",
                "case.close",
                "correction.approve",
                "pc.governance",
                "pc.export.all",
                "manager.control.view",
                "governance.center.view",
                "runtime.high_risk.all"
            },
            "admin" => AdminCapabilities,
            "releaseowner" => AdminCapabilities,
            "releaseOwner" => AdminCapabilities,
            _ => Array.Empty<string>()
        };

    private static readonly string[] AdminCapabilities =
    {
        "workos.write",
        "search.read",
        "operations.confirm",
        "case.close",
        "payment.confirm",
        "deposit.refund.pay",
        "correction.approve",
        "admin.role_capability.edit",
        "admin.device_session.revoke",
        "account.user.manage",
        "governance.center.view",
        "manager.control.view",
        "finance.control.view",
        "release.flight_deck.view",
        "pc.governance",
        "pc.governance.admin",
        "pc.export.all",
        "pc.export.ledger",
        "pc.export.case_timeline",
        "pc.export.evidence_audit",
        "pc.export.period_snapshot",
        "runtime.high_risk.all",
        "runtime.maintenance",
        "release.cutover"
    };

    public static RuntimeActorContext RequireActor(this HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            throw new InvalidOperationException("runtime_actor_session_required");
        }

        return new RuntimeActorContext(
            context.User.FindFirstValue(RuntimeActorClaims.ActorId) ?? string.Empty,
            context.User.FindFirstValue(RuntimeActorClaims.Role) ?? string.Empty,
            context.User.FindFirstValue(RuntimeActorClaims.TenantId) ?? DefaultTenantId,
            context.User.FindAll(RuntimeActorClaims.Capability).Select(claim => claim.Value).ToArray(),
            context.User.FindFirstValue(RuntimeActorClaims.AuthSource) ?? "unknown",
            context.User.FindFirstValue(RuntimeActorClaims.SessionToken) ?? string.Empty);
    }

    public static string SessionTokenForOperations(this HttpRequest request) =>
        request.HttpContext.User.FindFirstValue(RuntimeActorClaims.SessionToken)
        ?? request.Headers["X-WorkOS-Actor-Token"].FirstOrDefault()
        ?? string.Empty;

    public static IApplicationBuilder UseWorkOSRuntimeAccessPolicies(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            if (!context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
            {
                await next();
                return;
            }

            if (IsLogin(context.Request))
            {
                await next();
                return;
            }

            var requiresAuthentication = RequiresAuthentication(context.Request);
            if (!requiresAuthentication)
            {
                await next();
                return;
            }

            if (context.User.Identity?.IsAuthenticated != true)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { error = "runtime_actor_session_required" });
                return;
            }

            if (IsCookieAuthenticated(context) && IsUnsafeMethod(context.Request) && !HasValidCsrf(context))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "csrf_token_required" });
                return;
            }

            if (IsUnsafeMethod(context.Request) && !context.User.HasCapability("workos.write"))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "workos_write_policy_required" });
                return;
            }

            var policyFailure = RequiredPolicyFailure(context);
            if (policyFailure is not null)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = policyFailure });
                return;
            }

            await next();
        });

    public static bool HasCapability(this ClaimsPrincipal principal, string capability) =>
        principal.FindAll(RuntimeActorClaims.Capability)
            .Any(claim => claim.Value.Equals(capability, StringComparison.OrdinalIgnoreCase));

    public static RuntimeDeviceSession? TrustedDeviceFromRequest(ProjectionRuntime runtime, RuntimeActorContext actor, string? deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return null;
        }

        return runtime.FindDeviceSession(actor.TenantId, deviceId);
    }

    private static bool IsLogin(HttpRequest request) =>
        request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase) &&
        request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresAuthentication(HttpRequest request)
    {
        if (IsUnsafeMethod(request))
        {
            return true;
        }

        return request.Path.StartsWithSegments("/api/control-plane", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/evidence", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/audit-events", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/outbox", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/observability/runtime", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/workspaces", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/work-queue", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/device-sessions", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/search", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/lenses", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/pc-governance/account-users", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/pc-governance/account-audit", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/reconciliation", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/behavior-events", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/mobile", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/operations/cases", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/operations/trace", StringComparison.OrdinalIgnoreCase) ||
            request.Path.StartsWithSegments("/api/operations/work-items", StringComparison.OrdinalIgnoreCase);
    }

    private static string? RequiredPolicyFailure(HttpContext context)
    {
        var path = context.Request.Path;
        if (path.StartsWithSegments("/api/operations/work-items", StringComparison.OrdinalIgnoreCase) &&
            path.Value?.EndsWith("/confirm", StringComparison.OrdinalIgnoreCase) == true &&
            !context.User.HasCapability("operations.confirm"))
        {
            return "operations_confirm_policy_required";
        }

        if ((path.StartsWithSegments("/api/search", StringComparison.OrdinalIgnoreCase) ||
             path.StartsWithSegments("/api/lenses/search", StringComparison.OrdinalIgnoreCase)) &&
            !context.User.HasCapability("search.read"))
        {
            return "search_read_policy_required";
        }

        if ((path.StartsWithSegments("/api/pc-governance/account-users", StringComparison.OrdinalIgnoreCase) ||
             path.StartsWithSegments("/api/pc-governance/account-audit", StringComparison.OrdinalIgnoreCase)) &&
            !context.User.HasCapability("account.user.manage") &&
            !context.User.HasCapability("pc.governance.admin"))
        {
            return "account_user_manage_policy_required";
        }

        if (path.StartsWithSegments("/api/control-plane", StringComparison.OrdinalIgnoreCase) &&
            !context.User.HasCapability("pc.governance") &&
            !context.User.HasCapability("release.cutover"))
        {
            return "pc_governance_policy_required";
        }

        if (path.StartsWithSegments("/api/correction-center", StringComparison.OrdinalIgnoreCase) &&
            (path.Value?.Contains("/approve", StringComparison.OrdinalIgnoreCase) == true ||
             path.Value?.Contains("/apply", StringComparison.OrdinalIgnoreCase) == true) &&
            !context.User.HasCapability("correction.approve") &&
            !context.User.HasCapability("runtime.high_risk.all"))
        {
            return "correction_policy_required";
        }

        if (path.StartsWithSegments("/api/pc-governance/exports", StringComparison.OrdinalIgnoreCase) &&
            !context.User.HasCapability("pc.export.all"))
        {
            return "governance_export_policy_required";
        }

        if (path.StartsWithSegments("/api/auth/sessions", StringComparison.OrdinalIgnoreCase) &&
            !context.User.HasCapability("runtime.maintenance"))
        {
            return "runtime_maintenance_policy_required";
        }

        if (path.StartsWithSegments("/api/device-sessions", StringComparison.OrdinalIgnoreCase) &&
            path.Value?.Contains("/revoke", StringComparison.OrdinalIgnoreCase) == true &&
            !context.User.HasCapability("admin.device_session.revoke") &&
            !context.User.HasCapability("runtime.maintenance"))
        {
            return "runtime_maintenance_policy_required";
        }

        if (path.StartsWithSegments("/api/projections/process-outbox", StringComparison.OrdinalIgnoreCase) &&
            !context.User.HasCapability("runtime.maintenance"))
        {
            return "runtime_maintenance_policy_required";
        }

        return null;
    }

    private static bool IsUnsafeMethod(HttpRequest request) =>
        !HttpMethods.IsGet(request.Method) &&
        !HttpMethods.IsHead(request.Method) &&
        !HttpMethods.IsOptions(request.Method);

    private static bool IsCookieAuthenticated(HttpContext context) =>
        context.User.FindFirstValue(RuntimeActorClaims.AuthSource)?.Equals("cookie", StringComparison.OrdinalIgnoreCase) == true;

    private static bool HasValidCsrf(HttpContext context)
    {
        var header = context.Request.Headers["X-CSRF-Token"].FirstOrDefault();
        var cookie = context.Request.Cookies[RuntimeActorAuthenticationDefaults.CsrfCookieName];
        return !string.IsNullOrWhiteSpace(header) &&
            !string.IsNullOrWhiteSpace(cookie) &&
            header.Equals(cookie, StringComparison.Ordinal);
    }
}
