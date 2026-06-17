import type { Sample, SampleTypeReport, ReportData } from "../types";
import { SAMPLE_TYPE_MAGNIFICATION_RULES } from "../constants";

const parseMagnificationValue = (magnification: string): number => {
  const value = parseInt(magnification, 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

export const generateObservationReport = (samples: Sample[]): ReportData => {
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

export const generateReportPlainText = (report: ReportData): string => {
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

export const downloadTextFile = (content: string, filename: string): void => {
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
