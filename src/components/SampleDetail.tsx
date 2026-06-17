import React, { useState, useMemo, ChangeEvent, FormEvent } from "react";
import type {
  Sample,
  MagnificationFormData,
  Role,
  FormErrors,
  MagnificationRecord
} from "../types";
import {
  MAGNIFICATION_GROUPS,
  EMPTY_MAGNIFICATION_FORM
} from "../constants";
import { runQualityCheck } from "../utils/qualityCheck";
import { formatDate, groupMagnifications } from "../utils/format";
import { MetricCard } from "./MetricCard";
import { QualityCheckPanel } from "./QualityCheckPanel";
import { ConfirmDialog } from "./ConfirmDialog";

interface SampleDetailProps {
  sample: Sample;
  onBack: () => void;
  onAddMagnification: (sampleId: string, data: MagnificationFormData, forceSubmit?: boolean) => void;
  onUpdateMagnification: (sampleId: string, magId: string, data: MagnificationFormData, forceSubmit?: boolean) => void;
  onDeleteMagnification: (sampleId: string, magId: string) => void;
  onToggleQualified?: (sampleId: string, magId: string, qualified: boolean) => void;
  currentRole: Role;
  currentUserName: string;
}

export function SampleDetail({
  sample,
  onBack,
  onAddMagnification,
  onUpdateMagnification,
  onDeleteMagnification,
  onToggleQualified,
  currentRole,
  currentUserName
}: SampleDetailProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [magFormData, setMagFormData] = useState<MagnificationFormData>(EMPTY_MAGNIFICATION_FORM);
  const [magErrors, setMagErrors] = useState<FormErrors>({});
  const [magConfirmDialog, setMagConfirmDialog] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | null;
  }>({ isOpen: false, mode: null });

  const magQualityResult = useMemo(() => {
    return runQualityCheck(
      {
        sampleType: sample.sampleType,
        magnification: magFormData.magnification,
        observedStructure: magFormData.observedStructure,
        fieldDescription: magFormData.fieldDescription
      },
      false
    );
  }, [magFormData, sample.sampleType]);

  const groups = useMemo(() => groupMagnifications(sample.magnifications), [sample.magnifications]);

  const detailFields = [
    { key: "studentName", label: "学生姓名", value: sample.studentName },
    { key: "sampleType", label: "样本类型", value: sample.sampleType },
    { key: "stainingMethod", label: "染色方式", value: sample.stainingMethod },
    { key: "createdAt", label: "创建时间", value: formatDate(sample.createdAt) },
    { key: "magnifications", label: "视野记录数", value: `${sample.magnifications.length} 条` }
  ];

  const resetForm = () => {
    setMagFormData(EMPTY_MAGNIFICATION_FORM);
    setEditingId(null);
    setMagErrors({});
    setShowForm(false);
  };

  const handleToggleForm = () => {
    if (showForm) {
      resetForm();
    } else {
      setEditingId(null);
      setMagFormData(EMPTY_MAGNIFICATION_FORM);
      setMagErrors({});
      setShowForm(true);
    }
  };

  const handleMagInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMagFormData(prev => ({ ...prev, [name]: value }));
    if (magErrors[name as keyof FormErrors]) {
      setMagErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateMagForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!magFormData.magnification.trim()) {
      newErrors.magnification = "放大倍数为必填项";
    } else if (!/^\d+x$/i.test(magFormData.magnification.trim())) {
      newErrors.magnification = "放大倍数格式应为 数字+x，如 100x、400x";
    }
    if (!magFormData.observedStructure.trim()) {
      newErrors.observedStructure = "观察结构为必填项";
    }
    setMagErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMagSubmit = (e: FormEvent<HTMLFormElement>, forceSubmit: boolean = false) => {
    e.preventDefault();
    if (!validateMagForm()) return;

    const qualityResult = runQualityCheck(
      {
        sampleType: sample.sampleType,
        magnification: magFormData.magnification,
        observedStructure: magFormData.observedStructure,
        fieldDescription: magFormData.fieldDescription
      },
      false
    );

    if (qualityResult.hasErrors) {
      const firstError = qualityResult.issues.find(i => i.level === "error");
      alert(`保存失败：${firstError?.message || "存在必填项未填写，请检查后再提交。"}`);
      return;
    }

    if (qualityResult.hasWarnings && !forceSubmit) {
      setMagConfirmDialog({ isOpen: true, mode: editingId ? "edit" : "add" });
      return;
    }

    if (editingId) {
      onUpdateMagnification(sample.id, editingId, magFormData, true);
    } else {
      onAddMagnification(sample.id, magFormData, true);
    }
    resetForm();
  };

  const handleConfirmMagSubmit = () => {
    if (magConfirmDialog.mode === "edit" && editingId) {
      onUpdateMagnification(sample.id, editingId, magFormData, true);
    } else {
      onAddMagnification(sample.id, magFormData, true);
    }
    setMagConfirmDialog({ isOpen: false, mode: null });
    resetForm();
  };

  const handleCancelMagConfirm = () => {
    setMagConfirmDialog({ isOpen: false, mode: null });
  };

  const handleEditMagnification = (record: MagnificationRecord) => {
    setEditingId(record.id);
    setMagFormData({
      magnification: record.magnification,
      observedStructure: record.observedStructure,
      fieldDescription: record.fieldDescription
    });
    setMagErrors({});
    setShowForm(true);
  };

  const handleDeleteMagnification = (record: MagnificationRecord) => {
    const confirmed = window.confirm(
      `确认删除 ${record.magnification} 下「${record.observedStructure}」的视野记录？`
    );
    if (confirmed) {
      onDeleteMagnification(sample.id, record.id);
      if (editingId === record.id) resetForm();
    }
  };

  return (
    <section className="detail-view">
      <div className="detail-header panel">
        <button className="back-button" onClick={onBack}>
          ← 返回列表
        </button>
        <div className="detail-title">
          <p className="eyebrow">玻片样本详情</p>
          <h1>{sample.sampleName}</h1>
          <p className="detail-meta">创建时间：{formatDate(sample.createdAt)}</p>
        </div>
      </div>

      <section className="metrics-grid">
        <MetricCard label="样本类型" value={sample.sampleType} index={0} />
        <MetricCard label="染色方式" value={sample.stainingMethod} index={1} />
        <MetricCard label="视野记录数" value={String(sample.magnifications.length)} index={2} />
        <MetricCard label="倍率分组数" value={String(groups.length)} index={0} />
      </section>

      <section className="panel detail-content">
        <div className="section-heading">
          <div>
            <p>详细信息</p>
            <h2>样本信息</h2>
          </div>
        </div>
        <div className="detail-fields">
          {detailFields.map(field => (
            <div key={field.key} className="detail-field">
              <span className="detail-label">{field.label}</span>
              <strong className="detail-value">{field.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel magnification-module">
        <div className="section-heading">
          <div>
            <p>多倍率视野对比</p>
            <h2>倍率视野记录</h2>
          </div>
          {currentRole === "student" && (
            <button type="button" className="primary-action" onClick={handleToggleForm}>
              {showForm ? "收起表单" : "+ 新增倍率记录"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={(e) => handleMagSubmit(e)} className="magnification-form field-grid">
            <label className={magErrors.magnification ? "field-error" : ""}>
              <span>
                放大倍数
                <em className="required-mark">*</em>
              </span>
              <input
                list="magnification-options-detail"
                name="magnification"
                value={magFormData.magnification}
                onChange={handleMagInputChange}
                placeholder="如 100x、200x、400x、1000x"
              />
              <datalist id="magnification-options-detail">
                {MAGNIFICATION_GROUPS.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {magErrors.magnification && (
                <small className="error-text">{magErrors.magnification}</small>
              )}
            </label>
            <label className={magErrors.observedStructure ? "field-error" : ""}>
              <span>
                观察结构
                <em className="required-mark">*</em>
              </span>
              <input
                name="observedStructure"
                value={magFormData.observedStructure}
                onChange={handleMagInputChange}
                placeholder="填写观察结构"
              />
              {magErrors.observedStructure && (
                <small className="error-text">{magErrors.observedStructure}</small>
              )}
            </label>
            <label className={magErrors.fieldDescription ? "field-error" : ""}>
              <span>视野描述</span>
              <input
                name="fieldDescription"
                value={magFormData.fieldDescription}
                onChange={handleMagInputChange}
                placeholder="填写视野描述"
              />
              {magErrors.fieldDescription && (
                <small className="error-text">{magErrors.fieldDescription}</small>
              )}
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <QualityCheckPanel result={magQualityResult} title="视野记录质量检查" />
            </div>
            <div className="form-actions">
              <button type="button" onClick={resetForm}>取消</button>
              <button type="submit" className="primary-action">
                {editingId ? "保存修改" : "新增记录"}
              </button>
            </div>
          </form>
        )}

        <ConfirmDialog
          isOpen={magConfirmDialog.isOpen}
          title="存在需要注意的问题"
          icon="⚠️"
          message="当前记录存在一些提醒项，虽然可以继续保存，但建议先进行优化。是否确认提交？"
          confirmText="仍要提交"
          cancelText="返回修改"
          onConfirm={handleConfirmMagSubmit}
          onCancel={handleCancelMagConfirm}
        >
          <QualityCheckPanel result={magQualityResult} title="检查结果详情" />
        </ConfirmDialog>

        <div className="magnification-groups">
          {groups.length === 0 ? (
            <p className="empty-description">
              暂无倍率记录，请点击「新增倍率记录」添加观察结果。
            </p>
          ) : (
            groups.map(group => (
              <div key={group.group} className="magnification-group">
                <div className="group-title">
                  <h3>{group.group}</h3>
                  <span className="group-count">{group.records.length} 条视野</span>
                </div>
                <div className="group-records">
                  {group.records.map(record => (
                    <article
                      key={record.id}
                      className={`magnification-card ${
                        record.isQualified === true
                          ? "qualified"
                          : record.isQualified === false
                          ? "unqualified"
                          : ""
                      }`}
                    >
                      <div className="magnification-card-head">
                        <div className="card-title-wrap">
                          <strong>{record.observedStructure}</strong>
                          {record.isQualified !== undefined && (
                            <span
                              className={`qualification-badge ${
                                record.isQualified ? "badge-pass" : "badge-fail"
                              }`}
                            >
                              {record.isQualified ? "✓ 合格" : "✗ 不合格"}
                            </span>
                          )}
                        </div>
                        <div className="magnification-actions">
                          {currentRole === "teacher" && onToggleQualified && (
                            <>
                              <button
                                type="button"
                                className={`qualified-action ${
                                  record.isQualified === true ? "active-pass" : ""
                                }`}
                                onClick={() =>
                                  onToggleQualified(sample.id, record.id, true)
                                }
                              >
                                标记合格
                              </button>
                              <button
                                type="button"
                                className={`unqualified-action ${
                                  record.isQualified === false ? "active-fail" : ""
                                }`}
                                onClick={() =>
                                  onToggleQualified(sample.id, record.id, false)
                                }
                              >
                                标记不合格
                              </button>
                            </>
                          )}
                          {currentRole === "student" && (
                            <>
                              <button type="button" onClick={() => handleEditMagnification(record)}>
                                编辑
                              </button>
                              <button
                                type="button"
                                className="danger-action"
                                onClick={() => handleDeleteMagnification(record)}
                              >
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="magnification-description">
                        {record.fieldDescription || "暂无视野描述"}
                      </p>
                      <div className="magnification-meta">
                        <span className="magnification-time">
                          记录时间：{formatDate(record.createdAt)}
                        </span>
                        {record.qualifiedAt && record.reviewedBy && (
                          <span className="review-info">
                            评阅人：{record.reviewedBy} · {formatDate(record.qualifiedAt)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
