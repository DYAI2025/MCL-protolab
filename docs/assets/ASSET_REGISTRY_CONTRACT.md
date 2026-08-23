# Asset Registry Contract

Assets are replaceable prototype inputs. Gameplay code references stable asset IDs, not arbitrary file paths.

Required per asset:
- `asset_id`
- `kind`
- `path`
- `format`
- `status`: placeholder | candidate | approved_for_prototype
- `version`
- `source`
- `license`
- `provenance`
- `fallback_asset_id`

Rules:
1. No asset without known source/license/provenance.
2. Generated assets are candidates, not canon.
3. Placeholder replacement should require registry changes, not gameplay-mechanic edits.
4. Final-art approval is outside this prototype contract.
5. Do not use recognizable third-party franchise iconography.
