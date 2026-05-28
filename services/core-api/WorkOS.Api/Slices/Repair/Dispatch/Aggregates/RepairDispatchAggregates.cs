namespace WorkOS.Api.Slices.Repair.Dispatch.Aggregates;

public sealed record RepairStationAggregate(
    string StationId,
    string StationName,
    string Status,
    DateTimeOffset UpdatedAtUtc);

public sealed record TechnicianAggregate(
    string TechnicianId,
    string DisplayName,
    string SkillGroup,
    string Status,
    DateTimeOffset UpdatedAtUtc);

public sealed record VehicleAggregate(
    string VehicleId,
    string PlateNo,
    string Model,
    string Vin,
    string Status,
    DateTimeOffset UpdatedAtUtc);
