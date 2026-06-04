namespace WorkOS.Api.Runtime;

public sealed class AuthSessionService
{
    private readonly IProjectionStore store;
    private readonly RuntimeAuthOptions authOptions;

    public AuthSessionService(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        this.authOptions = authOptions;
    }

    public RuntimeLoginResult? Login(RuntimeState state, LoginRequest request)
    {
        var account = store.FindUserCredentialByUsername(request.Username);
        var user = account?.User ?? (authOptions.AllowDevelopmentAccounts
            ? state.Users.FirstOrDefault(item =>
                item.Enabled &&
                item.Username.Equals(request.Username, StringComparison.OrdinalIgnoreCase))
            : null);
        var passwordHash = account?.PasswordHash;

        if (user is null ||
            !user.Enabled ||
            string.Equals(user.Status, "disabled", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(user.Status, "locked", StringComparison.OrdinalIgnoreCase) ||
            (string.IsNullOrWhiteSpace(passwordHash) &&
                !authOptions.PasswordSha256ByUsername.TryGetValue(user.Username, out passwordHash)) ||
            !RuntimePasswordHasher.Verify(request.Password, passwordHash))
        {
            return null;
        }

        var session = store.CreateSession(user);
        return new RuntimeLoginResult(
            true,
            user.UserId,
            user.Role,
            user.DisplayName,
            user.Role,
            session.Token,
            session.ExpiresAtUtc,
            user.UserId,
            user.TenantId,
            user.Department,
            user.BusinessLine,
            user.EffectiveRoles,
            user.EffectiveCapabilities,
            session,
            user.Status);
    }
}
