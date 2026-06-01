# B-Stage Runtime Boundary

## B1

B1 is definition-layer only: docs, templates, and checkers. B1 does not activate production runtime behavior.

## B2

B2 may run certification runners, semantic shadow checks, invariant checks, and runtime test harnesses. B2 does not activate production user scope.

## B3

B3 may run admission checker and runtime guard checks. Business lines that remain L0 cannot production confirm and cannot appear in production-like surfaces.

## B4 And Later

Pilot activation is outside RT-B. Dormitory pilot activation remains locked until later release-train gates and DORM-INT readiness.
