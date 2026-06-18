import type { Sample, ObservationBatch } from "../types";
import { getInitialSamples, getInitialBatches } from "../db";

export const clearAllStorage = (): void => {
  if (typeof window !== "undefined") {
    localStorage.clear();
    sessionStorage.clear();
  }
};

export const clearAllIndexedDB = async (): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }

  const databases = await (window.indexedDB as any).databases?.();
  if (!databases) {
    return;
  }

  await Promise.all(
    databases.map(
      (db: { name: string }) =>
        new Promise<void>((resolve) => {
          const request = window.indexedDB.deleteDatabase(db.name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })
    )
  );
};

export const resetTestStorage = async (): Promise<void> => {
  clearAllStorage();
  await clearAllIndexedDB();
};

export const createTestSamples = (count: number = 3): Sample[] => {
  const baseSamples = getInitialSamples();
  const samples: Sample[] = [];

  for (let i = 0; i < count; i++) {
    const base = baseSamples[i % baseSamples.length];
    samples.push({
      ...base,
      id: `test-sample-${i + 1}`,
      sampleName: `${base.sampleName} (测试 ${i + 1})`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    });
  }

  return samples;
};

export const createTestBatches = (
  sampleIds: string[]
): ObservationBatch[] => {
  return getInitialBatches(sampleIds).map((batch, index) => ({
    ...batch,
    id: `test-batch-${index + 1}`,
    name: `测试批次 ${index + 1}`,
  }));
};

export const createEmptyTestData = () => ({
  samples: [] as Sample[],
  batches: [] as ObservationBatch[],
});

export const createStandardTestData = () => {
  const samples = createTestSamples(3);
  const sampleIds = samples.map((s) => s.id);
  const batches = createTestBatches(sampleIds);
  return { samples, batches };
};
