import type {
  QualityIssue,
  QualityCheckResult,
  Sample,
  SampleTypeMagnificationRule,
  MagnificationRecord,
  MagnificationCoverage,
  SampleQualityOverview
} from "../types";
import {
  SAMPLE_TYPE_MAGNIFICATION_RULES,
  MIN_FIELD_DESCRIPTION_LENGTH
} from "../constants";

const parseMagValue = (mag: string): number => {
  const match = mag.match(/^(\d+)x$/i);
  return match ? parseInt(match[1], 10) : 0;
};

export const getMagnificationRule = (
  sampleType: string
): SampleTypeMagnificationRule | undefined => {
  return SAMPLE_TYPE_MAGNIFICATION_RULES.find(
    rule => rule.sampleType === sampleType
  );
};

interface QualityCheckInput {
  sampleName?: string;
  sampleType?: string;
  stainingMethod?: string;
  magnification?: string;
  observedStructure?: string;
  fieldDescription?: string;
}

export const runQualityCheck = (
  data: QualityCheckInput,
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

export const getSampleQualityStatus = (sample: Sample): QualityCheckResult => {
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
    sample.magnifications.forEach((rec: MagnificationRecord, idx: number) => {
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

export const getMagnificationCoverage = (
  sample: Sample
): MagnificationCoverage => {
  const rule = getMagnificationRule(sample.sampleType);
  const recommended = rule ? [...rule.recommended] : [];

  const recordedSet = new Set<string>();
  sample.magnifications.forEach(rec => {
    recordedSet.add(rec.magnification.toLowerCase());
  });

  const recorded = Array.from(recordedSet);
  const missing = recommended.filter(mag => !recordedSet.has(mag.toLowerCase()));
  const nonRecommended = recorded.filter(
    mag => !recommended.includes(mag.toLowerCase())
  );

  const coverageRate =
    recommended.length > 0
      ? (recommended.length - missing.length) / recommended.length
      : 1;

  const isComplete = recommended.length > 0 && missing.length === 0;

  return {
    sampleType: sample.sampleType,
    recommended,
    recorded,
    missing,
    nonRecommended,
    coverageRate,
    isComplete
  };
};

export const getSampleQualityOverview = (
  sample: Sample
): SampleQualityOverview => {
  const coverage = getMagnificationCoverage(sample);
  const missingMagnifications = coverage.missing;
  const nonRecommendedMagnifications = coverage.nonRecommended;

  let emptyDescriptionCount = 0;
  let shortDescriptionCount = 0;
  let pendingReviewCount = 0;

  sample.magnifications.forEach((rec: MagnificationRecord) => {
    const desc = rec.fieldDescription?.trim() ?? "";
    if (!desc) {
      emptyDescriptionCount++;
    } else if (desc.length < MIN_FIELD_DESCRIPTION_LENGTH) {
      shortDescriptionCount++;
    }

    if (rec.isQualified === undefined) {
      pendingReviewCount++;
    }
  });

  const totalRecords = sample.magnifications.length;

  let overallStatus: QualityOverallStatus = "pass";
  const hasErrors =
    missingMagnifications.length > 0 ||
    emptyDescriptionCount > 0;
  const hasWarnings =
    shortDescriptionCount > 0 ||
    nonRecommendedMagnifications.length > 0 ||
    pendingReviewCount > 0;

  if (hasErrors) {
    overallStatus = "error";
  } else if (hasWarnings) {
    overallStatus = "warning";
  }

  const hasIssues =
    missingMagnifications.length > 0 ||
    emptyDescriptionCount > 0 ||
    shortDescriptionCount > 0 ||
    nonRecommendedMagnifications.length > 0 ||
    pendingReviewCount > 0;

  return {
    missingMagnifications,
    missingMagnificationCount: missingMagnifications.length,
    emptyDescriptionCount,
    shortDescriptionCount,
    nonRecommendedMagnifications,
    nonRecommendedMagnificationCount: nonRecommendedMagnifications.length,
    pendingReviewCount,
    totalRecords,
    overallStatus,
    hasIssues
  };
};
