using WorkOS.ControlPlaneRunners;

var command = args.FirstOrDefault();
var options = RunnerOptions.Parse(args.Skip(1));

try
{
    switch (command)
    {
        case "invariant":
            await InvariantRunner.Run(options);
            return 0;
        case "shadow-compare":
            await ShadowCompareRunner.Run(options);
            return 0;
        case "gate":
            await GateRunner.Run(options);
            return 0;
        case "ledger-inspection":
            await LedgerInspectionJob.Run(options);
            return 0;
        case "migration-verification":
            await MigrationVerificationJob.Run(options);
            return 0;
        case "backup-restore-smoke":
            await BackupRestoreSmokeJob.Run(options);
            return 0;
        default:
            Console.Error.WriteLine("Usage: WorkOS.ControlPlaneRunners <invariant|shadow-compare|gate|ledger-inspection|migration-verification|backup-restore-smoke> [--key=value]");
            return 2;
    }
}
catch (Exception error)
{
    Console.Error.WriteLine(error.Message);
    return 1;
}
