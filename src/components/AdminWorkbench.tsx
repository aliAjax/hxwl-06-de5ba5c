import React, { useState, FormEvent } from "react";
import type { User, SampleCategory, StainingMethod, ObservationTemplate, Role } from "../types";
import { canManageConfig } from "../utils/permissions";
import { MetricCard } from "./MetricCard";

interface TemplateFormData {
  name: string;
  category: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  description: string;
  icon: string;
}

interface AdminWorkbenchProps {
  currentUser: User;
  currentRole: Role;
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  templates: ObservationTemplate[];
  onAddCategory: (name: string) => boolean;
  onUpdateCategory: (id: string, name: string) => boolean;
  onDeleteCategory: (id: string) => void;
  onAddStainingMethod: (name: string) => boolean;
  onUpdateStainingMethod: (id: string, name: string) => boolean;
  onDeleteStainingMethod: (id: string) => void;
  onAddTemplate: (template: Omit<ObservationTemplate, "id">) => boolean;
  onUpdateTemplate: (id: string, template: Partial<Omit<ObservationTemplate, "id">>) => boolean;
  onDeleteTemplate: (id: string) => void;
  isTemplateNameDuplicate: (name: string, excludeId?: string) => boolean;
  countSamplesByType: (typeName: string) => number;
  countSamplesByStaining: (stainingName: string) => number;
  bulkUpdateSampleType: (oldName: string, newName: string) => number;
  bulkUpdateStainingMethod: (oldName: string, newName: string) => number;
}

const EMPTY_TEMPLATE_FORM: TemplateFormData = {
  name: "",
  category: "",
  sampleType: "",
  stainingMethod: "",
  magnification: "400x",
  observedStructure: "",
  description: "",
  icon: "🧬"
};

const MAGNIFICATION_OPTIONS = ["100x", "200x", "400x", "1000x"];
const TEMPLATE_ICONS = ["🌿", "🫀", "🦠", "🩸", "🧬", "🔬", "🧪", "📊", "🌱", "🧫"];

export function AdminWorkbench({
  currentUser,
  currentRole,
  sampleCategories,
  stainingMethods,
  templates,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddStainingMethod,
  onUpdateStainingMethod,
  onDeleteStainingMethod,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  isTemplateNameDuplicate,
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

  const [showAddTemplateForm, setShowAddTemplateForm] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState<TemplateFormData>(EMPTY_TEMPLATE_FORM);
  const [addTemplateError, setAddTemplateError] = useState<Partial<Record<keyof TemplateFormData, string>>>({});

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState<TemplateFormData>(EMPTY_TEMPLATE_FORM);
  const [editTemplateError, setEditTemplateError] = useState<Partial<Record<keyof TemplateFormData, string>>>({});

  const [templateDeleteConfirm, setTemplateDeleteConfirm] = useState<ObservationTemplate | null>(null);

  if (!canManageConfig(currentRole)) {
    return (
      <div className="permission-notice">
        <span className="permission-notice-icon">🔒</span>
        <p>权限不足：仅管理员可以维护系统配置</p>
      </div>
    );
  }

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

  const validateTemplateForm = (form: TemplateFormData, excludeId?: string): Partial<Record<keyof TemplateFormData, string>> => {
    const errors: Partial<Record<keyof TemplateFormData, string>> = {};
    if (!form.name.trim()) errors.name = "模板名称不能为空";
    else if (isTemplateNameDuplicate(form.name.trim(), excludeId)) errors.name = `模板「${form.name}」已存在`;
    if (!form.sampleType.trim()) errors.sampleType = "请选择样本类型";
    if (!form.stainingMethod.trim()) errors.stainingMethod = "请选择染色方式";
    if (!form.magnification.trim()) errors.magnification = "请选择推荐倍率";
    if (!form.observedStructure.trim()) errors.observedStructure = "请填写重点结构";
    return errors;
  };

  const handleAddTemplate = (e: FormEvent) => {
    e.preventDefault();
    const cleanedForm: TemplateFormData = {
      ...newTemplateForm,
      name: newTemplateForm.name.trim(),
      category: newTemplateForm.sampleType.trim(),
      sampleType: newTemplateForm.sampleType.trim(),
      stainingMethod: newTemplateForm.stainingMethod.trim(),
      magnification: newTemplateForm.magnification.trim(),
      observedStructure: newTemplateForm.observedStructure.trim(),
      description: newTemplateForm.description.trim(),
      icon: newTemplateForm.icon || "🧬"
    };
    const errors = validateTemplateForm(cleanedForm);
    if (Object.keys(errors).length > 0) {
      setAddTemplateError(errors);
      return;
    }
    const success = onAddTemplate(cleanedForm);
    if (!success) {
      setAddTemplateError({ name: `模板「${cleanedForm.name}」创建失败` });
      return;
    }
    setNewTemplateForm(EMPTY_TEMPLATE_FORM);
    setAddTemplateError({});
    setShowAddTemplateForm(false);
  };

  const startEditTemplate = (template: ObservationTemplate) => {
    setEditingTemplateId(template.id);
    setEditTemplateForm({
      name: template.name,
      category: template.category,
      sampleType: template.sampleType,
      stainingMethod: template.stainingMethod,
      magnification: template.magnification,
      observedStructure: template.observedStructure,
      description: template.description,
      icon: template.icon
    });
    setEditTemplateError({});
  };

  const cancelEditTemplate = () => {
    setEditingTemplateId(null);
    setEditTemplateForm(EMPTY_TEMPLATE_FORM);
    setEditTemplateError({});
  };

  const saveEditTemplate = () => {
    const cleanedForm: TemplateFormData = {
      ...editTemplateForm,
      name: editTemplateForm.name.trim(),
      category: editTemplateForm.sampleType.trim(),
      sampleType: editTemplateForm.sampleType.trim(),
      stainingMethod: editTemplateForm.stainingMethod.trim(),
      magnification: editTemplateForm.magnification.trim(),
      observedStructure: editTemplateForm.observedStructure.trim(),
      description: editTemplateForm.description.trim(),
      icon: editTemplateForm.icon || "🧬"
    };
    const errors = validateTemplateForm(cleanedForm, editingTemplateId!);
    if (Object.keys(errors).length > 0) {
      setEditTemplateError(errors);
      return;
    }
    const success = onUpdateTemplate(editingTemplateId!, cleanedForm);
    if (!success) {
      setEditTemplateError({ name: `模板「${cleanedForm.name}」更新失败` });
      return;
    }
    setEditingTemplateId(null);
    setEditTemplateForm(EMPTY_TEMPLATE_FORM);
    setEditTemplateError({});
  };

  const handleDeleteTemplate = (template: ObservationTemplate) => {
    setTemplateDeleteConfirm(template);
  };

  const confirmDeleteTemplate = () => {
    if (templateDeleteConfirm) {
      onDeleteTemplate(templateDeleteConfirm.id);
      if (editingTemplateId === templateDeleteConfirm.id) {
        cancelEditTemplate();
      }
    }
    setTemplateDeleteConfirm(null);
  };

  const cancelDeleteTemplate = () => {
    setTemplateDeleteConfirm(null);
  };

  const adminMetrics = [
    String(sampleCategories.length),
    String(stainingMethods.length),
    String(templates.length),
    String(0)
  ];
  const adminMetricsLabels = ["样本分类", "染色方式", "观察模板", "活跃用户"];

  return (
    <>
      <section className="hero admin-hero">
        <div>
          <p className="eyebrow">管理员工作台</p>
          <h1>欢迎，{currentUser.name}</h1>
          <p className="subtitle">在这里你可以维护样本分类、染色方式和课堂观察模板</p>
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

      <section className="panel admin-template-panel">
        <div className="section-heading">
          <div>
            <p>系统配置</p>
            <h2>课堂观察模板管理</h2>
          </div>
          <button
            type="button"
            className={`primary-action ${showAddTemplateForm ? "danger-action" : ""}`}
            onClick={() => {
              setShowAddTemplateForm(!showAddTemplateForm);
              if (showAddTemplateForm) {
                setNewTemplateForm(EMPTY_TEMPLATE_FORM);
                setAddTemplateError({});
              }
            }}
          >
            {showAddTemplateForm ? "取消新增" : "+ 新增模板"}
          </button>
        </div>

        {showAddTemplateForm && (
          <form onSubmit={handleAddTemplate} className="template-form">
            <div className="template-form-grid">
              <label className={addTemplateError.name ? "field-error" : ""}>
                <span>模板名称 <em className="required-mark">*</em></span>
                <input
                  type="text"
                  value={newTemplateForm.name}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="如：植物组织标准观察"
                />
                {addTemplateError.name && <small className="error-text">{addTemplateError.name}</small>}
              </label>

              <label className={addTemplateError.icon ? "field-error" : ""}>
                <span>模板图标</span>
                <div className="icon-picker">
                  {TEMPLATE_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-option ${newTemplateForm.icon === icon ? "icon-selected" : ""}`}
                      onClick={() => setNewTemplateForm(p => ({ ...p, icon }))}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </label>

              <label className={addTemplateError.sampleType ? "field-error" : ""}>
                <span>样本类型 <em className="required-mark">*</em></span>
                <select
                  value={newTemplateForm.sampleType}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, sampleType: e.target.value }))}
                >
                  <option value="">请选择样本类型</option>
                  {sampleCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                {addTemplateError.sampleType && <small className="error-text">{addTemplateError.sampleType}</small>}
              </label>

              <label className={addTemplateError.stainingMethod ? "field-error" : ""}>
                <span>染色方式 <em className="required-mark">*</em></span>
                <select
                  value={newTemplateForm.stainingMethod}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, stainingMethod: e.target.value }))}
                >
                  <option value="">请选择染色方式</option>
                  {stainingMethods.map(stain => (
                    <option key={stain.id} value={stain.name}>{stain.name}</option>
                  ))}
                </select>
                {addTemplateError.stainingMethod && <small className="error-text">{addTemplateError.stainingMethod}</small>}
              </label>

              <label className={addTemplateError.magnification ? "field-error" : ""}>
                <span>推荐倍率 <em className="required-mark">*</em></span>
                <select
                  value={newTemplateForm.magnification}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, magnification: e.target.value }))}
                >
                  {MAGNIFICATION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {addTemplateError.magnification && <small className="error-text">{addTemplateError.magnification}</small>}
              </label>

              <label className={addTemplateError.observedStructure ? "field-error" : ""}>
                <span>重点结构 <em className="required-mark">*</em></span>
                <input
                  type="text"
                  value={newTemplateForm.observedStructure}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, observedStructure: e.target.value }))}
                  placeholder="如：细胞壁、细胞核、叶绿体"
                />
                {addTemplateError.observedStructure && <small className="error-text">{addTemplateError.observedStructure}</small>}
              </label>

              <label className="template-form-full">
                <span>描述说明</span>
                <textarea
                  value={newTemplateForm.description}
                  onChange={(e) => setNewTemplateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="简要描述模板适用场景，方便学生理解"
                  rows={2}
                />
              </label>
            </div>
            <div className="template-form-actions">
              <button type="submit" className="primary-action">确认添加</button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setShowAddTemplateForm(false);
                  setNewTemplateForm(EMPTY_TEMPLATE_FORM);
                  setAddTemplateError({});
                }}
              >
                取消
              </button>
            </div>
          </form>
        )}

        <div className="admin-template-list">
          {templates.length === 0 ? (
            <p className="empty-description">暂无观察模板，请点击「+ 新增模板」添加。</p>
          ) : (
            templates.map(template => (
              <div key={template.id} className="admin-template-item">
                {editingTemplateId === template.id ? (
                  <div className="template-form template-edit-form">
                    <div className="template-form-grid">
                      <label className={editTemplateError.name ? "field-error" : ""}>
                        <span>模板名称 <em className="required-mark">*</em></span>
                        <input
                          type="text"
                          value={editTemplateForm.name}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, name: e.target.value }))}
                        />
                        {editTemplateError.name && <small className="error-text">{editTemplateError.name}</small>}
                      </label>

                      <label>
                        <span>模板图标</span>
                        <div className="icon-picker">
                          {TEMPLATE_ICONS.map(icon => (
                            <button
                              key={icon}
                              type="button"
                              className={`icon-option ${editTemplateForm.icon === icon ? "icon-selected" : ""}`}
                              onClick={() => setEditTemplateForm(p => ({ ...p, icon }))}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </label>

                      <label className={editTemplateError.sampleType ? "field-error" : ""}>
                        <span>样本类型 <em className="required-mark">*</em></span>
                        <select
                          value={editTemplateForm.sampleType}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, sampleType: e.target.value }))}
                        >
                          <option value="">请选择样本类型</option>
                          {sampleCategories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        {editTemplateError.sampleType && <small className="error-text">{editTemplateError.sampleType}</small>}
                      </label>

                      <label className={editTemplateError.stainingMethod ? "field-error" : ""}>
                        <span>染色方式 <em className="required-mark">*</em></span>
                        <select
                          value={editTemplateForm.stainingMethod}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, stainingMethod: e.target.value }))}
                        >
                          <option value="">请选择染色方式</option>
                          {stainingMethods.map(stain => (
                            <option key={stain.id} value={stain.name}>{stain.name}</option>
                          ))}
                        </select>
                        {editTemplateError.stainingMethod && <small className="error-text">{editTemplateError.stainingMethod}</small>}
                      </label>

                      <label className={editTemplateError.magnification ? "field-error" : ""}>
                        <span>推荐倍率 <em className="required-mark">*</em></span>
                        <select
                          value={editTemplateForm.magnification}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, magnification: e.target.value }))}
                        >
                          {MAGNIFICATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {editTemplateError.magnification && <small className="error-text">{editTemplateError.magnification}</small>}
                      </label>

                      <label className={editTemplateError.observedStructure ? "field-error" : ""}>
                        <span>重点结构 <em className="required-mark">*</em></span>
                        <input
                          type="text"
                          value={editTemplateForm.observedStructure}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, observedStructure: e.target.value }))}
                        />
                        {editTemplateError.observedStructure && <small className="error-text">{editTemplateError.observedStructure}</small>}
                      </label>

                      <label className="template-form-full">
                        <span>描述说明</span>
                        <textarea
                          value={editTemplateForm.description}
                          onChange={(e) => setEditTemplateForm(p => ({ ...p, description: e.target.value }))}
                          rows={2}
                        />
                      </label>
                    </div>
                    <div className="template-form-actions">
                      <button type="button" className="primary-action" onClick={saveEditTemplate}>保存修改</button>
                      <button type="button" className="secondary-action" onClick={cancelEditTemplate}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-template-header">
                      <div className="admin-template-icon">{template.icon}</div>
                      <div className="admin-template-main">
                        <div className="admin-template-title-row">
                          <h4>{template.name}</h4>
                        </div>
                        <p className="admin-template-desc">{template.description || "—"}</p>
                        <div className="admin-template-tags">
                          <span className="template-tag">样本：{template.sampleType}</span>
                          <span className="template-tag">染色：{template.stainingMethod}</span>
                          <span className="template-tag">倍率：{template.magnification}</span>
                          <span className="template-tag structure-tag">重点：{template.observedStructure}</span>
                        </div>
                      </div>
                    </div>
                    <div className="admin-item-actions">
                      <button
                        type="button"
                        className="secondary-action admin-edit-btn"
                        onClick={() => startEditTemplate(template)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => handleDeleteTemplate(template)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
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

      {templateDeleteConfirm && (
        <div className="admin-overlay" onClick={cancelDeleteTemplate}>
          <div className="admin-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-dialog-icon">🗑️</div>
            <h3 className="admin-dialog-title">确认删除模板</h3>
            <p className="admin-dialog-message">
              确定要删除观察模板「<strong>{templateDeleteConfirm.name}</strong>」吗？
            </p>
            <div className="admin-dialog-detail">
              <p>删除后：</p>
              <ul>
                <li>学生工作台将不再显示该模板卡片</li>
                <li>不影响已经使用该模板创建的历史样本记录</li>
              </ul>
            </div>
            <div className="admin-dialog-actions">
              <button type="button" className="secondary-action" onClick={cancelDeleteTemplate}>取消</button>
              <button type="button" className="danger-action" onClick={confirmDeleteTemplate}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
