import { useState, useEffect, useCallback } from "react";
import type { ObservationTemplate } from "../types";
import { defaultObservationTemplates } from "../db";

const STORAGE_KEY_TEMPLATES = "microscope_admin_templates";

const safeParseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

interface UseObservationTemplatesReturn {
  templates: ObservationTemplate[];
  isTemplatesLoaded: boolean;
  addTemplate: (template: Omit<ObservationTemplate, "id">) => ObservationTemplate | null;
  updateTemplate: (id: string, template: Partial<Omit<ObservationTemplate, "id">>) => boolean;
  deleteTemplate: (id: string) => void;
  resetTemplatesToDefaults: () => void;
  isTemplateNameDuplicate: (name: string, excludeId?: string) => boolean;
}

export function useObservationTemplates(): UseObservationTemplatesReturn {
  const [templates, setTemplates] = useState<ObservationTemplate[]>(defaultObservationTemplates);
  const [isTemplatesLoaded, setIsTemplatesLoaded] = useState(false);

  const persistTemplates = useCallback((templateList: ObservationTemplate[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templateList));
    } catch (e) {
      console.warn("保存模板配置失败：", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      setIsTemplatesLoaded(true);
      return;
    }

    try {
      const savedTemplates = safeParseJSON<ObservationTemplate[]>(
        window.localStorage.getItem(STORAGE_KEY_TEMPLATES),
        []
      );

      if (savedTemplates && savedTemplates.length > 0) {
        setTemplates(savedTemplates);
      } else {
        persistTemplates(defaultObservationTemplates);
      }
    } catch (e) {
      console.warn("读取本地模板配置失败，使用默认值：", e);
    } finally {
      setIsTemplatesLoaded(true);
    }
  }, [persistTemplates]);

  const isTemplateNameDuplicate = useCallback((name: string, excludeId?: string): boolean => {
    return templates.some(t => t.name === name && t.id !== excludeId);
  }, [templates]);

  const addTemplate = useCallback((template: Omit<ObservationTemplate, "id">): ObservationTemplate | null => {
    if (templates.some(t => t.name === template.name)) return null;
    const newTemplate: ObservationTemplate = {
      ...template,
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    };
    setTemplates(prev => {
      const next = [...prev, newTemplate];
      persistTemplates(next);
      return next;
    });
    return newTemplate;
  }, [persistTemplates, templates]);

  const updateTemplate = useCallback((id: string, template: Partial<Omit<ObservationTemplate, "id">>): boolean => {
    if (template.name && templates.some(t => t.name === template.name && t.id !== id)) return false;
    setTemplates(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...template } : t));
      persistTemplates(next);
      return next;
    });
    return true;
  }, [persistTemplates, templates]);

  const deleteTemplate = useCallback((id: string): void => {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== id);
      persistTemplates(next);
      return next;
    });
  }, [persistTemplates]);

  const resetTemplatesToDefaults = useCallback((): void => {
    setTemplates(defaultObservationTemplates);
    try {
      window.localStorage.removeItem(STORAGE_KEY_TEMPLATES);
    } catch (e) {
      console.warn("重置模板配置失败：", e);
    }
  }, []);

  return {
    templates,
    isTemplatesLoaded,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetTemplatesToDefaults,
    isTemplateNameDuplicate
  };
}
