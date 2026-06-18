import React, { useState, useMemo, ChangeEvent, FormEvent } from "react";
import type {
  User,
  Sample,
  SampleCategory,
  StainingMethod,
  SampleFormData,
  FormErrors,
  ObservationTemplate,
  QualityCheckResult,
  QualityOverallStatus
} from "../types";
import {
  MAGNIFICATION_GROUPS,
  PROJECT_CONFIG
} from "../constants";
import { getSampleQualityStatus } from "../utils/qualityCheck";
import { MetricCard } from "./MetricCard";
import { QualityCheckPanel } from "./QualityCheckPanel";
import { QualityBadge } from "./QualityBadge";

interface StudentWorkbenchProps {
  currentUser: User;
  samples: Sample[];
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  templates: ObservationTemplate[];
  formData: SampleFormData;
  errors: FormErrors;
  selectedTemplate: string | null;
  qualityResult: QualityCheckResult;
  onTemplateSelect: (template: ObservationTemplate) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, forceSubmit?: boolean) => void;
  onSampleClick: (sample: Sample) => void;
}

export function StudentWorkbench({
  currentUser,
  samples,
  sampleCategories,
  stainingMethods,
  templates,
  formData,
  errors,
  selectedTemplate,
  qualityResult,
  onTemplateSelect,
  onInputChange,
  onSubmit,
  onSampleClick
}: StudentWorkbenchProps) {
  const mySamples = samples.filter(s => s.studentId === currentUser.id);

  const [filterSampleType, setFilterSampleType] = useState<string>("all");
  const [filterStainingMethod, setFilterStainingMethod] = useState<string>("all");
  const [filterQualityStatus, setFilterQualityStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<"createdAt" | "fieldCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredAndSortedSamples = useMemo(() => {
    let result = [...mySamples];

    if (filterSampleType !== "all") {
      result = result.filter(s => s.sampleType === filterSampleType);
    }

    if (filterStainingMethod !== "all") {
      result = result.filter(s => s.stainingMethod === filterStainingMethod);
    }

    if (filterQualityStatus !== "all") {
      result = result.filter(s => {
        const sampleQuality = getSampleQualityStatus(s);
        return sampleQuality.overallStatus === filterQualityStatus;
      });
    }

    result.sort((a, b) => {
      if (sortField === "createdAt") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      } else {
        const countA = a.magnifications.length;
        const countB = b.magnifications.length;
        return sortOrder === "desc" ? countB - countA : countA - countB;
      }
    });

    return result;
  }, [mySamples, filterSampleType, filterStainingMethod, filterQualityStatus, sortField, sortOrder]);

  const hasActiveFilters =
    filterSampleType !== "all" ||
    filterStainingMethod !== "all" ||
    filterQualityStatus !== "all";

  const handleResetFilters = () => {
    setFilterSampleType("all");
    setFilterStainingMethod("all");
    setFilterQualityStatus("all");
    setSortField("createdAt");
    setSortOrder("desc");
  };

  const myMetrics = useMemo(() => {
    const uniqueSamples = mySamples.length;
    const totalFields = mySamples.reduce((sum, sample) => sum + sample.magnifications.length, 0);
    const qualifiedFields = mySamples.reduce(
      (sum, sample) =>
        sum + sample.magnifications.filter(r => r.isQualified === true).length,
      0
    );
    const unqualifiedFields = mySamples.reduce(
      (sum, sample) =>
        sum + sample.magnifications.filter(r => r.isQualified === false).length,
      0
    );
    return [
      String(uniqueSamples),
      String(totalFields),
      String(qualifiedFields),
      String(unqualifiedFields)
    ];
  }, [mySamples]);

  const studentMetricsLabels = ["我的样本", "视野记录", "已合格", "不合格"];

  return (
    <>
      <section className="hero student-hero">
        <div>
          <p className="eyebrow">学生工作台</p>
          <h1>欢迎回来，{currentUser.name}</h1>
          <p className="subtitle">在这里你可以新增和查看自己的显微镜观察记录</p>
        </div>
        <div className="stack-card">
          <span>当前身份</span>
          <strong>👨‍🎓 学生</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {studentMetricsLabels.map((label: string, index: number) => (
          <MetricCard key={label} label={label} value={myMetrics[index]} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>快捷操作</h2>
          <div className="chips muted">
            <button className="primary-action-chip">+ 新建记录</button>
          </div>
          <h2>样本分类</h2>
          <div className="chips">
            {sampleCategories.map(cat => (
              <span key={cat.id}>{cat.name}</span>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>记录管理</p>
              <h2>创建观察记录</h2>
            </div>
          </div>

          <div className="template-library">
            <div className="template-library-header">
              <h3>📚 课堂观察模板库</h3>
              <p className="template-hint">选择模板快速填充观察字段，之后可手动修改</p>
            </div>
            <div className="template-grid">
              {templates.length === 0 ? (
                <p className="empty-description">暂无可用的观察模板，请联系管理员添加。</p>
              ) : (
                templates.map(template => (
                  <article
                    key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? "template-selected" : ""}`}
                    onClick={() => onTemplateSelect(template)}
                  >
                    <div className="template-icon">{template.icon}</div>
                    <h4>{template.name}</h4>
                    <p className="template-desc">{template.description}</p>
                    <div className="template-info">
                      <span>染色：{template.stainingMethod}</span>
                      <span>倍数：{template.magnification}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <p className="form-hint">
            提交后将创建样本并录入第一条倍率视野记录，可在样本详情中继续补充 100x、200x、400x、1000x 等其他倍率观察结果。
          </p>

          <QualityCheckPanel result={qualityResult} title="观察质量预检" />

          <form onSubmit={onSubmit} className="field-grid">
            {PROJECT_CONFIG.fields.map(field => (
              <label key={field.key} className={errors[field.key as keyof FormErrors] ? "field-error" : ""}>
                <span>
                  {field.label}
                  {field.required && <em className="required-mark">*</em>}
                </span>
                {field.key === "sampleType" ? (
                  <select
                    name={field.key}
                    value={formData[field.key as keyof SampleFormData]}
                    onChange={onInputChange}
                  >
                    <option value="">请选择样本类型</option>
                    {sampleCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                ) : field.key === "stainingMethod" ? (
                  <select
                    name={field.key}
                    value={formData[field.key as keyof SampleFormData]}
                    onChange={onInputChange}
                  >
                    <option value="">请选择染色方式</option>
                    {stainingMethods.map(stain => (
                      <option key={stain.id} value={stain.name}>{stain.name}</option>
                    ))}
                  </select>
                ) : field.key === "magnification" ? (
                  <>
                    <input
                      list="magnification-options-student"
                      name={field.key}
                      value={formData[field.key as keyof SampleFormData]}
                      onChange={onInputChange}
                      placeholder={"填写" + field.label + "（如 400x）"}
                    />
                    <datalist id="magnification-options-student">
                      {MAGNIFICATION_GROUPS.map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    name={field.key}
                    value={formData[field.key as keyof SampleFormData]}
                    onChange={onInputChange}
                    placeholder={"填写" + field.label}
                  />
                )}
                {errors[field.key as keyof FormErrors] && (
                  <small className="error-text">{errors[field.key as keyof FormErrors]}</small>
                )}
              </label>
            ))}
            <div className="form-actions">
              <button type="submit" className="primary-action">提交记录</button>
            </div>
          </form>
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>我的数据</p>
            <h2>我的观察记录</h2>
          </div>
          <div className="student-filters">
            <select
              value={filterSampleType}
              onChange={(e) => setFilterSampleType(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部样本类型</option>
              {sampleCategories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterStainingMethod}
              onChange={(e) => setFilterStainingMethod(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部染色方式</option>
              {stainingMethods.map(stain => (
                <option key={stain.id} value={stain.name}>{stain.name}</option>
              ))}
            </select>
            <select
              value={filterQualityStatus}
              onChange={(e) => setFilterQualityStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部质量状态</option>
              <option value="pass">合格</option>
              <option value="warning">需改进</option>
              <option value="error">有错误</option>
            </select>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortField(field as "createdAt" | "fieldCount");
                setSortOrder(order as "asc" | "desc");
              }}
              className="filter-select"
            >
              <option value="createdAt-desc">创建时间（最新）</option>
              <option value="createdAt-asc">创建时间（最早）</option>
              <option value="fieldCount-desc">视野记录数（多→少）</option>
              <option value="fieldCount-asc">视野记录数（少→多）</option>
            </select>
            {hasActiveFilters && (
              <button type="button" className="reset-filter-btn" onClick={handleResetFilters}>
                重置筛选
              </button>
            )}
          </div>
        </div>
        <div className="record-list">
          {mySamples.length === 0 ? (
            <p className="empty-description">暂无你的样本记录，请通过上方表单创建。</p>
          ) : filteredAndSortedSamples.length === 0 ? (
            <p className="empty-description">
              没有符合筛选条件的记录，请尝试调整筛选条件。
              {hasActiveFilters && (
                <button type="button" className="inline-reset-btn" onClick={handleResetFilters}>
                  重置筛选
                </button>
              )}
            </p>
          ) : (
            filteredAndSortedSamples.map((sample, index) => {
              const sampleMagStats = MAGNIFICATION_GROUPS.map(mag => ({
                mag,
                count: sample.magnifications.filter(r => r.magnification.toLowerCase() === mag).length
              })).filter(s => s.count > 0);

              const qualifiedCount = sample.magnifications.filter(r => r.isQualified === true).length;
              const unqualifiedCount = sample.magnifications.filter(r => r.isQualified === false).length;
              const pendingCount = sample.magnifications.filter(r => r.isQualified === undefined).length;
              const sampleQuality = getSampleQualityStatus(sample);

              return (
                <article
                  key={sample.id}
                  className={`record-card clickable quality-card-${sampleQuality.overallStatus}`}
                  onClick={() => onSampleClick(sample)}
                >
                  <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="record-summary">
                    <div className="record-title-row">
                      <h3>{sample.sampleName}</h3>
                      <QualityBadge status={sampleQuality.overallStatus} />
                    </div>
                    <p>
                      {sample.sampleType} · {sample.stainingMethod} · 视野记录 {sample.magnifications.length} 条
                    </p>
                    <div className="record-status-chips">
                      {qualifiedCount > 0 && (
                        <span className="record-mag-chip pass-chip">合格 × {qualifiedCount}</span>
                      )}
                      {unqualifiedCount > 0 && (
                        <span className="record-mag-chip fail-chip">不合格 × {unqualifiedCount}</span>
                      )}
                      {pendingCount > 0 && (
                        <span className="record-mag-chip pending-chip">待评阅 × {pendingCount}</span>
                      )}
                    </div>
                    {sampleMagStats.length > 0 && (
                      <div className="record-mag-chips">
                        {sampleMagStats.map(stat => (
                          <span key={stat.mag} className="record-mag-chip">
                            {stat.mag} × {stat.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="record-badge">{sample.magnifications.length}</span>
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
