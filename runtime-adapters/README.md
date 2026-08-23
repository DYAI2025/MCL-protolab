# Runtime Adapters

Status: `EXCEPTION_GRANTED / ADAPTER_PENDING_IMPLEMENTATION`.

The Prototype Runtime Exception was granted on 2026-08-23 for this disposable lab only. MCL-1 remains open; the lab runtime must never be represented as the production-engine decision.

The active mission is `docs/plans/2026-08-23-runtime-foundation-mission.md` plus `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md`. It uses a **PlayCanvas-first verification** path and falls back only on a documented hard blocker. Current official `create-playcanvas` source inspection confirms an Engine format plus a third-person-controller starter with physics support; exact versions and commands still require execution evidence in the implementation run.

The adapter should own only the integration surface needed for local prototyping:
- runtime boot and scene/experiment loading;
- input and third-person camera/controller integration;
- physics/collision hooks;
- asset loading;
- audio, material, lighting, particle/trail/decal and basic post-effect hooks;
- debug/tuning hooks;
- reset/smoke lifecycle.

It is not a universal engine abstraction layer. Shared gameplay concepts remain outside the adapter unless repeated experiments demonstrate a reusable contract.
