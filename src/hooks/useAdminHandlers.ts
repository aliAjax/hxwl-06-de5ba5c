import { useCallback } from "react";
import type { Role, SampleCategory, StainingMethod, ObservationTemplate } from "../types";
import {
  canManageConfig,
  getPermissionDeniedMessage
} from "../utils/permissions";

interface UseAdminHandlersParams {
  currentRole: Role;
  addCategory: (name: string) => SampleCategory | null;
  updateCategory: (id: string, name: string) => boolean;
  deleteCategory: (id: string) => void;
  addStainingMethod: (name: string) => StainingMethod | null;
  updateStainingMethod: (id: string, name: string) => boolean;
  deleteStainingMethod: (id: string) => void;
  addTemplate: (template: Omit<ObservationTemplate, "id">) => ObservationTemplate | null;
  updateTemplate: (
    id: string,
    template: Partial<Omit<ObservationTemplate, "id">>
  ) => boolean;
  deleteTemplate: (id: string) => void;
  bulkUpdateSampleType: (oldName: string, newName: string) => number;
  bulkUpdateStainingMethod: (oldName: string, newName: string) => number;
}

interface UseAdminHandlersReturn {
  handleAddCategory: (name: string) => boolean;
  handleUpdateCategory: (id: string, name: string) => boolean;
  handleDeleteCategory: (id: string) => void;
  handleAddStainingMethod: (name: string) => boolean;
  handleUpdateStainingMethod: (id: string, name: string) => boolean;
  handleDeleteStainingMethod: (id: string) => void;
  handleAddTemplate: (t: Omit<ObservationTemplate, "id">) => boolean;
  handleUpdateTemplate: (
    id: string,
    t: Partial<Omit<ObservationTemplate, "id">>
  ) => boolean;
  handleDeleteTemplate: (id: string) => void;
  handleBulkUpdateSampleType: (oldName: string, newName: string) => number;
  handleBulkUpdateStainingMethod: (oldName: string, newName: string) => number;
}

export function useAdminHandlers({
  currentRole,
  addCategory,
  updateCategory,
  deleteCategory,
  addStainingMethod,
  updateStainingMethod,
  deleteStainingMethod,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  bulkUpdateSampleType,
  bulkUpdateStainingMethod
}: UseAdminHandlersParams): UseAdminHandlersReturn {
  const handleAddCategory = useCallback(
    (name: string): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("添加分类"));
        return false;
      }
      return addCategory(name) !== null;
    },
    [currentRole, addCategory]
  );

  const handleUpdateCategory = useCallback(
    (id: string, name: string): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("更新分类"));
        return false;
      }
      return updateCategory(id, name);
    },
    [currentRole, updateCategory]
  );

  const handleDeleteCategory = useCallback(
    (id: string) => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("删除分类"));
        return;
      }
      deleteCategory(id);
    },
    [currentRole, deleteCategory]
  );

  const handleAddStainingMethod = useCallback(
    (name: string): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("添加染色方式"));
        return false;
      }
      return addStainingMethod(name) !== null;
    },
    [currentRole, addStainingMethod]
  );

  const handleUpdateStainingMethod = useCallback(
    (id: string, name: string): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("更新染色方式"));
        return false;
      }
      return updateStainingMethod(id, name);
    },
    [currentRole, updateStainingMethod]
  );

  const handleDeleteStainingMethod = useCallback(
    (id: string) => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("删除染色方式"));
        return;
      }
      deleteStainingMethod(id);
    },
    [currentRole, deleteStainingMethod]
  );

  const handleAddTemplate = useCallback(
    (t: Omit<ObservationTemplate, "id">): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("添加模板"));
        return false;
      }
      return addTemplate(t) !== null;
    },
    [currentRole, addTemplate]
  );

  const handleUpdateTemplate = useCallback(
    (id: string, t: Partial<Omit<ObservationTemplate, "id">>): boolean => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("更新模板"));
        return false;
      }
      return updateTemplate(id, t);
    },
    [currentRole, updateTemplate]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("删除模板"));
        return;
      }
      deleteTemplate(id);
    },
    [currentRole, deleteTemplate]
  );

  const handleBulkUpdateSampleType = useCallback(
    (oldName: string, newName: string): number => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("批量更新样本类型"));
        return 0;
      }
      return bulkUpdateSampleType(oldName, newName);
    },
    [currentRole, bulkUpdateSampleType]
  );

  const handleBulkUpdateStainingMethod = useCallback(
    (oldName: string, newName: string): number => {
      if (!canManageConfig(currentRole)) {
        alert(getPermissionDeniedMessage("批量更新染色方式"));
        return 0;
      }
      return bulkUpdateStainingMethod(oldName, newName);
    },
    [currentRole, bulkUpdateStainingMethod]
  );

  return {
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleAddStainingMethod,
    handleUpdateStainingMethod,
    handleDeleteStainingMethod,
    handleAddTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleBulkUpdateSampleType,
    handleBulkUpdateStainingMethod
  };
}
