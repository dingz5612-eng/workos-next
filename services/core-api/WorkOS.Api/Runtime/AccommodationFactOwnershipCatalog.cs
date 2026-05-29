namespace WorkOS.Api.Runtime;

public static class AccommodationFactOwnershipCatalog
{
    private static readonly IReadOnlyDictionary<string, string> Owners = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["Deposit"] = "Accommodation.DepositLedger",
        ["Payment"] = "Accommodation.PaymentLedger",
        ["StayBalance"] = "Accommodation.PaymentLedger",
        ["BedStatus"] = "Accommodation.ResourceSetup",
        ["Expense"] = "Accommodation.ExpenseLedger",
        ["PeriodSnapshot"] = "Accommodation.PeriodAnalytics"
    };

    public static IReadOnlyDictionary<string, string> All() => Owners;

    public static string OwnerOf(string factName) => Owners[factName];

    public static bool IsOwner(string factName, string sliceId) =>
        Owners.TryGetValue(factName, out var owner) &&
        owner.Equals(sliceId, StringComparison.OrdinalIgnoreCase);
}
