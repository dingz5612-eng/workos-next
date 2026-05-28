namespace WorkOS.Api.Runtime;

public sealed class CardConfirmationPolicy
{
    public ConfirmResult? Authorize(CardProjection card, RuntimeUser actor)
    {
        if (card.Confirmation.ForbiddenForAi && actor.Role.Equals("ai", StringComparison.OrdinalIgnoreCase))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "ai_confirmation_forbidden: AI can prepare and explain, but cannot confirm finance or terminal business actions.", null);
        }

        if (!RoleCanConfirm(actor.Role, card.Confirmation.RequiredRole))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, $"role_confirmation_forbidden: Role {actor.Role} cannot confirm card {card.Id}; required role is {card.Confirmation.RequiredRole}.", null);
        }

        return null;
    }

    private static bool RoleCanConfirm(string actorRole, string requiredRole)
    {
        if (actorRole.Equals("admin", StringComparison.OrdinalIgnoreCase)) return true;
        if (requiredRole.Equals("operator", StringComparison.OrdinalIgnoreCase) &&
            actorRole.Equals("manager", StringComparison.OrdinalIgnoreCase)) return true;
        return actorRole.Equals(requiredRole, StringComparison.OrdinalIgnoreCase);
    }
}
