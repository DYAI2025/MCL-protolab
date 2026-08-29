export interface TunableSpec { value: number; min: number; max: number; step: number }
export interface TunableDescriptor extends TunableSpec { key: string }
export type TunableListener<K extends string> = (key: K, value: number) => void;

export function createTunables<Specs extends Record<string, TunableSpec>>(specs: Specs) {
  type Key = Extract<keyof Specs, string>;
  const values = new Map<Key, number>();
  const listeners = new Set<TunableListener<Key>>();
  const keys = Object.keys(specs) as Key[];

  const clamp = (key: Key, raw: number) => {
    const spec = specs[key] as TunableSpec;
    return Math.min(spec.max, Math.max(spec.min, raw));
  };

  for (const key of keys) values.set(key, (specs[key] as TunableSpec).value);

  return {
    get(key: Key): number { return values.get(key) ?? (specs[key] as TunableSpec).value; },
    set(key: Key, raw: number): void {
      const next = clamp(key, raw);
      values.set(key, next);
      for (const listener of [...listeners]) listener(key, next);
    },
    subscribe(listener: TunableListener<Key>): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    reset(): void { for (const key of keys) values.set(key, (specs[key] as TunableSpec).value); },
    descriptors(): TunableDescriptor[] {
      return keys.map((key) => ({ key, ...(specs[key] as TunableSpec), value: values.get(key) ?? (specs[key] as TunableSpec).value }));
    },
  };
}

export type Tunables<Specs extends Record<string, TunableSpec>> = ReturnType<typeof createTunables<Specs>>;
