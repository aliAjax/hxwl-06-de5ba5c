import React from "react";
import type { QualityOverallStatus } from "../types";

interface QualityBadgeProps {
  status: QualityOverallStatus;
}

const badgeConfig: Record<
  QualityOverallStatus,
  { label: string; class: string }
> = {
  pass: { label: "质量达标", class: "quality-badge-pass" },
  warning: { label: "待改进", class: "quality-badge-warning" },
  error: { label: "质量问题", class: "quality-badge-error" }
};

export function QualityBadge({ status }: QualityBadgeProps) {
  const config = badgeConfig[status];
  return <span className={`quality-badge ${config.class}`}>{config.label}</span>;
}
