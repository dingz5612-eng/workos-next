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

    public object? Login(RuntimeState state, LoginRequest request)
    {
        var user = state.Users.FirstOrDefault(item =>
            item.Enabled &&
            item.Username.Equals(request.Username, StringComparison.OrdinalIgnoreCase));

        if (user is null ||
            !authOptions.PasswordSha256ByUsername.TryGetValue(user.Username, out var passwordHash) ||
            !RuntimePasswordHasher.Verify(request.Password, passwordHash))
        {
            return null;
        }

        var session = store.CreateSession(user);
        return new
        {
            authenticated = true,
            actorId = user.UserId,
            actorType = user.Role,
            displayName = user.DisplayName,
            role = user.Role,
            token = session.Token,
            expiresAtUtc = session.ExpiresAtUtc
        };
    }
}
