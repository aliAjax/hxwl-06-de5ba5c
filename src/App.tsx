import React, { useState, useMemo, useEffect, useRef, ChangeEvent, FormEvent } from "react";
import "./styles.css";
import {
  observationDb,
  getInitialSamples,
  isIndexedDBSupported,
  type Sample,
  type MagnificationRecord,
  type User,
  type Role,
  type SampleCategory,
  type StainingMethod,
  defaultUsers,
  defaultSampleCategories,
  defaultStainingMethods
} from "./db";

const MAGNIFICATION_GROUPS = ["100x", "200x", "400x", "1000x"] as const;

type QualityLevel = "error" | "warning";

interface SampleTypeReport {
  sampleType: string;
  sampleCount: number;
  stainingMethods: string[];
  magnificationSummaries: {
    magnification: string;
    count: number;
    structures: string[];
    descriptions: string[];
  }[];
  missingItems: string[];
  samples: Sample[];
}

interface ReportData {
  generatedAt: string;
  totalSamples: number;
  totalRecords: number;
  sampleTypeReports: SampleTypeReport[];
  globalMissingItems: string[];
}

const generateObservationReport = (samples: Sample[]): ReportData => {
  const sampleTypeMap = new Map<string, Sample[]>();
  samples.forEach(sample => {
    const type = sample.sampleType || "未分类";
    if (!sampleTypeMap.has(type)) {
      sampleTypeMap.set(type, []);
    }
    sampleTypeMap.get(type)!.push(sample);
  });

  const globalMissingItems: string[] = [];
  const sampleTypeReports: SampleTypeReport[] = [];

  sampleTypeMap.forEach((typeSamples, sampleType) => {
    const stainingMethodsSet = new Set<string>();
    const magDataMap = new Map<string, {
      count: number;
      structures: Set<string>;
      descriptions: string[];
    }>();
    const missingItems: string[] = [];

    typeSamples.forEach(sample => {
      if (sample.stainingMethod?.trim()) {
        stainingMethodsSet.add(sample.stainingMethod);
      }
      if (!sample.stainingMethod?.trim()) {
        missingItems.push(`${sample.sampleName}: 缺失染色方式`);
      }
      if (!sample.sampleName?.trim()) {
        missingItems.push(`样本ID ${sample.id.slice(-6)}: 缺失样本名称`);
      }
      if (sample.magnifications.length === 0) {
        missingItems.push(`${sample.sampleName || "未知样本"}: 无任何视野记录`);
      }

      sample.magnifications.forEach(rec => {
        const mag = rec.magnification.toLowerCase();
        if (!magDataMap.has(mag)) {
          magDataMap.set(mag, {
            count: 0,
            structures: new Set<string>(),
            descriptions: []
          });
        }
        const magData = magDataMap.get(mag)!;
        magData.count++;
        if (rec.observedStructure?.trim()) {
          rec.observedStructure.split(/[、,，\s]+/).forEach(s => {
            const trimmed = s.trim();
            if (trimmed) magData.structures.add(trimmed);
          });
        }
        if (rec.fieldDescription?.trim()) {
          magData.descriptions.push(rec.fieldDescription.trim());
        }
        if (!rec.observedStructure?.trim()) {
          missingItems.push(`${sample.sampleName} @ ${mag}: 缺失重点结构`);
        }
        if (!rec.fieldDescription?.trim()) {
          missingItems.push(`${sample.sampleName} @ ${mag}: 缺失视野描述`);
        }
      });
    });

    const magnificationSummaries = Array.from(magDataMap.entries())
      .sort(([a], [b]) => parseMagnificationValue(a) - parseMagnificationValue(b))
      .map(([magnification, data]) => ({
        magnification,
        count: data.count,
        structures: Array.from(data.structures),
        descriptions: data.descriptions
      }));

    const rule = SAMPLE_TYPE_MAGNIFICATION_RULES.find(r => r.sampleType === sampleType);
    if (rule) {
      const existingMags = magnificationSummaries.map(m => m.magnification);
      const missingRecommendedMags = rule.recommended.filter(
        recMag => !existingMags.includes(recMag)
      );
      if (missingRecommendedMags.length > 0) {
        missingItems.push(
          `${sampleType} 类样本缺少推荐倍率观察: ${missingRecommendedMags.join("、")}`
        );
      }
    }

    sampleTypeReports.push({
      sampleType,
      sampleCount: typeSamples.length,
      stainingMethods: Array.from(stainingMethodsSet),
      magnificationSummaries,
      missingItems,
      samples: typeSamples
    });
  });

  if (samples.length === 0) {
    globalMissingItems.push("暂无任何样本数据");
  } else {
    const uncategorized = samples.filter(s => !s.sampleType?.trim());
    if (uncategorized.length > 0) {
      globalMissingItems.push(`${uncategorized.length} 个样本未设置样本类型`);
    }
    const noStain = samples.filter(s => !s.stainingMethod?.trim());
    if (noStain.length > 0) {
      globalMissingItems.push(`${noStain.length} 个样本未设置染色方式`);
    }
    const noRecords = samples.filter(s => s.magnifications.length === 0);
    if (noRecords.length > 0) {
      globalMissingItems.push(`${noRecords.length} 个样本无任何视野记录`);
    }
  }

  const totalRecords = samples.reduce(
    (sum, s) => sum + s.magnifications.length, 0
  );

  return {
    generatedAt: new Date().toLocaleString("zh-CN"),
    totalSamples: samples.length,
    totalRecords,
    sampleTypeReports: sampleTypeReports.sort(
      (a, b) => b.sampleCount - a.sampleCount
    ),
    globalMissingItems
  };
};

const generateReportPlainText = (report: ReportData): string => {
  const lines: string[] = [];
  const separator = "=".repeat(60);
  const subSeparator = "-".repeat(50);

  lines.push(separator);
  lines.push("              显微镜玻片观察实验报告");
  lines.push(separator);
  lines.push("");
  lines.push(`生成时间: ${report.generatedAt}`);
  lines.push(`样本总数: ${report.totalSamples} 个`);
  lines.push(`视野记录: ${report.totalRecords} 条`);
  lines.push(`样本分类: ${report.sampleTypeReports.length} 类`);
  lines.push("");

  if (report.globalMissingItems.length > 0) {
    lines.push("【全局异常提示】");
    report.globalMissingItems.forEach(item => {
      lines.push(`  ⚠ ${item}`);
    });
    lines.push("");
  }

  lines.push(separator);
  lines.push("                 分 类 详 情");
  lines.push(separator);
  lines.push("");

  report.sampleTypeReports.forEach((typeReport, typeIdx) => {
    lines.push(subSeparator);
    lines.push(`【分类 ${typeIdx + 1}】${typeReport.sampleType}`);
    lines.push(subSeparator);
    lines.push(`样本数量: ${typeReport.sampleCount} 个`);
    lines.push(
      `染色方式: ${typeReport.stainingMethods.length > 0
        ? typeReport.stainingMethods.join("、")
        : "无记录"}`
    );
    lines.push("");

    if (typeReport.magnificationSummaries.length > 0) {
      lines.push("  各放大倍数观察摘要:");
      lines.push("  " + "~".repeat(45));
      typeReport.magnificationSummaries.forEach(magSum => {
        lines.push(`  ▶ ${magSum.magnification}（共 ${magSum.count} 条记录）`);
        lines.push(`    重点结构: ${
          magSum.structures.length > 0
            ? magSum.structures.join("、")
            : "无记录"
        }`);
        if (magSum.descriptions.length > 0) {
          lines.push("    典型描述:");
          magSum.descriptions.slice(0, 3).forEach((desc, i) => {
            lines.push(`      · ${desc}`);
          });
          if (magSum.descriptions.length > 3) {
            lines.push(`      ...（另有 ${magSum.descriptions.length - 3} 条描述）`);
          }
        }
        lines.push("");
      });
    } else {
      lines.push("  各放大倍数观察摘要: 无任何倍率记录");
      lines.push("");
    }

    if (typeReport.missingItems.length > 0) {
      lines.push("  ⚠ 异常/缺失项提示:");
      typeReport.missingItems.forEach((item, i) => {
        lines.push(`    ${i + 1}. ${item}`);
      });
      lines.push("");
    }

    lines.push("  样本清单:");
    typeReport.samples.forEach((sample, sIdx) => {
      const displayStudent = sample.studentName || sample.studentId || "未知学生";
      lines.push(
        `    ${sIdx + 1}. ${sample.sampleName}（${displayStudent}）` +
        ` [${sample.magnifications.length} 条视野]`
      );
      if (sample.magnifications.length > 0) {
        const mags = Array.from(
          new Set(sample.magnifications.map(r => r.magnification.toLowerCase()))
        ).sort((a, b) => parseMagnificationValue(a) - parseMagnificationValue(b));
        lines.push(`       倍率: ${mags.join(" → ")}`);
      }
    });
    lines.push("");
  });

  lines.push(separator);
  lines.push("                    报告结束");
  lines.push(separator);

  return lines.join("\n");
};

const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface QualityIssue {
  level: QualityLevel;
  field: string;
  message: string;
  suggestion?: string;
}

interface QualityCheckResult {
  issues: QualityIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  overallStatus: "pass" | "warning" | "error";
}

interface SampleTypeMagnificationRule {
  sampleType: string;
  recommended: string[];
  minRecommended: string;
  maxRecommended: string;
}

const SAMPLE_TYPE_MAGNIFICATION_RULES: SampleTypeMagnificationRule[] = [
  {
    sampleType: "植物组织",
    recommended: ["100x", "200x", "400x"],
    minRecommended: "100x",
    maxRecommended: "400x"
  },
  {
    sampleType: "动物组织",
    recommended: ["100x", "200x", "400x"],
    minRecommended: "100x",
    maxRecommended: "400x"
  },
  {
    sampleType: "微生物",
    recommended: ["400x", "1000x"],
    minRecommended: "400x",
    maxRecommended: "1000x"
  },
  {
    sampleType: "血液涂片",
    recommended: ["400x", "1000x"],
    minRecommended: "400x",
    maxRecommended: "1000x"
  }
];

const MIN_FIELD_DESCRIPTION_LENGTH = 8;

const parseMagValue = (mag: string): number => {
  const match = mag.match(/^(\d+)x$/i);
  return match ? parseInt(match[1], 10) : 0;
};

const getMagnificationRule = (sampleType: string): SampleTypeMagnificationRule | undefined => {
  return SAMPLE_TYPE_MAGNIFICATION_RULES.find(
    rule => rule.sampleType === sampleType
  );
};

const runQualityCheck = (
  data: {
    sampleName?: string;
    sampleType?: string;
    stainingMethod?: string;
    magnification?: string;
    observedStructure?: string;
    fieldDescription?: string;
  },
  checkSampleLevel: boolean = true
): QualityCheckResult => {
  const issues: QualityIssue[] = [];

  if (checkSampleLevel) {
    if (!data.sampleName?.trim()) {
      issues.push({
        level: "error",
        field: "sampleName",
        message: "样本名称不能为空",
        suggestion: "请填写玻片的样本名称，如「洋葱表皮」"
      });
    }

    if (!data.sampleType?.trim()) {
      issues.push({
        level: "error",
        field: "sampleType",
        message: "样本类型为必填项",
        suggestion: "请选择正确的样本类型分类"
      });
    }

    if (!data.stainingMethod?.trim()) {
      issues.push({
        level: "error",
        field: "stainingMethod",
        message: "染色方式为必填项",
        suggestion: "请选择样本使用的染色方法"
      });
    }
  }

  if (!data.magnification?.trim()) {
    issues.push({
      level: "error",
      field: "magnification",
      message: "放大倍数为必填项",
      suggestion: "请填写放大倍数，如 100x、400x"
    });
  } else if (!/^\d+x$/i.test(data.magnification.trim())) {
    issues.push({
      level: "error",
      field: "magnification",
      message: "放大倍数格式不正确",
      suggestion: "请使用「数字+x」的格式，如 100x、400x、1000x"
    });
  } else if (data.sampleType?.trim()) {
    const rule = getMagnificationRule(data.sampleType.trim());
    if (rule) {
      const magValue = parseMagValue(data.magnification.trim());
      const minValue = parseMagValue(rule.minRecommended);
      const maxValue = parseMagValue(rule.maxRecommended);

      if (magValue < minValue) {
        issues.push({
          level: "warning",
          field: "magnification",
          message: `放大倍数偏低，${data.sampleType}建议使用 ${rule.recommended.join("、")}`,
          suggestion: `${rule.minRecommended} 以下可能无法清晰观察到${data.sampleType}的典型结构`
        });
      } else if (magValue > maxValue) {
        issues.push({
          level: "warning",
          field: "magnification",
          message: `放大倍数偏高，${data.sampleType}建议使用 ${rule.recommended.join("、")}`,
          suggestion: `${rule.maxRecommended} 以上可能超出${data.sampleType}观察的常用范围`
        });
      } else if (!rule.recommended.includes(data.magnification.trim().toLowerCase())) {
        issues.push({
          level: "warning",
          field: "magnification",
          message: `非${data.sampleType}的常用倍率，推荐 ${rule.recommended.join("、")}`,
          suggestion: "请确认当前放大倍数是否适合观察该样本类型"
        });
      }
    }
  }

  if (!data.observedStructure?.trim()) {
    issues.push({
      level: "error",
      field: "observedStructure",
      message: "重点结构不能为空",
      suggestion: "请填写本次观察到的重点结构名称，如「细胞壁」「细胞核」"
    });
  } else if (data.observedStructure.trim().length < 2) {
    issues.push({
      level: "warning",
      field: "observedStructure",
      message: "重点结构描述过短",
      suggestion: "建议使用更具体的结构名称，至少2个字符"
    });
  }

  if (!data.fieldDescription?.trim()) {
    issues.push({
      level: "warning",
      field: "fieldDescription",
      message: "视野描述为空",
      suggestion: "建议填写视野中的观察到的具体现象，便于后期回顾"
    });
  } else if (data.fieldDescription.trim().length < MIN_FIELD_DESCRIPTION_LENGTH) {
    issues.push({
      level: "warning",
      field: "fieldDescription",
      message: `视野描述过短（仅 ${data.fieldDescription.trim().length} 字）`,
      suggestion: `建议描述至少 ${MIN_FIELD_DESCRIPTION_LENGTH} 个字，记录观察到的细节和特征`
    });
  }

  const hasErrors = issues.some(i => i.level === "error");
  const hasWarnings = issues.some(i => i.level === "warning");
  const overallStatus = hasErrors ? "error" : hasWarnings ? "warning" : "pass";

  return { issues, hasErrors, hasWarnings, overallStatus };
};

const getSampleQualityStatus = (sample: Sample): QualityCheckResult => {
  const allIssues: QualityIssue[] = [];

  if (!sample.sampleName?.trim()) {
    allIssues.push({ level: "error", field: "sampleName", message: "样本名称缺失" });
  }
  if (!sample.sampleType?.trim()) {
    allIssues.push({ level: "error", field: "sampleType", message: "样本类型缺失" });
  }
  if (!sample.stainingMethod?.trim()) {
    allIssues.push({ level: "error", field: "stainingMethod", message: "染色方式缺失" });
  }

  if (sample.magnifications.length === 0) {
    allIssues.push({ level: "error", field: "magnifications", message: "无任何视野记录" });
  } else {
    sample.magnifications.forEach((rec, idx) => {
      const recCheck = runQualityCheck(
        {
          sampleType: sample.sampleType,
          magnification: rec.magnification,
          observedStructure: rec.observedStructure,
          fieldDescription: rec.fieldDescription
        },
        false
      );
      recCheck.issues.forEach(issue => {
        allIssues.push({
          ...issue,
          field: `[第${idx + 1}条视野] ${issue.field}`,
          message: `[第${idx + 1}条视野-${rec.magnification}] ${issue.message}`
        });
      });
    });
  }

  const hasErrors = allIssues.some(i => i.level === "error");
  const hasWarnings = allIssues.some(i => i.level === "warning");
  const overallStatus = hasErrors ? "error" : hasWarnings ? "warning" : "pass";

  return { issues: allIssues, hasErrors, hasWarnings, overallStatus };
};

interface SampleFormData {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  studentId: string;
  studentName: string;
}

interface MagnificationFormData {
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
}

type WorkbenchView = "workbench" | "observation";

interface RoleConfig {
  role: Role;
  label: string;
  icon: string;
  description: string;
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



interface MagnificationGroup {
  group: string;
  records: MagnificationRecord[];
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: "student",
    label: "学生",
    icon: "👨‍🎓",
    description: "新增和查看自己的观察记录"
  },
  {
    role: "teacher",
    label: "实验课教师",
    icon: "👨‍🏫",
    description: "查看全班记录并标记重点结构是否合格"
  },
  {
    role: "admin",
    label: "实验管理员",
    icon: "🔧",
    description: "维护样本分类和染色方式选项"
  }
];

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

function QualityCheckPanel({
  result,
  title = "观察质量检查"
}: {
  result: QualityCheckResult;
  title?: string;
}) {
  const errors = result.issues.filter(i => i.level === "error");
  const warnings = result.issues.filter(i => i.level === "warning");

  const statusConfig = {
    pass: { label: "✓ 质量达标", class: "quality-pass", icon: "✅" },
    warning: { label: "⚠ 有改进空间", class: "quality-warning", icon: "⚠️" },
    error: { label: "✗ 存在严重问题", class: "quality-error", icon: "❌" }
  };

  const config = statusConfig[result.overallStatus];

  return (
    <div className={`quality-check-panel ${config.class}`}>
      <div className="quality-check-header">
        <div className="quality-status-icon">{config.icon}</div>
        <div>
          <h4>{title}</h4>
          <p className={`quality-status-text ${config.class}-text`}>{config.label}</p>
        </div>
        <div className="quality-counts">
          {errors.length > 0 && (
            <span className="quality-count error-count">严重 {errors.length}</span>
          )}
          {warnings.length > 0 && (
            <span className="quality-count warning-count">提醒 {warnings.length}</span>
          )}
        </div>
      </div>

      {result.issues.length > 0 && (
        <ul className="quality-issue-list">
          {errors.map((issue, idx) => (
            <li key={`err-${idx}`} className="quality-issue error-issue">
              <span className="issue-level-badge error-badge">严重</span>
              <div className="issue-content">
                <p className="issue-message">{issue.message}</p>
                {issue.suggestion && <p className="issue-suggestion">💡 {issue.suggestion}</p>}
              </div>
            </li>
          ))}
          {warnings.map((issue, idx) => (
            <li key={`warn-${idx}`} className="quality-issue warning-issue">
              <span className="issue-level-badge warning-badge">提醒</span>
              <div className="issue-content">
                <p className="issue-message">{issue.message}</p>
                {issue.suggestion && <p className="issue-suggestion">💡 {issue.suggestion}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QualityBadge({ status }: { status: "pass" | "warning" | "error" }) {
  const badgeConfig = {
    pass: { label: "质量达标", class: "quality-badge-pass" },
    warning: { label: "待改进", class: "quality-badge-warning" },
    error: { label: "质量问题", class: "quality-badge-error" }
  };
  const config = badgeConfig[status];
  return <span className={`quality-badge ${config.class}`}>{config.label}</span>;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  icon = "⚠️",
  confirmText = "确认提交",
  cancelText = "返回修改",
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <span className="confirm-dialog-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <div className="confirm-dialog-body">
          <p>{message}</p>
          {children}
        </div>
        <div className="confirm-dialog-footer">
          <button type="button" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="primary-action" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportPreviewDialogProps {
  isOpen: boolean;
  reportText: string;
  reportData: ReportData | null;
  onClose: () => void;
  onDownload: () => void;
}

function ReportPreviewDialog({
  isOpen,
  reportText,
  reportData,
  onClose,
  onDownload
}: ReportPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!isOpen) return null;

  const generateFilename = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    return `显微镜观察实验报告_${dateStr}_${timeStr}.txt`;
  };

  return (
    <div className="report-dialog-overlay" onClick={onClose}>
      <div className="report-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-dialog-header">
          <div className="report-dialog-title-wrap">
            <span className="report-dialog-icon">📋</span>
            <div>
              <h3>实验观察报告预览</h3>
              <p className="report-dialog-subtitle">
                {reportData && (
                  <>共 {reportData.totalSamples} 个样本 · {reportData.totalRecords} 条视野记录 · {reportData.sampleTypeReports.length} 个分类</>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="report-close-btn"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {reportData && reportData.sampleTypeReports.length > 0 && (
          <div className="report-summary-cards">
            {reportData.sampleTypeReports.map((typeReport) => (
              <div key={typeReport.sampleType} className="report-summary-card">
                <div className="report-summary-header">
                  <strong>{typeReport.sampleType}</strong>
                  <span className="report-summary-count">{typeReport.sampleCount} 个</span>
                </div>
                <div className="report-summary-detail">
                  <span className="report-summary-label">染色:</span>
                  <span className="report-summary-value">
                    {typeReport.stainingMethods.length > 0
                      ? typeReport.stainingMethods.join("、")
                      : "无"}
                  </span>
                </div>
                <div className="report-summary-detail">
                  <span className="report-summary-label">倍率:</span>
                  <span className="report-summary-value">
                    {typeReport.magnificationSummaries.length > 0
                      ? typeReport.magnificationSummaries.map(m => m.magnification).join(" ")
                      : "无"}
                  </span>
                </div>
                {typeReport.missingItems.length > 0 && (
                  <div className="report-summary-warnings">
                    ⚠ {typeReport.missingItems.length} 项异常
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="report-preview-area">
          <div className="report-preview-toolbar">
            <span className="report-preview-title">📝 纯文本报告内容</span>
            <div className="report-preview-stats">
              {reportText.length} 字符
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="report-textarea"
            readOnly
            value={reportText}
            spellCheck={false}
          />
        </div>

        <div className="report-dialog-footer">
          <button type="button" onClick={onClose}>
            关闭预览
          </button>
          <button
            type="button"
            className={`copy-action ${copied ? "copied" : ""}`}
            onClick={handleCopy}
          >
            {copied ? "✓ 已复制到剪贴板" : "📋 复制全部内容"}
          </button>
          <button
            type="button"
            className="primary-action download-action"
            onClick={() => {
              onDownload();
              downloadTextFile(reportText, generateFilename());
            }}
          >
            💾 下载 TXT 文件
          </button>
        </div>
      </div>
    </div>
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

const initialFormData: SampleFormData = {
  sampleName: "",
  sampleType: "",
  stainingMethod: "",
  magnification: "",
  observedStructure: "",
  fieldDescription: "",
  studentId: "",
  studentName: ""
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
  onDeleteMagnification,
  onToggleQualified,
  currentRole,
  currentUserName
}: {
  sample: Sample;
  onBack: () => void;
  onAddMagnification: (sampleId: string, data: MagnificationFormData, forceSubmit?: boolean) => void;
  onUpdateMagnification: (sampleId: string, magId: string, data: MagnificationFormData, forceSubmit?: boolean) => void;
  onDeleteMagnification: (sampleId: string, magId: string) => void;
  onToggleQualified?: (sampleId: string, magId: string, qualified: boolean) => void;
  currentRole: Role;
  currentUserName: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [magFormData, setMagFormData] = useState<MagnificationFormData>(emptyMagnificationForm);
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

function RoleSelector({
  currentRole,
  currentUser,
  users,
  onRoleChange,
  onUserChange
}: {
  currentRole: Role;
  currentUser: User | null;
  users: User[];
  onRoleChange: (role: Role) => void;
  onUserChange: (user: User) => void;
}) {
  const filteredUsers = users.filter(u => u.role === currentRole);

  return (
    <section className="panel role-selector">
      <div className="section-heading">
        <div>
          <p>角色切换</p>
          <h2>实验角色工作台</h2>
        </div>
      </div>
      <div className="role-cards">
        {ROLE_CONFIGS.map(config => (
          <article
            key={config.role}
            className={`role-card ${currentRole === config.role ? "role-active" : ""}`}
            onClick={() => {
              onRoleChange(config.role);
              const firstUser = users.find(u => u.role === config.role);
              if (firstUser) onUserChange(firstUser);
            }}
          >
            <div className="role-icon">{config.icon}</div>
            <h3>{config.label}</h3>
            <p>{config.description}</p>
          </article>
        ))}
      </div>
      <div className="user-select-wrap">
        <label>
          <span>选择用户（模拟登录）</span>
          <select
            value={currentUser?.id || ""}
            onChange={(e) => {
              const user = users.find(u => u.id === e.target.value);
              if (user) onUserChange(user);
            }}
          >
            {filteredUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}（{ROLE_CONFIGS.find(r => r.role === user.role)?.label}）
              </option>
            ))}
          </select>
        </label>
        {currentUser && (
          <div className="current-user-info">
            <span className="user-avatar">
              {ROLE_CONFIGS.find(r => r.role === currentUser.role)?.icon}
            </span>
            <div>
              <strong>{currentUser.name}</strong>
              <p>当前身份：{ROLE_CONFIGS.find(r => r.role === currentUser.role)?.label}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface StudentWorkbenchProps {
  currentUser: User;
  samples: Sample[];
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  formData: SampleFormData;
  errors: FormErrors;
  selectedTemplate: string | null;
  qualityResult: QualityCheckResult;
  onTemplateSelect: (template: ObservationTemplate) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, forceSubmit?: boolean) => void;
  onSampleClick: (sample: Sample) => void;
}

function StudentWorkbench({
  currentUser,
  samples,
  sampleCategories,
  stainingMethods,
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

  const myMetrics = useMemo(() => {
    const uniqueSamples = mySamples.length;
    const totalFields = mySamples.reduce((sum, sample) => sum + sample.magnifications.length, 0);
    const qualifiedFields = mySamples.reduce(
      (sum, sample) =>
        sum + sample.magnifications.filter(r => r.isQualified === true).length,
      0
    );
    const pendingFields = mySamples.reduce(
      (sum, sample) =>
        sum + sample.magnifications.filter(r => r.isQualified === undefined).length,
      0
    );
    return [
      String(uniqueSamples),
      String(totalFields),
      String(qualifiedFields),
      String(pendingFields)
    ];
  }, [mySamples]);

  const studentMetricsLabels = ["我的样本", "视野记录", "已合格", "待评阅"];

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
              {observationTemplates.map(template => (
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
              ))}
            </div>
          </div>

          <p className="form-hint">
            提交后将创建样本并录入第一条倍率视野记录，可在样本详情中继续补充 100x、200x、400x、1000x 等其他倍率观察结果。
          </p>

          <QualityCheckPanel result={qualityResult} title="观察质量预检" />

          <form onSubmit={onSubmit} className="field-grid">
            {project.fields.map(field => (
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
                      list="magnification-options"
                      name={field.key}
                      value={formData[field.key as keyof SampleFormData]}
                      onChange={onInputChange}
                      placeholder={"填写" + field.label + "（如 400x）"}
                    />
                    <datalist id="magnification-options">
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
        </div>
        <div className="record-list">
          {mySamples.length === 0 ? (
            <p className="empty-description">暂无你的样本记录，请通过上方表单创建。</p>
          ) : (
            mySamples.map((sample, index) => {
              const sampleMagStats = MAGNIFICATION_GROUPS.map(mag => ({
                mag,
                count: sample.magnifications.filter(r => r.magnification.toLowerCase() === mag).length
              })).filter(s => s.count > 0);

              const qualifiedCount = sample.magnifications.filter(r => r.isQualified === true).length;
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

function TeacherWorkbench({
  currentUser,
  samples,
  users,
  onSampleClick,
  onToggleQualified,
  onExportSummary
}: {
  currentUser: User;
  samples: Sample[];
  users: User[];
  onSampleClick: (sample: Sample) => void;
  onToggleQualified: (sampleId: string, magId: string, qualified: boolean) => void;
  onExportSummary: () => void;
}) {
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
            <button
              type="button"
              className="export-summary-btn"
              onClick={onExportSummary}
            >
              📊 记录导出摘要
            </button>
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
                      const pendingRecords = sample.magnifications.filter(r => r.isQualified === undefined);

                      return (
                        <article key={sample.id} className="teacher-sample-card">
                          <div
                            className="teacher-sample-info clickable"
                            onClick={() => onSampleClick(sample)}
                          >
                            <h4>{sample.sampleName}</h4>
                            <p>{sample.sampleType} · {sample.stainingMethod}</p>
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

function AdminWorkbench({
  currentUser,
  sampleCategories,
  stainingMethods,
  onAddCategory,
  onDeleteCategory,
  onAddStainingMethod,
  onDeleteStainingMethod
}: {
  currentUser: User;
  sampleCategories: SampleCategory[];
  stainingMethods: StainingMethod[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddStainingMethod: (name: string) => void;
  onDeleteStainingMethod: (id: string) => void;
}) {
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

function App() {
  const [formData, setFormData] = useState<SampleFormData>(initialFormData);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentView, setCurrentView] = useState<"list" | "detail">("list");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<"init" | "ready" | "error" | "unsupported">("init");
  const [dbError, setDbError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const [currentRole, setCurrentRole] = useState<Role>("student");
  const [currentUser, setCurrentUser] = useState<User | null>(defaultUsers[0]);
  const [users] = useState<User[]>(defaultUsers);
  const [sampleCategories, setSampleCategories] = useState<SampleCategory[]>(defaultSampleCategories);
  const [stainingMethods, setStainingMethods] = useState<StainingMethod[]>(defaultStainingMethods);
  const [submitConfirmDialog, setSubmitConfirmDialog] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPlainText, setReportPlainText] = useState<string>("");

  useEffect(() => {
    const initDatabase = async () => {
      try {
        if (!isIndexedDBSupported()) {
          setDbStatus("unsupported");
          setDbError("当前浏览器不支持 IndexedDB，数据将无法持久化保存。刷新页面后数据会丢失。");
          setSamples(getInitialSamples());
          setIsLoading(false);
          return;
        }

        await observationDb.init();
        setDbStatus("ready");

        const savedSamples = await observationDb.getAllSamples();

        if (savedSamples.length === 0) {
          const initialData = getInitialSamples();
          await observationDb.saveSamples(initialData);
          setSamples(initialData);
        } else {
          setSamples(savedSamples);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Database init error:", error);
        setDbStatus("error");
        setDbError(error instanceof Error ? error.message : "数据库初始化失败");
        setSamples(getInitialSamples());
        setIsLoading(false);
      }
    };

    initDatabase();

    return () => {
      observationDb.close();
    };
  }, []);

  const persistSamples = async (newSamples: Sample[]) => {
    if (dbStatus !== "ready") {
      return;
    }
    try {
      await observationDb.saveSamples(newSamples);
    } catch (error) {
      console.error("保存数据失败:", error);
    }
  };

  const handleClearAllRecords = async () => {
    const confirmed = window.confirm(
      "确认清空所有本地记录？此操作将删除所有保存在浏览器中的样本和视野记录，且不可恢复。\n\n清空后会重新加载三条示例记录。"
    );
    if (!confirmed) return;

    try {
      if (dbStatus === "ready") {
        await observationDb.clearAllSamples();
        const initialData = getInitialSamples();
        await observationDb.saveSamples(initialData);
        setSamples(initialData);
      } else {
        const initialData = getInitialSamples();
        setSamples(initialData);
      }
      alert("本地记录已清空，已重新加载示例记录。");
    } catch (error) {
      alert("清空记录失败：" + (error instanceof Error ? error.message : "未知错误"));
    }
  };

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

  const qualityResult = useMemo(() => {
    return runQualityCheck({
      sampleName: formData.sampleName,
      sampleType: formData.sampleType,
      stainingMethod: formData.stainingMethod,
      magnification: formData.magnification,
      observedStructure: formData.observedStructure,
      fieldDescription: formData.fieldDescription
    }, true);
  }, [formData]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      const errKey = key as keyof FormErrors;

      if (field.required && !value.trim()) {
        newErrors[errKey] = `${field.label}为必填项`;
      }

      if (field.pattern && value.trim() && !field.pattern.test(value)) {
        newErrors[errKey] = `${field.label}格式应为 数字+x，如 100x、400x`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const doSubmitSample = () => {
    if (!currentUser) return;

    const now = new Date().toISOString();
    const studentId = currentUser.id;
    const studentName = currentUser.name;

    const existingSample = samples.find(
      sample =>
        sample.sampleName === formData.sampleName.trim() &&
        sample.sampleType === formData.sampleType.trim() &&
        sample.studentId === studentId
    );

    const newMagnification: MagnificationRecord = {
      id: `mag-${Date.now()}`,
      magnification: formData.magnification.trim().toLowerCase(),
      observedStructure: formData.observedStructure.trim(),
      fieldDescription: formData.fieldDescription.trim(),
      createdAt: now
    };

    let newSamples: Sample[];
    if (existingSample) {
      newSamples = samples.map(sample =>
        sample.id === existingSample.id
          ? { ...sample, magnifications: [...sample.magnifications, newMagnification] }
          : sample
      );
    } else {
      const newSample: Sample = {
        id: `sample-${Date.now()}`,
        sampleName: formData.sampleName.trim(),
        sampleType: formData.sampleType.trim(),
        stainingMethod: formData.stainingMethod.trim(),
        createdAt: now,
        magnifications: [newMagnification],
        studentId,
        studentName
      };
      newSamples = [newSample, ...samples];
    }

    setSamples(newSamples);
    persistSamples(newSamples);

    setFormData(initialFormData);
    setErrors({});
    setSelectedTemplate(null);
    setSubmitConfirmDialog(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>, forceSubmit: boolean = false) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!currentUser) return;

    const checkResult = runQualityCheck(
      {
        sampleName: formData.sampleName,
        sampleType: formData.sampleType,
        stainingMethod: formData.stainingMethod,
        magnification: formData.magnification,
        observedStructure: formData.observedStructure,
        fieldDescription: formData.fieldDescription
      },
      true
    );

    if (checkResult.hasErrors) {
      const firstError = checkResult.issues.find(i => i.level === "error");
      alert(`保存失败：${firstError?.message || "存在必填项未填写或格式不正确，请检查后再提交。"}`);
      return;
    }

    if (checkResult.hasWarnings && !forceSubmit) {
      setSubmitConfirmDialog(true);
      return;
    }

    doSubmitSample();
  };

  const handleConfirmSubmit = () => {
    doSubmitSample();
  };

  const handleCancelSubmit = () => {
    setSubmitConfirmDialog(false);
  };

  const handleSampleClick = (sample: Sample) => {
    setSelectedSampleId(sample.id);
    setCurrentView("detail");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedSampleId(null);
  };

  const handleAddMagnification = (sampleId: string, data: MagnificationFormData, _forceSubmit: boolean = true) => {
    const newSamples = samples.map(sample =>
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
    );
    setSamples(newSamples);
    persistSamples(newSamples);
  };

  const handleUpdateMagnification = (
    sampleId: string,
    magId: string,
    data: MagnificationFormData,
    _forceSubmit: boolean = true
  ) => {
    const newSamples = samples.map(sample =>
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
    );
    setSamples(newSamples);
    persistSamples(newSamples);
  };

  const handleDeleteMagnification = (sampleId: string, magId: string) => {
    const newSamples = samples.map(sample =>
      sample.id === sampleId
        ? { ...sample, magnifications: sample.magnifications.filter(record => record.id !== magId) }
        : sample
    );
    setSamples(newSamples);
    persistSamples(newSamples);
  };

  const handleToggleQualified = (sampleId: string, magId: string, qualified: boolean) => {
    if (!currentUser) return;
    const newSamples = samples.map(sample =>
      sample.id === sampleId
        ? {
            ...sample,
            magnifications: sample.magnifications.map(record =>
              record.id === magId
                ? {
                    ...record,
                    isQualified: qualified,
                    qualifiedAt: new Date().toISOString(),
                    reviewedBy: currentUser.name
                  }
                : record
            )
          }
        : sample
    );
    setSamples(newSamples);
    persistSamples(newSamples);
  };

  const handleAddCategory = (name: string) => {
    const newCategory: SampleCategory = {
      id: `cat-${Date.now()}`,
      name
    };
    setSampleCategories(prev => [...prev, newCategory]);
  };

  const handleDeleteCategory = (id: string) => {
    setSampleCategories(prev => prev.filter(c => c.id !== id));
  };

  const handleAddStainingMethod = (name: string) => {
    const newMethod: StainingMethod = {
      id: `stain-${Date.now()}`,
      name
    };
    setStainingMethods(prev => [...prev, newMethod]);
  };

  const handleDeleteStainingMethod = (id: string) => {
    setStainingMethods(prev => prev.filter(s => s.id !== id));
  };

  const handleExportSummary = () => {
    const generatedReport = generateObservationReport(samples);
    const plainText = generateReportPlainText(generatedReport);
    setReportData(generatedReport);
    setReportPlainText(plainText);
    setReportDialogOpen(true);
  };

  const handleCloseReportDialog = () => {
    setReportDialogOpen(false);
  };

  const handleDownloadReport = () => {
  };

  const handleTemplateSelect = (template: ObservationTemplate) => {
    setSelectedTemplate(template.id);
    const studentId = currentUser?.id || "";
    const studentName = currentUser?.name || "";
    setFormData(prev => ({
      ...prev,
      sampleType: template.sampleType,
      stainingMethod: template.stainingMethod,
      magnification: template.magnification,
      observedStructure: template.observedStructure,
      studentId,
      studentName
    }));
    setErrors({});
  };

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p>加载中...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {currentView === "list" ? (
        <>
          <RoleSelector
            currentRole={currentRole}
            currentUser={currentUser}
            users={users}
            onRoleChange={setCurrentRole}
            onUserChange={(user) => {
              setCurrentUser(user);
              setCurrentRole(user.role);
              setFormData(prev => ({
                ...prev,
                studentId: user.id,
                studentName: user.name
              }));
            }}
          />

          {currentUser && currentRole === "student" && (
            <StudentWorkbench
              currentUser={currentUser}
              samples={samples}
              sampleCategories={sampleCategories}
              stainingMethods={stainingMethods}
              formData={formData}
              errors={errors}
              selectedTemplate={selectedTemplate}
              qualityResult={qualityResult}
              onTemplateSelect={handleTemplateSelect}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onSampleClick={handleSampleClick}
            />
          )}

          {currentUser && currentRole === "teacher" && (
            <TeacherWorkbench
              currentUser={currentUser}
              samples={samples}
              users={users}
              onSampleClick={handleSampleClick}
              onToggleQualified={handleToggleQualified}
              onExportSummary={handleExportSummary}
            />
          )}

          {currentUser && currentRole === "admin" && (
            <AdminWorkbench
              currentUser={currentUser}
              sampleCategories={sampleCategories}
              stainingMethods={stainingMethods}
              onAddCategory={handleAddCategory}
              onDeleteCategory={handleDeleteCategory}
              onAddStainingMethod={handleAddStainingMethod}
              onDeleteStainingMethod={handleDeleteStainingMethod}
            />
          )}

          {dbStatus !== "ready" && (
            <section className={`storage-alert ${dbStatus}`}>
              <div className="storage-alert-icon">
                {dbStatus === "unsupported" ? "⚠️" : "❌"}
              </div>
              <div className="storage-alert-content">
                <p className="storage-alert-title">
                  {dbStatus === "unsupported" ? "浏览器不支持本地存储" : "本地存储初始化失败"}
                </p>
                <p className="storage-alert-message">{dbError}</p>
              </div>
            </section>
          )}
        </>
      ) : (
        selectedSample && currentUser && (
          <SampleDetail
            sample={selectedSample}
            onBack={handleBackToList}
            onAddMagnification={handleAddMagnification}
            onUpdateMagnification={handleUpdateMagnification}
            onDeleteMagnification={handleDeleteMagnification}
            onToggleQualified={handleToggleQualified}
            currentRole={currentRole}
            currentUserName={currentUser.name}
          />
        )
      )}

      <ConfirmDialog
        isOpen={submitConfirmDialog}
        title="存在需要注意的问题"
        icon="⚠️"
        message="当前记录存在一些提醒项，虽然可以继续保存，但建议先进行优化。是否确认提交？"
        confirmText="仍要提交"
        cancelText="返回修改"
        onConfirm={handleConfirmSubmit}
        onCancel={handleCancelSubmit}
      >
        <QualityCheckPanel result={qualityResult} title="检查结果详情" />
      </ConfirmDialog>

      <ReportPreviewDialog
        isOpen={reportDialogOpen}
        reportText={reportPlainText}
        reportData={reportData}
        onClose={handleCloseReportDialog}
        onDownload={handleDownloadReport}
      />
    </main>
  );
}

export default App;
