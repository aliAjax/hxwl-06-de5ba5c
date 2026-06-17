import React, { useState, useMemo } from "react";
import type {
  User,
  Sample,
  ObservationBatch,
  ReviewFilterStatus
} from "../types";
import { MetricCard } from "./MetricCard";

interface BatchReviewWorkbenchProps {
  currentUser: User;
  samples: Sample[];
  users: User[];
  batches: ObservationBatch[];
  onCreateBatch: (name: string, description: string, userId: string, userName: string) => void;
  onCloseBatch: (batchId: string) => void;
  onReopenBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  onToggleQualified: (sampleId: string, magId: string, qualified: boolean) => void;
  onSampleClick: (sample: Sample) => void;
  onAddSampleToBatch: (batchId: string, sampleId: string) => void;
  onRemoveSampleFromBatch: (batchId: string, sampleId: string) => void;
}

export function BatchReviewWorkbench({
  currentUser,
  samples,
  users,
  batches,
  onCreateBatch,
  onCloseBatch,
  onReopenBatch,
  onDeleteBatch,
  onToggleQualified,
  onSampleClick,
  onAddSampleToBatch,
  onRemoveSampleFromBatch
}: BatchReviewWorkbenchProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [filterSampleType, setFilterSampleType] = useState<string>("all");
  const [filterStudentId, setFilterStudentId] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<ReviewFilterStatus>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchDesc, setNewBatchDesc] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showAddSampleDialog, setShowAddSampleDialog] = useState(false);
  const [searchStudentId, setSearchStudentId] = useState<string>("all");
  const [searchSampleType, setSearchSampleType] = useState<string>("all");
  const [searchSampleName, setSearchSampleName] = useState("");
  const [removeConfirmSampleId, setRemoveConfirmSampleId] = useState<string | null>(null);

  const students = users.filter(u => u.role === "student");
  const sampleTypes = [...new Set(samples.map(s => s.sampleType))];

  const selectedBatch = useMemo(
    () => batches.find(b => b.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const batchSamples = useMemo(() => {
    if (!selectedBatch) return [];
    return samples.filter(s => selectedBatch.sampleIds.includes(s.id));
  }, [selectedBatch, samples]);

  const isBatchClosed = selectedBatch?.status === "closed";

  const availableSamples = useMemo(() => {
    if (!selectedBatch) return [];
    return samples.filter(s => !selectedBatch.sampleIds.includes(s.id));
  }, [selectedBatch, samples]);

  const filteredAvailableSamples = useMemo(() => {
    let result = availableSamples;
    if (searchStudentId !== "all") {
      result = result.filter(s => s.studentId === searchStudentId);
    }
    if (searchSampleType !== "all") {
      result = result.filter(s => s.sampleType === searchSampleType);
    }
    if (searchSampleName.trim()) {
      const keyword = searchSampleName.trim().toLowerCase();
      result = result.filter(s => s.sampleName.toLowerCase().includes(keyword));
    }
    return result;
  }, [availableSamples, searchStudentId, searchSampleType, searchSampleName]);

  const filteredSamples = useMemo(() => {
    let result = batchSamples;

    if (filterSampleType !== "all") {
      result = result.filter(s => s.sampleType === filterSampleType);
    }
    if (filterStudentId !== "all") {
      result = result.filter(s => s.studentId === filterStudentId);
    }
    if (filterQuality !== "all") {
      result = result.filter(s => {
        const mags = s.magnifications;
        if (filterQuality === "pending") return mags.some(m => m.isQualified === undefined);
        if (filterQuality === "pass") return mags.every(m => m.isQualified === true);
        if (filterQuality === "fail") return mags.some(m => m.isQualified === false);
        return true;
      });
    }

    return result;
  }, [batchSamples, filterSampleType, filterStudentId, filterQuality]);

  const batchMetrics = useMemo(() => {
    const totalBatches = batches.length;
    const openBatches = batches.filter(b => b.status === "open").length;
    const batchSampleCount = batchSamples.length;
    const batchTotalFields = batchSamples.reduce(
      (sum, s) => sum + s.magnifications.length, 0
    );
    return [
      String(totalBatches),
      String(openBatches),
      String(batchSampleCount),
      String(batchTotalFields)
    ];
  }, [batches, batchSamples]);

  const batchMetricsLabels = ["全部批次", "进行中", "批次样本", "批次视野"];

  const handleCreateBatch = () => {
    if (!newBatchName.trim()) return;
    onCreateBatch(newBatchName, newBatchDesc, currentUser.id, currentUser.name);
    setNewBatchName("");
    setNewBatchDesc("");
    setShowCreateForm(false);
  };

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    setFilterSampleType("all");
    setFilterStudentId("all");
    setFilterQuality("all");
  };

  const handleBackToBatches = () => {
    setSelectedBatchId(null);
    setFilterSampleType("all");
    setFilterStudentId("all");
    setFilterQuality("all");
  };

  const handleBatchApproveAll = (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample) return;
    sample.magnifications.forEach(mag => {
      if (mag.isQualified === undefined) {
        onToggleQualified(sampleId, mag.id, true);
      }
    });
  };

  const handleBatchRejectAll = (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample) return;
    sample.magnifications.forEach(mag => {
      if (mag.isQualified === undefined) {
        onToggleQualified(sampleId, mag.id, false);
      }
    });
  };

  const handleDeleteWithConfirm = (batchId: string) => {
    if (deleteConfirmId === batchId) {
      onDeleteBatch(batchId);
      setDeleteConfirmId(null);
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null);
      }
    } else {
      setDeleteConfirmId(batchId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleOpenAddSampleDialog = () => {
    setSearchStudentId("all");
    setSearchSampleType("all");
    setSearchSampleName("");
    setShowAddSampleDialog(true);
  };

  const handleCloseAddSampleDialog = () => {
    setShowAddSampleDialog(false);
  };

  const handleAddSample = (sampleId: string) => {
    if (!selectedBatchId) return;
    onAddSampleToBatch(selectedBatchId, sampleId);
  };

  const handleRemoveSample = (sampleId: string) => {
    if (!selectedBatchId) return;
    if (removeConfirmSampleId === sampleId) {
      onRemoveSampleFromBatch(selectedBatchId, sampleId);
      setRemoveConfirmSampleId(null);
    } else {
      setRemoveConfirmSampleId(sampleId);
      setTimeout(() => setRemoveConfirmSampleId(null), 3000);
    }
  };

  if (selectedBatch && selectedBatchId) {
    return (
      <section className="batch-review-detail">
        <button
          type="button"
          className="back-button"
          onClick={handleBackToBatches}
        >
          ← 返回批次列表
        </button>

        <div className="batch-detail-hero">
          <div className="batch-detail-info">
            <p className="eyebrow">批次复核</p>
            <h1>{selectedBatch.name}</h1>
            <p className="subtitle">
              {selectedBatch.description || "无描述"} · 创建于 {new Date(selectedBatch.createdAt).toLocaleDateString("zh-CN")}
              {selectedBatch.status === "closed" && " · 已截止"}
            </p>
          </div>
          <div className="batch-detail-status">
            <span className={`batch-status-badge ${selectedBatch.status}`}>
              {selectedBatch.status === "open" ? "进行中" : "已截止"}
            </span>
            {selectedBatch.status === "open" ? (
              <button
                type="button"
                className="batch-action-btn close-btn"
                onClick={() => onCloseBatch(selectedBatch.id)}
              >
                截止批次
              </button>
            ) : (
              <button
                type="button"
                className="batch-action-btn reopen-btn"
                onClick={() => onReopenBatch(selectedBatch.id)}
              >
                重新开启
              </button>
            )}
          </div>
        </div>

        <section className="metrics-grid">
          {batchMetricsLabels.map((label, index) => (
            <MetricCard key={label} label={label} value={batchMetrics[index]} index={index} />
          ))}
        </section>

        <section className="panel batch-review-panel">
          <div className="section-heading">
            <div>
              <p>复核筛选</p>
              <h2>按条件筛选记录</h2>
            </div>
            {!isBatchClosed && (
              <div className="batch-sample-manage-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleOpenAddSampleDialog}
                >
                  + 添加样本到批次
                </button>
              </div>
            )}
          </div>

          <div className="batch-filter-bar">
            <div className="batch-filter-group">
              <label>
                <span>样本类型</span>
                <select
                  value={filterSampleType}
                  onChange={e => setFilterSampleType(e.target.value)}
                >
                  <option value="all">全部类型</option>
                  {sampleTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="batch-filter-group">
              <label>
                <span>学生</span>
                <select
                  value={filterStudentId}
                  onChange={e => setFilterStudentId(e.target.value)}
                >
                  <option value="all">全部学生</option>
                  {students.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="batch-filter-group">
              <label>
                <span>质量状态</span>
                <select
                  value={filterQuality}
                  onChange={e => setFilterQuality(e.target.value as ReviewFilterStatus)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待评阅</option>
                  <option value="pass">已合格</option>
                  <option value="fail">有不合格</option>
                </select>
              </label>
            </div>
          </div>

          {isBatchClosed && (
            <div className="batch-closed-notice">
              <span className="batch-closed-icon">🔒</span>
              <p>批次已截止，不可调整样本，您仍可查看复核结果。</p>
            </div>
          )}

          {batchSamples.length === 0 ? (
            <div className="batch-empty-state">
              <div className="batch-empty-icon">📋</div>
              <h3>该批次暂无样本</h3>
              <p>学生提交观察记录后，将自动关联到此批次中。
                {!isBatchClosed && "您也可以点击上方\"添加样本到批次\"按钮手动添加。"}
              </p>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="batch-empty-state">
              <div className="batch-empty-icon">🔍</div>
              <h3>没有匹配的记录</h3>
              <p>当前筛选条件下没有符合条件的样本，请调整筛选条件。</p>
            </div>
          ) : (
            <div className="batch-review-list">
              {filteredSamples.map(sample => {
                const pendingCount = sample.magnifications.filter(m => m.isQualified === undefined).length;
                const passCount = sample.magnifications.filter(m => m.isQualified === true).length;
                const failCount = sample.magnifications.filter(m => m.isQualified === false).length;
                const student = students.find(u => u.id === sample.studentId);

                return (
                  <article key={sample.id} className="batch-review-card">
                    <div className="batch-review-card-main">
                      <div className="batch-review-card-header">
                        <h4
                          className="clickable"
                          onClick={() => onSampleClick(sample)}
                        >
                          {sample.sampleName}
                        </h4>
                        <span className="batch-student-tag">
                          {student?.name || sample.studentName}
                        </span>
                      </div>
                      <p className="batch-review-meta">
                        {sample.sampleType} · {sample.stainingMethod} · {sample.magnifications.length} 条视野
                      </p>
                      <div className="batch-review-status-chips">
                        {passCount > 0 && (
                          <span className="record-mag-chip pass-chip">合格 {passCount}</span>
                        )}
                        {failCount > 0 && (
                          <span className="record-mag-chip fail-chip">不合格 {failCount}</span>
                        )}
                        {pendingCount > 0 && (
                          <span className="record-mag-chip pending-chip">待评阅 {pendingCount}</span>
                        )}
                      </div>
                      <div className="batch-mag-detail">
                        {sample.magnifications.map(mag => (
                          <div
                            key={mag.id}
                            className={`batch-mag-item ${
                              mag.isQualified === true
                                ? "mag-pass"
                                : mag.isQualified === false
                                ? "mag-fail"
                                : "mag-pending"
                            }`}
                          >
                            <span className="batch-mag-label">
                              {mag.magnification} {mag.observedStructure}
                            </span>
                            <span className="batch-mag-actions">
                              {isBatchClosed ? (
                                mag.isQualified === true ? (
                                  <span className="review-info">
                                    ✓ 合格 {mag.reviewedBy ? `· ${mag.reviewedBy}` : ""}
                                  </span>
                                ) : mag.isQualified === false ? (
                                  <span className="review-info fail-info">
                                    ✗ 不合格 {mag.reviewedBy ? `· ${mag.reviewedBy}` : ""}
                                  </span>
                                ) : (
                                  <span className="review-info pending-info">
                                    待评阅
                                  </span>
                                )
                              ) : (
                                mag.isQualified === undefined ? (
                                  <>
                                    <button
                                      type="button"
                                      className="qualified-action small-btn"
                                      onClick={() => onToggleQualified(sample.id, mag.id, true)}
                                    >
                                      ✓ 合格
                                    </button>
                                    <button
                                      type="button"
                                      className="unqualified-action small-btn"
                                      onClick={() => onToggleQualified(sample.id, mag.id, false)}
                                    >
                                      ✗ 不合格
                                    </button>
                                  </>
                                ) : mag.isQualified === true ? (
                                  <span className="review-info">
                                    ✓ 合格 {mag.reviewedBy ? `· ${mag.reviewedBy}` : ""}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="unqualified-action small-btn"
                                    onClick={() => onToggleQualified(sample.id, mag.id, true)}
                                  >
                                    ✗ 不合格 · 重新评定
                                  </button>
                                )
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="batch-review-card-actions">
                      {!isBatchClosed && pendingCount > 0 && (
                        <>
                          <button
                            type="button"
                            className="batch-quick-btn batch-approve-btn"
                            onClick={() => handleBatchApproveAll(sample.id)}
                          >
                            全部合格
                          </button>
                          <button
                            type="button"
                            className="batch-quick-btn batch-reject-btn"
                            onClick={() => handleBatchRejectAll(sample.id)}
                          >
                            全部不合格
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="primary-action small-btn"
                        onClick={() => onSampleClick(sample)}
                      >
                        查看详情
                      </button>
                      {!isBatchClosed && (
                        <button
                          type="button"
                          className={`danger-action small-btn ${removeConfirmSampleId === sample.id ? "confirm-delete" : ""}`}
                          onClick={() => handleRemoveSample(sample.id)}
                        >
                          {removeConfirmSampleId === sample.id ? "确认移出?" : "移出批次"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showAddSampleDialog && selectedBatch && (
          <div className="dialog-overlay" onClick={handleCloseAddSampleDialog}>
            <div className="dialog-content batch-add-sample-dialog" onClick={e => e.stopPropagation()}>
              <div className="dialog-header">
                <div>
                  <p className="eyebrow">批次管理</p>
                  <h2>添加样本到批次</h2>
                </div>
                <button
                  type="button"
                  className="dialog-close-btn"
                  onClick={handleCloseAddSampleDialog}
                >
                  ✕
                </button>
              </div>

              <div className="batch-add-search-bar">
                <div className="batch-filter-group">
                  <label>
                    <span>学生</span>
                    <select
                      value={searchStudentId}
                      onChange={e => setSearchStudentId(e.target.value)}
                    >
                      <option value="all">全部学生</option>
                      {students.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="batch-filter-group">
                  <label>
                    <span>样本类型</span>
                    <select
                      value={searchSampleType}
                      onChange={e => setSearchSampleType(e.target.value)}
                    >
                      <option value="all">全部类型</option>
                      {sampleTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="batch-filter-group">
                  <label>
                    <span>样本名称</span>
                    <input
                      type="text"
                      placeholder="输入样本名称关键词"
                      value={searchSampleName}
                      onChange={e => setSearchSampleName(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="batch-add-count-info">
                共找到 <strong>{filteredAvailableSamples.length}</strong> 个可添加样本
              </div>

              <div className="batch-add-sample-list">
                {filteredAvailableSamples.length === 0 ? (
                  <div className="batch-empty-state small-empty">
                    <div className="batch-empty-icon">🔍</div>
                    <h3>没有可添加的样本</h3>
                    <p>
                      {availableSamples.length === 0
                        ? "所有样本都已加入当前批次，或暂无可用样本。"
                        : "当前搜索条件下没有找到匹配的样本，请调整搜索条件。"}
                    </p>
                  </div>
                ) : (
                  filteredAvailableSamples.map(sample => {
                    const student = students.find(u => u.id === sample.studentId);
                    return (
                      <article key={sample.id} className="batch-add-sample-item">
                        <div className="batch-add-sample-info">
                          <h4>{sample.sampleName}</h4>
                          <p>
                            <span className="batch-student-tag small">
                              {student?.name || sample.studentName}
                            </span>
                            <span className="batch-meta-sep">·</span>
                            <span>{sample.sampleType}</span>
                            <span className="batch-meta-sep">·</span>
                            <span>{sample.stainingMethod}</span>
                            <span className="batch-meta-sep">·</span>
                            <span>{sample.magnifications.length} 条视野</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          className="primary-action small-btn"
                          onClick={() => handleAddSample(sample.id)}
                        >
                          + 添加
                        </button>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="dialog-footer">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleCloseAddSampleDialog}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="batch-review-module">
      <section className="hero batch-hero">
        <div>
          <p className="eyebrow">课堂批量观察</p>
          <h1>实验课批次管理</h1>
          <p className="subtitle">创建实验课批次，学生按批次提交观察记录，教师在同一界面按条件筛选并复核</p>
        </div>
        <div className="stack-card">
          <span>当前身份</span>
          <strong>👨‍🏫 批次复核</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {batchMetricsLabels.map((label, index) => (
          <MetricCard key={label} label={label} value={batchMetrics[index]} index={index} />
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>批次管理</p>
            <h2>实验课批次列表</h2>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "取消创建" : "+ 新建批次"}
          </button>
        </div>

        {showCreateForm && (
          <div className="batch-create-form">
            <div className="batch-create-fields">
              <label>
                <span>批次名称 <em className="required-mark">*</em></span>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={e => setNewBatchName(e.target.value)}
                  placeholder="例如：第三周植物组织观察实验"
                />
              </label>
              <label>
                <span>批次描述</span>
                <input
                  type="text"
                  value={newBatchDesc}
                  onChange={e => setNewBatchDesc(e.target.value)}
                  placeholder="可选：简要描述实验内容与要求"
                />
              </label>
            </div>
            <div className="batch-create-actions">
              <button
                type="button"
                className="primary-action"
                onClick={handleCreateBatch}
                disabled={!newBatchName.trim()}
              >
                确认创建
              </button>
            </div>
          </div>
        )}

        {batches.length === 0 ? (
          <div className="batch-empty-state">
            <div className="batch-empty-icon">🧪</div>
            <h3>还没有实验课批次</h3>
            <p>点击"新建批次"创建一次实验课，学生提交的观察记录将按批次归类，方便您集中复核与评分。</p>
          </div>
        ) : (
          <div className="batch-list">
            {batches.map(batch => {
              const batchSampleList = samples.filter(s => batch.sampleIds.includes(s.id));
              const totalMags = batchSampleList.reduce((sum, s) => sum + s.magnifications.length, 0);
              const pendingMags = batchSampleList.reduce(
                (sum, s) => sum + s.magnifications.filter(m => m.isQualified === undefined).length, 0
              );
              const passMags = batchSampleList.reduce(
                (sum, s) => sum + s.magnifications.filter(m => m.isQualified === true).length, 0
              );

              return (
                <article
                  key={batch.id}
                  className={`batch-card ${batch.status}`}
                  onClick={() => handleBatchSelect(batch.id)}
                >
                  <div className="batch-card-main">
                    <div className="batch-card-header">
                      <h3>{batch.name}</h3>
                      <span className={`batch-status-tag ${batch.status}`}>
                        {batch.status === "open" ? "进行中" : "已截止"}
                      </span>
                    </div>
                    <p className="batch-card-desc">
                      {batch.description || "无描述"}
                    </p>
                    <div className="batch-card-stats">
                      <span className="batch-stat">
                        <em>{batchSampleList.length}</em> 样本
                      </span>
                      <span className="batch-stat">
                        <em>{totalMags}</em> 视野
                      </span>
                      {passMags > 0 && (
                        <span className="batch-stat pass-stat">
                          <em>{passMags}</em> 合格
                        </span>
                      )}
                      {pendingMags > 0 && (
                        <span className="batch-stat pending-stat">
                          <em>{pendingMags}</em> 待评阅
                        </span>
                      )}
                    </div>
                    <p className="batch-card-time">
                      创建于 {new Date(batch.createdAt).toLocaleString("zh-CN")}
                      {batch.createdByName && ` · ${batch.createdByName}`}
                    </p>
                  </div>
                  <div className="batch-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="primary-action small-btn"
                      onClick={() => handleBatchSelect(batch.id)}
                    >
                      进入复核
                    </button>
                    {batch.status === "open" ? (
                      <button
                        type="button"
                        className="batch-action-btn close-btn small-btn"
                        onClick={() => onCloseBatch(batch.id)}
                      >
                        截止
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="batch-action-btn reopen-btn small-btn"
                        onClick={() => onReopenBatch(batch.id)}
                      >
                        重开
                      </button>
                    )}
                    <button
                      type="button"
                      className={`danger-action small-btn ${deleteConfirmId === batch.id ? "confirm-delete" : ""}`}
                      onClick={() => handleDeleteWithConfirm(batch.id)}
                    >
                      {deleteConfirmId === batch.id ? "确认删除?" : "删除"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
