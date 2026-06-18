import { useState, useMemo, useCallback } from "react";
import type {
  Sample,
  WorkbenchView,
  MagnificationFormData,
  Role,
  User
} from "../types";
import {
  canModifySample,
  canModifyMagnification,
  getPermissionDeniedMessage
} from "../utils/permissions";

interface UseViewNavigationParams {
  samples: Sample[];
  currentRole: Role;
  currentUser: User | null;
  addMagnification: (sampleId: string, data: MagnificationFormData) => void;
  updateMagnification: (
    sampleId: string,
    magId: string,
    data: MagnificationFormData
  ) => void;
  deleteMagnification: (sampleId: string, magId: string) => void;
}

interface UseViewNavigationReturn {
  currentView: WorkbenchView;
  setCurrentView: React.Dispatch<React.SetStateAction<WorkbenchView>>;
  selectedSampleId: string | null;
  setSelectedSampleId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedSample: Sample | null;
  handleSampleClick: (sample: Sample) => void;
  handleBackToList: () => void;
  handleAddMagnification: (sampleId: string, data: MagnificationFormData) => void;
  handleUpdateMagnification: (
    sampleId: string,
    magId: string,
    data: MagnificationFormData
  ) => void;
  handleDeleteMagnification: (sampleId: string, magId: string) => void;
  resetViewNavigation: () => void;
}

export function useViewNavigation({
  samples,
  currentRole,
  currentUser,
  addMagnification,
  updateMagnification,
  deleteMagnification
}: UseViewNavigationParams): UseViewNavigationReturn {
  const [currentView, setCurrentView] = useState<WorkbenchView>("list");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  const selectedSample = useMemo<Sample | null>(
    () => samples.find(sample => sample.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  const handleSampleClick = useCallback(
    (sample: Sample) => {
      if (currentRole === "student" && sample.studentId !== currentUser?.id) {
        alert(getPermissionDeniedMessage("查看其他学生的样本详情"));
        return;
      }
      setSelectedSampleId(sample.id);
      setCurrentView("detail");
    },
    [currentRole, currentUser]
  );

  const handleBackToList = useCallback(() => {
    setCurrentView("list");
    setSelectedSampleId(null);
  }, []);

  const handleAddMagnification = useCallback(
    (sampleId: string, data: MagnificationFormData) => {
      if (!currentUser) return;
      const sample = samples.find(s => s.id === sampleId);
      if (!sample || !canModifySample(currentRole, currentUser.id, sample)) {
        alert(getPermissionDeniedMessage("添加视野记录"));
        return;
      }
      addMagnification(sampleId, data);
    },
    [currentUser, samples, currentRole, addMagnification]
  );

  const handleUpdateMagnification = useCallback(
    (sampleId: string, magId: string, data: MagnificationFormData) => {
      if (!currentUser) return;
      const sample = samples.find(s => s.id === sampleId);
      if (!sample) return;
      const record = sample.magnifications.find(r => r.id === magId);
      if (!record || !canModifyMagnification(currentRole, currentUser.id, sample, record)) {
        alert(getPermissionDeniedMessage("编辑视野记录"));
        return;
      }
      updateMagnification(sampleId, magId, data);
    },
    [currentUser, samples, currentRole, updateMagnification]
  );

  const handleDeleteMagnification = useCallback(
    (sampleId: string, magId: string) => {
      if (!currentUser) return;
      const sample = samples.find(s => s.id === sampleId);
      if (!sample) return;
      const record = sample.magnifications.find(r => r.id === magId);
      if (!record || !canModifyMagnification(currentRole, currentUser.id, sample, record)) {
        alert(getPermissionDeniedMessage("删除视野记录"));
        return;
      }
      deleteMagnification(sampleId, magId);
    },
    [currentUser, samples, currentRole, deleteMagnification]
  );

  const resetViewNavigation = useCallback(() => {
    setCurrentView("list");
    setSelectedSampleId(null);
  }, []);

  return {
    currentView,
    setCurrentView,
    selectedSampleId,
    setSelectedSampleId,
    selectedSample,
    handleSampleClick,
    handleBackToList,
    handleAddMagnification,
    handleUpdateMagnification,
    handleDeleteMagnification,
    resetViewNavigation
  };
}
