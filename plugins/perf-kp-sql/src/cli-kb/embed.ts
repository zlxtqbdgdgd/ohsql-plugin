// Phase 1 · M3 · transformers all-MiniLM-L6-v2 → 384 维 embedding
// (从老 cli-kb.ts 提取 · 接口不变)

let _extractor: unknown;

export async function embed(text: string, modelDir?: string): Promise<number[]> {
  if (!_extractor) {
    const transformers: typeof import("@xenova/transformers") = await import("@xenova/transformers");
    if (modelDir) {
      transformers.env.localModelPath = modelDir;
      transformers.env.cacheDir = modelDir;
    }
    _extractor = await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const extractor = _extractor as (
    t: string,
    o: Record<string, unknown>,
  ) => Promise<{ data: Float32Array }>;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export function embeddingToBlob(embedding: number[]): Buffer {
  // sqlite-vec 接受 32-bit float blob (Little-Endian)
  const buf = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i], i * 4);
  }
  return buf;
}
