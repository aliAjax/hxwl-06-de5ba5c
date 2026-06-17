import React, { useState, FormEvent } from "react";
import type { User, SampleCategory, StainingMethod } from "../types";
import { MetricCard } from "./MetricCard";

interface AdminWorkbenchProps {
  currentUser: User;
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddStainingMethod: (name: string) => void;
  onDeleteStainingMethod: (id: string) => void;
}

export function AdminWorkbench({
  currentUser,
  sampleCategories,
  stainingMethods,
  onAddCategory,
  onDeleteCategory,
  onAddStainingMethod,
  onDeleteStainingMethod
}: AdminWorkbenchProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newStainingName, setNewStainingName] = useState("");

  const handleAddCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    onAddCategory(newCategoryName.trim());
    setNewCategoryName("");
  };

  const handleAddStaining = (e: FormEvent) => {
    e.preventDefault();
    if (!newStainingName.trim()) return;
    onAddStainingMethod(newStainingName.trim());
    setNewStainingName("");
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
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入新的样本分类名称"
            />
            <button type="submit" className="primary-action">+ 添加分类</button>
          </form>

          <div className="admin-item-list">
            {sampleCategories.map(cat => (
              <div key={cat.id} className="admin-item">
                <span className="admin-item-name">
                  <span className="item-icon">📁</span>
                  {cat.name}
                </span>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    if (window.confirm(`确认删除分类「${cat.name}」？`)) {
                      onDeleteCategory(cat.id);
                    }
                  }}
                >
                  删除
                </button>
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
            <input
              type="text"
              value={newStainingName}
              onChange={(e) => setNewStainingName(e.target.value)}
              placeholder="输入新的染色方式名称"
            />
            <button type="submit" className="primary-action">+ 添加染色方式</button>
          </form>

          <div className="admin-item-list">
            {stainingMethods.map(stain => (
              <div key={stain.id} className="admin-item">
                <span className="admin-item-name">
                  <span className="item-icon">🧪</span>
                  {stain.name}
                </span>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    if (window.confirm(`确认删除染色方式「${stain.name}」？`)) {
                      onDeleteStainingMethod(stain.id);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
