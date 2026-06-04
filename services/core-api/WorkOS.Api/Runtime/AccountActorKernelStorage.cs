using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class AccountActorKernelStorage
{
    private readonly PostgresConnectionFactory connections;

    public AccountActorKernelStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public void EnsureSeeded(IReadOnlyList<RuntimeUser> seedUsers, RuntimeAuthOptions authOptions)
    {
        using var connection = connections.Open();
        foreach (var seed in seedUsers)
        {
            if (seed.DevelopmentOnly && !authOptions.AllowDevelopmentAccounts)
            {
                continue;
            }

            var normalized = NormalizeUser(seed, createdBy: "system.seed");
            var passwordHash = authOptions.PasswordSha256ByUsername.TryGetValue(seed.Username, out var configuredHash)
                ? configuredHash
                : RuntimePasswordHasher.Pbkdf2Sha256(Guid.NewGuid().ToString("N"));

            using var command = connection.CreateCommand();
            command.CommandText = """
                insert into account_users(
                    user_id, tenant_id, username, display_name, department, business_line,
                    primary_role, roles, capabilities, status, password_hash, development_only,
                    created_by, created_at_utc, updated_at_utc)
                values (
                    @userId, @tenantId, @username, @displayName, @department, @businessLine,
                    @primaryRole, @roles::jsonb, @capabilities::jsonb, @status, @passwordHash, @developmentOnly,
                    @createdBy, @now, @now)
                on conflict(user_id) do update
                set username = excluded.username,
                    display_name = excluded.display_name,
                    department = excluded.department,
                    business_line = excluded.business_line,
                    primary_role = excluded.primary_role,
                    roles = excluded.roles,
                    capabilities = excluded.capabilities,
                    status = excluded.status,
                    password_hash = excluded.password_hash,
                    updated_at_utc = excluded.updated_at_utc
                where account_users.development_only = true
                """;
            AddUserParameters(command, normalized, passwordHash, createdBy: "system.seed");
            command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
            command.ExecuteNonQuery();
        }
    }

    public IReadOnlyList<RuntimeUser> ListUsers(string tenantId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select user_id, username, display_name, primary_role, status, tenant_id,
                   department, business_line, roles, capabilities, development_only
            from account_users
            where tenant_id = @tenantId
            order by created_at_utc, username
            """;
        command.Parameters.AddWithValue("tenantId", tenantId);
        using var reader = command.ExecuteReader();
        var users = new List<RuntimeUser>();
        while (reader.Read())
        {
            users.Add(ReadUser(reader));
        }

        return users;
    }

    public RuntimeUserCredential? FindCredentialByUsername(string username)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select user_id, username, display_name, primary_role, status, tenant_id,
                   department, business_line, roles, capabilities, development_only, password_hash
            from account_users
            where lower(username) = lower(@username)
            limit 1
            """;
        command.Parameters.AddWithValue("username", username);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        var user = ReadUser(reader);
        return new RuntimeUserCredential(user, reader.GetString(11));
    }

    public RuntimeUser? FindUserById(string userId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select user_id, username, display_name, primary_role, status, tenant_id,
                   department, business_line, roles, capabilities, development_only
            from account_users
            where user_id = @userId
            limit 1
            """;
        command.Parameters.AddWithValue("userId", userId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadUser(reader) : null;
    }

    public RuntimeUser CreateUser(AccountUserCreateRequest request, RuntimeActorContext actor)
    {
        var requestedTenantId = string.IsNullOrWhiteSpace(request.TenantId)
            ? actor.TenantId
            : request.TenantId.Trim();
        if (!string.Equals(requestedTenantId, actor.TenantId, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("account_tenant_mismatch");
        }

        var user = NormalizeUser(new RuntimeUser(
            $"u-{Guid.NewGuid():N}",
            request.Username,
            request.DisplayName,
            PrimaryRole(request.Roles),
            EnabledFromStatus(request.Status),
            actor.TenantId,
            request.Department,
            request.BusinessLine,
            NormalizeList(request.Roles, PrimaryRole(request.Roles)),
            NormalizeCapabilities(request.Roles, request.Capabilities),
            NormalizeStatus(request.Status),
            DevelopmentOnly: false), actor.ActorId);

        var passwordHash = RuntimePasswordHasher.Pbkdf2Sha256(request.Password);
        using var connection = connections.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                insert into account_users(
                    user_id, tenant_id, username, display_name, department, business_line,
                    primary_role, roles, capabilities, status, password_hash, development_only,
                    created_by, created_at_utc, updated_at_utc)
                values (
                    @userId, @tenantId, @username, @displayName, @department, @businessLine,
                    @primaryRole, @roles::jsonb, @capabilities::jsonb, @status, @passwordHash, false,
                    @createdBy, @now, @now)
                returning user_id, username, display_name, primary_role, status, tenant_id,
                          department, business_line, roles, capabilities, development_only
                """;
            AddUserParameters(command, user, passwordHash, actor.ActorId);
            command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
            using var reader = command.ExecuteReader();
            reader.Read();
            var created = ReadUser(reader);
            reader.Close();
            AppendAudit(connection, transaction, actor, "AccountUserCreated", created.UserId, new Dictionary<string, object>
            {
                ["username"] = created.Username,
                ["department"] = created.Department,
                ["businessLine"] = created.BusinessLine,
                ["roles"] = created.EffectiveRoles,
                ["capabilities"] = created.EffectiveCapabilities
            });
            transaction.Commit();
            return created;
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            transaction.Rollback();
            throw new InvalidOperationException("account_username_already_exists", ex);
        }
    }

    public RuntimeUser? DisableUser(string userId, RuntimeActorContext actor)
    {
        using var connection = connections.Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            update account_users
            set status = 'disabled',
                updated_at_utc = @now,
                disabled_at_utc = coalesce(disabled_at_utc, @now),
                disabled_by = coalesce(disabled_by, @actorId)
            where user_id = @userId and tenant_id = @tenantId
            returning user_id, username, display_name, primary_role, status, tenant_id,
                      department, business_line, roles, capabilities, development_only
            """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("tenantId", actor.TenantId);
        command.Parameters.AddWithValue("actorId", actor.ActorId);
        command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            transaction.Rollback();
            return null;
        }

        var disabled = ReadUser(reader);
        reader.Close();
        AppendAudit(connection, transaction, actor, "AccountUserDisabled", disabled.UserId, new Dictionary<string, object>
        {
            ["username"] = disabled.Username
        });
        transaction.Commit();
        return disabled;
    }

    public RuntimeUser? ResetPassword(string userId, AccountUserPasswordResetRequest request, RuntimeActorContext actor)
    {
        using var connection = connections.Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            update account_users
            set password_hash = @passwordHash,
                updated_at_utc = @now
            where user_id = @userId and tenant_id = @tenantId
            returning user_id, username, display_name, primary_role, status, tenant_id,
                      department, business_line, roles, capabilities, development_only
            """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("tenantId", actor.TenantId);
        command.Parameters.AddWithValue("passwordHash", RuntimePasswordHasher.Pbkdf2Sha256(request.Password));
        command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            transaction.Rollback();
            return null;
        }

        var updated = ReadUser(reader);
        reader.Close();
        AppendAudit(connection, transaction, actor, "AccountUserPasswordReset", updated.UserId, new Dictionary<string, object>
        {
            ["username"] = updated.Username
        });
        transaction.Commit();
        return updated;
    }

    public IReadOnlyList<AccountAuditRecord> ListAudit(string tenantId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select audit_event_id, tenant_id, actor_id, event_type, target_user_id, payload, occurred_at_utc
            from account_audit_events
            where tenant_id = @tenantId
            order by occurred_at_utc desc
            limit 100
            """;
        command.Parameters.AddWithValue("tenantId", tenantId);
        using var reader = command.ExecuteReader();
        var records = new List<AccountAuditRecord>();
        while (reader.Read())
        {
            records.Add(new AccountAuditRecord(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(5), PostgresProjectionStore.JsonOptions) ?? new Dictionary<string, object>(),
                reader.GetFieldValue<DateTimeOffset>(6)));
        }

        return records;
    }

    private static RuntimeUser ReadUser(Npgsql.NpgsqlDataReader reader)
    {
        var status = reader.GetString(4);
        return new RuntimeUser(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            EnabledFromStatus(status),
            reader.GetString(5),
            reader.GetString(6),
            reader.GetString(7),
            JsonStringArray(reader.GetString(8)),
            JsonStringArray(reader.GetString(9)),
            status,
            reader.GetBoolean(10));
    }

    private static void AddUserParameters(Npgsql.NpgsqlCommand command, RuntimeUser user, string passwordHash, string createdBy)
    {
        command.Parameters.AddWithValue("userId", user.UserId);
        command.Parameters.AddWithValue("tenantId", user.TenantId);
        command.Parameters.AddWithValue("username", user.Username);
        command.Parameters.AddWithValue("displayName", user.DisplayName);
        command.Parameters.AddWithValue("department", user.Department);
        command.Parameters.AddWithValue("businessLine", user.BusinessLine);
        command.Parameters.AddWithValue("primaryRole", user.Role);
        command.Parameters.AddWithValue("roles", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(user.EffectiveRoles, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("capabilities", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(user.EffectiveCapabilities, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("status", NormalizeStatus(user.Status));
        command.Parameters.AddWithValue("passwordHash", passwordHash);
        command.Parameters.AddWithValue("developmentOnly", user.DevelopmentOnly);
        command.Parameters.AddWithValue("createdBy", createdBy);
    }

    private static void AppendAudit(
        Npgsql.NpgsqlConnection connection,
        Npgsql.NpgsqlTransaction transaction,
        RuntimeActorContext actor,
        string eventType,
        string targetUserId,
        IReadOnlyDictionary<string, object> payload)
    {
        using var audit = connection.CreateCommand();
        audit.Transaction = transaction;
        audit.CommandText = """
            insert into account_audit_events(
                audit_event_id, tenant_id, actor_id, event_type, target_user_id, payload, occurred_at_utc)
            values (@auditEventId, @tenantId, @actorId, @eventType, @targetUserId, @payload::jsonb, @occurredAtUtc)
            """;
        audit.Parameters.AddWithValue("auditEventId", $"acct-audit-{Guid.NewGuid():N}");
        audit.Parameters.AddWithValue("tenantId", actor.TenantId);
        audit.Parameters.AddWithValue("actorId", actor.ActorId);
        audit.Parameters.AddWithValue("eventType", eventType);
        audit.Parameters.AddWithValue("targetUserId", targetUserId);
        audit.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(payload, PostgresProjectionStore.JsonOptions));
        audit.Parameters.AddWithValue("occurredAtUtc", DateTimeOffset.UtcNow);
        audit.ExecuteNonQuery();
    }

    private static RuntimeUser NormalizeUser(RuntimeUser user, string createdBy) =>
        user with
        {
            Username = Required(user.Username, "account_username_required"),
            DisplayName = Required(user.DisplayName, "account_display_name_required"),
            TenantId = Required(user.TenantId, "account_tenant_required"),
            Department = Required(user.Department, "account_department_required"),
            BusinessLine = Required(user.BusinessLine, "account_business_line_required"),
            Role = PrimaryRole(user.EffectiveRoles),
            Roles = NormalizeList(user.EffectiveRoles, PrimaryRole(user.EffectiveRoles)),
            Capabilities = NormalizeCapabilities(user.EffectiveRoles, user.Capabilities),
            Status = NormalizeStatus(user.Status),
            Enabled = EnabledFromStatus(user.Status)
        };

    private static IReadOnlyList<string> NormalizeCapabilities(IReadOnlyList<string>? roles, IReadOnlyList<string>? capabilities)
    {
        var normalized = (capabilities ?? Array.Empty<string>())
            .Select(item => item.Trim())
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return normalized.Length > 0 ? normalized : RuntimeActorAuthorization.CapabilitiesForRoles(roles ?? Array.Empty<string>());
    }

    private static IReadOnlyList<string> NormalizeList(IReadOnlyList<string>? values, string fallback)
    {
        var normalized = (values ?? Array.Empty<string>())
            .Select(item => item.Trim())
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return normalized.Length > 0
            ? normalized
            : string.IsNullOrWhiteSpace(fallback) ? Array.Empty<string>() : new[] { fallback };
    }

    private static string[] JsonStringArray(string json) =>
        JsonSerializer.Deserialize<string[]>(json, PostgresProjectionStore.JsonOptions) ?? Array.Empty<string>();

    private static string PrimaryRole(IReadOnlyList<string>? roles) =>
        NormalizeList(roles, "operator").FirstOrDefault() ?? "operator";

    private static string NormalizeStatus(string? status) =>
        string.IsNullOrWhiteSpace(status)
            ? "active"
            : status.Trim().ToLowerInvariant() switch
            {
                "active" or "invited" or "disabled" or "locked" => status.Trim().ToLowerInvariant(),
                _ => "active"
            };

    private static bool EnabledFromStatus(string? status) =>
        NormalizeStatus(status) is "active" or "invited";

    private static string Required(string? value, string reason) =>
        string.IsNullOrWhiteSpace(value) ? throw new InvalidOperationException(reason) : value.Trim();
}
