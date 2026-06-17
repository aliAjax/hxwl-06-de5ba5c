export type Role = "student" | "teacher" | "admin";

export type QualityOverallStatus = "pass" | "warning" | "error";

export type QualityLevel = "error" | "warning";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface SampleCategory {
  id: string;
  name: string;
}

export interface StainingMethod {
  id: string;
  name: string;
}

export interface MagnificationRecord {
  id: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  createdAt: string;
  isQualified?: boolean;
  qualifiedAt?: string;
  reviewedBy?: string;
}

export interface Sample {
  id: string;
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  createdAt: string;
  magnifications: MagnificationRecord[];
  studentId: string;
  studentName: string;
}

export interface MagnificationGroup {
  group: string;
  records: MagnificationRecord[];
}

export interface RoleConfig {
  role: Role;
  label: string;
  icon: string;
  description: string;
}

export interface QualityIssue {
  level: QualityLevel;
  field: string;
  message: string;
  suggestion?: string;
}

export interface QualityCheckResult {
  issues: QualityIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  overallStatus: QualityOverallStatus;
}

export interface SampleTypeMagnificationRule {
  sampleType: string;
  recommended: string[];
  minRecommended: string;
  maxRecommended: string;
}

export interface ObservationTemplate {
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

export interface ObservationField {
  key: keyof SampleFormData;
  label: string;
  required: boolean;
  pattern?: RegExp;
}

export interface SampleFormData {
  sampleName: string;
  sampleType: string;
  stainingMethod: string;
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
  studentId: string;
  studentName: string;
}

export interface MagnificationFormData {
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
}

export interface FormErrors {
  sampleName?: string;
  sampleType?: string;
  stainingMethod?: string;
  magnification?: string;
  observedStructure?: string;
  fieldDescription?: string;
}

export type WorkbenchView = "list" | "detail";

export interface SampleTypeReport {
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

export interface ReportData {
  generatedAt: string;
  totalSamples: number;
  totalRecords: number;
  sampleTypeReports: SampleTypeReport[];
  globalMissingItems: string[];
}

export type DbStatus = "init" | "ready" | "error" | "unsupported";

export type BatchStatus = "open" | "closed";

export type ReviewFilterStatus = "all" | "pending" | "pass" | "fail";

export interface ObservationBatch {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  closedAt?: string;
  status: BatchStatus;
  createdBy: string;
  createdByName: string;
  sampleIds: string[];
}

export interface BatchReviewFilter {
  batchId: string;
  sampleType: string;
  studentId: string;
  qualityStatus: ReviewFilterStatus;
}

export interface MagnificationCoverage {
  sampleType: string;
  recommended: string[];
  recorded: string[];
  missing: string[];
  nonRecommended: string[];
  coverageRate: number;
  isComplete: boolean;
}
