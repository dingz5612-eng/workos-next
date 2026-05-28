namespace WorkOS.Api.Runtime;

public sealed class ProjectionOutboxWorker : BackgroundService
{
    private readonly ProjectionRuntime runtime;
    private readonly ILogger<ProjectionOutboxWorker> logger;
    private readonly TimeSpan interval;

    public ProjectionOutboxWorker(
        ProjectionRuntime runtime,
        IConfiguration configuration,
        ILogger<ProjectionOutboxWorker> logger)
    {
        this.runtime = runtime;
        this.logger = logger;
        interval = TimeSpan.FromMilliseconds(configuration.GetValue("Outbox:PollIntervalMilliseconds", 750));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var processed = runtime.ProcessPendingOutbox();
                if (processed > 0)
                {
                    logger.LogInformation("Processed {ProcessedCount} outbox message(s).", processed);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox worker failed while processing projection messages.");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
