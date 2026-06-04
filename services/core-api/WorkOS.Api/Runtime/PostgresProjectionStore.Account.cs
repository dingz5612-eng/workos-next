namespace WorkOS.Api.Runtime;

public sealed partial class PostgresProjectionStore
{
    public void EnsureAccountKernelSeeded(IReadOnlyList<RuntimeUser> seedUsers, RuntimeAuthOptions authOptions) =>
        accounts.EnsureSeeded(seedUsers, authOptions);

    public RuntimeUserCredential? FindUserCredentialByUsername(string username) =>
        accounts.FindCredentialByUsername(username);

    public IReadOnlyList<RuntimeUser> ListAccountUsers(string tenantId) =>
        accounts.ListUsers(tenantId);

    public RuntimeUser? CreateAccountUser(AccountUserCreateRequest request, RuntimeActorContext actor) =>
        accounts.CreateUser(request, actor);

    public RuntimeUser? DisableAccountUser(string userId, RuntimeActorContext actor) =>
        accounts.DisableUser(userId, actor);

    public RuntimeUser? ResetAccountUserPassword(string userId, AccountUserPasswordResetRequest request, RuntimeActorContext actor) =>
        accounts.ResetPassword(userId, request, actor);

    public IReadOnlyList<AccountAuditRecord> ListAccountAudit(string tenantId) =>
        accounts.ListAudit(tenantId);

    public RuntimeSession CreateSession(RuntimeUser user) =>
        sessions.CreateSession(user);

    public void RevokeSession(string token, string actorId) =>
        sessions.RevokeSession(token, actorId);

    public RuntimeUser? FindUserBySessionToken(string token)
    {
        var userId = sessions.FindUserIdBySessionToken(token);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        var accountUser = accounts.FindUserById(userId);
        if (accountUser is not null)
        {
            return accountUser.Enabled ? accountUser : null;
        }

        var state = documents.LoadOrSeed(ProjectionSeed.Create);
        return state.Users.FirstOrDefault(user => user.Enabled && user.UserId == userId);
    }

    public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request) =>
        deviceSessions.Register(request);

    public IReadOnlyList<RuntimeDeviceSession> ListDeviceSessions(string tenantId) =>
        deviceSessions.List(tenantId);

    public RuntimeDeviceSession? FindDeviceSession(string deviceId) =>
        deviceSessions.Find(deviceId);

    public RuntimeDeviceSession? FindDeviceSession(string tenantId, string deviceId) =>
        deviceSessions.Find(tenantId, deviceId);

    public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId) =>
        deviceSessions.Revoke(deviceId, actorId);
}
