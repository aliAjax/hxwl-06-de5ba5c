import React, { useState, FormEvent } from "react";
import type { User, SampleCategory, StainingMethod } from "../types";
import { MetricCard } from "./MetricCard";

interface AdminWorkbenchProps {
  currentUser: User;
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  onAddCategory: (name: string) => boolean;
  onUpdateCategory: (id: string, name: string) => boolean;
  onDeleteCategory: (id: string) => void;
  onAddStainingMethod: (name: string) => boolean;
  onUpdateStainingMethod: (id: string, name: string) => boolean;
  onDeleteStainingMethod: (id: string) => void;
  countSamplesByType: (typeName: string) => number;
  countSamplesByStaining: (stainingName: string) => number;
  bulkUpdateSampleType: (oldName: string, newName: string) => number;
  bulkUpdateStainingMethod: (oldName: string, newName: string) => number;
}

export function AdminWorkbench({
  currentUser,
  sampleCategories,
  stainingMethods,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddStainingMethod,
  onUpdateStainingMethod,
  onDeleteStainingMethod,
  countSamplesByType,
  countSamplesByStaining,
  bulkUpdateSampleType,
  bulkUpdateStainingMethod
}: AdminWorkbenchProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newStainingName, setNewStainingName] = useState("");
  const [addError, setAddError] = useState<{ category?: string; staining?: string }>({});

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryError, setEditingCategoryError] = useState("");

  const [editingStainingId, setEditingStainingId] = useState<string | null>(null);
  const [editingStainingName, setEditingStainingName] = useState("");
  const [editingStainingError, setEditingStainingError] = useState("");

  const [deleteWarning, setDeleteWarning] = useState<{
    type: "category" | "staining";
    id: string;
    name: string;
    count: number;
  } | null>(null);

  const handleAddCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    const success = onAddCategory(name);
    if (!success) {
      setAddError(prev => ({ ...prev, category: `分类「${name}」已存在，请使用其他名称` }));
      return;
    }
    setNewCategoryName("");
    setAddError(prev => ({ ...prev, category: undefined }));
  };

  const handleAddStaining = (e: FormEvent) => {
    e.preventDefault();
    const name = newStainingName.trim();
    if (!name) return;
    const success = onAddStainingMethod(name);
    if (!success) {
      setAddError(prev => ({ ...prev, staining: `染色方式「${name}」已存在，请使用其他名称` }));
      return;
    }
    setNewStainingName("");
    setAddError(prev => ({ ...prev, staining: undefined }));
  };

  const startEditCategory = (cat: SampleCategory) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
    setEditingCategoryError("");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryError("");
  };

  const saveEditCategory = () => {
    const name = editingCategoryName.trim();
    if (!name) {
      setEditingCategoryError("名称不能为空");
      return;
    }
    const success = onUpdateCategory(editingCategoryId!, name);
    if (!success) {
      setEditingCategoryError(`分类「${name}」已存在，请使用其他名称`);
      return;
    }

    const oldCat = sampleCategories.find(c => c.id === editingCategoryId);
    if (oldCat && oldCat.name !== name) {
      const affectedCount = countSamplesByType(oldCat.name);
      if (affectedCount > 0) {
        const doMigrate = window.confirm(
          `分类「${oldCat.name}」被 ${affectedCount} 条样本记录引用。\n` +
          `是否同步更新这些样本的分类名称为「${name}」？\n\n` +
          `点击「确定」：同步更新已有样本（推荐，保持数据一致性）\n` +
          `点击「取消」：仅更新配置，已有样本保留旧名称（可能导致下拉选项与历史记录不一致）`
        );
        if (doMigrate) {
          bulkUpdateSampleType(oldCat.name, name);
        }
      }
    }

    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryError("");
  };

  const startEditStaining = (stain: StainingMethod) => {
    setEditingStainingId(stain.id);
    setEditingStainingName(stain.name);
    setEditingStainingError("");
  };

  const cancelEditStaining = () => {
    setEditingStainingId(null);
    setEditingStainingName("");
    setEditingStainingError("");
  };

  const saveEditStaining = () => {
    const name = editingStainingName.trim();
    if (!name) {
      setEditingStainingError("名称不能为空");
      return;
    }
    const success = onUpdateStainingMethod(editingStainingId!, name);
    if (!success) {
      setEditingStainingError(`染色方式「${name}」已存在，请使用其他名称`);
      return;
    }

    const oldStain = stainingMethods.find(s => s.id === editingStainingId);
    if (oldStain && oldStain.name !== name) {
      const affectedCount = countSamplesByStaining(oldStain.name);
      if (affectedCount > 0) {
        const doMigrate = window.confirm(
          `染色方式「${oldStain.name}」被 ${affectedCount} 条样本记录引用。\n` +
          `是否同步更新这些样本的染色方式为「${name}」？\n\n` +
          `点击「确定」：同步更新已有样本（推荐，保持数据一致性）\n` +
          `点击「取消」：仅更新配置，已有样本保留旧名称（可能导致下拉选项与历史记录不一致）`
        );
        if (doMigrate) {
          bulkUpdateStainingMethod(oldStain.name, name);
        }
      }
    }

    setEditingStainingId(null);
    setEditingStainingName("");
    setEditingStainingError("");
  };

  const handleDeleteCategory = (cat: SampleCategory) => {
    const affectedCount = countSamplesByType(cat.name);
    if (affectedCount > 0) {
      setDeleteWarning({ type: "category", id: cat.id, name: cat.name, count: affectedCount });
      return;
    }
    if (window.confirm(`确认删除分类「${cat.name}」？`)) {
      onDeleteCategory(cat.id);
    }
  };

  const handleDeleteStaining = (stain: StainingMethod) => {
    const affectedCount = countSamplesByStaining(stain.name);
    if (affectedCount > 0) {
      setDeleteWarning({ type: "staining", id: stain.id, name: stain.name, count: affectedCount });
      return;
    }
    if (window.confirm(`确认删除染色方式「${stain.name}」？`)) {
      onDeleteStainingMethod(stain.id);
    }
  };

  const closeDeleteWarning = () => {
    setDeleteWarning(null);
  };

  const adminMetrics = [
    String(sampleCategories.length),
    String(stainingMethods.length),
    String(0),
    String(0)
  ];
  const adminMetricsLabels = ["样本分类", "染色方式", "总记录数", "活跃用户"];

  return (
    <>
      <section className="hero admin-hero">
        <div>
          <p className="eyebrow">管理员工作台</p>
          <h1>欢迎，{currentUser.name}</h1>
          <p className="subtitle">在这里你可以维护样本分类和染色方式选项</p>
        </div>
        <div className="stack-card">
          <span>当前身份</span>
          <strong>🔧 实验管理员</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {adminMetricsLabels.map((label: string, index: number) => (
          <MetricCard key={label} label={label} value={adminMetrics[index]} index={index} />
        ))}
      </section>

      <section className="workspace">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>系统配置</p>
              <h2>样本分类管理</h2>
            </div>
          </div>

          <form onSubmit={handleAddCategory} className="admin-add-form">
            <div className="admin-add-input-wrap">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (addError.category) setAddError(prev => ({ ...prev, category: undefined }));
                }}
                placeholder="输入新的样本分类名称"
              />
              {addError.category && <p className="admin-field-error">{addError.category}</p>}
            </div>
            <button type="submit" className="primary-action">+ 添加分类</button>
          </form>

          <div className="admin-item-list">
            {sampleCategories.map(cat => (
              <div key={cat.id} className="admin-item">
                {editingCategoryId === cat.id ? (
                  <div className="admin-item-edit">
                    <div className="admin-edit-input-wrap">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => {
                          setEditingCategoryName(e.target.value);
                          if (editingCategoryError) setEditingCategoryError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEditCategory(); }
                          if (e.key === "Escape") cancelEditCategory();
                        }}
                        autoFocus
                      />
                      {editingCategoryError && <p className="admin-field-error">{editingCategoryError}</p>}
                    </div>
                    <div className="admin-edit-actions">
                      <button type="button" className="primary-action admin-edit-save" onClick={saveEditCategory}>保存</button>
                      <button type="button" className="admin-edit-cancel" onClick={cancelEditCategory}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="admin-item-name">
                      <span className="item-icon">📁</span>
                      {cat.name}
                      {countSamplesByType(cat.name) > 0 && (
                        <span className="admin-item-badge">{countSamplesByType(cat.name)} 条样本引用</span>
                      )}
                    </span>
                    <div className="admin-item-actions">
                      <button
                        type="button"
                        className="secondary-action admin-edit-btn"
                        onClick={() => startEditCategory(cat)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => handleDeleteCategory(cat)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>系统配置</p>
              <h2>染色方式管理</h2>
            </div>
          </div>

          <form onSubmit={handleAddStaining} className="admin-add-form">
            <div className="admin-add-input-wrap">
              <input
                type="text"
                value={newStainingName}
                onChange={(e) => {
                  setNewStainingName(e.target.value);
                  if (addError.staining) setAddError(prev => ({ ...prev, staining: undefined }));
                }}
                placeholder="输入新的染色方式名称"
              />
              {addError.staining && <p className="admin-field-error">{addError.staining}</p>}
            </div>
            <button type="submit" className="primary-action">+ 添加染色方式</button>
          </form>

          <div className="admin-item-list">
            {stainingMethods.map(stain => (
              <div key={stain.id} className="admin-item">
                {editingStainingId === stain.id ? (
                  <div className="admin-item-edit">
                    <div className="admin-edit-input-wrap">
                      <input
                        type="text"
                        value={editingStainingName}
                        onChange={(e) => {
                          setEditingStainingName(e.target.value);
                          if (editingStainingError) setEditingStainingError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEditStaining(); }
                          if (e.key === "Escape") cancelEditStaining();
                        }}
                        autoFocus
                      />
                      {editingStainingError && <p className="admin-field-error">{editingStainingError}</p>}
                    </div>
                    <div className="admin-edit-actions">
                      <button type="button" className="primary-action admin-edit-save" onClick={saveEditStaining}>保存</button>
                      <button type="button" className="admin-edit-cancel" onClick={cancelEditStaining}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="admin-item-name">
                      <span className="item-icon">🧪</span>
                      {stain.name}
                      {countSamplesByStaining(stain.name) > 0 && (
                        <span className="admin-item-badge">{countSamplesByStaining(stain.name)} 条样本引用</span>
                      )}
                    </span>
                    <div className="admin-item-actions">
                      <button
                        type="button"
                        className="secondary-action admin-edit-btn"
                        onClick={() => startEditStaining(stain)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => handleDeleteStaining(stain)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </section>

      {deleteWarning && (
        <div className="admin-overlay" onClick={closeDeleteWarning}>
          <div className="admin-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-dialog-icon">⚠️</div>
            <h3 className="admin-dialog-title">无法删除</h3>
            <p className="admin-dialog-message">
              {deleteWarning.type === "category" ? "分类" : "染色方式"}「{deleteWarning.name}」
              目前被 <strong>{deleteWarning.count}</strong> 条样本记录引用，无法直接删除。
            </p>
            <div className="admin-dialog-detail">
              <p>如需删除，请先处理以下受影响的样本：</p>
              <ul>
                <li>将相关样本的分类/染色方式改为其他选项</li>
                <li>或删除引用了该选项的所有样本记录</li>
              </ul>
            </div>
            <div className="admin-dialog-actions">
              <button type="button" className="primary-action" onClick={closeDeleteWarning}>我知道了</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
