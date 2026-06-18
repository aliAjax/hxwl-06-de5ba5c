import { useState, useCallback } from "react";
import type { Role, Sample, ReportData } from "../types";
import {
  canExportReport,
  getPermissionDeniedMessage
} from "../utils/permissions";
import {
  generateObservationReport,
  generateReportPlainText,
  downloadTextFile
} from "../utils/reportGenerator";

interface UseReportDialogParams {
  currentRole: Role;
  samples: Sample[];
}

interface UseReportDialogReturn {
  reportDialogOpen: boolean;
  reportData: ReportData | null;
  reportPlainText: string;
  handleExportSummary: (filteredSamples?: Sample[]) => void;
  handleCloseReportDialog: () => void;
  handleDownloadReport: () => void;
}

export function useReportDialog({
  currentRole,
  samples
}: UseReportDialogParams): UseReportDialogReturn {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPlainText, setReportPlainText] = useState<string>("");

  const handleExportSummary = useCallback(
    (filteredSamples?: Sample[]) => {
      if (!canExportReport(currentRole)) {
        alert(getPermissionDeniedMessage("导出报告"));
        return;
      }
      const targetSamples = filteredSamples ?? samples;
      if (targetSamples.length === 0) {
        alert("暂无任何样本数据，无法生成报告。请先添加观察记录。");
        return;
      }
      const generatedReport = generateObservationReport(targetSamples);
      const plainText = generateReportPlainText(generatedReport);
      setReportData(generatedReport);
      setReportPlainText(plainText);
      setReportDialogOpen(true);
    },
    [currentRole, samples]
  );

  const handleCloseReportDialog = useCallback(() => {
    setReportDialogOpen(false);
  }, []);

  const handleDownloadReport = useCallback(() => {
    if (!canExportReport(currentRole)) {
      alert(getPermissionDeniedMessage("下载报告"));
      return;
    }
    if (!reportData || reportData.totalSamples === 0) {
      alert("暂无任何样本数据，无法下载报告。请先添加观察记录。");
      return;
    }
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `显微镜观察实验报告_${dateStr}_${timeStr}.txt`;
    downloadTextFile(reportPlainText, filename);
  }, [currentRole, reportData, reportPlainText]);

  return {
    reportDialogOpen,
    reportData,
    reportPlainText,
    handleExportSummary,
    handleCloseReportDialog,
    handleDownloadReport
  };
}
