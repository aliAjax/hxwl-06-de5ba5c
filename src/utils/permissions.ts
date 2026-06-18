import type { Role, User, Sample, MagnificationRecord } from "../types";

export function canSubmitSample(role: Role): boolean {
  return role === "student";
}

export function canModifySample(role: Role, userId: string, sample: Sample): boolean {
  if (role !== "student") return false;
  return sample.studentId === userId;
}

export function canModifyMagnification(
  role: Role,
  userId: string,
  sample: Sample,
  record: MagnificationRecord
): boolean {
  if (!canModifySample(role, userId, sample)) return false;
  return record.isQualified === undefined;
}

export function canReview(role: Role): boolean {
  return role === "teacher";
}

export function canManageBatches(role: Role): boolean {
  return role === "teacher";
}

export function canManageConfig(role: Role): boolean {
  return role === "admin";
}

export function canImportExport(role: Role): boolean {
  return role === "admin";
}

export function canViewSampleDetail(role: Role, userId: string, sample: Sample): boolean {
  if (role === "student") return sample.studentId === userId;
  if (role === "teacher") return true;
  if (role === "admin") return true;
  return false;
}

export function getPermissionDeniedMessage(action: string): string {
  return `权限不足：当前角色无法执行「${action}」操作。`;
}
