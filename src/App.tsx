import React, { useMemo, useCallback } from "react";
import "./styles.css";
import type { Role, User } from "./types";
import { MAGNIFICATION_GROUPS } from "./constants";
import { useSamples } from "./hooks/useSamples";
import { useBatches } from "./hooks/useBatches";
import { useAdminConfig } from "./hooks/useAdminConfig";
import { useObservationTemplates } from "./hooks/useObservationTemplates";
import { useSession } from "./hooks/useSession";
import { useStudentEntry } from "./hooks/useStudentEntry";
import { useTeacherWorkbench } from "./hooks/useTeacherWorkbench";
import { useAdminHandlers } from "./hooks/useAdminHandlers";
import { useReportDialog } from "./hooks/useReportDialog";
import { useViewNavigation } from "./hooks/useViewNavigation";
import { QualityCheckPanel } from "./components/QualityCheckPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ReportPreviewDialog } from "./components/ReportPreviewDialog";
import { RoleSelector } from "./components/RoleSelector";
import { SampleDetail } from "./components/SampleDetail";
import { StudentWorkbench } from "./components/StudentWorkbench";
import { TeacherWorkbench } from "./components/TeacherWorkbench";
import { AdminWorkbench } from "./components/AdminWorkbench";
import { BatchReviewWorkbench } from "./components/BatchReviewWorkbench";

function App() {
  const {
    currentRole,
    currentUser,
    users,
    setCurrentRole: setCurrentRoleBase,
    setCurrentUser: setCurrentUserBase,
    logout
  } = useSession();

  const {
    sampleCategories,
    stainingMethods,
    addCategory,
    updateCategory,
    deleteCategory,
    addStainingMethod,
    updateStainingMethod,
    deleteStainingMethod
  } = useAdminConfig();

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    isTemplateNameDuplicate
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
    bulkUpdateSampleType,
    bulkUpdateStainingMethod,
    countSamplesByType,
    countSamplesByStaining
  } = useSamples();

  const {
    batches,
    createBatch,
    closeBatch,
    reopenBatch,
    deleteBatch,
    addSampleToBatch,
    removeSampleFromBatch
  } = useBatches(dbStatus, samples);

  const studentEntry = useStudentEntry({
    currentRole,
    currentUser,
    addSample,
    batches,
    addSampleToBatch
  });

  const teacherWorkbench = useTeacherWorkbench({
    currentRole,
    currentUser,
    toggleQualified,
    createBatch,
    closeBatch,
    reopenBatch,
    deleteBatch,
    addSampleToBatch,
    removeSampleFromBatch
  });

  const adminHandlers = useAdminHandlers({
    currentRole,
    addCategory,
    updateCategory,
    deleteCategory,
    addStainingMethod,
    updateStainingMethod,
    deleteStainingMethod,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    bulkUpdateSampleType,
    bulkUpdateStainingMethod
  });

  const reportDialog = useReportDialog({
    currentRole,
    samples
  });

  const viewNavigation = useViewNavigation({
    samples,
    currentRole,
    currentUser,
    addMagnification,
    updateMagnification,
    deleteMagnification
  });

  const handleRoleChange = useCallback(
    (role: Role) => {
      setCurrentRoleBase(role);
      viewNavigation.resetViewNavigation();
      studentEntry.resetStudentEntry();
      teacherWorkbench.resetTeacherWorkbench();
    },
    [setCurrentRoleBase, viewNavigation, studentEntry, teacherWorkbench]
  );

  const handleUserChange = useCallback(
    (user: User) => {
      setCurrentUserBase(user);
      viewNavigation.resetViewNavigation();
      studentEntry.setFormData(prev => ({
        ...prev,
        studentId: user.id,
        studentName: user.name
      }));
      studentEntry.resetForUserChange();
      teacherWorkbench.resetTeacherWorkbench();
    },
    [setCurrentUserBase, viewNavigation, studentEntry, teacherWorkbench]
  );

  const _metrics = useMemo(() => {
    const uniqueSamples = samples.length;
    const totalFields = samples.reduce(
      (sum, sample) => sum + sample.magnifications.length,
      0
    );
    const uniqueStains = new Set(samples.map(sample => sample.stainingMethod))
      .size;
    const uniqueStructures = new Set(
      samples.flatMap(sample =>
        sample.magnifications.map(record => record.observedStructure)
      )
    ).size;
    return [
      String(uniqueSamples),
      String(totalFields),
      String(uniqueStains),
      String(uniqueStructures)
    ];
  }, [samples]);

  const _magnificationStats = useMemo(() => {
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
      {viewNavigation.currentView === "list" ? (
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
              samples={samples.filter(s => s.studentId === currentUser.id)}
              sampleCategories={sampleCategories}
              stainingMethods={stainingMethods}
              templates={templates}
              formData={studentEntry.formData}
              errors={studentEntry.errors}
              selectedTemplate={studentEntry.selectedTemplate}
              qualityResult={studentEntry.qualityResult}
              onTemplateSelect={studentEntry.handleTemplateSelect}
              onInputChange={studentEntry.handleInputChange}
              onSubmit={studentEntry.handleSubmit}
              onSampleClick={viewNavigation.handleSampleClick}
            />
          )}

          {currentUser && currentRole === "teacher" && (
            <>
              <div className="teacher-tabs">
                <button
                  type="button"
                  className={`teacher-tab ${
                    teacherWorkbench.teacherSubView === "overview"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => teacherWorkbench.setTeacherSubView("overview")}
                >
                  👨‍🏫 学生管理
                </button>
                <button
                  type="button"
                  className={`teacher-tab ${
                    teacherWorkbench.teacherSubView === "batch" ? "active" : ""
                  }`}
                  onClick={() => teacherWorkbench.setTeacherSubView("batch")}
                >
                  🧪 批量复核
                </button>
              </div>

              {teacherWorkbench.teacherSubView === "overview" ? (
                <TeacherWorkbench
                  currentUser={currentUser}
                  currentRole={currentRole}
                  samples={samples}
                  users={users}
                  onSampleClick={viewNavigation.handleSampleClick}
                  onToggleQualified={teacherWorkbench.handleToggleQualified}
                />
              ) : (
                <BatchReviewWorkbench
                  currentRole={currentRole}
                  currentUser={currentUser}
                  samples={samples}
                  users={users}
                  batches={batches}
                  onCreateBatch={teacherWorkbench.handleCreateBatch}
                  onCloseBatch={teacherWorkbench.handleCloseBatch}
                  onReopenBatch={teacherWorkbench.handleReopenBatch}
                  onDeleteBatch={teacherWorkbench.handleDeleteBatch}
                  onToggleQualified={teacherWorkbench.handleToggleQualified}
                  onSampleClick={viewNavigation.handleSampleClick}
                  onAddSampleToBatch={
                    teacherWorkbench.handleAddSampleToBatch
                  }
                  onRemoveSampleFromBatch={
                    teacherWorkbench.handleRemoveSampleFromBatch
                  }
                />
              )}
            </>
          )}

          {currentUser && currentRole === "admin" && (
            <>
              <AdminWorkbench
                currentUser={currentUser}
                currentRole={currentRole}
                sampleCategories={sampleCategories}
                stainingMethods={stainingMethods}
                templates={templates}
                onAddCategory={adminHandlers.handleAddCategory}
                onUpdateCategory={adminHandlers.handleUpdateCategory}
                onDeleteCategory={adminHandlers.handleDeleteCategory}
                onAddStainingMethod={adminHandlers.handleAddStainingMethod}
                onUpdateStainingMethod={
                  adminHandlers.handleUpdateStainingMethod
                }
                onDeleteStainingMethod={
                  adminHandlers.handleDeleteStainingMethod
                }
                onAddTemplate={adminHandlers.handleAddTemplate}
                onUpdateTemplate={adminHandlers.handleUpdateTemplate}
                onDeleteTemplate={adminHandlers.handleDeleteTemplate}
                isTemplateNameDuplicate={isTemplateNameDuplicate}
                countSamplesByType={countSamplesByType}
                countSamplesByStaining={countSamplesByStaining}
                bulkUpdateSampleType={adminHandlers.handleBulkUpdateSampleType}
                bulkUpdateStainingMethod={
                  adminHandlers.handleBulkUpdateStainingMethod
                }
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
                  {dbStatus === "unsupported"
                    ? "浏览器不支持本地存储"
                    : "本地存储初始化失败"}
                </p>
                <p className="storage-alert-message">{dbError}</p>
              </div>
            </section>
          )}
        </>
      ) : (
        viewNavigation.selectedSample && currentUser && (
          <SampleDetail
            sample={viewNavigation.selectedSample}
            onBack={viewNavigation.handleBackToList}
            onAddMagnification={viewNavigation.handleAddMagnification}
            onUpdateMagnification={viewNavigation.handleUpdateMagnification}
            onDeleteMagnification={viewNavigation.handleDeleteMagnification}
            onToggleQualified={teacherWorkbench.handleToggleQualified}
            currentRole={currentRole}
            currentUserName={currentUser.name}
            currentUserId={currentUser.id}
          />
        )
      )}

      <ConfirmDialog
        isOpen={studentEntry.submitConfirmDialog}
        title="存在需要注意的问题"
        icon="⚠️"
        message="当前记录存在一些提醒项，虽然可以继续保存，但建议先进行优化。是否确认提交？"
        confirmText="仍要提交"
        cancelText="返回修改"
        onConfirm={studentEntry.handleConfirmSubmit}
        onCancel={studentEntry.handleCancelSubmit}
      >
        <QualityCheckPanel
          result={studentEntry.qualityResult}
          title="检查结果详情"
        />
      </ConfirmDialog>

      <ReportPreviewDialog
        isOpen={reportDialog.reportDialogOpen}
        reportText={reportDialog.reportPlainText}
        reportData={reportDialog.reportData}
        onClose={reportDialog.handleCloseReportDialog}
        onDownload={reportDialog.handleDownloadReport}
      />
    </main>
  );
}

export default App;
