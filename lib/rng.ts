/** Seeded pseudo-random number generation (mulberry32) plus small helpers. */

export type Rng = () => number;

/** Deterministic 32-bit PRNG; the same seed always yields the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh unpredictable 32-bit seed. */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Derive an independent seed from a base seed so two RNG streams never overlap. */
export function deriveSeed(seed: number, salt: number): number {
  return Math.imul((seed ^ salt) >>> 0, 0x9e3779b1) >>> 0;
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: empty list');
  return items[Math.floor(rng() * items.length)];
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}
