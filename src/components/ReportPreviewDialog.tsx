import React, { useState, useRef } from "react";
import type { ReportData } from "../types";

interface ReportPreviewDialogProps {
  isOpen: boolean;
  reportText: string;
  reportData: ReportData | null;
  onClose: () => void;
  onDownload: () => void;
}

export function ReportPreviewDialog({
  isOpen,
  reportText,
  reportData,
  onClose,
  onDownload
}: ReportPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!isOpen) return null;

  const hasData = reportData && reportData.totalSamples > 0;

  return (
    <div className="report-dialog-overlay" onClick={onClose}>
      <div className="report-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-dialog-header">
          <div className="report-dialog-title-wrap">
            <span className="report-dialog-icon">📋</span>
            <div>
              <h3>实验观察报告预览</h3>
              <p className="report-dialog-subtitle">
                {reportData && (
                  <>共 {reportData.totalSamples} 个样本 · {reportData.totalRecords} 条视野记录 · {reportData.sampleTypeReports.length} 个分类</>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="report-close-btn"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {reportData && reportData.sampleTypeReports.length > 0 && (
          <div className="report-summary-cards">
            {reportData.sampleTypeReports.map((typeReport) => (
              <div key={typeReport.sampleType} className="report-summary-card">
                <div className="report-summary-header">
                  <strong>{typeReport.sampleType}</strong>
                  <span className="report-summary-count">{typeReport.sampleCount} 个</span>
                </div>
                <div className="report-summary-detail">
                  <span className="report-summary-label">染色:</span>
                  <span className="report-summary-value">
                    {typeReport.stainingMethods.length > 0
                      ? typeReport.stainingMethods.join("、")
                      : "无"}
                  </span>
                </div>
                <div className="report-summary-detail">
                  <span className="report-summary-label">倍率:</span>
                  <span className="report-summary-value">
                    {typeReport.magnificationSummaries.length > 0
                      ? typeReport.magnificationSummaries.map(m => m.magnification).join(" ")
                      : "无"}
                  </span>
                </div>
                {typeReport.missingItems.length > 0 && (
                  <div className="report-summary-warnings">
                    ⚠ {typeReport.missingItems.length} 项异常
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="report-preview-area">
          <div className="report-preview-toolbar">
            <span className="report-preview-title">📝 纯文本报告内容</span>
            <div className="report-preview-stats">
              {reportText.length} 字符
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="report-textarea"
            readOnly
            value={reportText}
            spellCheck={false}
          />
        </div>

        <div className="report-dialog-footer">
          <button type="button" onClick={onClose}>
            关闭预览
          </button>
          <button
            type="button"
            className={`copy-action ${copied ? "copied" : ""} ${!hasData ? "disabled" : ""}`}
            onClick={handleCopy}
            disabled={!hasData}
          >
            {!hasData ? "⚠ 无内容可复制" : copied ? "✓ 已复制到剪贴板" : "📋 复制全部内容"}
          </button>
          <button
            type="button"
            className={`primary-action download-action ${!hasData ? "disabled" : ""}`}
            disabled={!hasData}
            onClick={() => {
              if (!hasData) return;
              onDownload();
            }}
          >
            {hasData ? "💾 下载 TXT 文件" : "⚠ 暂无数据可下载"}
          </button>
        </div>
      </div>
    </div>
  );
}
