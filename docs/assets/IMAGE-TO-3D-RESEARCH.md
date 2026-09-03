# Image-to-3D service research (2026-08-30)

> Multi-agent web research (4 agents, sources linked inline; claims the research could not verify are marked UNVERIFIED). Decision input for the V2 hero-asset pipeline in ART_DIRECTION.md — the service choice itself is Ben's call.

# Image-to-GLB Creature Pipeline — Recommendation (based solely on the three research reports, Aug 2026)

## 1. Ranked picks

**1. Tripo (tripo3d.ai) — primary pick.** Best fit for creatures: multi-view input (2–4 images, ordered [front, left, back, right]), GLB as default output, and the only reported rig pipeline with non-humanoid skeleton types (quadruped, hexapod, avian, serpentine, aquatic — rig model v2.5-20260210) plus a free `rig-check` endpoint. Self-serve pay-as-you-go API at 1 credit = $0.01 with no subscription required (https://developers.tripo3d.ai/en/pricing, https://developers.tripo3d.ai/en/docs/animations-rig).
- Licensing caveats: free tier outputs are public CC BY 4.0 and NOT for commercial use, with Tripo training on free-tier inputs/outputs — never use free-tier output for game assets. Paid tiers grant commercial rights, BUT one snippet said commercial rights are "exclusively Pro and Enterprise level" (CONFLICT — UNVERIFIED, the terms page returned 403; verify https://www.tripo3d.ai/terms in a browser). Whether **API pay-as-you-go** outputs automatically carry commercial rights is UNVERIFIED — the developer pricing page is silent on licensing. Subscription tier prices themselves are from third-party aggregators only (official page 403'd).

**2. Meshy (meshy.ai) — close second / style-preservation pick.** Multi-Image to 3D (1–4 images, meshy-7) is explicitly marketed as preserving the art style of stylized/hand-drawn inputs — directly relevant to painterly concept sheets (https://docs.meshy.ai/en/api/multi-image-to-3d, https://www.meshy.ai/tutorials/multi-view-image-to-3d). GLB with embedded textures, optional PBR maps (metallic/roughness/normal), quad topology, target polycount control, built-in auto-rig. Third-party comparisons rate Meshy "best fit for stylized game assets" with cleaner topology (https://www.strayspark.studio/blog/generative-3d-tools-comparison-meshy-rodin-tripo-csm-2026, https://medium.com/ideas-with-wings/best-ai-3d-model-generators-in-2026-tripo-ai-vs-meshy-rodin-kaedim-and-more-7eea7b05eb11).
- Licensing caveats: API requires Pro tier or above ($20/mo minimum) — free plan is webapp-only, and free-plan outputs are Meshy-owned CC BY 4.0 requiring attribution. Paid plans: full private ownership, conditioned on not publishing to Meshy Community and non-infringing inputs (https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models). The claim that paid-plan rights persist after downgrade is UNVERIFIED (search snippet only).

**3. Rodin / Hyper3D — quality reserve, poor API economics.** Ranked at/near top for mesh fidelity/topology in 2026 roundups, but API access starts at Business $120/mo (https://hyper3d.ai/pricing); per-call resale exists via https://wavespeed.ai/models/hyper3d/rodin-v2/image-to-3d. The claim that all plans grant full commercial rights is UNVERIFIED (third-party review only, https://makerstack.co/reviews/hyper3d-rodin-review/); Gen-2.5 feature list also UNVERIFIED against any first-party changelog. Use via webapp Creator tier ($30/mo, ~60 models) if Tripo/Meshy geometry disappoints.

**Not recommended:** Hunyuan3D-2.1 — license explicitly excludes the EU, covering outputs, not just weights (https://huggingface.co/tencent/Hunyuan3D-2.1/blob/main/LICENSE); legally unusable for a Germany-based commercial project. Hitem3D/Hi3D — interesting new entrant but commercial terms UNVERIFIED. CSM — reported Google acquisition Jan 2026 is UNVERIFIED/single-source; pipeline continuity risk.

## 2. Workflow

1. **Prep inputs from the concept sheets.** Crop each creature (Mugosh, Flammenwolf, Veras) into 2–4 clean single-creature views on neutral background; front view first/primary. Tripo expects [front, left, back, right]; Meshy treats image 1 as front. If a sheet only has one angle, single-image mode works on both services (expect the model to hallucinate unseen angles — Tripo reportedly does this plausibly per https://www.whytryai.com/p/tripo-ai-hd-model).
2. **Generate.** Async API call (poll or webhook), ~3–4 min per model at max settings (Tripo, per whytryai). Request textured output; on Meshy set `topology: quad`, a `target_polycount` sane for PlayCanvas (e.g. 10–30k), and `enable_pbr: true` if you want metallic/roughness/normal maps.
3. **Rig (optional but cheap).** Tripo: free `rig-check`, then POST /animations/rig with quadruped (Flammenwolf) or whichever skeleton fits, Mixamo-compatible naming, GLB out; retargeted animations 10 credits each. Meshy has rigging/animation endpoints too.
4. **Download GLB** (textures embedded) and drop into PlayCanvas.
5. **Cleanup — plan for it.** Reports agree these are draft-quality game assets: expect manual retopo/LOD work, texture touch-ups, and scale/orientation fixes (the "expect manual cleanup for game-ready LODs" note is the Meshy report's own inference, UNVERIFIED). Iterate: each attempt is cheap enough to regenerate rather than repair heavily.
6. **Register provenance** per your asset-registry contract: service, model version, license ("Tripo paid tier / commercial" or "Meshy Pro / proprietary-owned"), source concept image, and fallback asset.

## 3. Cost expectations

- **Tripo API (pay-as-you-go, no subscription):** textured image/multiview-to-3D 30 credits = $0.30; + auto-rig 25–30 credits; + format conversion 5–10 → **~$0.55–0.60 per textured+rigged attempt** (https://developers.tripo3d.ai/en/pricing). Three creatures with 3–5 attempts each: roughly $5–10 total.
- **Meshy:** Pro $20/mo (1,000 credits) required for API. Per textured model ~20–35 credits — Meshy's own pages disagree (20 vs 25 vs 30/35; multi-image responses showed `consumed_credits: 30`) — exact per-task cost UNVERIFIED; ballpark **30–50 textured models per month on Pro** (https://www.meshy.ai/pricing, https://www.meshy.ai/api).
- **Rodin:** $30/mo Creator ≈ 60 models webapp-only; API from $120/mo.

For three creatures, Tripo pay-as-you-go is the cheapest entry (single-digit dollars, no subscription); Meshy Pro at $20 for one month buys enough credits for extensive iteration.

## 4. Local / open-source path

**Viable in principle, not on your Mac.** The Alternatives report is explicit: no current-generation model (TRELLIS.2, Hunyuan3D-2.1, TripoSG) runs on Apple Silicon — all CUDA-only.

- Best option: **Microsoft TRELLIS.2-4B** — MIT license (cleanest in the field, no revenue caps/territory limits/attribution), PBR-ready GLB output, but requires an NVIDIA GPU with ≥24 GB, Linux, CUDA 12.4 (https://github.com/microsoft/TRELLIS.2, https://huggingface.co/microsoft/TRELLIS.2-4B). Practical route: rent a 24 GB+ GPU (RunPod/Vast/Lambda), batch-generate, pay per GPU-hour instead of per asset. Hourly rates were not researched — UNVERIFIED. Its "best model you can run yourself" ranking comes from an SEO/fan site (https://trellis2.app/blog/best-ai-3d-model-generator) — reputational, not measured.
- Hunyuan3D-2.1: technically strong and lighter (10–29 GB VRAM) but EU-excluded license — avoid.
- TripoSG (MIT): geometry only, no textures. SF3D: textured and fast but 2024-era quality, Stability license free only under $1M revenue. TripoSR (MIT): the only plausibly Mac-runnable option, oldest/lowest quality.

**Verdict:** for three prototype creatures, the hosted path (Tripo, then Meshy) is faster and costs less than an hour of GPU rental setup. The TRELLIS.2/rented-GPU route only pays off if creature generation becomes a recurring high-volume need.

## Consolidated UNVERIFIED / caveat list

- Meshy exact per-task credit costs (20/25/30/35 inconsistent across Meshy's own pages) — verify against a live `consumed_credits` response.
- Meshy rights-persist-after-downgrade wording (search snippet only).
- Meshy quality on dark-fantasy creatures specifically — no source tested it; all quality claims are third-party blog benchmarks; the proposed concept-art→multi-image→quad→auto-rig pipeline is inference, untested.
- Tripo commercial rights on the cheapest paid tier (one snippet says Pro/Enterprise only) and on API pay-as-you-go outputs — both unresolved; official terms/pricing pages returned 403.
- Tripo subscription tier prices (third-party aggregators only), "Uni-Rig" branding (snippet only), H3.1/P1 availability on Tripo's own API, and Reddit-level user evidence.
- Rodin Gen-2.5 feature list and "all plans grant commercial rights" claim.
- Hitem3D API claims (first-party marketing) and commercial terms entirely.
- Hunyuan3D attribution requirement detail (third-party site, not license text) — moot given the EU exclusion.
- CSM Google acquisition (single source).
- GPU rental hourly rates (not researched).
