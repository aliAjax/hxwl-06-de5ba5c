import { useState, useCallback } from "react";
import type { SampleCategory, StainingMethod } from "../types";
import {
  defaultSampleCategories,
  defaultStainingMethods
} from "../db";

const STORAGE_KEY_CATEGORIES = "microscope_admin_categories";
const STORAGE_KEY_STAINING = "microscope_admin_staining";

const safeParseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

interface UseAdminConfigReturn {
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  isConfigLoaded: boolean;
  addCategory: (name: string) => SampleCategory | null;
  updateCategory: (id: string, name: string) => boolean;
  deleteCategory: (id: string) => void;
  addStainingMethod: (name: string) => StainingMethod | null;
  updateStainingMethod: (id: string, name: string) => boolean;
  deleteStainingMethod: (id: string) => void;
  resetToDefaults: () => void;
  isCategoryNameDuplicate: (name: string, excludeId?: string) => boolean;
  isStainingNameDuplicate: (name: string, excludeId?: string) => boolean;
  refreshConfig: () => void;
}

export function useAdminConfig(): UseAdminConfigReturn {
  const [sampleCategories, setSampleCategories] = useState<SampleCategory[]>(() => {
    if (typeof window === "undefined" || !window.localStorage) return defaultSampleCategories;
    const raw = window.localStorage.getItem(STORAGE_KEY_CATEGORIES);
    return raw ? safeParseJSON<SampleCategory[]>(raw, defaultSampleCategories) : defaultSampleCategories;
  });
  const [stainingMethods, setStainingMethods] = useState<StainingMethod[]>(() => {
    if (typeof window === "undefined" || !window.localStorage) return defaultStainingMethods;
    const raw = window.localStorage.getItem(STORAGE_KEY_STAINING);
    return raw ? safeParseJSON<StainingMethod[]>(raw, defaultStainingMethods) : defaultStainingMethods;
  });
  const [isConfigLoaded] = useState(true);

  const persistCategories = useCallback((categories: SampleCategory[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn("保存分类配置失败：", e);
    }
  }, []);

  const persistStaining = useCallback((methods: StainingMethod[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY_STAINING, JSON.stringify(methods));
    } catch (e) {
      console.warn("保存染色配置失败：", e);
    }
  }, []);

  const isCategoryNameDuplicate = useCallback((name: string, excludeId?: string): boolean => {
    return sampleCategories.some(c => c.name === name && c.id !== excludeId);
  }, [sampleCategories]);

  const isStainingNameDuplicate = useCallback((name: string, excludeId?: string): boolean => {
    return stainingMethods.some(s => s.name === name && s.id !== excludeId);
  }, [stainingMethods]);

  const addCategory = useCallback((name: string): SampleCategory | null => {
    if (sampleCategories.some(c => c.name === name)) return null;
    const newCategory: SampleCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name
    };
    setSampleCategories(prev => {
      const next = [...prev, newCategory];
      persistCategories(next);
      return next;
    });
    return newCategory;
  }, [persistCategories, sampleCategories]);

  const updateCategory = useCallback((id: string, name: string): boolean => {
    if (sampleCategories.some(c => c.name === name && c.id !== id)) return false;
    setSampleCategories(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, name } : c));
      persistCategories(next);
      return next;
    });
    return true;
  }, [persistCategories, sampleCategories]);

  const deleteCategory = useCallback((id: string): void => {
    setSampleCategories(prev => {
      const next = prev.filter(c => c.id !== id);
      persistCategories(next);
      return next;
    });
  }, [persistCategories]);

  const addStainingMethod = useCallback((name: string): StainingMethod | null => {
    if (stainingMethods.some(s => s.name === name)) return null;
    const newMethod: StainingMethod = {
      id: `stain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name
    };
    setStainingMethods(prev => {
      const next = [...prev, newMethod];
      persistStaining(next);
      return next;
    });
    return newMethod;
  }, [persistStaining, stainingMethods]);

  const updateStainingMethod = useCallback((id: string, name: string): boolean => {
    if (stainingMethods.some(s => s.name === name && s.id !== id)) return false;
    setStainingMethods(prev => {
      const next = prev.map(s => (s.id === id ? { ...s, name } : s));
      persistStaining(next);
      return next;
    });
    return true;
  }, [persistStaining, stainingMethods]);

  const deleteStainingMethod = useCallback((id: string): void => {
    setStainingMethods(prev => {
      const next = prev.filter(s => s.id !== id);
      persistStaining(next);
      return next;
    });
  }, [persistStaining]);

  const resetToDefaults = useCallback((): void => {
    setSampleCategories(defaultSampleCategories);
    setStainingMethods(defaultStainingMethods);
    try {
      window.localStorage.removeItem(STORAGE_KEY_CATEGORIES);
      window.localStorage.removeItem(STORAGE_KEY_STAINING);
    } catch (e) {
      console.warn("重置配置失败：", e);
    }
  }, []);

  const refreshConfig = useCallback((): void => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const rawCategories = window.localStorage.getItem(STORAGE_KEY_CATEGORIES);
      const rawStaining = window.localStorage.getItem(STORAGE_KEY_STAINING);

      if (rawCategories === null) {
        setSampleCategories(defaultSampleCategories);
      } else {
        const savedCategories = safeParseJSON<SampleCategory[]>(rawCategories, []);
        setSampleCategories(savedCategories);
      }

      if (rawStaining === null) {
        setStainingMethods(defaultStainingMethods);
      } else {
        const savedStaining = safeParseJSON<StainingMethod[]>(rawStaining, []);
        setStainingMethods(savedStaining);
      }
    } catch (e) {
      console.warn("刷新配置失败：", e);
    }
  }, []);

  return {
    sampleCategories,
    stainingMethods,
    isConfigLoaded,
    addCategory,
    updateCategory,
    deleteCategory,
    addStainingMethod,
    updateStainingMethod,
    deleteStainingMethod,
    resetToDefaults,
    isCategoryNameDuplicate,
    isStainingNameDuplicate,
    refreshConfig
  };
}
