# Experiment Contract

Every prototype is one falsifiable gameplay experiment, not a mini production milestone.

Required metadata:
- `id`
- `title`
- `hypothesis`
- `design_status`: STATED | TENTATIVE | AMBIGUOUS | CONFLICT
- `source_refs`
- `runtime_adapter`
- `mechanics`
- `assets`
- `tunables`
- `success_signals`
- `kill_criteria`
- `reset_strategy`

## Isolation rule

Default: all new gameplay logic stays in the experiment. A mechanic may move to a shared module only after at least two independent experiments require the same behavior contract.

## Prototype truth rule

A successful experiment supports a design hypothesis. It does not update Confluence canon by itself.

## Suggested first experiment after runtime approval

`zhalm-forest-v1`: third-person forest encounter testing whether sound -> root trigger -> visible network alert -> investigate/chase produces a legible, distinctive loop.
