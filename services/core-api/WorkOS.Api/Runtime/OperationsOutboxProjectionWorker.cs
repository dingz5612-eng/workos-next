namespace WorkOS.Api.Runtime;

public sealed class OperationsOutboxProjectionWorker : BackgroundService
{
    private readonly OperationsOutboxProjectionStore operationsOutbox;
    private readonly ProjectionRuntime runtime;
    private readonly ILogger<OperationsOutboxProjectionWorker> logger;
    private readonly TimeSpan interval;
    private readonly string workerId = $"operations-projection-{Environment.MachineName}-{Guid.NewGuid():N}";

    public OperationsOutboxProjectionWorker(
        OperationsOutboxProjectionStore operationsOutbox,
        ProjectionRuntime runtime,
        IConfiguration configuration,
        ILogger<OperationsOutboxProjectionWorker> logger)
    {
        this.operationsOutbox = operationsOutbox;
        this.runtime = runtime;
        this.logger = logger;
        interval = TimeSpan.FromMilliseconds(configuration.GetValue("OperationsOutbox:PollIntervalMilliseconds", 350));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = 0;
            foreach (var message in operationsOutbox.ClaimPending(workerId))
            {
                try
                {
                    runtime.ProjectOperationsOutboxMessage(message);
                    operationsOutbox.MarkProcessed(message.MessageId, workerId);
                    processed++;
                }
                catch (Exception ex)
                {
                    operationsOutbox.MarkFailed(message.MessageId, workerId, ex.Message);
                }
            }

            if (processed > 0)
            {
                logger.LogInformation("Projected {ProcessedCount} operations outbox message(s).", processed);
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
