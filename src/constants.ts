import type {
  RoleConfig,
  SampleTypeMagnificationRule,
  ObservationTemplate,
  ObservationField,
  SampleFormData
} from "./types";

export const MAGNIFICATION_GROUPS = ["100x", "200x", "400x", "1000x"] as const;

export const MIN_FIELD_DESCRIPTION_LENGTH = 8;

export const SAMPLE_TYPE_MAGNIFICATION_RULES: SampleTypeMagnificationRule[] = [
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

export const ROLE_CONFIGS: RoleConfig[] = [
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

export const OBSERVATION_TEMPLATES: ObservationTemplate[] = [
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

export const PROJECT_CONFIG = {
  id: "hxwl-06",
  port: 5106,
  title: "显微镜玻片观察",
  subtitle: "样本、多倍率视野与染色观察记录库",
  stack: "React + Vite + TypeScript + CSS",
  theme: ["#4338ca", "#0d9488", "#db2777"],
  domain: "生物显微观察",
  users: ["实验课教师", "学生", "实验管理员"],
  metrics: ["样本数", "视野记录", "染色方法", "重点结构"],
  filters: ["植物组织", "动物组织", "微生物", "血液涂片"],
  fields: [
    { key: "sampleName", label: "样本名称", required: true },
    { key: "sampleType", label: "样本类型", required: true },
    { key: "stainingMethod", label: "染色方式", required: true },
    { key: "magnification", label: "放大倍数", required: true, pattern: /^\d+x$/i },
    { key: "observedStructure", label: "观察结构", required: true },
    { key: "fieldDescription", label: "视野描述", required: false }
  ] satisfies ObservationField[],
  initialRecords: [
    ["洋葱表皮", "植物组织", "碘液", "100x", "细胞排列", "低倍镜下细胞紧密排列，轮廓可辨"],
    ["洋葱表皮", "植物组织", "碘液", "200x", "细胞壁", "中倍镜下细胞壁清晰，细胞核隐约可见"],
    ["洋葱表皮", "植物组织", "碘液", "400x", "细胞壁", "高倍镜下细胞壁清晰，细胞核可见"],
    ["人血涂片", "血液涂片", "瑞氏染色", "1000x", "红细胞", "红细胞分布均匀"],
    ["草履虫", "微生物", "活体观察", "200x", "纤毛", "纤毛运动明显"]
  ]
};

export const INITIAL_SAMPLE_FORM_DATA: SampleFormData = {
  sampleName: "",
  sampleType: "",
  stainingMethod: "",
  magnification: "",
  observedStructure: "",
  fieldDescription: "",
  studentId: "",
  studentName: ""
};

export const EMPTY_MAGNIFICATION_FORM: {
  magnification: string;
  observedStructure: string;
  fieldDescription: string;
} = {
  magnification: "",
  observedStructure: "",
  fieldDescription: ""
};

export const STATUS_COLORS = ["status-ok", "status-watch", "status-danger"];
