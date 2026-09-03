/** Typed mirror of schemas/creature-concept.schema.json — extend both together. */

export type DesignStatus = 'STATED' | 'TENTATIVE' | 'AMBIGUOUS' | 'CONFLICT';

export type VisualLayer =
  | 'geometry' | 'material' | 'emissive' | 'particles' | 'trail'
  | 'decal' | 'light' | 'fog' | 'post_effect';

export interface FxProfile {
  primary: string[];
  secondary: string[];
  readability_goal: string;
}

export interface CreatureConcept {
  id: string;
  display_name: string;
  design_status: DesignStatus;
  source_refs: string[];
  role: string;
  disposition: string;
  silhouette: string;
  scale: string;
  visual_layers: VisualLayer[];
  fx_profile: FxProfile;
  concept_capabilities: string[];
  extension_points: string[];
  non_goals: string[];
}

export function createConceptRegistry(profiles: readonly CreatureConcept[]) {
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return {
    get(id: string): CreatureConcept {
      const profile = byId.get(id);
      if (!profile) throw new Error(`Unknown creature concept "${id}". Known: ${[...byId.keys()].join(', ')}`);
      return profile;
    },
    ids(): string[] { return [...byId.keys()]; },
    all(): CreatureConcept[] { return [...byId.values()]; },
  };
}

export type ConceptRegistry = ReturnType<typeof createConceptRegistry>;
