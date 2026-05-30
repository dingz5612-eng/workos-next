using WorkOS.Api.Runtime;

if (args.Length > 0 && args[0].Equals("dead-letter", StringComparison.OrdinalIgnoreCase))
{
    return OutboxDeadLetterReplayCli.Run(args[1..]);
}

if (args.Length > 0 && args[0].Equals("projection-rebuild", StringComparison.OrdinalIgnoreCase))
{
    return ProjectionRebuildCli.Run(args[1..]);
}

return ProjectionRebuildCli.Run(args);
