import { useState, useMemo, useCallback, ChangeEvent, FormEvent } from "react";
import type {
  SampleFormData,
  FormErrors,
  ObservationTemplate,
  QualityCheckResult,
  User,
  Role,
  ObservationBatch
} from "../types";
import {
  INITIAL_SAMPLE_FORM_DATA,
  PROJECT_CONFIG
} from "../constants";
import { runQualityCheck } from "../utils/qualityCheck";
import {
  canSubmitSample,
  getPermissionDeniedMessage
} from "../utils/permissions";

interface UseStudentEntryParams {
  currentRole: Role;
  currentUser: User | null;
  addSample: (formData: SampleFormData, currentUserId: string, currentUserName: string) => string;
  batches: ObservationBatch[];
  addSampleToBatch: (batchId: string, sampleId: string) => void;
}

interface UseStudentEntryReturn {
  formData: SampleFormData;
  setFormData: React.Dispatch<React.SetStateAction<SampleFormData>>;
  errors: FormErrors;
  selectedTemplate: string | null;
  submitConfirmDialog: boolean;
  qualityResult: QualityCheckResult;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  validateForm: () => boolean;
  handleSubmit: (e: FormEvent<HTMLFormElement>, forceSubmit?: boolean) => void;
  handleConfirmSubmit: () => void;
  handleCancelSubmit: () => void;
  handleTemplateSelect: (template: ObservationTemplate) => void;
  resetStudentEntry: () => void;
  resetForUserChange: () => void;
}

export function useStudentEntry({
  currentRole,
  currentUser,
  addSample,
  batches,
  addSampleToBatch
}: UseStudentEntryParams): UseStudentEntryReturn {
  const [formData, setFormData] = useState<SampleFormData>(INITIAL_SAMPLE_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [submitConfirmDialog, setSubmitConfirmDialog] = useState(false);

  const qualityResult = useMemo<QualityCheckResult>(() => {
    return runQualityCheck(
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
  }, [formData]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name as keyof FormErrors]) {
        setErrors(prev => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const validateForm = useCallback((): boolean => {
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
  }, [formData]);

  const doSubmitSample = useCallback(() => {
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
  }, [currentUser, currentRole, addSample, formData, batches, addSampleToBatch]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>, forceSubmit: boolean = false) => {
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
        alert(
          `保存失败：${firstError?.message || "存在必填项未填写或格式不正确，请检查后再提交。"}`
        );
        return;
      }

      if (checkResult.hasWarnings && !forceSubmit) {
        setSubmitConfirmDialog(true);
        return;
      }

      doSubmitSample();
    },
    [validateForm, currentUser, formData, doSubmitSample]
  );

  const handleConfirmSubmit = useCallback(() => {
    doSubmitSample();
  }, [doSubmitSample]);

  const handleCancelSubmit = useCallback(() => {
    setSubmitConfirmDialog(false);
  }, []);

  const handleTemplateSelect = useCallback(
    (template: ObservationTemplate) => {
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
    },
    [currentUser]
  );

  const resetStudentEntry = useCallback(() => {
    setFormData(INITIAL_SAMPLE_FORM_DATA);
    setErrors({});
    setSelectedTemplate(null);
    setSubmitConfirmDialog(false);
  }, []);

  const resetForUserChange = useCallback(() => {
    setErrors({});
    setSelectedTemplate(null);
    setSubmitConfirmDialog(false);
  }, []);

  return {
    formData,
    setFormData,
    errors,
    selectedTemplate,
    submitConfirmDialog,
    qualityResult,
    handleInputChange,
    validateForm,
    handleSubmit,
    handleConfirmSubmit,
    handleCancelSubmit,
    handleTemplateSelect,
    resetStudentEntry,
    resetForUserChange
  };
}
