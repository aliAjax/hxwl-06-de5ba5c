import React, { useState, useMemo, ChangeEvent, FormEvent } from "react";
import "./styles.css";

interface ObservationFormData {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
}

interface ObservationRecord {
  id: string;
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  createdAt: string;
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
  key: keyof ObservationFormData;
  label: string;
  required: boolean;
  pattern?: RegExp;
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
      "400x",
      "细胞壁",
      "细胞壁清晰，细胞核可见"
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

const initialRecords: ObservationRecord[] = project.initialRecords.map((rec, idx) => ({
  id: `record-${Date.now()}-${idx}`,
  sampleName: rec[0],
  sampleType: rec[1],
  stainingMethod: rec[2],
  magnification: rec[3],
  observedStructure: rec[4],
  fieldDescription: rec[5],
  createdAt: new Date(Date.now() - idx * 86400000).toISOString()
}));

const initialFormData: ObservationFormData = {
  sampleName: "",
  sampleType: "",
  stainingMethod: "",
  magnification: "",
  observedStructure: "",
  fieldDescription: ""
};

function App() {
  const [formData, setFormData] = useState<ObservationFormData>(initialFormData);
  const [records, setRecords] = useState<ObservationRecord[]>(initialRecords);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentView, setCurrentView] = useState<"list" | "detail">("list");
  const [selectedRecord, setSelectedRecord] = useState<ObservationRecord | null>(null);

  const metrics = useMemo(() => {
    const uniqueSamples = new Set(records.map(r => r.sampleName)).size;
    const totalRecords = records.length;
    const uniqueStains = new Set(records.map(r => r.stainingMethod)).size;
    const uniqueStructures = new Set(records.map(r => r.observedStructure)).size;
    return [
      String(uniqueSamples),
      String(totalRecords),
      String(uniqueStains),
      String(uniqueStructures)
    ];
  }, [records]);

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
      const key = field.key as keyof ObservationFormData;
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

    const newRecord: ObservationRecord = {
      id: `record-${Date.now()}`,
      sampleName: formData.sampleName.trim(),
      sampleType: formData.sampleType.trim(),
      stainingMethod: formData.stainingMethod.trim(),
      magnification: formData.magnification.trim().toLowerCase(),
      observedStructure: formData.observedStructure.trim(),
      fieldDescription: formData.fieldDescription.trim(),
      createdAt: new Date().toISOString()
    };

    setRecords(prev => [newRecord, ...prev]);
    setFormData(initialFormData);
    setErrors({});
  };

  const handleRecordClick = (record: ObservationRecord) => {
    setSelectedRecord(record);
    setCurrentView("detail");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedRecord(null);
  };

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

  function SampleDetail({ record, onBack }: { record: ObservationRecord; onBack: () => void }) {
    const detailFields = [
      { key: "sampleType", label: "样本类型", value: record.sampleType },
      { key: "stainingMethod", label: "染色方式", value: record.stainingMethod },
      { key: "magnification", label: "放大倍数", value: record.magnification },
      { key: "observedStructure", label: "观察结构", value: record.observedStructure }
    ];

    return (
      <section className="detail-view">
        <div className="detail-header panel">
          <button className="back-button" onClick={onBack}>
            ← 返回列表
          </button>
          <div className="detail-title">
            <p className="eyebrow">玻片样本详情</p>
            <h1>{record.sampleName}</h1>
            <p className="detail-meta">创建时间：{formatDate(record.createdAt)}</p>
          </div>
        </div>

        <section className="metrics-grid">
          <MetricCard label="样本类型" value={record.sampleType} index={0} />
          <MetricCard label="染色方式" value={record.stainingMethod} index={1} />
          <MetricCard label="放大倍数" value={record.magnification} index={2} />
          <MetricCard label="观察结构" value={record.observedStructure} index={0} />
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

        <section className="panel detail-description">
          <div className="section-heading">
            <div>
              <p>观察记录</p>
              <h2>视野描述</h2>
            </div>
          </div>
          <div className="description-content">
            {record.fieldDescription ? (
              <p>{record.fieldDescription}</p>
            ) : (
              <p className="empty-description">暂无视野描述</p>
            )}
          </div>
        </section>
      </section>
    );
  }

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
              <form onSubmit={handleSubmit} className="field-grid">
                {project.fields.map(field => (
                  <label key={field.key} className={errors[field.key as keyof FormErrors] ? "field-error" : ""}>
                    <span>
                      {field.label}
                      {field.required && <em className="required-mark">*</em>}
                    </span>
                    <input
                      name={field.key}
                      value={formData[field.key as keyof ObservationFormData]}
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
              {records.map((record, index) => (
                <article
                  key={record.id}
                  className="record-card clickable"
                  onClick={() => handleRecordClick(record)}
                >
                  <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{record.sampleName}</h3>
                    <p>
                      {record.sampleType} · {record.stainingMethod} · {record.magnification} · {record.observedStructure}
                      {record.fieldDescription && ` · ${record.fieldDescription}`}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        selectedRecord && <SampleDetail record={selectedRecord} onBack={handleBackToList} />
      )}
    </main>
  );
}

export default App;
