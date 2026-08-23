# Creature Concept Contract

Purpose: make named PvE creatures visually prototypeable before final art, animation, AI or combat systems exist.

A creature concept is **not** a gameplay implementation and does not create canon. It is a source-linked visual/interaction profile that the prototype runtime can render with replaceable placeholder geometry and effect layers.

Each concept must validate against `schemas/creature-concept.schema.json` and declare stable identity, design status, source references, visual layers, FX readability goals, extension points and non-goals.

## Runtime expectation

The first runtime playground should include a `creature-fx-gallery` mode or equivalent scene that can instantiate these profiles using engine primitives. A profile may later swap its primitive placeholder for a GLB asset without changing its stable concept id.

The gallery must be useful for judging silhouette and player-relative scale, material response, emissive readability, transparency, particles, trails, simple decals/ground marks, local lights, atmosphere and restrained bloom/post effects where supported.

The gallery is a design instrument, not final game UI or final creature behavior.
