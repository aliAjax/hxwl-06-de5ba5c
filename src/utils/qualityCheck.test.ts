import { describe, it, expect } from "vitest";
import type { Sample, MagnificationRecord } from "../types";
import {
  runQualityCheck,
  getMagnificationCoverage,
  getSampleQualityOverview,
} from "./qualityCheck";

const createMagnificationRecord = (
  overrides: Partial<MagnificationRecord> = {}
): MagnificationRecord => ({
  id: "rec-1",
  magnification: "100x",
  observedStructure: "细胞壁",
  fieldDescription: "视野中观察到清晰的细胞结构",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const createSample = (
  overrides: Partial<Sample> = {},
  magOverrides: Partial<MagnificationRecord>[] = []
): Sample => {
  const defaultMags: MagnificationRecord[] = [
    createMagnificationRecord({
      id: "m1",
      magnification: "100x",
      observedStructure: "细胞壁",
      fieldDescription: "低倍镜下观察到细胞排列整齐，细胞壁清晰可见",
      isQualified: true,
    }),
    createMagnificationRecord({
      id: "m2",
      magnification: "200x",
      observedStructure: "细胞核",
      fieldDescription: "中倍镜下细胞核隐约可见，细胞层次分明",
      isQualified: true,
    }),
    createMagnificationRecord({
      id: "m3",
      magnification: "400x",
      observedStructure: "叶绿体",
      fieldDescription: "高倍镜下叶绿体呈椭圆形，分布于细胞质中",
      isQualified: true,
    }),
  ];
  const magnifications =
    magOverrides.length > 0
      ? magOverrides.map((o, i) =>
          createMagnificationRecord({ ...defaultMags[i], ...o })
        )
      : defaultMags;
  return {
    id: "sample-1",
    sampleName: "洋葱表皮",
    sampleType: "植物组织",
    stainingMethod: "碘液",
    createdAt: "2026-01-01T00:00:00Z",
    magnifications,
    studentId: "stu-1",
    studentName: "张三",
    ...overrides,
  };
};

describe("runQualityCheck", () => {
  describe("放大倍数格式错误", () => {
    it("应检测缺少x后缀的格式错误", () => {
      const result = runQualityCheck(
        {
          magnification: "100",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构",
        },
        false
      );
      expect(result.hasErrors).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          field: "magnification",
          message: "放大倍数格式不正确",
        })
      );
    });

    it("应检测字母非x的格式错误", () => {
      const result = runQualityCheck(
        {
          magnification: "100倍",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构",
        },
        false
      );
      expect(result.hasErrors).toBe(true);
      expect(result.issues.find((i) => i.field === "magnification")?.level).toBe(
        "error"
      );
    });

    it("应检测包含空格的格式错误", () => {
      const result = runQualityCheck(
        {
          magnification: "100 x",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构",
        },
        false
      );
      expect(result.hasErrors).toBe(true);
    });

    it("应接受正确的格式（小写x）", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          sampleType: "植物组织",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构，细胞壁轮廓明显",
        },
        false
      );
      const magError = result.issues.find(
        (i) => i.field === "magnification" && i.level === "error"
      );
      expect(magError).toBeUndefined();
    });

    it("应接受正确的格式（大写X）", () => {
      const result = runQualityCheck(
        {
          magnification: "400X",
          sampleType: "植物组织",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构，细胞壁轮廓明显",
        },
        false
      );
      const magError = result.issues.find(
        (i) => i.field === "magnification" && i.level === "error"
      );
      expect(magError).toBeUndefined();
    });

    it("应检测放大倍数字段为空", () => {
      const result = runQualityCheck(
        {
          magnification: "",
          observedStructure: "细胞壁",
          fieldDescription: "观察到清晰的细胞结构",
        },
        false
      );
      expect(result.hasErrors).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          field: "magnification",
          message: "放大倍数为必填项",
        })
      );
    });
  });

  describe("样本类型推荐倍率告警", () => {
    it("植物组织使用50x（低于推荐最小值）应触发偏低告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "植物组织",
          magnification: "50x",
          observedStructure: "细胞壁",
          fieldDescription: "观察到细胞的基本轮廓",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "magnification",
          message: expect.stringContaining("放大倍数偏低"),
        })
      );
    });

    it("植物组织使用1000x（高于推荐最大值）应触发偏高告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "植物组织",
          magnification: "1000x",
          observedStructure: "细胞壁",
          fieldDescription: "高倍镜下细胞壁结构清晰可见",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "magnification",
          message: expect.stringContaining("放大倍数偏高"),
        })
      );
    });

    it("微生物使用200x（低于推荐最小值）应触发偏低告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "微生物",
          magnification: "200x",
          observedStructure: "鞭毛",
          fieldDescription: "尝试观察微生物的运动状态",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      const magWarning = result.issues.find(
        (i) => i.field === "magnification" && i.level === "warning"
      );
      expect(magWarning?.message).toContain("放大倍数偏低");
    });

    it("血液涂片使用低于推荐范围的倍率应触发偏低告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "血液涂片",
          magnification: "100x",
          observedStructure: "红细胞",
          fieldDescription: "低倍镜下观察血液细胞的分布情况",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "magnification",
          message: expect.stringContaining("放大倍数偏低"),
        })
      );
    });

    it("动物组织使用范围内的非推荐倍率300x应触发非推荐告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "动物组织",
          magnification: "300x",
          observedStructure: "细胞膜",
          fieldDescription: "观察到细胞膜的完整结构以及细胞质的状态",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "magnification",
          message: expect.stringContaining("非动物组织的常用倍率"),
        })
      );
    });

    it("使用推荐倍率范围内的正确倍率不应触发倍率告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "植物组织",
          magnification: "400x",
          observedStructure: "细胞壁",
          fieldDescription: "高倍镜下细胞壁清晰，细胞核可见",
        },
        false
      );
      const magWarnings = result.issues.filter(
        (i) => i.field === "magnification" && i.level === "warning"
      );
      expect(magWarnings).toHaveLength(0);
    });

    it("未知样本类型使用任意倍不应触发推荐倍率告警", () => {
      const result = runQualityCheck(
        {
          sampleType: "未知类型",
          magnification: "50x",
          observedStructure: "细胞结构",
          fieldDescription: "观察到未知样本的基本结构特征",
        },
        false
      );
      const magWarnings = result.issues.filter(
        (i) => i.field === "magnification" && i.level === "warning"
      );
      expect(magWarnings).toHaveLength(0);
    });
  });

  describe("视野描述过短", () => {
    it("视野描述长度为0应触发空描述告警", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          observedStructure: "细胞壁",
          fieldDescription: "",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "fieldDescription",
          message: "视野描述为空",
        })
      );
    });

    it("视野描述长度小于8应触发过短告警", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          observedStructure: "细胞壁",
          fieldDescription: "细胞可见",
        },
        false
      );
      expect(result.hasWarnings).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          level: "warning",
          field: "fieldDescription",
          message: expect.stringContaining("视野描述过短"),
        })
      );
    });

    it("视野描述恰好8字不应触发过短告警", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          observedStructure: "细胞壁",
          fieldDescription: "细胞壁清晰可见细胞排",
        },
        false
      );
      const descWarnings = result.issues.filter(
        (i) => i.field === "fieldDescription" && i.level === "warning"
      );
      expect(descWarnings).toHaveLength(0);
    });

    it("视野描述超过8字不应触发过短告警", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          observedStructure: "细胞壁",
          fieldDescription: "高倍镜下细胞壁清晰，细胞核可见",
        },
        false
      );
      const descWarnings = result.issues.filter(
        (i) => i.field === "fieldDescription" && i.level === "warning"
      );
      expect(descWarnings).toHaveLength(0);
    });
  });

  describe("整体状态判定", () => {
    it("存在错误时overallStatus应为error", () => {
      const result = runQualityCheck(
        {
          magnification: "错误格式",
          observedStructure: "细胞壁",
          fieldDescription: "正常长度的视野描述内容",
        },
        false
      );
      expect(result.overallStatus).toBe("error");
      expect(result.hasErrors).toBe(true);
    });

    it("仅存在警告时overallStatus应为warning", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          sampleType: "植物组织",
          observedStructure: "细胞壁",
          fieldDescription: "短",
        },
        false
      );
      expect(result.overallStatus).toBe("warning");
      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(true);
    });

    it("无任何问题时overallStatus应为pass", () => {
      const result = runQualityCheck(
        {
          magnification: "400x",
          sampleType: "植物组织",
          observedStructure: "细胞壁",
          fieldDescription: "高倍镜下细胞壁清晰，细胞核结构完整可见",
        },
        false
      );
      expect(result.overallStatus).toBe("pass");
      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
    });
  });
});

describe("getMagnificationCoverage", () => {
  describe("缺失推荐倍率", () => {
    it("植物组织缺少400x应正确识别缺失项", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x" },
          { id: "m2", magnification: "200x" },
        ]
      );
      sample.magnifications = sample.magnifications.slice(0, 2);
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.missing).toEqual(["400x"]);
      expect(coverage.isComplete).toBe(false);
    });

    it("植物组织缺少200x和400x应正确识别多项缺失", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [{ id: "m1", magnification: "100x" }]
      );
      sample.magnifications = sample.magnifications.slice(0, 1);
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.missing).toEqual(["200x", "400x"]);
      expect(coverage.isComplete).toBe(false);
    });

    it("所有推荐倍率都已记录时missing应为空且isComplete为true", () => {
      const sample = createSample({ sampleType: "植物组织" });
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.missing).toEqual([]);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.coverageRate).toBeCloseTo(1.0);
    });

    it("微生物推荐400x和1000x，缺少1000x时应正确识别", () => {
      const sample = createSample(
        { sampleType: "微生物" },
        [
          { id: "m1", magnification: "400x" },
        ]
      );
      sample.magnifications = sample.magnifications.slice(0, 1);
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.recommended).toEqual(["400x", "1000x"]);
      expect(coverage.missing).toEqual(["1000x"]);
      expect(coverage.coverageRate).toBeCloseTo(0.5);
    });

    it("倍率大小写不同应视为同一记录", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100X" },
          { id: "m2", magnification: "200x" },
          { id: "m3", magnification: "400X" },
        ]
      );
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.missing).toEqual([]);
      expect(coverage.isComplete).toBe(true);
    });

    it("重复记录同一倍率应去重统计", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x" },
          { id: "m2", magnification: "100x" },
          { id: "m3", magnification: "200x" },
        ]
      );
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.recorded).toHaveLength(2);
      expect(coverage.missing).toEqual(["400x"]);
    });

    it("使用非推荐倍率应正确识别nonRecommended", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x" },
          { id: "m2", magnification: "200x" },
          { id: "m3", magnification: "400x" },
          { id: "m4", magnification: "1000x" },
        ]
      );
      sample.magnifications.push(
        createMagnificationRecord({
          id: "m4",
          magnification: "1000x",
          observedStructure: "细胞",
          fieldDescription: "更高倍率下的观察",
        })
      );
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.nonRecommended).toContain("1000x");
    });

    it("未知样本类型推荐列表为空时coverageRate为1且isComplete为false", () => {
      const sample = createSample(
        { sampleType: "未知样本" },
        [{ id: "m1", magnification: "200x" }]
      );
      sample.magnifications = sample.magnifications.slice(0, 1);
      const coverage = getMagnificationCoverage(sample);
      expect(coverage.recommended).toEqual([]);
      expect(coverage.coverageRate).toBe(1);
      expect(coverage.isComplete).toBe(false);
    });
  });
});

describe("getSampleQualityOverview", () => {
  describe("待评阅记录统计", () => {
    it("isQualified全为undefined时pendingReviewCount应等于记录总数", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x", isQualified: undefined },
          { id: "m2", magnification: "200x", isQualified: undefined },
          { id: "m3", magnification: "400x", isQualified: undefined },
        ]
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.pendingReviewCount).toBe(3);
      expect(overview.totalRecords).toBe(3);
    });

    it("部分记录待评阅应统计正确数量", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x", isQualified: true },
          { id: "m2", magnification: "200x", isQualified: undefined },
          { id: "m3", magnification: "400x", isQualified: false },
        ]
      );
      sample.magnifications.push(
        createMagnificationRecord({
          id: "m4",
          magnification: "400x",
          observedStructure: "叶绿体",
          fieldDescription: "补充观察记录",
          isQualified: undefined,
        })
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.pendingReviewCount).toBe(2);
    });

    it("所有记录已评阅时pendingReviewCount应为0", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x", isQualified: true },
          { id: "m2", magnification: "200x", isQualified: false },
          { id: "m3", magnification: "400x", isQualified: true },
        ]
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.pendingReviewCount).toBe(0);
    });

    it("存在待评阅记录时应触发warning状态", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x", isQualified: true },
          { id: "m2", magnification: "200x", isQualified: undefined },
          { id: "m3", magnification: "400x", isQualified: true },
        ]
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.pendingReviewCount).toBe(1);
      expect(overview.overallStatus).toBe("warning");
      expect(overview.hasIssues).toBe(true);
    });
  });

  describe("综合统计场景", () => {
    it("缺失推荐倍率且存在空描述时应判定为error", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          {
            id: "m1",
            magnification: "100x",
            fieldDescription: "",
            isQualified: true,
          },
          {
            id: "m2",
            magnification: "200x",
            fieldDescription: "中倍镜下观察结果记录详细",
            isQualified: true,
          },
        ]
      );
      sample.magnifications = sample.magnifications.slice(0, 2);
      const overview = getSampleQualityOverview(sample);
      expect(overview.missingMagnificationCount).toBe(1);
      expect(overview.emptyDescriptionCount).toBe(1);
      expect(overview.overallStatus).toBe("error");
    });

    it("视野描述过短和非推荐倍率应统计为warning", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          {
            id: "m1",
            magnification: "100x",
            fieldDescription: "正常长度的详细描述内容",
            isQualified: true,
          },
          {
            id: "m2",
            magnification: "200x",
            fieldDescription: "太短",
            isQualified: true,
          },
          {
            id: "m3",
            magnification: "1000x",
            fieldDescription: "非推荐倍率但描述详细完整",
            isQualified: true,
          },
        ]
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.missingMagnificationCount).toBe(1);
      expect(overview.shortDescriptionCount).toBe(1);
      expect(overview.nonRecommendedMagnificationCount).toBe(1);
    });

    it("所有记录完美时overallStatus应为pass", () => {
      const sample = createSample({ sampleType: "植物组织" });
      const overview = getSampleQualityOverview(sample);
      expect(overview.missingMagnificationCount).toBe(0);
      expect(overview.emptyDescriptionCount).toBe(0);
      expect(overview.shortDescriptionCount).toBe(0);
      expect(overview.nonRecommendedMagnificationCount).toBe(0);
      expect(overview.pendingReviewCount).toBe(0);
      expect(overview.overallStatus).toBe("pass");
      expect(overview.hasIssues).toBe(false);
    });

    it("空视野记录与过短视野记录应分别统计", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          {
            id: "m1",
            magnification: "100x",
            fieldDescription: "",
            isQualified: true,
          },
          {
            id: "m2",
            magnification: "200x",
            fieldDescription: "短小",
            isQualified: true,
          },
          {
            id: "m3",
            magnification: "400x",
            fieldDescription: "该记录的描述非常详细且完整，满足长度要求",
            isQualified: true,
          },
        ]
      );
      const overview = getSampleQualityOverview(sample);
      expect(overview.emptyDescriptionCount).toBe(1);
      expect(overview.shortDescriptionCount).toBe(1);
      expect(overview.overallStatus).toBe("error");
    });

    it("totalRecords应等于magnifications数组长度", () => {
      const sample = createSample(
        { sampleType: "植物组织" },
        [
          { id: "m1", magnification: "100x", isQualified: true },
          { id: "m2", magnification: "200x", isQualified: undefined },
        ]
      );
      sample.magnifications = sample.magnifications.slice(0, 2);
      const overview = getSampleQualityOverview(sample);
      expect(overview.totalRecords).toBe(2);
    });
  });
});
