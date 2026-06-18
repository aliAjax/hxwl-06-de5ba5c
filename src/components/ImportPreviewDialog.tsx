import React, { useState } from "react";
import type {
  ImportPreviewResult,
  ImportOptions,
  ImportItemDetail,
  Sample,
  ObservationBatch,
  SampleCategory,
  StainingMethod,
  ObservationTemplate
} from "../types";

interface ImportPreviewDialogProps {
  isOpen: boolean;
  previewResult: ImportPreviewResult | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: (options: ImportOptions) => void;
}

const typeLabels: Record<string, string> = {
  sample: "样本",
  batch: "批次",
  sampleCategory: "样本分类",
  stainingMethod: "染色方式",
  template: "观察模板"
};

const statusLabels: Record<string, string> = {
  new: "新增",
  overwrite: "覆盖",
  conflict: "冲突",
  invalid: "无效"
};

const statusColors: Record<string, string> = {
  new: "#059669",
  overwrite: "#0284c7",
  conflict: "#d97706",
  invalid: "#dc2626"
};

export function ImportPreviewDialog({
  isOpen,
  previewResult,
  isLoading,
  onCancel,
  onConfirm
}: ImportPreviewDialogProps) {
  const [resolveConflicts, setResolveConflicts] = useState<ImportOptions["resolveConflicts"]>("skip");
  const [importSamples, setImportSamples] = useState(true);
  const [importBatches, setImportBatches] = useState(true);
  const [importCategories, setImportCategories] = useState(true);
  const [importStainingMethods, setImportStainingMethods] = useState(true);
  const [importTemplates, setImportTemplates] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!isOpen || !previewResult) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getItemName = <T extends { id: string; name?: string; sampleName?: string }>(item: T): string => {
    if ("sampleName" in item && item.sampleName) return item.sampleName;
    if ("name" in item && item.name) return item.name;
    return item.id;
  };

  const renderDetailSection = <T extends { id: string; name?: string; sampleName?: string }>(
    title: string,
    sectionKey: string,
    details: ImportItemDetail<T>[],
    enabled: boolean,
    onToggle: (v: boolean) => void
  ) => {
    if (details.length === 0) return null;

    const isExpanded = expandedSection === sectionKey;
    const counts = {
      new: details.filter(d => d.status === "new").length,
      overwrite: details.filter(d => d.status === "overwrite").length,
      conflict: details.filter(d => d.status === "conflict").length,
      invalid: details.filter(d => d.status === "invalid").length
    };

    return (
      <div className="import-detail-section">
        <div className="import-detail-header" onClick={() => toggleSection(sectionKey)}>
          <div className="import-detail-title">
            <label className="import-checkbox">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{title}</span>
            </label>
            <div className="import-detail-counts">
              {counts.new > 0 && (
                <span className="import-count-badge" style={{ background: statusColors.new }}>
                  新增 {counts.new}
                </span>
              )}
              {counts.overwrite > 0 && (
                <span className="import-count-badge" style={{ background: statusColors.overwrite }}>
                  覆盖 {counts.overwrite}
                </span>
              )}
              {counts.conflict > 0 && (
                <span className="import-count-badge" style={{ background: statusColors.conflict }}>
                  冲突 {counts.conflict}
                </span>
              )}
              {counts.invalid > 0 && (
                <span className="import-count-badge" style={{ background: statusColors.invalid }}>
                  无效 {counts.invalid}
                </span>
              )}
            </div>
            <span className="import-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="import-detail-list">
            {details.map((detail, index) => (
              <div key={index} className={`import-detail-item status-${detail.status}`}>
                <div className="import-item-main">
                  <span
                    className="import-status-badge"
                    style={{ background: statusColors[detail.status] }}
                  >
                    {statusLabels[detail.status]}
                  </span>
                  <span className="import-item-name">{getItemName(detail.item)}</span>
                  <span className="import-item-id">ID: {detail.item.id}</span>
                </div>
                {detail.status === "conflict" && detail.conflictFields && detail.conflictFields.length > 0 && (
                  <div className="import-conflict-fields">
                    冲突字段: {detail.conflictFields.join(", ")}
                  </div>
                )}
                {detail.status === "invalid" && detail.invalidReasons && detail.invalidReasons.length > 0 && (
                  <div className="import-invalid-reasons">
                    {detail.invalidReasons.map((reason, i) => (
                      <span key={i}>⚠ {reason}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleConfirm = () => {
    onConfirm({
      resolveConflicts,
      importSamples,
      importBatches,
      importCategories,
      importStainingMethods,
      importTemplates
    });
  };

  const hasConflicts = previewResult.summary.some(s => s.status === "conflict" && s.count > 0);
  const hasInvalid = previewResult.summary.some(s => s.status === "invalid" && s.count > 0);

  return (
    <div className="import-dialog-overlay" onClick={onCancel}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-dialog-header">
          <div className="import-dialog-title-wrap">
            <span className="import-dialog-icon">📥</span>
            <div>
              <h3>导入数据预览</h3>
              <p className="import-dialog-subtitle">
                数据版本: v{previewResult.version}
                {previewResult.isOldVersion && (
                  <span className="import-version-warning"> (旧版本，已尝试迁移)</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="import-close-btn"
            onClick={onCancel}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {previewResult.migrationNote && (
          <div className="import-migration-note">
            ℹ️ {previewResult.migrationNote}
          </div>
        )}

        {!previewResult.isValid && (
          <div className="import-error-alert">
            ❌ 数据文件格式不正确或不属于本项目，无法导入
          </div>
        )}

        {previewResult.isValid && (
          <>
            <div className="import-summary-section">
              <h4>📊 数据摘要</h4>
              <div className="import-summary-grid">
                {previewResult.summary.map((item, index) => (
                  <div key={index} className="import-summary-card" style={{ borderColor: statusColors[item.status] }}>
                    <div className="import-summary-type">{typeLabels[item.type]}</div>
                    <div
                      className="import-summary-count"
                      style={{ color: statusColors[item.status] }}
                    >
                      {statusLabels[item.status]}: {item.count}
                    </div>
                  </div>
                ))}
                {previewResult.summary.length === 0 && (
                  <div className="import-empty-summary">当前文件中没有可导入的数据</div>
                )}
              </div>
            </div>

            {hasConflicts && (
              <div className="import-conflict-resolution">
                <h4>⚔️ 冲突处理方式</h4>
                <div className="import-conflict-options">
                  <label className="import-radio">
                    <input
                      type="radio"
                      name="resolveConflicts"
                      value="skip"
                      checked={resolveConflicts === "skip"}
                      onChange={(e) => setResolveConflicts(e.target.value as ImportOptions["resolveConflicts"])}
                    />
                    <span>跳过冲突项</span>
                  </label>
                  <label className="import-radio">
                    <input
                      type="radio"
                      name="resolveConflicts"
                      value="overwrite"
                      checked={resolveConflicts === "overwrite"}
                      onChange={(e) => setResolveConflicts(e.target.value as ImportOptions["resolveConflicts"])}
                    />
                    <span>覆盖现有数据</span>
                  </label>
                  <label className="import-radio">
                    <input
                      type="radio"
                      name="resolveConflicts"
                      value="keepBoth"
                      checked={resolveConflicts === "keepBoth"}
                      onChange={(e) => setResolveConflicts(e.target.value as ImportOptions["resolveConflicts"])}
                    />
                    <span>保留两者（自动生成新ID）</span>
                  </label>
                </div>
              </div>
            )}

            <div className="import-details-section">
              <h4>📋 详细列表</h4>
              {renderDetailSection(
                "样本数据",
                "samples",
                previewResult.details.samples as ImportItemDetail<Sample>[],
                importSamples,
                setImportSamples
              )}
              {renderDetailSection(
                "批次数据",
                "batches",
                previewResult.details.batches as ImportItemDetail<ObservationBatch>[],
                importBatches,
                setImportBatches
              )}
              {renderDetailSection(
                "样本分类",
                "categories",
                previewResult.details.sampleCategories as ImportItemDetail<SampleCategory>[],
                importCategories,
                setImportCategories
              )}
              {renderDetailSection(
                "染色方式",
                "staining",
                previewResult.details.stainingMethods as ImportItemDetail<StainingMethod>[],
                importStainingMethods,
                setImportStainingMethods
              )}
              {renderDetailSection(
                "观察模板",
                "templates",
                previewResult.details.templates as ImportItemDetail<ObservationTemplate>[],
                importTemplates,
                setImportTemplates
              )}
            </div>
          </>
        )}

        <div className="import-dialog-footer">
          <button type="button" onClick={onCancel} disabled={isLoading}>
            取消
          </button>
          <button
            type="button"
            className="primary-action import-confirm-btn"
            onClick={handleConfirm}
            disabled={!previewResult.isValid || isLoading || previewResult.summary.length === 0}
          >
            {isLoading ? "导入中..." : "✅ 确认导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
