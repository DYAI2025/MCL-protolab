# Runtime Adapters

Status: `ADAPTER_MISSING / BLOCKED`.

No game engine is selected in this concept because MCL-1 remains unresolved and current project instructions prohibit engine selection.

After the gate clears, research and validate exactly one adapter. The adapter should own only the integration surface needed for local prototyping, such as:
- runtime boot and scene loading;
- input and third-person camera/controller integration;
- physics/collision hooks;
- asset loading;
- audio and basic effects;
- debug/tuning hooks;
- reset/smoke lifecycle.

Do not build a universal engine abstraction layer. Port only the contracts that demonstrably reduce repeated prototype setup cost.
