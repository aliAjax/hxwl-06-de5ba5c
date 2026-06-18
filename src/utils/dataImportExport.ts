import type {
  Sample,
  ObservationBatch,
  SampleCategory,
  StainingMethod,
  ObservationTemplate,
  ExportData,
  ImportPreviewResult,
  ImportItemDetail,
  ImportItemStatus,
  ImportOptions,
  ImportResult,
  MagnificationRecord
} from "../types";
import { DATA_EXPORT_VERSION } from "../types";
import { PROJECT_CONFIG } from "../constants";
import { observationDb } from "../db";

const STORAGE_KEY_CATEGORIES = "microscope_admin_categories";
const STORAGE_KEY_STAINING = "microscope_admin_staining";
const STORAGE_KEY_TEMPLATES = "microscope_admin_templates";

const safeParseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getStoredCategories = (): SampleCategory[] => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  return safeParseJSON<SampleCategory[]>(
    window.localStorage.getItem(STORAGE_KEY_CATEGORIES),
    []
  );
};

const getStoredStainingMethods = (): StainingMethod[] => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  return safeParseJSON<StainingMethod[]>(
    window.localStorage.getItem(STORAGE_KEY_STAINING),
    []
  );
};

const getStoredTemplates = (): ObservationTemplate[] => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  return safeParseJSON<ObservationTemplate[]>(
    window.localStorage.getItem(STORAGE_KEY_TEMPLATES),
    []
  );
};

export const exportAllData = async (): Promise<string> => {
  await observationDb.init();

  const [samples, batches] = await Promise.all([
    observationDb.getAllSamples(),
    observationDb.getAllBatches()
  ]);

  const sampleCategories = getStoredCategories();
  const stainingMethods = getStoredStainingMethods();
  const templates = getStoredTemplates();

  const exportData: ExportData = {
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_CONFIG.id,
    data: {
      samples,
      batches,
      sampleCategories,
      stainingMethods,
      templates
    }
  };

  return JSON.stringify(exportData, null, 2);
};

export const downloadExportFile = (jsonData: string): void => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `显微镜观察数据_${dateStr}_${timeStr}.json`;

  const blob = new Blob([jsonData], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const validateSample = (sample: unknown): sample is Sample => {
  if (!sample || typeof sample !== "object") return false;
  const s = sample as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.sampleName === "string" &&
    typeof s.sampleType === "string" &&
    typeof s.stainingMethod === "string" &&
    typeof s.createdAt === "string" &&
    Array.isArray(s.magnifications) &&
    typeof s.studentId === "string" &&
    typeof s.studentName === "string"
  );
};

const validateBatch = (batch: unknown): batch is ObservationBatch => {
  if (!batch || typeof batch !== "object") return false;
  const b = batch as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.name === "string" &&
    typeof b.description === "string" &&
    typeof b.createdAt === "string" &&
    typeof b.status === "string" &&
    typeof b.createdBy === "string" &&
    typeof b.createdByName === "string" &&
    Array.isArray(b.sampleIds)
  );
};

const validateCategory = (cat: unknown): cat is SampleCategory => {
  if (!cat || typeof cat !== "object") return false;
  const c = cat as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.name === "string";
};

const validateStaining = (st: unknown): st is StainingMethod => {
  if (!st || typeof st !== "object") return false;
  const s = st as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string";
};

const validateTemplate = (tpl: unknown): tpl is ObservationTemplate => {
  if (!tpl || typeof tpl !== "object") return false;
  const t = tpl as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.category === "string" &&
    typeof t.sampleType === "string" &&
    typeof t.stainingMethod === "string" &&
    typeof t.magnification === "string" &&
    typeof t.observedStructure === "string" &&
    typeof t.description === "string" &&
    typeof t.icon === "string"
  );
};

const compareObjects = <T extends Record<string, unknown>>(a: T, b: T): string[] => {
  const conflicts: string[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    if (key === "id") continue;
    const valA = JSON.stringify(a[key]);
    const valB = JSON.stringify(b[key]);
    if (valA !== valB) {
      conflicts.push(key);
    }
  }
  return conflicts;
};

const getItemStatus = <T extends { id: string }>(
  item: T,
  existingItems: T[],
  comparator: (a: T, b: T) => string[]
): { status: ImportItemStatus; existingItem?: T; conflictFields?: string[] } => {
  const existing = existingItems.find(e => e.id === item.id);
  if (!existing) {
    return { status: "new" };
  }

  const conflictFields = comparator(item, existing);
  if (conflictFields.length === 0) {
    return { status: "overwrite", existingItem: existing };
  }

  return { status: "conflict", existingItem: existing, conflictFields };
};

const migrateFromLegacyVersion = (data: unknown, version: string): { data: ExportData["data"]; note: string } | null => {
  const note = `检测到旧版本数据 (v${version})，正在尝试迁移到当前版本 (v${DATA_EXPORT_VERSION})`;

  if (version.startsWith("0.")) {
    const legacyData = data as Record<string, unknown>;
    const migrated: ExportData["data"] = {
      samples: Array.isArray(legacyData.samples) ? (legacyData.samples as unknown[]).filter(validateSample) : [],
      batches: Array.isArray(legacyData.batches) ? (legacyData.batches as unknown[]).filter(validateBatch) : [],
      sampleCategories: Array.isArray(legacyData.sampleCategories) ? (legacyData.sampleCategories as unknown[]).filter(validateCategory) : [],
      stainingMethods: Array.isArray(legacyData.stainingMethods) ? (legacyData.stainingMethods as unknown[]).filter(validateStaining) : [],
      templates: Array.isArray(legacyData.templates) ? (legacyData.templates as unknown[]).filter(validateTemplate) : []
    };

    migrated.samples = migrated.samples.map(s => ({
      ...s,
      magnifications: s.magnifications.map((m: MagnificationRecord) => ({
        unqualifiedReason: "",
        revisionSuggestion: "",
        ...m
      }))
    }));

    return { data: migrated, note };
  }

  return null;
};

export const previewImportData = async (
  fileContent: string
): Promise<ImportPreviewResult> => {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(fileContent);
  } catch {
    return {
      isValid: false,
      version: "unknown",
      isOldVersion: false,
      summary: [],
      details: {
        samples: [],
        batches: [],
        sampleCategories: [],
        stainingMethods: [],
        templates: []
      }
    };
  }

  const rawData = parsedData as Record<string, unknown>;
  const version = typeof rawData.version === "string" ? rawData.version : "0.0.0";
  const isOldVersion = version !== DATA_EXPORT_VERSION;

  let importData: ExportData["data"];
  let migrationNote: string | undefined;

  if (rawData.projectId !== PROJECT_CONFIG.id) {
    return {
      isValid: false,
      version,
      isOldVersion,
      summary: [],
      details: {
        samples: [],
        batches: [],
        sampleCategories: [],
        stainingMethods: [],
        templates: []
      }
    };
  }

  if (isOldVersion) {
    const migrated = migrateFromLegacyVersion(rawData.data, version);
    if (migrated) {
      importData = migrated.data;
      migrationNote = migrated.note;
    } else if (rawData.data && typeof rawData.data === "object") {
      const d = rawData.data as Record<string, unknown>;
      importData = {
        samples: Array.isArray(d.samples) ? (d.samples as unknown[]).filter(validateSample) : [],
        batches: Array.isArray(d.batches) ? (d.batches as unknown[]).filter(validateBatch) : [],
        sampleCategories: Array.isArray(d.sampleCategories) ? (d.sampleCategories as unknown[]).filter(validateCategory) : [],
        stainingMethods: Array.isArray(d.stainingMethods) ? (d.stainingMethods as unknown[]).filter(validateStaining) : [],
        templates: Array.isArray(d.templates) ? (d.templates as unknown[]).filter(validateTemplate) : []
      };
      migrationNote = `检测到版本差异 (v${version} → v${DATA_EXPORT_VERSION})，已尝试兼容导入`;
    } else {
      return {
        isValid: false,
        version,
        isOldVersion,
        summary: [],
        details: {
          samples: [],
          batches: [],
          sampleCategories: [],
          stainingMethods: [],
          templates: []
        }
      };
    }
  } else {
    const d = rawData.data as ExportData["data"];
    importData = {
      samples: Array.isArray(d.samples) ? d.samples.filter(validateSample) : [],
      batches: Array.isArray(d.batches) ? d.batches.filter(validateBatch) : [],
      sampleCategories: Array.isArray(d.sampleCategories) ? d.sampleCategories.filter(validateCategory) : [],
      stainingMethods: Array.isArray(d.stainingMethods) ? d.stainingMethods.filter(validateStaining) : [],
      templates: Array.isArray(d.templates) ? d.templates.filter(validateTemplate) : []
    };
  }

  await observationDb.init();
  const [existingSamples, existingBatches] = await Promise.all([
    observationDb.getAllSamples(),
    observationDb.getAllBatches()
  ]);
  const existingCategories = getStoredCategories();
  const existingStaining = getStoredStainingMethods();
  const existingTemplates = getStoredTemplates();

  const rawSamples = Array.isArray((rawData.data as Record<string, unknown>)?.samples)
    ? ((rawData.data as Record<string, unknown>).samples as unknown[])
    : [];
  const rawBatches = Array.isArray((rawData.data as Record<string, unknown>)?.batches)
    ? ((rawData.data as Record<string, unknown>).batches as unknown[])
    : [];
  const rawCategories = Array.isArray((rawData.data as Record<string, unknown>)?.sampleCategories)
    ? ((rawData.data as Record<string, unknown>).sampleCategories as unknown[])
    : [];
  const rawStaining = Array.isArray((rawData.data as Record<string, unknown>)?.stainingMethods)
    ? ((rawData.data as Record<string, unknown>).stainingMethods as unknown[])
    : [];
  const rawTemplates = Array.isArray((rawData.data as Record<string, unknown>)?.templates)
    ? ((rawData.data as Record<string, unknown>).templates as unknown[])
    : [];

  const processItems = <T extends { id: string }>(
    validItems: T[],
    rawItems: unknown[],
    existingItems: T[],
    comparator: (a: T, b: T) => string[]
  ): ImportItemDetail<T>[] => {
    const details: ImportItemDetail<T>[] = [];
    const validIds = new Set(validItems.map(i => i.id));

    rawItems.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") {
        details.push({
          item: { id: `invalid-${index}` } as T,
          status: "invalid",
          invalidReasons: ["数据格式不正确"]
        });
        return;
      }

      const rawObj = raw as Record<string, unknown>;
      const id = typeof rawObj.id === "string" ? rawObj.id : `unknown-${index}`;

      if (!validIds.has(id)) {
        const reasons: string[] = [];
        const requiredFields = Object.keys(existingItems[0] || { id: "" }).filter(k => k !== "id");
        requiredFields.forEach(field => {
          if (rawObj[field] === undefined) {
            reasons.push(`缺少必填字段: ${field}`);
          }
        });
        if (reasons.length === 0) {
          reasons.push("数据验证失败");
        }
        details.push({
          item: { id } as T,
          status: "invalid",
          invalidReasons: reasons
        });
        return;
      }

      const validItem = validItems.find(i => i.id === id)!;
      const result = getItemStatus(validItem, existingItems, comparator);
      details.push({
        item: validItem,
        status: result.status,
        existingItem: result.existingItem,
        conflictFields: result.conflictFields
      });
    });

    return details;
  };

  const sampleDetails = processItems(
    importData.samples,
    rawSamples,
    existingSamples,
    (a, b) => compareObjects(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  );

  const batchDetails = processItems(
    importData.batches,
    rawBatches,
    existingBatches,
    (a, b) => compareObjects(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  );

  const categoryDetails = processItems(
    importData.sampleCategories,
    rawCategories,
    existingCategories,
    (a, b) => compareObjects(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  );

  const stainingDetails = processItems(
    importData.stainingMethods,
    rawStaining,
    existingStaining,
    (a, b) => compareObjects(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  );

  const templateDetails = processItems(
    importData.templates,
    rawTemplates,
    existingTemplates,
    (a, b) => compareObjects(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  );

  const countByStatus = <T>(details: ImportItemDetail<T>[]): Record<ImportItemStatus, number> => {
    return {
      new: details.filter(d => d.status === "new").length,
      overwrite: details.filter(d => d.status === "overwrite").length,
      conflict: details.filter(d => d.status === "conflict").length,
      invalid: details.filter(d => d.status === "invalid").length
    };
  };

  const sampleCounts = countByStatus(sampleDetails);
  const batchCounts = countByStatus(batchDetails);
  const categoryCounts = countByStatus(categoryDetails);
  const stainingCounts = countByStatus(stainingDetails);
  const templateCounts = countByStatus(templateDetails);

  const summary = [
    ...(["new", "overwrite", "conflict", "invalid"] as ImportItemStatus[]).flatMap(status => [
      { type: "sample" as const, status, count: sampleCounts[status] },
      { type: "batch" as const, status, count: batchCounts[status] },
      { type: "sampleCategory" as const, status, count: categoryCounts[status] },
      { type: "stainingMethod" as const, status, count: stainingCounts[status] },
      { type: "template" as const, status, count: templateCounts[status] }
    ])
  ].filter(s => s.count > 0);

  const totalInvalid =
    sampleCounts.invalid + batchCounts.invalid + categoryCounts.invalid + stainingCounts.invalid + templateCounts.invalid;

  return {
    isValid: totalInvalid < rawSamples.length + rawBatches.length + rawCategories.length + rawStaining.length + rawTemplates.length,
    version,
    isOldVersion,
    migrationNote,
    summary,
    details: {
      samples: sampleDetails,
      batches: batchDetails,
      sampleCategories: categoryDetails,
      stainingMethods: stainingDetails,
      templates: templateDetails
    }
  };
};

const generateNewId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
};

export const executeImport = async (
  previewResult: ImportPreviewResult,
  options: ImportOptions
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: true,
    importedCounts: {
      samples: 0,
      batches: 0,
      sampleCategories: 0,
      stainingMethods: 0,
      templates: 0
    },
    skippedCounts: {
      samples: 0,
      batches: 0,
      sampleCategories: 0,
      stainingMethods: 0,
      templates: 0
    },
    errors: []
  };

  try {
    await observationDb.init();

    const processImportItems = <T extends { id: string }>(
      details: ImportItemDetail<T>[],
      enabled: boolean,
      typeKey: keyof ImportResult["importedCounts"],
      resolveFn: (items: T[]) => Promise<void>
    ) => {
      if (!enabled) {
        result.skippedCounts[typeKey] = details.length;
        return;
      }

      const itemsToImport: T[] = [];

      details.forEach(detail => {
        if (detail.status === "invalid") {
          result.skippedCounts[typeKey]++;
          return;
        }

        if (detail.status === "conflict") {
          if (options.resolveConflicts === "skip") {
            result.skippedCounts[typeKey]++;
            return;
          }
          if (options.resolveConflicts === "keepBoth") {
            const prefix = typeKey === "samples" ? "sample" :
                          typeKey === "batches" ? "batch" :
                          typeKey === "sampleCategories" ? "cat" :
                          typeKey === "stainingMethods" ? "stain" : "template";
            const newItem = { ...detail.item, id: generateNewId(prefix) };
            itemsToImport.push(newItem);
            result.importedCounts[typeKey]++;
            return;
          }
        }

        itemsToImport.push(detail.item);
        result.importedCounts[typeKey]++;
      });

      return resolveFn(itemsToImport);
    };

    await processImportItems(
      previewResult.details.samples,
      options.importSamples,
      "samples",
      async (items) => {
        if (items.length > 0) {
          await observationDb.saveSamples(items as Sample[]);
        }
      }
    );

    await processImportItems(
      previewResult.details.batches,
      options.importBatches,
      "batches",
      async (items) => {
        if (items.length > 0) {
          await observationDb.saveBatches(items as ObservationBatch[]);
        }
      }
    );

    await processImportItems(
      previewResult.details.sampleCategories,
      options.importCategories,
      "sampleCategories",
      async (items) => {
        if (items.length > 0) {
          const existing = getStoredCategories();
          const importIds = new Set(items.map(i => i.id));
          const merged = [
            ...existing.filter(c => !importIds.has(c.id)),
            ...items as SampleCategory[]
          ];
          window.localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(merged));
        }
      }
    );

    await processImportItems(
      previewResult.details.stainingMethods,
      options.importStainingMethods,
      "stainingMethods",
      async (items) => {
        if (items.length > 0) {
          const existing = getStoredStainingMethods();
          const importIds = new Set(items.map(i => i.id));
          const merged = [
            ...existing.filter(s => !importIds.has(s.id)),
            ...items as StainingMethod[]
          ];
          window.localStorage.setItem(STORAGE_KEY_STAINING, JSON.stringify(merged));
        }
      }
    );

    await processImportItems(
      previewResult.details.templates,
      options.importTemplates,
      "templates",
      async (items) => {
        if (items.length > 0) {
          const existing = getStoredTemplates();
          const importIds = new Set(items.map(i => i.id));
          const merged = [
            ...existing.filter(t => !importIds.has(t.id)),
            ...items as ObservationTemplate[]
          ];
          window.localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(merged));
        }
      }
    );
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : "导入失败");
  }

  return result;
};
