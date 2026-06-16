import React, { useState, useMemo, ChangeEvent, FormEvent } from "react";
import "./styles.css";

const MAGNIFICATION_GROUPS = ["100x", "200x", "400x", "1000x"] as const;

interface MagnificationRecord {
  id: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  createdAt: string;
}

interface Sample {
  id: string;
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  createdAt: string;
  magnifications: MagnificationRecord[];
}

interface SampleFormData {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
}

interface MagnificationFormData {
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
}

interface FormErrors {
  sampleName?: string;
  sampleType?: string;
  stainingMethod?: string;
  magnification?: string;
  observedStructure?: string;
  fieldDescription?: string;
}

interface ObservationField {
  key: keyof SampleFormData;
  label: string;
  required: boolean;
  pattern?: RegExp;
}

interface ObservationTemplate {
  id: string;
  name: string;
  category: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  description: string;
  icon: string;
}

interface LegacyRecord {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  createdAt: string;
}

interface MagnificationGroup {
  group: string;
  records: MagnificationRecord[];
}

const project = {
  "id": "hxwl-06",
  "port": 5106,
  "title": "显微镜玻片观察",
  "subtitle": "样本、多倍率视野与染色观察记录库",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#4338ca",
    "#0d9488",
    "#db2777"
  ],
  "domain": "生物显微观察",
  "users": [
    "实验课教师",
    "学生",
    "实验管理员"
  ],
  "metrics": [
    "样本数",
    "视野记录",
    "染色方法",
    "重点结构"
  ],
  "filters": [
    "植物组织",
    "动物组织",
    "微生物",
    "血液涂片"
  ],
  "fields": [
    { key: "sampleName", label: "样本名称", required: true },
    { key: "sampleType", label: "样本类型", required: true },
    { key: "stainingMethod", label: "染色方式", required: true },
    { key: "magnification", label: "放大倍数", required: true, pattern: /^\d+x$/i },
    { key: "observedStructure", label: "观察结构", required: true },
    { key: "fieldDescription", label: "视野描述", required: false }
  ] satisfies ObservationField[],
  "initialRecords": [
    [
      "洋葱表皮",
      "植物组织",
      "碘液",
      "100x",
      "细胞排列",
      "低倍镜下细胞紧密排列，轮廓可辨"
    ],
    [
      "洋葱表皮",
      "植物组织",
      "碘液",
      "200x",
      "细胞壁",
      "中倍镜下细胞壁清晰，细胞核隐约可见"
    ],
    [
      "洋葱表皮",
      "植物组织",
      "碘液",
      "400x",
      "细胞壁",
      "高倍镜下细胞壁清晰，细胞核可见"
    ],
    [
      "人血涂片",
      "血液涂片",
      "瑞氏染色",
      "1000x",
      "红细胞",
      "红细胞分布均匀"
    ],
    [
      "草履虫",
      "微生物",
      "活体观察",
      "200x",
      "纤毛",
      "纤毛运动明显"
    ]
  ]
};

const observationTemplates: ObservationTemplate[] = [
  {
    id: "plant-tissue",
    name: "植物组织",
    category: "植物组织",
    sampleType: "植物组织",
    stainingMethod: "碘液",
    magnification: "400x",
    observedStructure: "细胞壁、细胞核、叶绿体",
    description: "适用于洋葱表皮、叶片等植物玻片的观察记录",
    icon: "🌿"
  },
  {
    id: "animal-tissue",
    name: "动物组织",
    category: "动物组织",
    sampleType: "动物组织",
    stainingMethod: "HE染色",
    magnification: "400x",
    observedStructure: "细胞膜、细胞质、细胞核",
    description: "适用于口腔上皮细胞、肌肉组织等动物玻片",
    icon: "🫀"
  },
  {
    id: "microorganism",
    name: "微生物",
    category: "微生物",
    sampleType: "微生物",
    stainingMethod: "革兰氏染色",
    magnification: "1000x",
    observedStructure: "细胞壁、鞭毛、荚膜",
    description: "适用于细菌、真菌等微生物玻片观察",
    icon: "🦠"
  },
  {
    id: "blood-smear",
    name: "血液涂片",
    category: "血液涂片",
    sampleType: "血液涂片",
    stainingMethod: "瑞氏染色",
    magnification: "1000x",
    observedStructure: "红细胞、白细胞、血小板",
    description: "适用于人血或动物血涂片的观察记录",
    icon: "🩸"
  }
];

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const parseMagnificationValue = (magnification: string): number => {
  const value = parseInt(magnification, 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

const groupMagnifications = (magnifications: MagnificationRecord[]): MagnificationGroup[] => {
  const groups = new Map<string, MagnificationRecord[]>();
  magnifications.forEach(record => {
    const key = record.magnification.toLowerCase();
    const list = groups.get(key);
    if (list) {
      list.push(record);
    } else {
      groups.set(key, [record]);
    }
  });

  const standardGroups = MAGNIFICATION_GROUPS.filter(group => groups.has(group));
  const extraGroups = Array.from(groups.keys())
    .filter(group => !(MAGNIFICATION_GROUPS as readonly string[]).includes(group))
    .sort((a, b) => parseMagnificationValue(a) - parseMagnificationValue(b));

  return [...standardGroups, ...extraGroups].map(group => ({
    group,
    records: groups.get(group) as MagnificationRecord[]
  }));
};

const migrateToSamples = (records: LegacyRecord[]): Sample[] => {
  const sampleMap = new Map<string, Sample>();
  records.forEach((record, index) => {
    const magnificationRecord: MagnificationRecord = {
      id: `mag-init-${index}`,
      magnification: record.magnification.toLowerCase(),
      observedStructure: record.observedStructure,
      fieldDescription: record.fieldDescription,
      createdAt: record.createdAt
    };
    const existing = sampleMap.get(record.sampleName);
    if (existing) {
      existing.magnifications.push(magnificationRecord);
    } else {
      sampleMap.set(record.sampleName, {
        id: `sample-init-${index}`,
        sampleName: record.sampleName,
        sampleType: record.sampleType,
        stainingMethod: record.stainingMethod,
        createdAt: record.createdAt,
        magnifications: [magnificationRecord]
      });
    }
  });
  return Array.from(sampleMap.values());
};

const legacyRecords: LegacyRecord[] = project.initialRecords.map((rec, idx) => ({
  sampleName: rec[0],
  sampleType: rec[1],
  stainingMethod: rec[2],
  magnification: rec[3],
  observedStructure: rec[4],
  fieldDescription: rec[5],
  createdAt: new Date(Date.now() - idx * 86400000).toISOString()
}));

const initialSamples: Sample[] = migrateToSamples(legacyRecords);

const initialFormData: SampleFormData = {
  sampleName: "",
  sampleType: "",
  stainingMethod: "",
  magnification: "",
  observedStructure: "",
  fieldDescription: ""
};

const emptyMagnificationForm: MagnificationFormData = {
  magnification: "",
  observedStructure: "",
  fieldDescription: ""
};

function SampleDetail({
  sample,
  onBack,
  onAddMagnification,
  onUpdateMagnification,
  onDeleteMagnification
}: {
  sample: Sample;
  onBack: () => void;
  onAddMagnification: (sampleId: string, data: MagnificationFormData) => void;
  onUpdateMagnification: (sampleId: string, magId: string, data: MagnificationFormData) => void;
  onDeleteMagnification: (sampleId: string, magId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [magFormData, setMagFormData] = useState<MagnificationFormData>(emptyMagnificationForm);
  const [magErrors, setMagErrors] = useState<FormErrors>({});

  const groups = useMemo(() => groupMagnifications(sample.magnifications), [sample.magnifications]);

  const detailFields = [
    { key: "sampleType", label: "样本类型", value: sample.sampleType },
    { key: "stainingMethod", label: "染色方式", value: sample.stainingMethod },
    { key: "createdAt", label: "创建时间", value: formatDate(sample.createdAt) },
    { key: "magnifications", label: "视野记录数", value: `${sample.magnifications.length} 条` }
  ];

  const resetForm = () => {
    setMagFormData(emptyMagnificationForm);
    setEditingId(null);
    setMagErrors({});
    setShowForm(false);
  };

  const handleToggleForm = () => {
    if (showForm) {
      resetForm();
    } else {
      setEditingId(null);
      setMagFormData(emptyMagnificationForm);
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

  const handleMagSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateMagForm()) return;
    if (editingId) {
      onUpdateMagnification(sample.id, editingId, magFormData);
    } else {
      onAddMagnification(sample.id, magFormData);
    }
    resetForm();
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
          <button type="button" className="primary-action" onClick={handleToggleForm}>
            {showForm ? "收起表单" : "+ 新增倍率记录"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleMagSubmit} className="magnification-form field-grid">
            <label className={magErrors.magnification ? "field-error" : ""}>
              <span>
                放大倍数
                <em className="required-mark">*</em>
              </span>
              <input
                list="magnification-options"
                name="magnification"
                value={magFormData.magnification}
                onChange={handleMagInputChange}
                placeholder="如 100x、200x、400x、1000x"
              />
              <datalist id="magnification-options">
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
            <div className="form-actions">
              <button type="button" onClick={resetForm}>取消</button>
              <button type="submit" className="primary-action">
                {editingId ? "保存修改" : "新增记录"}
              </button>
            </div>
          </form>
        )}

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
                    <article key={record.id} className="magnification-card">
                      <div className="magnification-card-head">
                        <strong>{record.observedStructure}</strong>
                        <div className="magnification-actions">
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
                        </div>
                      </div>
                      <p className="magnification-description">
                        {record.fieldDescription || "暂无视野描述"}
                      </p>
                      <span className="magnification-time">
                        记录时间：{formatDate(record.createdAt)}
                      </span>
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

function App() {
  const [formData, setFormData] = useState<SampleFormData>(initialFormData);
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentView, setCurrentView] = useState<"list" | "detail">("list");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const selectedSample = useMemo(
    () => samples.find(sample => sample.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  const metrics = useMemo(() => {
    const uniqueSamples = samples.length;
    const totalFields = samples.reduce((sum, sample) => sum + sample.magnifications.length, 0);
    const uniqueStains = new Set(samples.map(sample => sample.stainingMethod)).size;
    const uniqueStructures = new Set(
      samples.flatMap(sample => sample.magnifications.map(record => record.observedStructure))
    ).size;
    return [
      String(uniqueSamples),
      String(totalFields),
      String(uniqueStains),
      String(uniqueStructures)
    ];
  }, [samples]);

  const magnificationStats = useMemo(() => {
    const stats = new Map<string, number>();
    MAGNIFICATION_GROUPS.forEach(group => stats.set(group, 0));
    samples.forEach(sample => {
      sample.magnifications.forEach(record => {
        const key = record.magnification.toLowerCase();
        stats.set(key, (stats.get(key) || 0) + 1);
      });
    });
    return MAGNIFICATION_GROUPS.map(group => ({
      magnification: group,
      count: stats.get(group) || 0
    }));
  }, [samples]);

  const handleTemplateSelect = (template: ObservationTemplate) => {
    setSelectedTemplate(template.id);
    setFormData(prev => ({
      ...prev,
      sampleType: template.sampleType,
      stainingMethod: template.stainingMethod,
      magnification: template.magnification,
      observedStructure: template.observedStructure
    }));
    setErrors({});
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    project.fields.forEach(field => {
      const key = field.key as keyof SampleFormData;
      const value = formData[key];

      if (field.required && !value.trim()) {
        newErrors[key] = `${field.label}为必填项`;
      }

      if (field.pattern && value.trim() && !field.pattern.test(value)) {
        newErrors[key] = `${field.label}格式应为 数字+x，如 100x、400x`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    const now = new Date().toISOString();
    const existingSample = samples.find(
      sample =>
        sample.sampleName === formData.sampleName.trim() &&
        sample.sampleType === formData.sampleType.trim()
    );

    const newMagnification: MagnificationRecord = {
      id: `mag-${Date.now()}`,
      magnification: formData.magnification.trim().toLowerCase(),
      observedStructure: formData.observedStructure.trim(),
      fieldDescription: formData.fieldDescription.trim(),
      createdAt: now
    };

    if (existingSample) {
      setSamples(prev =>
        prev.map(sample =>
          sample.id === existingSample.id
            ? { ...sample, magnifications: [...sample.magnifications, newMagnification] }
            : sample
        )
      );
    } else {
      const newSample: Sample = {
        id: `sample-${Date.now()}`,
        sampleName: formData.sampleName.trim(),
        sampleType: formData.sampleType.trim(),
        stainingMethod: formData.stainingMethod.trim(),
        createdAt: now,
        magnifications: [newMagnification]
      };
      setSamples(prev => [newSample, ...prev]);
    }

    setFormData(initialFormData);
    setErrors({});
    setSelectedTemplate(null);
  };

  const handleSampleClick = (sample: Sample) => {
    setSelectedSampleId(sample.id);
    setCurrentView("detail");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedSampleId(null);
  };

  const handleAddMagnification = (sampleId: string, data: MagnificationFormData) => {
    setSamples(prev =>
      prev.map(sample =>
        sample.id === sampleId
          ? {
              ...sample,
              magnifications: [
                ...sample.magnifications,
                {
                  id: `mag-${Date.now()}`,
                  magnification: data.magnification.trim().toLowerCase(),
                  observedStructure: data.observedStructure.trim(),
                  fieldDescription: data.fieldDescription.trim(),
                  createdAt: new Date().toISOString()
                }
              ]
            }
          : sample
      )
    );
  };

  const handleUpdateMagnification = (
    sampleId: string,
    magId: string,
    data: MagnificationFormData
  ) => {
    setSamples(prev =>
      prev.map(sample =>
        sample.id === sampleId
          ? {
              ...sample,
              magnifications: sample.magnifications.map(record =>
                record.id === magId
                  ? {
                      ...record,
                      magnification: data.magnification.trim().toLowerCase(),
                      observedStructure: data.observedStructure.trim(),
                      fieldDescription: data.fieldDescription.trim()
                    }
                  : record
              )
            }
          : sample
      )
    );
  };

  const handleDeleteMagnification = (sampleId: string, magId: string) => {
    setSamples(prev =>
      prev.map(sample =>
        sample.id === sampleId
          ? { ...sample, magnifications: sample.magnifications.filter(record => record.id !== magId) }
          : sample
      )
    );
  };

  return (
    <main className="app-shell">
      {currentView === "list" ? (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">{project.id} · port {project.port}</p>
              <h1>{project.title}</h1>
              <p className="subtitle">{project.subtitle}</p>
            </div>
            <div className="stack-card">
              <span>技术栈</span>
              <strong>{project.stack}</strong>
            </div>
          </section>

          <section className="metrics-grid">
            {project.metrics.map((metric: string, index: number) => (
              <MetricCard key={metric} label={metric} value={metrics[index]} index={index} />
            ))}
          </section>

          <section className="panel magnification-stats-panel">
            <div className="section-heading">
              <div>
                <p>按倍率统计</p>
                <h2>多倍率视野记录分布</h2>
              </div>
            </div>
            <div className="magnification-stats">
              {magnificationStats.map((stat, index) => (
                <div key={stat.magnification} className="magnification-stat-card">
                  <div className="magnification-stat-header">
                    <span className="magnification-label">{stat.magnification}</span>
                    <strong className="magnification-count">{stat.count}</strong>
                  </div>
                  <div className="magnification-bar-wrapper">
                    <div
                      className={`magnification-bar magnification-bar-${index}`}
                      style={{
                        width: `${
                          magnificationStats.some(s => s.count > 0)
                            ? (stat.count / Math.max(...magnificationStats.map(s => s.count))) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                  <span className="magnification-stat-hint">条视野记录</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace">
            <aside className="panel narrow">
              <h2>角色</h2>
              <div className="chips">
                {project.users.map((user: string) => (
                  <span key={user}>{user}</span>
                ))}
              </div>
              <h2>筛选</h2>
              <div className="chips muted">
                {project.filters.map((filter: string) => (
                  <button key={filter}>{filter}</button>
                ))}
              </div>
            </aside>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p>{project.domain}</p>
                  <h2>观察记录创建</h2>
                </div>
              </div>

              <div className="template-library">
                <div className="template-library-header">
                  <h3>📚 课堂观察模板库</h3>
                  <p className="template-hint">选择模板快速填充观察字段，之后可手动修改</p>
                </div>
                <div className="template-grid">
                  {observationTemplates.map(template => (
                    <article
                      key={template.id}
                      className={`template-card ${selectedTemplate === template.id ? "template-selected" : ""}`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="template-icon">{template.icon}</div>
                      <h4>{template.name}</h4>
                      <p className="template-desc">{template.description}</p>
                      <div className="template-info">
                        <span>染色：{template.stainingMethod}</span>
                        <span>倍数：{template.magnification}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <p className="form-hint">
                提交后将创建样本并录入第一条倍率视野记录，可在样本详情中继续补充 100x、200x、400x、1000x 等其他倍率观察结果。
              </p>

              <form onSubmit={handleSubmit} className="field-grid">
                {project.fields.map(field => (
                  <label key={field.key} className={errors[field.key as keyof FormErrors] ? "field-error" : ""}>
                    <span>
                      {field.label}
                      {field.required && <em className="required-mark">*</em>}
                    </span>
                    <input
                      name={field.key}
                      value={formData[field.key as keyof SampleFormData]}
                      onChange={handleInputChange}
                      placeholder={"填写" + field.label + (field.key === "magnification" ? "（如 400x）" : "")}
                    />
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
                <p>数据</p>
                <h2>近期记录</h2>
              </div>
              <button>导出摘要</button>
            </div>
            <div className="record-list">
              {samples.length === 0 ? (
                <p className="empty-description">暂无样本记录，请通过上方表单创建。</p>
              ) : (
                samples.map((sample, index) => {
                  const sampleMagStats = MAGNIFICATION_GROUPS.map(mag => ({
                    mag,
                    count: sample.magnifications.filter(r => r.magnification.toLowerCase() === mag).length
                  })).filter(s => s.count > 0);

                  return (
                    <article
                      key={sample.id}
                      className="record-card clickable"
                      onClick={() => handleSampleClick(sample)}
                    >
                      <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                      <div className="record-summary">
                        <h3>{sample.sampleName}</h3>
                        <p>
                          {sample.sampleType} · {sample.stainingMethod} · 视野记录 {sample.magnifications.length} 条
                        </p>
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
      ) : (
        selectedSample && (
          <SampleDetail
            sample={selectedSample}
            onBack={handleBackToList}
            onAddMagnification={handleAddMagnification}
            onUpdateMagnification={handleUpdateMagnification}
            onDeleteMagnification={handleDeleteMagnification}
          />
        )
      )}
    </main>
  );
}

export default App;
