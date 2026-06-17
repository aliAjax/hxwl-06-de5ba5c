import React from "react";
import type { QualityCheckResult, QualityOverallStatus } from "../types";

interface QualityCheckPanelProps {
  result: QualityCheckResult;
  title?: string;
}

const statusConfig: Record<
  QualityOverallStatus,
  { label: string; class: string; icon: string }
> = {
  pass: { label: "✓ 质量达标", class: "quality-pass", icon: "✅" },
  warning: { label: "⚠ 有改进空间", class: "quality-warning", icon: "⚠️" },
  error: { label: "✗ 存在严重问题", class: "quality-error", icon: "❌" }
};

export function QualityCheckPanel({
  result,
  title = "观察质量检查"
}: QualityCheckPanelProps) {
  const errors = result.issues.filter(i => i.level === "error");
  const warnings = result.issues.filter(i => i.level === "warning");
  const config = statusConfig[result.overallStatus];

  return (
    <div className={`quality-check-panel ${config.class}`}>
      <div className="quality-check-header">
        <div className="quality-status-icon">{config.icon}</div>
        <div>
          <h4>{title}</h4>
          <p className={`quality-status-text ${config.class}-text`}>
            {config.label}
          </p>
        </div>
        <div className="quality-counts">
          {errors.length > 0 && (
            <span className="quality-count error-count">严重 {errors.length}</span>
          )}
          {warnings.length > 0 && (
            <span className="quality-count warning-count">提醒 {warnings.length}</span>
          )}
        </div>
      </div>

      {result.issues.length > 0 && (
        <ul className="quality-issue-list">
          {errors.map((issue, idx) => (
            <li key={`err-${idx}`} className="quality-issue error-issue">
              <span className="issue-level-badge error-badge">严重</span>
              <div className="issue-content">
                <p className="issue-message">{issue.message}</p>
                {issue.suggestion && (
                  <p className="issue-suggestion">💡 {issue.suggestion}</p>
                )}
              </div>
            </li>
          ))}
          {warnings.map((issue, idx) => (
            <li key={`warn-${idx}`} className="quality-issue warning-issue">
              <span className="issue-level-badge warning-badge">提醒</span>
              <div className="issue-content">
                <p className="issue-message">{issue.message}</p>
                {issue.suggestion && (
                  <p className="issue-suggestion">💡 {issue.suggestion}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
