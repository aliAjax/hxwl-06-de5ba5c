import React, { useState, useMemo } from "react";
import type { User, Sample, Role } from "../types";
import { canReview, canExportReport } from "../utils/permissions";
import { getSampleQualityOverview } from "../utils/qualityCheck";
import { MetricCard } from "./MetricCard";
import { QualityBadge } from "./QualityBadge";

interface TeacherWorkbenchProps {
  currentUser: User;
  currentRole: Role;
  samples: Sample[];
  users: User[];
  onSampleClick: (sample: Sample) => void;
  onToggleQualified: (sampleId: string, magId: string, qualified: boolean) => void;
  onExportSummary: (filteredSamples: Sample[]) => void;
}

export function TeacherWorkbench({
  currentUser,
  currentRole,
  samples,
  users,
  onSampleClick,
  onExportSummary
}: TeacherWorkbenchProps) {
  if (!canReview(currentRole)) {
    return (
      <div className="permission-notice">
        <span className="permission-notice-icon">🔒</span>
        <p>权限不足：仅教师可以访问此工作台</p>
      </div>
    );
  }
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");

  const students = users.filter(u => u.role === "student");

  const filteredSamples = useMemo(() => {
    if (selectedStudentId === "all") return samples;
    return samples.filter(s => s.studentId === selectedStudentId);
  }, [samples, selectedStudentId]);

  const classMetrics = useMemo(() => {
    const totalStudents = students.length;
    const totalSamples = samples.length;
    const totalFields = samples.reduce((sum, s) => sum + s.magnifications.length, 0);
    const qualifiedFields = samples.reduce(
      (sum, s) => sum + s.magnifications.filter(r => r.isQualified === true).length,
      0
    );
    return [
      String(totalStudents),
      String(totalSamples),
      String(totalFields),
      String(qualifiedFields)
    ];
  }, [samples, students]);

  const teacherMetricsLabels = ["全班学生", "样本总数", "视野记录", "已合格"];

  return (
    <>
      <section className="hero teacher-hero">
        <div>
          <p className="eyebrow">教师工作台</p>
          <h1>欢迎，{currentUser.name}</h1>
          <p className="subtitle">在这里你可以查看全班学生的观察记录并评阅重点结构</p>
        </div>
        <div className="stack-card">
          <span>当前身份</span>
          <strong>👨‍🏫 实验课教师</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {teacherMetricsLabels.map((label: string, index: number) => (
          <MetricCard key={label} label={label} value={classMetrics[index]} index={index} />
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>学生管理</p>
            <h2>查看学生记录</h2>
          </div>
          <div className="teacher-filters">
            {canExportReport(currentRole) && (
              <button
                type="button"
                className="export-summary-btn"
                onClick={() => onExportSummary(filteredSamples)}
              >
                📊 记录导出摘要
              </button>
            )}
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部学生</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="student-records-grid">
          {students.map(student => {
            if (selectedStudentId !== "all" && selectedStudentId !== student.id) return null;
            const studentSamples = filteredSamples.filter(s => s.studentId === student.id);

            return (
              <div key={student.id} className="student-record-panel">
                <div className="student-record-header">
                  <div className="student-info">
                    <span className="student-avatar">👨‍🎓</span>
                    <div>
                      <strong>{student.name}</strong>
                      <p>{studentSamples.length} 个样本</p>
                    </div>
                  </div>
                  <div className="student-stats">
                    <span className="mini-stat">
                      <em>{studentSamples.reduce((sum, s) => sum + s.magnifications.length, 0)}</em>
                      <small>视野记录</small>
                    </span>
                    <span className="mini-stat pass">
                      <em>{studentSamples.reduce((sum, s) => sum + s.magnifications.filter(r => r.isQualified === true).length, 0)}</em>
                      <small>已合格</small>
                    </span>
                    <span className="mini-stat fail">
                      <em>{studentSamples.reduce((sum, s) => sum + s.magnifications.filter(r => r.isQualified === false).length, 0)}</em>
                      <small>不合格</small>
                    </span>
                    <span className="mini-stat pending">
                      <em>{studentSamples.reduce((sum, s) => sum + s.magnifications.filter(r => r.isQualified === undefined).length, 0)}</em>
                      <small>待评阅</small>
                    </span>
                  </div>
                </div>

                <div className="student-samples-list">
                  {studentSamples.length === 0 ? (
                    <p className="empty-description">该学生暂无记录</p>
                  ) : (
                    studentSamples.map(sample => {
                      const qualityOverview = getSampleQualityOverview(sample);
                      const pendingRecords = sample.magnifications.filter(r => r.isQualified === undefined);

                      return (
                        <article key={sample.id} className="teacher-sample-card">
                          <div
                            className="teacher-sample-info clickable"
                            onClick={() => onSampleClick(sample)}
                          >
                            <h4>
                              {sample.sampleName}
                              <span style={{ marginLeft: "8px" }}>
                                <QualityBadge status={qualityOverview.overallStatus} />
                              </span>
                            </h4>
                            <p>{sample.sampleType} · {sample.stainingMethod}</p>
                            <div className="sample-quality-summary">
                              {qualityOverview.missingMagnificationCount > 0 && (
                                <span className="quality-summary-tag error-tag">缺失倍率 {qualityOverview.missingMagnificationCount}</span>
                              )}
                              {qualityOverview.emptyDescriptionCount > 0 && (
                                <span className="quality-summary-tag error-tag">空描述 {qualityOverview.emptyDescriptionCount}</span>
                              )}
                              {qualityOverview.shortDescriptionCount > 0 && (
                                <span className="quality-summary-tag warning-tag">过短描述 {qualityOverview.shortDescriptionCount}</span>
                              )}
                              {qualityOverview.nonRecommendedMagnificationCount > 0 && (
                                <span className="quality-summary-tag warning-tag">非推荐倍率 {qualityOverview.nonRecommendedMagnificationCount}</span>
                              )}
                            </div>
                            <div className="record-mag-chips">
                              {sample.magnifications.slice(0, 3).map(rec => (
                                <span
                                  key={rec.id}
                                  className={`record-mag-chip ${
                                    rec.isQualified === true
                                      ? "pass-chip"
                                      : rec.isQualified === false
                                      ? "fail-chip"
                                      : "pending-chip"
                                  }`}
                                >
                                  {rec.magnification} {rec.observedStructure}
                                  {rec.isQualified === true ? " ✓" : rec.isQualified === false ? " ✗" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="teacher-quick-actions">
                            {pendingRecords.length > 0 && (
                              <span className="pending-badge">{pendingRecords.length} 待评阅</span>
                            )}
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => onSampleClick(sample)}
                            >
                              查看详情
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
