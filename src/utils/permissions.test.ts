import { describe, it, expect } from "vitest";
import type { Sample, MagnificationRecord } from "../types";
import {
  canSubmitSample,
  canModifySample,
  canModifyMagnification,
  canReview,
  canManageBatches,
  canManageConfig,
  canImportExport,
  canExportReport,
  canViewSampleDetail,
  getPermissionDeniedMessage,
} from "./permissions";

const createSample = (studentId: string): Sample => ({
  id: "sample-1",
  sampleName: "测试样本",
  sampleType: "植物组织",
  stainingMethod: "碘液",
  createdAt: "2026-01-01T00:00:00Z",
  magnifications: [],
  studentId,
  studentName: "测试学生",
});

const createMagnificationRecord = (
  isQualified?: boolean
): MagnificationRecord => ({
  id: "mag-1",
  magnification: "400x",
  observedStructure: "细胞壁",
  fieldDescription: "测试描述",
  createdAt: "2026-01-01T00:00:00Z",
  isQualified,
});

describe("canSubmitSample", () => {
  it("学生角色应能提交样本", () => {
    expect(canSubmitSample("student")).toBe(true);
  });

  it("教师角色不能提交样本", () => {
    expect(canSubmitSample("teacher")).toBe(false);
  });

  it("管理员角色不能提交样本", () => {
    expect(canSubmitSample("admin")).toBe(false);
  });
});

describe("canModifySample", () => {
  it("学生可以修改自己的样本", () => {
    const sample = createSample("student-1");
    expect(canModifySample("student", "student-1", sample)).toBe(true);
  });

  it("学生不能修改他人的样本", () => {
    const sample = createSample("student-2");
    expect(canModifySample("student", "student-1", sample)).toBe(false);
  });

  it("教师不能修改任何样本", () => {
    const sample = createSample("student-1");
    expect(canModifySample("teacher", "teacher-1", sample)).toBe(false);
  });

  it("管理员不能修改任何样本", () => {
    const sample = createSample("student-1");
    expect(canModifySample("admin", "admin-1", sample)).toBe(false);
  });
});

describe("canModifyMagnification", () => {
  it("学生可以修改自己未评阅的记录", () => {
    const sample = createSample("student-1");
    const record = createMagnificationRecord(undefined);
    expect(canModifyMagnification("student", "student-1", sample, record)).toBe(
      true
    );
  });

  it("学生不能修改自己已通过评阅的记录", () => {
    const sample = createSample("student-1");
    const record = createMagnificationRecord(true);
    expect(canModifyMagnification("student", "student-1", sample, record)).toBe(
      false
    );
  });

  it("学生不能修改自己未通过评阅的记录", () => {
    const sample = createSample("student-1");
    const record = createMagnificationRecord(false);
    expect(canModifyMagnification("student", "student-1", sample, record)).toBe(
      false
    );
  });

  it("学生不能修改他人样本的记录", () => {
    const sample = createSample("student-2");
    const record = createMagnificationRecord(undefined);
    expect(canModifyMagnification("student", "student-1", sample, record)).toBe(
      false
    );
  });

  it("教师不能修改任何记录", () => {
    const sample = createSample("student-1");
    const record = createMagnificationRecord(undefined);
    expect(canModifyMagnification("teacher", "teacher-1", sample, record)).toBe(
      false
    );
  });
});

describe("canReview", () => {
  it("教师角色可以评阅", () => {
    expect(canReview("teacher")).toBe(true);
  });

  it("学生角色不能评阅", () => {
    expect(canReview("student")).toBe(false);
  });

  it("管理员角色不能评阅", () => {
    expect(canReview("admin")).toBe(false);
  });
});

describe("canManageBatches", () => {
  it("教师可以管理批次", () => {
    expect(canManageBatches("teacher")).toBe(true);
  });

  it("学生不能管理批次", () => {
    expect(canManageBatches("student")).toBe(false);
  });

  it("管理员不能管理批次", () => {
    expect(canManageBatches("admin")).toBe(false);
  });
});

describe("canManageConfig", () => {
  it("管理员可以管理配置", () => {
    expect(canManageConfig("admin")).toBe(true);
  });

  it("学生不能管理配置", () => {
    expect(canManageConfig("student")).toBe(false);
  });

  it("教师不能管理配置", () => {
    expect(canManageConfig("teacher")).toBe(false);
  });
});

describe("canImportExport", () => {
  it("所有角色都不能导入导出", () => {
    expect(canImportExport("student")).toBe(false);
    expect(canImportExport("teacher")).toBe(false);
    expect(canImportExport("admin")).toBe(false);
  });
});

describe("canExportReport", () => {
  it("所有角色都不能导出报告", () => {
    expect(canExportReport("student")).toBe(false);
    expect(canExportReport("teacher")).toBe(false);
    expect(canExportReport("admin")).toBe(false);
  });
});

describe("canViewSampleDetail", () => {
  it("学生可以查看自己的样本详情", () => {
    const sample = createSample("student-1");
    expect(canViewSampleDetail("student", "student-1", sample)).toBe(true);
  });

  it("学生不能查看他人的样本详情", () => {
    const sample = createSample("student-2");
    expect(canViewSampleDetail("student", "student-1", sample)).toBe(false);
  });

  it("教师可以查看所有样本详情", () => {
    const sample = createSample("student-1");
    expect(canViewSampleDetail("teacher", "teacher-1", sample)).toBe(true);
  });

  it("管理员可以查看所有样本详情", () => {
    const sample = createSample("student-1");
    expect(canViewSampleDetail("admin", "admin-1", sample)).toBe(true);
  });
});

describe("getPermissionDeniedMessage", () => {
  it("应返回包含操作名的权限不足消息", () => {
    const message = getPermissionDeniedMessage("删除样本");
    expect(message).toContain("权限不足");
    expect(message).toContain("删除样本");
  });
});
