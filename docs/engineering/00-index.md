# Engineering Rules Index

This directory is the human-readable engineering authority for V5.5 and later
WorkOSNext / FunRide OMR runtime work.

## Authority

- Machine-readable precedence: `docs/rules/v5.5/rule-authority.yml`.
- Human-readable authority: `docs/engineering/00-rule-authority.md`.
- Acceptance authority: `docs/acceptance/00-index.md`.
- Compatibility references: `docs/architecture/*`.

## Rule Documents

- `00-rule-authority.md`: precedence, hard No-Go rules, and Codex execution
  contract.
- `02-runtime-ownership-rules.md`: fact ownership and writer boundary rules.
- `03-api-boundary-rules.md`: API write boundary and Operations Confirm rules.
- `13-release-control-plane-rules.md`: Control Plane, GateResult, and release
  evidence rules.
- `14-testing-ci-rules.md`: invariant maturity and CI evidence rules.
- `15-no-go-rules.md`: blocking No-Go conditions.
- `16-v5.5-engineering-rules-os.md`: V5.5 Rules OS batch dependency map.

When this index conflicts with `docs/rules/v5.5/rule-authority.yml`, the YAML
file wins because it is the machine-readable authority consumed by guards.
