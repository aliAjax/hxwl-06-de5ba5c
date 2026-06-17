import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Sample,
  MagnificationRecord,
  SampleFormData,
  MagnificationFormData,
  DbStatus
} from "../types";
import {
  observationDb,
  getInitialSamples,
  isIndexedDBSupported
} from "../db";

interface UseSamplesReturn {
  samples: Sample[];
  isLoading: boolean;
  dbStatus: DbStatus;
  dbError: string;
  addSample: (formData: SampleFormData, currentUserId: string, currentUserName: string) => string;
  addMagnification: (sampleId: string, data: MagnificationFormData) => void;
  updateMagnification: (sampleId: string, magId: string, data: MagnificationFormData) => void;
  deleteMagnification: (sampleId: string, magId: string) => void;
  toggleQualified: (sampleId: string, magId: string, qualified: boolean, reviewerName: string) => void;
  clearAllRecords: () => Promise<boolean>;
}

export const useSamples = (): UseSamplesReturn => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("init");
  const [dbError, setDbError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const persistSamples = useCallback(async (newSamples: Sample[]) => {
    if (dbStatus !== "ready") {
      return;
    }
    try {
      await observationDb.saveSamples(newSamples);
    } catch (error) {
      console.error("保存数据失败:", error);
    }
  }, [dbStatus]);

  useEffect(() => {
    const initDatabase = async () => {
      try {
        if (!isIndexedDBSupported()) {
          setDbStatus("unsupported");
          setDbError("当前浏览器不支持 IndexedDB，数据将无法持久化保存。刷新页面后数据会丢失。");
          setSamples(getInitialSamples());
          setIsLoading(false);
          return;
        }

        await observationDb.init();
        setDbStatus("ready");

        const savedSamples = await observationDb.getAllSamples();

        if (savedSamples.length === 0) {
          const initialData = getInitialSamples();
          await observationDb.saveSamples(initialData);
          setSamples(initialData);
        } else {
          setSamples(savedSamples);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Database init error:", error);
        setDbStatus("error");
        setDbError(error instanceof Error ? error.message : "数据库初始化失败");
        setSamples(getInitialSamples());
        setIsLoading(false);
      }
    };

    initDatabase();

    return () => {
      observationDb.close();
    };
  }, []);

  const addSample = useCallback(
    (formData: SampleFormData, currentUserId: string, currentUserName: string): string => {
      const now = new Date().toISOString();

      const existingSample = samples.find(
        sample =>
          sample.sampleName === formData.sampleName.trim() &&
          sample.sampleType === formData.sampleType.trim() &&
          sample.studentId === currentUserId
      );

      const newMagnification: MagnificationRecord = {
        id: `mag-${Date.now()}`,
        magnification: formData.magnification.trim().toLowerCase(),
        observedStructure: formData.observedStructure.trim(),
        fieldDescription: formData.fieldDescription.trim(),
        createdAt: now
      };

      let newSamples: Sample[];
      let resultingSampleId: string;

      if (existingSample) {
        resultingSampleId = existingSample.id;
        newSamples = samples.map(sample =>
          sample.id === existingSample.id
            ? { ...sample, magnifications: [...sample.magnifications, newMagnification] }
            : sample
        );
      } else {
        resultingSampleId = `sample-${Date.now()}`;
        const newSample: Sample = {
          id: resultingSampleId,
          sampleName: formData.sampleName.trim(),
          sampleType: formData.sampleType.trim(),
          stainingMethod: formData.stainingMethod.trim(),
          createdAt: now,
          magnifications: [newMagnification],
          studentId: currentUserId,
          studentName: currentUserName
        };
        newSamples = [newSample, ...samples];
      }

      setSamples(newSamples);
      persistSamples(newSamples);
      return resultingSampleId;
    },
    [samples, persistSamples]
  );

  const addMagnification = useCallback(
    (sampleId: string, data: MagnificationFormData) => {
      const newSamples = samples.map(sample =>
        sample.id === sampleId
          ? {
              ...sample,
              magnifications: [
                ...sample.magnifications,
                {
                  id: `mag-${Date.now()}`,
                  magnification: data.magnification.trim().toLowerCase(),
                  observedStructure: data.observedStructure.trim(),
                  fieldDescription: data.fieldDescription.trim(),
                  createdAt: new Date().toISOString()
                }
              ]
            }
          : sample
      );
      setSamples(newSamples);
      persistSamples(newSamples);
    },
    [samples, persistSamples]
  );

  const updateMagnification = useCallback(
    (sampleId: string, magId: string, data: MagnificationFormData) => {
      const newSamples = samples.map(sample =>
        sample.id === sampleId
          ? {
              ...sample,
              magnifications: sample.magnifications.map(record =>
                record.id === magId
                  ? {
                      ...record,
                      magnification: data.magnification.trim().toLowerCase(),
                      observedStructure: data.observedStructure.trim(),
                      fieldDescription: data.fieldDescription.trim()
                    }
                  : record
              )
            }
          : sample
      );
      setSamples(newSamples);
      persistSamples(newSamples);
    },
    [samples, persistSamples]
  );

  const deleteMagnification = useCallback(
    (sampleId: string, magId: string) => {
      const newSamples = samples.map(sample =>
        sample.id === sampleId
          ? { ...sample, magnifications: sample.magnifications.filter(record => record.id !== magId) }
          : sample
      );
      setSamples(newSamples);
      persistSamples(newSamples);
    },
    [samples, persistSamples]
  );

  const toggleQualified = useCallback(
    (sampleId: string, magId: string, qualified: boolean, reviewerName: string) => {
      const newSamples = samples.map(sample =>
        sample.id === sampleId
          ? {
              ...sample,
              magnifications: sample.magnifications.map(record =>
                record.id === magId
                  ? {
                      ...record,
                      isQualified: qualified,
                      qualifiedAt: new Date().toISOString(),
                      reviewedBy: reviewerName
                    }
                  : record
              )
            }
          : sample
      );
      setSamples(newSamples);
      persistSamples(newSamples);
    },
    [samples, persistSamples]
  );

  const clearAllRecords = useCallback(async (): Promise<boolean> => {
    try {
      if (dbStatus === "ready") {
        await observationDb.clearAllSamples();
        const initialData = getInitialSamples();
        await observationDb.saveSamples(initialData);
        setSamples(initialData);
      } else {
        const initialData = getInitialSamples();
        setSamples(initialData);
      }
      return true;
    } catch {
      return false;
    }
  }, [dbStatus]);

  return useMemo(
    () => ({
      samples,
      isLoading,
      dbStatus,
      dbError,
      addSample,
      addMagnification,
      updateMagnification,
      deleteMagnification,
      toggleQualified,
      clearAllRecords
    }),
    [
      samples,
      isLoading,
      dbStatus,
      dbError,
      addSample,
      addMagnification,
      updateMagnification,
      deleteMagnification,
      toggleQualified,
      clearAllRecords
    ]
  );
};
