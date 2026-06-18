import React, { useState, useMemo, useCallback, ChangeEvent, FormEvent } from "react";
import "./styles.css";
import type {
  Sample,
  Role,
  User,
  SampleCategory,
  StainingMethod,
  SampleFormData,
  MagnificationFormData,
  FormErrors,
  ObservationTemplate,
  ReportData,
  WorkbenchView
} from "./types";
import {
  INITIAL_SAMPLE_FORM_DATA,
  PROJECT_CONFIG,
  MAGNIFICATION_GROUPS
} from "./constants";
import { runQualityCheck } from "./utils/qualityCheck";
import {
  generateObservationReport,
  generateReportPlainText,
  downloadTextFile
} from "./utils/reportGenerator";
import {
  canSubmitSample,
  canModifySample,
  canModifyMagnification,
  canReview,
  canManageBatches,
  canManageConfig,
  canImportExport,
  getPermissionDeniedMessage
} from "./utils/permissions";
import { useSamples } from "./hooks/useSamples";
import { useBatches } from "./hooks/useBatches";
import { useAdminConfig } from "./hooks/useAdminConfig";
import { useObservationTemplates } from "./hooks/useObservationTemplates";
import { useSession } from "./hooks/useSession";
import { defaultUsers } from "./db";
import { MetricCard } from "./components/MetricCard";
import { QualityCheckPanel } from "./components/QualityCheckPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ReportPreviewDialog } from "./components/ReportPreviewDialog";
import { RoleSelector } from "./components/RoleSelector";
import { SampleDetail } from "./components/SampleDetail";
import { StudentWorkbench } from "./components/StudentWorkbench";
import { TeacherWorkbench } from "./components/TeacherWorkbench";
import { AdminWorkbench } from "./components/AdminWorkbench";
import { BatchReviewWorkbench } from "./components/BatchReviewWorkbench";
import { DataImportExportPanel } from "./components/DataImportExportPanel";

function App() {
  const [formData, setFormData] = useState<SampleFormData>(INITIAL_SAMPLE_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentView, setCurrentView] = useState<WorkbenchView>("list");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const {
    currentRole,
    currentUser,
    setCurrentRole: setCurrentRoleBase,
    setCurrentUser: setCurrentUserBase,
    logout
  } = useSession();
  const [users] = useState<User[]>(defaultUsers);
  const [submitConfirmDialog, setSubmitConfirmDialog] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPlainText, setReportPlainText] = useState<string>("");

  const {
    sampleCategories,
    stainingMethods,
    addCategory,
    updateCategory,
    deleteCategory,
    addStainingMethod,
    updateStainingMethod,
    deleteStainingMethod,
    refreshConfig
  } = useAdminConfig();

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    isTemplateNameDuplicate,
    refreshTemplates
  } = useObservationTemplates();

  const {
    samples,
    isLoading,
    dbStatus,
    dbError,
    addSample,
    addMagnification,
    updateMagnification,
    deleteMagnification,
    toggleQualified,
    clearAllRecords,
    bulkUpdateSampleType,
    bulkUpdateStainingMethod,
    countSamplesByType,
    countSamplesByStaining,
    refreshSamples
  } = useSamples();

  const {
    batches,
    createBatch,
    closeBatch,
    reopenBatch,
    deleteBatch,
    addSampleToBatch,
    removeSampleFromBatch,
    refreshBatches
  } = useBatches(dbStatus, samples);

  const [teacherSubView, setTeacherSubView] = useState<"overview" | "batch">("overview");

  const handleRoleChange = useCallback((role: Role) => {
    setCurrentRoleBase(role);
    setCurrentView("list");
    setSelectedSampleId(null);
    setFormData(INITIAL_SAMPLE_FORM_DATA);
    setErrors({});
    setSelectedTemplate(null);
    setTeacherSubView("overview");
  }, [setCurrentRoleBase]);

  const handleUserChange = useCallback((user: User) => {
    setCurrentUserBase(user);
    setCurrentView("list");
    setSelectedSampleId(null);
    setFormData(prev => ({
      ...prev,
      studentId: user.id,
      studentName: user.name
    }));
    setErrors({});
    setSelectedTemplate(null);
    setTeacherSubView("overview");
  }, [setCurrentUserBase]);

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

    PROJECT_CONFIG.fields.forEach(field => {
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
    if (!canSubmitSample(currentRole)) {
      alert(getPermissionDeniedMessage("提交样本"));
      return;
    }
    const sampleId = addSample(formData, currentUser.id, currentUser.name);
    const openBatch = batches.find(b => b.status === "open");
    if (openBatch) {
      addSampleToBatch(openBatch.id, sampleId);
    }
    setFormData(INITIAL_SAMPLE_FORM_DATA);
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
    if (currentRole === "student" && sample.studentId !== currentUser?.id) {
      alert(getPermissionDeniedMessage("查看其他学生的样本详情"));
      return;
    }
    setSelectedSampleId(sample.id);
    setCurrentView("detail");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedSampleId(null);
  };

  const handleAddMagnification = (sampleId: string, data: MagnificationFormData) => {
    if (!currentUser) return;
    const sample = samples.find(s => s.id === sampleId);
    if (!sample || !canModifySample(currentRole, currentUser.id, sample)) {
      alert(getPermissionDeniedMessage("添加视野记录"));
      return;
    }
    addMagnification(sampleId, data);
  };

  const handleUpdateMagnification = (
    sampleId: string,
    magId: string,
    data: MagnificationFormData
  ) => {
    if (!currentUser) return;
    const sample = samples.find(s => s.id === sampleId);
    if (!sample) return;
    const record = sample.magnifications.find(r => r.id === magId);
    if (!record || !canModifyMagnification(currentRole, currentUser.id, sample, record)) {
      alert(getPermissionDeniedMessage("编辑视野记录"));
      return;
    }
    updateMagnification(sampleId, magId, data);
  };

  const handleDeleteMagnification = (sampleId: string, magId: string) => {
    if (!currentUser) return;
    const sample = samples.find(s => s.id === sampleId);
    if (!sample) return;
    const record = sample.magnifications.find(r => r.id === magId);
    if (!record || !canModifyMagnification(currentRole, currentUser.id, sample, record)) {
      alert(getPermissionDeniedMessage("删除视野记录"));
      return;
    }
    deleteMagnification(sampleId, magId);
  };

  const handleToggleQualified = (
    sampleId: string,
    magId: string,
    qualified: boolean,
    unqualifiedReason?: string,
    revisionSuggestion?: string
  ) => {
    if (!currentUser) return;
    if (!canReview(currentRole)) {
      alert(getPermissionDeniedMessage("评阅"));
      return;
    }
    toggleQualified(sampleId, magId, qualified, currentUser.name, unqualifiedReason, revisionSuggestion);
  };

  const handleExportSummary = (filteredSamples?: Sample[]) => {
    const targetSamples = filteredSamples ?? samples;
    if (targetSamples.length === 0) {
      alert("暂无任何样本数据，无法生成报告。请先添加观察记录。");
      return;
    }
    const generatedReport = generateObservationReport(targetSamples);
    const plainText = generateReportPlainText(generatedReport);
    setReportData(generatedReport);
    setReportPlainText(plainText);
    setReportDialogOpen(true);
  };

  const handleCloseReportDialog = () => {
    setReportDialogOpen(false);
  };

  const handleDownloadReport = () => {
    if (!reportData || reportData.totalSamples === 0) {
      alert("暂无任何样本数据，无法下载报告。请先添加观察记录。");
      return;
    }
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `显微镜观察实验报告_${dateStr}_${timeStr}.txt`;
    downloadTextFile(reportPlainText, filename);
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

  const handleDataImported = useCallback(async () => {
    await Promise.all([
      refreshSamples(),
      refreshBatches()
    ]);
    refreshConfig();
    refreshTemplates();
  }, [refreshSamples, refreshBatches, refreshConfig, refreshTemplates]);

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
            onRoleChange={handleRoleChange}
            onUserChange={handleUserChange}
            onLogout={logout}
          />

          {currentUser && currentRole === "student" && (
            <StudentWorkbench
              currentUser={currentUser}
              samples={samples}
              sampleCategories={sampleCategories}
              stainingMethods={stainingMethods}
              templates={templates}
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
            <>
              <div className="teacher-tabs">
                <button
                  type="button"
                  className={`teacher-tab ${teacherSubView === "overview" ? "active" : ""}`}
                  onClick={() => setTeacherSubView("overview")}
                >
                  👨‍🏫 学生管理
                </button>
                <button
                  type="button"
                  className={`teacher-tab ${teacherSubView === "batch" ? "active" : ""}`}
                  onClick={() => setTeacherSubView("batch")}
                >
                  🧪 批量复核
                </button>
              </div>

              {teacherSubView === "overview" ? (
                <TeacherWorkbench
                  currentUser={currentUser}
                  samples={samples}
                  users={users}
                  onSampleClick={handleSampleClick}
                  onToggleQualified={handleToggleQualified}
                  onExportSummary={handleExportSummary}
                />
              ) : (
                <BatchReviewWorkbench
                  currentRole={currentRole}
                  currentUser={currentUser}
                  samples={samples}
                  users={users}
                  batches={batches}
                  onCreateBatch={createBatch}
                  onCloseBatch={closeBatch}
                  onReopenBatch={reopenBatch}
                  onDeleteBatch={deleteBatch}
                  onToggleQualified={handleToggleQualified}
                  onSampleClick={handleSampleClick}
                  onAddSampleToBatch={addSampleToBatch}
                  onRemoveSampleFromBatch={removeSampleFromBatch}
                />
              )}
            </>
          )}

          {currentUser && currentRole === "admin" && (
            <>
              <DataImportExportPanel currentRole={currentRole} onDataImported={handleDataImported} />
              <AdminWorkbench
                currentUser={currentUser}
                sampleCategories={sampleCategories}
                stainingMethods={stainingMethods}
                templates={templates}
                onAddCategory={(name: string) => addCategory(name) !== null}
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onAddStainingMethod={(name: string) => addStainingMethod(name) !== null}
                onUpdateStainingMethod={updateStainingMethod}
                onDeleteStainingMethod={deleteStainingMethod}
                onAddTemplate={(t) => addTemplate(t) !== null}
                onUpdateTemplate={updateTemplate}
                onDeleteTemplate={deleteTemplate}
                isTemplateNameDuplicate={isTemplateNameDuplicate}
                countSamplesByType={countSamplesByType}
                countSamplesByStaining={countSamplesByStaining}
                bulkUpdateSampleType={bulkUpdateSampleType}
                bulkUpdateStainingMethod={bulkUpdateStainingMethod}
              />
            </>
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
            currentUserId={currentUser.id}
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
