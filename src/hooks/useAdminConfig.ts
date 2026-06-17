import { useState, useEffect, useCallback } from "react";
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
}

export function useAdminConfig(): UseAdminConfigReturn {
  const [sampleCategories, setSampleCategories] = useState<SampleCategory[]>(defaultSampleCategories);
  const [stainingMethods, setStainingMethods] = useState<StainingMethod[]>(defaultStainingMethods);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      setIsConfigLoaded(true);
      return;
    }

    try {
      const savedCategories = safeParseJSON<SampleCategory[]>(
        window.localStorage.getItem(STORAGE_KEY_CATEGORIES),
        defaultSampleCategories
      );
      const savedStaining = safeParseJSON<StainingMethod[]>(
        window.localStorage.getItem(STORAGE_KEY_STAINING),
        defaultStainingMethods
      );

      if (savedCategories && savedCategories.length > 0) {
        setSampleCategories(savedCategories);
      }
      if (savedStaining && savedStaining.length > 0) {
        setStainingMethods(savedStaining);
      }
    } catch (e) {
      console.warn("读取本地配置失败，使用默认值：", e);
    } finally {
      setIsConfigLoaded(true);
    }
  }, []);

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
    isStainingNameDuplicate
  };
}
