// Deterministic PRNG helpers (pure functions).
// Given the same starting seed and call sequence, results are stable.

export function nextSeed(seed: number): number {
    // Mulberry32 step
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
}

export function randFloat01(seed: number): { value: number; seed: number } {
    const s = nextSeed(seed);
    // Convert int32 to [0, 1)
    const value = ((s >>> 0) & 0xffffffff) / 0x100000000;
    return { value, seed: s };
}

export function randRange(seed: number, min: number, max: number): { value: number; seed: number } {
    const { value: r, seed: s } = randFloat01(seed);
    return { value: min + r * (max - min), seed: s };
}

export function randIntInclusive(
    seed: number,
    min: number,
    max: number,
): { value: number; seed: number } {
    const { value: r, seed: s } = randFloat01(seed);
    const v = Math.floor(min + r * (max - min + 1));
    return { value: v, seed: s };
}
