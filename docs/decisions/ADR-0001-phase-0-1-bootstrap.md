# ADR-0001: Phase 0-1 Bootstrap

## Status

Accepted

## Context

The target system uses Flutter and .NET 10 LTS. The current local machine does not have Flutter SDK installed, but the project needs to start immediately with a testable UI/UX surface.

## Decision

Phase 0-1 will use:

- A mobile-first PWA prototype in `apps/mobile`.
- A .NET 10 API scaffold in `services/core-api/WorkOS.Api`.
- Architecture documents that preserve the target Flutter and .NET 10 direction.

## Consequences

- The user can test UI/UX immediately.
- No legacy FunRide UI is reused.
- The product model remains portable to Flutter.
- The API project targets `net10.0`.
