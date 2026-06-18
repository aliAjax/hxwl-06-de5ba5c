import React, { useState, useRef } from "react";
import {
  exportAllData,
  downloadExportFile,
  previewImportData,
  executeImport
} from "../utils/dataImportExport";
import type { ImportPreviewResult, ImportOptions, ImportResult, Role } from "../types";
import { canImportExport } from "../utils/permissions";
import { ImportPreviewDialog } from "./ImportPreviewDialog";

interface DataImportExportPanelProps {
  currentRole: Role;
  onDataImported: () => void;
}

export function DataImportExportPanel({ currentRole, onDataImported }: DataImportExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!canImportExport(currentRole)) {
    return null;
  }

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const jsonData = await exportAllData();
      downloadExportFile(jsonData);
    } catch (error) {
      console.error("导出失败:", error);
      alert("导出失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const content = await file.text();
      const result = await previewImportData(content);
      setPreviewResult(result);
      setShowPreview(true);
    } catch (error) {
      console.error("文件读取失败:", error);
      alert("文件读取失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportConfirm = async (options: ImportOptions) => {
    if (!previewResult) return;

    setIsImporting(true);
    try {
      const result = await executeImport(previewResult, options);
      setImportResult(result);
      setShowResult(true);
      setShowPreview(false);

      if (result.success) {
        onDataImported();
      }
    } catch (error) {
      console.error("导入失败:", error);
      alert("导入失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewResult(null);
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setImportResult(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const formatResultMessage = (result: ImportResult): string => {
    if (!result.success) {
      return `❌ 导入失败：${result.errors.join("；")}`;
    }

    const imported = result.importedCounts;
    const skipped = result.skippedCounts;
    const totalImported =
      imported.samples +
      imported.batches +
      imported.sampleCategories +
      imported.stainingMethods +
      imported.templates;
    const totalSkipped =
      skipped.samples +
      skipped.batches +
      skipped.sampleCategories +
      skipped.stainingMethods +
      skipped.templates;

    const parts: string[] = [];
    if (totalImported > 0) {
      parts.push(`✅ 成功导入 ${totalImported} 项`);
    }
    if (totalSkipped > 0) {
      parts.push(`⏭️ 跳过 ${totalSkipped} 项`);
    }
    if (imported.samples > 0) parts.push(`样本: ${imported.samples}`);
    if (imported.batches > 0) parts.push(`批次: ${imported.batches}`);
    if (imported.sampleCategories > 0) parts.push(`分类: ${imported.sampleCategories}`);
    if (imported.stainingMethods > 0) parts.push(`染色: ${imported.stainingMethods}`);
    if (imported.templates > 0) parts.push(`模板: ${imported.templates}`);

    return parts.join(" · ");
  };

  return (
    <div className="data-import-export-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div className="import-export-buttons">
        <button
          type="button"
          className="export-btn"
          onClick={handleExport}
          disabled={isExporting || isImporting}
        >
          {isExporting ? "导出中..." : "📤 导出全部数据"}
        </button>
        <button
          type="button"
          className="import-btn"
          onClick={triggerFileInput}
          disabled={isExporting || isImporting}
        >
          {isImporting ? "导入中..." : "📥 导入数据"}
        </button>
      </div>

      <ImportPreviewDialog
        isOpen={showPreview}
        previewResult={previewResult}
        isLoading={isImporting}
        onCancel={handleCancelPreview}
        onConfirm={handleImportConfirm}
      />

      {showResult && importResult && (
        <div className="import-result-overlay" onClick={handleCloseResult}>
          <div className="import-result-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="import-result-header">
              <span className="import-result-icon">
                {importResult.success ? "✅" : "❌"}
              </span>
              <h3>导入结果</h3>
            </div>
            <div className="import-result-message">
              {formatResultMessage(importResult)}
            </div>
            {importResult.errors.length > 0 && (
              <div className="import-result-errors">
                <h4>错误详情：</h4>
                <ul>
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="import-result-footer">
              <button
                type="button"
                className="primary-action"
                onClick={handleCloseResult}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
