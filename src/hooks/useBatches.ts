import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ObservationBatch, BatchStatus, Sample, DbStatus } from "../types";
import { observationDb, getInitialBatches } from "../db";

interface UseBatchesReturn {
  batches: ObservationBatch[];
  isLoading: boolean;
  dbStatus: DbStatus;
  createBatch: (name: string, description: string, userId: string, userName: string) => void;
  closeBatch: (batchId: string) => void;
  reopenBatch: (batchId: string) => void;
  deleteBatch: (batchId: string) => void;
  addSampleToBatch: (batchId: string, sampleId: string) => void;
  removeSampleFromBatch: (batchId: string, sampleId: string) => void;
  getBatchById: (batchId: string) => ObservationBatch | undefined;
}

export const useBatches = (parentDbStatus: DbStatus, samples: Sample[]): UseBatchesReturn => {
  const [batches, setBatches] = useState<ObservationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus>(parentDbStatus);
  const initializedRef = useRef(false);

  const persistBatches = useCallback(async (newBatches: ObservationBatch[]) => {
    if (dbStatus !== "ready") {
      return;
    }
    try {
      await observationDb.saveBatches(newBatches);
    } catch (error) {
      console.error("保存批次数据失败:", error);
    }
  }, [dbStatus]);

  useEffect(() => {
    const initBatches = async () => {
      if (parentDbStatus !== "ready") {
        setDbStatus(parentDbStatus);
        setIsLoading(false);
        return;
      }

      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        const savedBatches = await observationDb.getAllBatches();

        if (savedBatches.length === 0 && samples.length > 0) {
          const initialBatches = getInitialBatches(samples.map(s => s.id));
          if (initialBatches.length > 0) {
            await observationDb.saveBatches(initialBatches);
            setBatches(initialBatches);
          } else {
            setBatches([]);
          }
        } else {
          setBatches(savedBatches);
        }

        setDbStatus("ready");
      } catch (error) {
        console.error("批次数据加载失败:", error);
        setDbStatus("error");
      }

      setIsLoading(false);
    };

    initBatches();
  }, [parentDbStatus, samples]);

  const createBatch = useCallback(
    (name: string, description: string, userId: string, userName: string) => {
      const now = new Date().toISOString();
      const newBatch: ObservationBatch = {
        id: `batch-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        createdAt: now,
        status: "open",
        createdBy: userId,
        createdByName: userName,
        sampleIds: []
      };

      const newBatches = [newBatch, ...batches];
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const closeBatch = useCallback(
    (batchId: string) => {
      const newBatches = batches.map(b =>
        b.id === batchId
          ? { ...b, status: "closed" as BatchStatus, closedAt: new Date().toISOString() }
          : b
      );
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const reopenBatch = useCallback(
    (batchId: string) => {
      const newBatches = batches.map(b =>
        b.id === batchId
          ? { ...b, status: "open" as BatchStatus, closedAt: undefined }
          : b
      );
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const deleteBatch = useCallback(
    (batchId: string) => {
      const newBatches = batches.filter(b => b.id !== batchId);
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const addSampleToBatch = useCallback(
    (batchId: string, sampleId: string) => {
      const newBatches = batches.map(b => {
        if (b.id !== batchId) return b;
        if (b.sampleIds.includes(sampleId)) return b;
        return { ...b, sampleIds: [...b.sampleIds, sampleId] };
      });
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const removeSampleFromBatch = useCallback(
    (batchId: string, sampleId: string) => {
      const newBatches = batches.map(b =>
        b.id === batchId
          ? { ...b, sampleIds: b.sampleIds.filter(id => id !== sampleId) }
          : b
      );
      setBatches(newBatches);
      persistBatches(newBatches);
    },
    [batches, persistBatches]
  );

  const getBatchById = useCallback(
    (batchId: string) => batches.find(b => b.id === batchId),
    [batches]
  );

  return useMemo(
    () => ({
      batches,
      isLoading,
      dbStatus,
      createBatch,
      closeBatch,
      reopenBatch,
      deleteBatch,
      addSampleToBatch,
      removeSampleFromBatch,
      getBatchById
    }),
    [
      batches,
      isLoading,
      dbStatus,
      createBatch,
      closeBatch,
      reopenBatch,
      deleteBatch,
      addSampleToBatch,
      removeSampleFromBatch,
      getBatchById
    ]
  );
};
