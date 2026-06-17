import type {
  Role,
  User,
  MagnificationRecord,
  Sample,
  SampleCategory,
  StainingMethod,
  ObservationBatch
} from "./types";

export type { Role, User, MagnificationRecord, Sample, SampleCategory, StainingMethod, ObservationBatch };

interface LegacyRecord {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  createdAt: string;
}

interface MetadataEntry {
  key: string;
  value: unknown;
}

const DB_NAME = "microscope-observation-db";
const DB_VERSION = 5;
const STORE_SAMPLES = "samples";
const STORE_METADATA = "metadata";
const STORE_BATCHES = "batches";

export const defaultUsers: User[] = [
  { id: "student-1", name: "张三", role: "student" },
  { id: "student-2", name: "李四", role: "student" },
  { id: "student-3", name: "王五", role: "student" },
  { id: "teacher-1", name: "李老师", role: "teacher" },
  { id: "admin-1", name: "赵管理员", role: "admin" }
];

export const defaultSampleCategories: SampleCategory[] = [
  { id: "cat-1", name: "植物组织" },
  { id: "cat-2", name: "动物组织" },
  { id: "cat-3", name: "微生物" },
  { id: "cat-4", name: "血液涂片" }
];

export const defaultStainingMethods: StainingMethod[] = [
  { id: "stain-1", name: "碘液" },
  { id: "stain-2", name: "HE染色" },
  { id: "stain-3", name: "革兰氏染色" },
  { id: "stain-4", name: "瑞氏染色" },
  { id: "stain-5", name: "活体观察" }
];

const initialLegacyRecords: (LegacyRecord & { studentId: string; studentName: string })[] = [
  {
    sampleName: "洋葱表皮",
    sampleType: "植物组织",
    stainingMethod: "碘液",
    magnification: "100x",
    observedStructure: "细胞排列",
    fieldDescription: "低倍镜下细胞紧密排列，轮廓可辨",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    studentId: "student-1",
    studentName: "张三"
  },
  {
    sampleName: "洋葱表皮",
    sampleType: "植物组织",
    stainingMethod: "碘液",
    magnification: "200x",
    observedStructure: "细胞壁",
    fieldDescription: "中倍镜下细胞壁清晰，细胞核隐约可见",
    createdAt: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
    studentId: "student-1",
    studentName: "张三"
  },
  {
    sampleName: "人血涂片",
    sampleType: "血液涂片",
    stainingMethod: "瑞氏染色",
    magnification: "1000x",
    observedStructure: "红细胞",
    fieldDescription: "红细胞分布均匀，形态典型",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    studentId: "student-2",
    studentName: "李四"
  },
  {
    sampleName: "草履虫",
    sampleType: "微生物",
    stainingMethod: "活体观察",
    magnification: "200x",
    observedStructure: "纤毛",
    fieldDescription: "纤毛运动明显，细胞结构清晰",
    createdAt: new Date(Date.now() - 86400000 / 2).toISOString(),
    studentId: "student-3",
    studentName: "王五"
  }
];

const migrateLegacyRecordsToSamples = (
  records: (LegacyRecord & { studentId: string; studentName: string })[]
): Sample[] => {
  const sampleMap = new Map<string, Sample>();
  records.forEach((record, index) => {
    const magnificationRecord: MagnificationRecord = {
      id: `mag-init-${index}`,
      magnification: record.magnification.toLowerCase(),
      observedStructure: record.observedStructure,
      fieldDescription: record.fieldDescription,
      createdAt: record.createdAt
    };
    const key = `${record.sampleName}-${record.studentId}`;
    const existing = sampleMap.get(key);
    if (existing) {
      existing.magnifications.push(magnificationRecord);
    } else {
      sampleMap.set(key, {
        id: `sample-init-${index}`,
        sampleName: record.sampleName,
        sampleType: record.sampleType,
        stainingMethod: record.stainingMethod,
        createdAt: record.createdAt,
        magnifications: [magnificationRecord],
        studentId: record.studentId,
        studentName: record.studentName
      });
    }
  });
  return Array.from(sampleMap.values());
};

export const getInitialSamples = (): Sample[] => {
  return migrateLegacyRecordsToSamples(initialLegacyRecords);
};

export const getInitialBatches = (sampleIds: string[]): ObservationBatch[] => {
  if (sampleIds.length === 0) return [];
  return [
    {
      id: "batch-init-1",
      name: "示例批次 · 历史观察记录",
      description: "系统自动生成的示例批次，包含所有历史观察记录数据",
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: "open",
      createdBy: "teacher-1",
      createdByName: "李老师",
      sampleIds
    }
  ];
};

export const isIndexedDBSupported = (): boolean => {
  return typeof window !== "undefined" && "indexedDB" in window;
};

const builtInSampleOwners: Record<string, Pick<User, "id" | "name">> = {
  "洋葱表皮": { id: "student-1", name: "张三" },
  "人血涂片": { id: "student-2", name: "李四" },
  "草履虫": { id: "student-3", name: "王五" }
};

const inferBuiltInSampleOwner = (sample: Sample): Pick<User, "id" | "name"> | undefined => {
  const byName = builtInSampleOwners[sample.sampleName];
  if (byName) {
    return byName;
  }

  if (sample.sampleType === "血液涂片" && sample.stainingMethod === "瑞氏染色") {
    return builtInSampleOwners["人血涂片"];
  }
  if (sample.sampleType === "微生物" && sample.stainingMethod === "活体观察") {
    return builtInSampleOwners["草履虫"];
  }
  return undefined;
};

export class ObservationDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!isIndexedDBSupported()) {
        reject(new Error("当前浏览器不支持 IndexedDB，数据将无法持久化保存。"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("数据库打开失败：" + (request.error?.message || "未知错误")));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onerror = (event) => {
          console.error("数据库错误:", event);
        };
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion || 0;

        if (oldVersion < 1) {
          this.migrateFrom0To1(db);
        }
        if (oldVersion < 2) {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          this.migrateFrom1To2(db, tx);
        }
        if (oldVersion < 3) {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          this.migrateFrom2To3(db, tx);
        }
        if (oldVersion < 4) {
          this.migrateFrom3To4(db);
        }
        if (oldVersion < 5) {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          this.migrateFrom4To5(db, tx);
        }
      };
    });

    return this.initPromise;
  }

  private migrateFrom0To1(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
      const store = db.createObjectStore(STORE_SAMPLES, { keyPath: "id" });
      this.ensureSampleIndexes(store);
    }
  }

  private migrateFrom1To2(db: IDBDatabase, transaction?: IDBTransaction | null): void {
    if (!db.objectStoreNames.contains(STORE_METADATA)) {
      db.createObjectStore(STORE_METADATA, { keyPath: "key" });
    }

    if (db.objectStoreNames.contains(STORE_SAMPLES) && transaction) {
      const store = transaction.objectStore(STORE_SAMPLES);
      this.ensureSampleIndexes(store);
      this.normalizeSavedSamples(store);
    }
  }

  private migrateFrom2To3(db: IDBDatabase, transaction?: IDBTransaction | null): void {
    if (db.objectStoreNames.contains(STORE_SAMPLES) && transaction) {
      const store = transaction.objectStore(STORE_SAMPLES);
      this.ensureSampleIndexes(store);
      this.normalizeSavedSamples(store);
    }
  }

  private migrateFrom3To4(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_BATCHES)) {
      const store = db.createObjectStore(STORE_BATCHES, { keyPath: "id" });
      if (!store.indexNames.contains("status")) {
        store.createIndex("status", "status", { unique: false });
      }
      if (!store.indexNames.contains("createdAt")) {
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    }
  }

  private migrateFrom4To5(db: IDBDatabase, transaction?: IDBTransaction | null): void {
    if (db.objectStoreNames.contains(STORE_SAMPLES) && transaction) {
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.getAll();
      request.onsuccess = () => {
        const samples = request.result as Sample[];
        samples.forEach(sample => {
          let changed = false;
          sample.magnifications = sample.magnifications.map(rec => {
            if (rec.unqualifiedReason === undefined || rec.revisionSuggestion === undefined) {
              changed = true;
              return {
                unqualifiedReason: "",
                revisionSuggestion: "",
                ...rec
              };
            }
            return rec;
          });
          if (changed) {
            store.put(sample);
          }
        });
      };
    }
  }

  private ensureSampleIndexes(store: IDBObjectStore): void {
    if (!store.indexNames.contains("sampleName")) {
      store.createIndex("sampleName", "sampleName", { unique: false });
    }
    if (!store.indexNames.contains("createdAt")) {
      store.createIndex("createdAt", "createdAt", { unique: false });
    }
    if (!store.indexNames.contains("studentId")) {
      store.createIndex("studentId", "studentId", { unique: false });
    }
  }

  private normalizeSavedSamples(store: IDBObjectStore): void {
    const request = store.getAll();
    request.onsuccess = () => {
      const samples = request.result as Sample[];
      samples.forEach(sample => {
        let changed = false;
        const inferredOwner = inferBuiltInSampleOwner(sample);

        sample.magnifications = sample.magnifications.map(rec => {
          const lowerMag = rec.magnification.toLowerCase();
          if (rec.magnification !== lowerMag) {
            changed = true;
            return { ...rec, magnification: lowerMag };
          }
          return rec;
        });

        if (inferredOwner) {
          if (sample.studentId !== inferredOwner.id || sample.studentName !== inferredOwner.name) {
            sample.studentId = inferredOwner.id;
            sample.studentName = inferredOwner.name;
            changed = true;
          }
        } else if (!sample.studentId) {
          sample.studentId = "student-1";
          sample.studentName = "张三";
          changed = true;
        }

        if (changed) {
          store.put(sample);
        }
      });
    };
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error("数据库未初始化，请先调用 init() 方法。");
    }
  }

  async getMetadata<T = unknown>(key: string): Promise<T | undefined> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_METADATA, "readonly");
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as MetadataEntry | undefined;
        resolve(entry?.value as T | undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_METADATA, "readwrite");
      const store = transaction.objectStore(STORE_METADATA);
      store.put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllSamples(): Promise<Sample[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readonly");
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.getAll();

      request.onsuccess = () => {
        const samples = request.result as Sample[];
        samples.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(samples);
      };

      request.onerror = () => {
        reject(new Error("读取数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async saveSample(sample: Sample): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readwrite");
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.put(sample);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("保存数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async saveSamples(samples: Sample[]): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readwrite");
      const store = transaction.objectStore(STORE_SAMPLES);

      samples.forEach(sample => {
        store.put(sample);
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error("批量保存数据失败：" + (transaction.error?.message || "未知错误")));
      };
    });
  }

  async deleteSample(sampleId: string): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readwrite");
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.delete(sampleId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("删除数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async clearAllSamples(): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readwrite");
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("清空数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async countSamples(): Promise<number> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_SAMPLES, "readonly");
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error("统计数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async getAllBatches(): Promise<ObservationBatch[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_BATCHES, "readonly");
      const store = transaction.objectStore(STORE_BATCHES);
      const request = store.getAll();

      request.onsuccess = () => {
        const batches = request.result as ObservationBatch[];
        batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(batches);
      };

      request.onerror = () => {
        reject(new Error("读取批次数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async saveBatch(batch: ObservationBatch): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_BATCHES, "readwrite");
      const store = transaction.objectStore(STORE_BATCHES);
      const request = store.put(batch);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("保存批次数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async saveBatches(batches: ObservationBatch[]): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_BATCHES, "readwrite");
      const store = transaction.objectStore(STORE_BATCHES);

      batches.forEach(batch => {
        store.put(batch);
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error("批量保存批次数据失败：" + (transaction.error?.message || "未知错误")));
      };
    });
  }

  async deleteBatch(batchId: string): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_BATCHES, "readwrite");
      const store = transaction.objectStore(STORE_BATCHES);
      const request = store.delete(batchId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("删除批次数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  async clearAllBatches(): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_BATCHES, "readwrite");
      const store = transaction.objectStore(STORE_BATCHES);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("清空批次数据失败：" + (request.error?.message || "未知错误")));
      };
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

export const observationDb = new ObservationDatabase();
