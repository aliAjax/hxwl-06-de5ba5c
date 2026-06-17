import React from "react";
import { STATUS_COLORS } from "../constants";

interface MetricCardProps {
  label: string;
  value: string;
  index: number;
}

export function MetricCard({ label, value, index }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={STATUS_COLORS[index % STATUS_COLORS.length]} />
    </article>
  );
}
