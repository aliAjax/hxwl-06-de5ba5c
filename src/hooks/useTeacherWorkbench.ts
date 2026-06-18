import { useState, useCallback } from "react";
import type { Role, User, Sample, ObservationBatch } from "../types";
import {
  canReview,
  canManageBatches,
  getPermissionDeniedMessage
} from "../utils/permissions";

type TeacherSubView = "overview" | "batch";

interface UseTeacherWorkbenchParams {
  currentRole: Role;
  currentUser: User | null;
  toggleQualified: (
    sampleId: string,
    magId: string,
    qualified: boolean,
    reviewerName: string,
    unqualifiedReason?: string,
    revisionSuggestion?: string
  ) => void;
  createBatch: (
    name: string,
    description: string,
    userId: string,
    userName: string
  ) => void;
  closeBatch: (batchId: string) => void;
  reopenBatch: (batchId: string) => void;
  deleteBatch: (batchId: string) => void;
  addSampleToBatch: (batchId: string, sampleId: string) => void;
  removeSampleFromBatch: (batchId: string, sampleId: string) => void;
}

interface UseTeacherWorkbenchReturn {
  teacherSubView: TeacherSubView;
  setTeacherSubView: React.Dispatch<React.SetStateAction<TeacherSubView>>;
  handleToggleQualified: (
    sampleId: string,
    magId: string,
    qualified: boolean,
    unqualifiedReason?: string,
    revisionSuggestion?: string
  ) => void;
  handleCreateBatch: (
    name: string,
    description: string,
    userId: string,
    userName: string
  ) => void;
  handleCloseBatch: (batchId: string) => void;
  handleReopenBatch: (batchId: string) => void;
  handleDeleteBatch: (batchId: string) => void;
  handleAddSampleToBatch: (batchId: string, sampleId: string) => void;
  handleRemoveSampleFromBatch: (batchId: string, sampleId: string) => void;
  resetTeacherWorkbench: () => void;
}

export function useTeacherWorkbench({
  currentRole,
  currentUser,
  toggleQualified,
  createBatch,
  closeBatch,
  reopenBatch,
  deleteBatch,
  addSampleToBatch,
  removeSampleFromBatch
}: UseTeacherWorkbenchParams): UseTeacherWorkbenchReturn {
  const [teacherSubView, setTeacherSubView] = useState<TeacherSubView>("overview");

  const handleToggleQualified = useCallback(
    (
      sampleId: string,
      magId: string,
      qualified: boolean,
      unqualifiedReason?: string,
      revisionSuggestion?: string
    ) => {
      if (!currentUser) return;
      if (!canReview(currentRole)) {
        alert(getPermissionDeniedMessage("评阅"));
        return;
      }
      toggleQualified(
        sampleId,
        magId,
        qualified,
        currentUser.name,
        unqualifiedReason,
        revisionSuggestion
      );
    },
    [currentUser, currentRole, toggleQualified]
  );

  const handleCreateBatch = useCallback(
    (name: string, description: string, userId: string, userName: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("创建批次"));
        return;
      }
      createBatch(name, description, userId, userName);
    },
    [currentRole, createBatch]
  );

  const handleCloseBatch = useCallback(
    (batchId: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("截止批次"));
        return;
      }
      closeBatch(batchId);
    },
    [currentRole, closeBatch]
  );

  const handleReopenBatch = useCallback(
    (batchId: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("重新开启批次"));
        return;
      }
      reopenBatch(batchId);
    },
    [currentRole, reopenBatch]
  );

  const handleDeleteBatch = useCallback(
    (batchId: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("删除批次"));
        return;
      }
      deleteBatch(batchId);
    },
    [currentRole, deleteBatch]
  );

  const handleAddSampleToBatch = useCallback(
    (batchId: string, sampleId: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("添加样本到批次"));
        return;
      }
      addSampleToBatch(batchId, sampleId);
    },
    [currentRole, addSampleToBatch]
  );

  const handleRemoveSampleFromBatch = useCallback(
    (batchId: string, sampleId: string) => {
      if (!canManageBatches(currentRole)) {
        alert(getPermissionDeniedMessage("从批次移出样本"));
        return;
      }
      removeSampleFromBatch(batchId, sampleId);
    },
    [currentRole, removeSampleFromBatch]
  );

  const resetTeacherWorkbench = useCallback(() => {
    setTeacherSubView("overview");
  }, []);

  return {
    teacherSubView,
    setTeacherSubView,
    handleToggleQualified,
    handleCreateBatch,
    handleCloseBatch,
    handleReopenBatch,
    handleDeleteBatch,
    handleAddSampleToBatch,
    handleRemoveSampleFromBatch,
    resetTeacherWorkbench
  };
}
