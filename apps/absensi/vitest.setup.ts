import { vi } from 'vitest';

vi.mock('@vladmandic/human', () => ({
  match: {
    similarity: (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Length mismatch: ${a.length} vs ${b.length}`);
      }
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += a[i]! * b[i]!;
      }
      const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
      return normA && normB ? sum / (normA * normB) : 0;
    },
  },
}));
