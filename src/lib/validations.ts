import { z } from 'zod';

const trim = (s: string) => s.trim();

// ===== Service agreement =====
const serviceAgreementSchema = z.object({
  sampleDelivery: z.enum(['self', 'courier']),
  testMethod: z.enum(['standard', 'custom', 'previous']),
  testMethodDoneBefore: z.string().nullable().optional(),
  testMethodDetail: z.string().optional(),
  testDuration: z.enum(['normal', 'extended', 'urgent']),
  testDurationDays: z.number().int().positive().nullable().optional(),
  requireUncertainty: z.boolean(),
});

export const petitionItemSchema = z.object({
  seq: z.number().int().positive(),
  sampleName: z.string().min(1, 'กรุณากรอกชื่อตัวอย่าง').transform(trim),
  commonName: z.string().optional().default(''),
  batchNo: z.string().min(1, 'กรุณากรอกเลขแบช'),
  productionDate: z.string().nullable().optional(),
  submissionNo: z.string().optional().default(''),
  packageUnit: z.string().optional().default(''),
  testUnit: z.string().optional().default(''),
  testItems: z.string().optional().default(''),
  note: z.string().optional().default(''),
  labelManufacturer: z.string().optional().default(''),
  labelSeller: z.string().optional().default(''),
  labelQuantity: z.string().optional().default(''),
  labelSampledBy: z.string().optional().default(''),
  labelSampledDate: z.string().optional().default(''),
  labelRemark: z.string().optional().default(''),
});

export const submitterSchema = z.object({
  employeeId: z.string().optional(),
  name: z.string().min(1, 'กรุณาเลือกผู้ยื่นคำขอ').transform(trim),
  submittedAt: z.string().optional(),
});

export const delivererSchema = z.object({
  employeeId: z.string().optional(),
  name: z.string().min(1, 'กรุณาเลือกผู้นำส่ง').transform(trim),
});

// ===== Production plan =====
const machineCheckSchema = z.object({
  name: z.string(),
  ok: z.boolean().optional(),
  dateOk: z.string().optional(),
});

const physicalCheckSchema = z.object({
  name: z.string(),
  result1: z.string().optional(),
  pass1: z.boolean().optional(),
  inspector1: z.string().optional(),
  result2: z.string().optional(),
  pass2: z.boolean().optional(),
});

const weighingRowSchema = z.object({
  seq: z.number().int().positive(),
  rawMaterial: z.string().optional(),
  amounts: z.array(z.number().nullable()).default([]),
});

const productionStepSchema = z.object({
  description: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
});

const downtimeSchema = z.object({
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
  reason: z.string().optional(),
});

export const productionPlanSchema = z.object({
  batchNo: z.string().min(1),
  batchNos: z.array(z.string()).optional(),
  planDate: z.string().optional().default(''),
  productionDate: z.string().optional().default(''),
  commonName: z.string().optional().default(''),
  quantity: z.string().optional().default(''),
  staffNames: z.string().optional().default(''),
  machineChecks: z.array(machineCheckSchema).default([]),
  machineInspectedBy: z.string().optional().default(''),
  machineInspectedAt: z.string().optional().default(''),
  machineDefectNote: z.string().optional().default(''),
  cleaning: z.object({
    continuous: z.boolean().default(false),
    solvent: z.number().optional(),
    water: z.number().optional(),
    kaolin: z.number().optional(),
    sand: z.number().optional(),
    inspectedBy: z.string().optional(),
    inspectedAt: z.string().optional(),
  }),
  actualStart: z.object({ date: z.string().optional(), time: z.string().optional() }).optional(),
  actualEnd: z.object({ date: z.string().optional(), time: z.string().optional() }).optional(),
  actualQty: z.string().optional().default(''),
  downtimes: z.array(downtimeSchema).default([]),
  physicalChecks: z.array(physicalCheckSchema).default([]),
  sendToLab: z.boolean().optional(),
  followUpFail1: z.string().optional().default(''),
  followUpFail2: z.string().optional().default(''),
  weighingRef: z.object({ docNo: z.string().optional(), docDate: z.string().optional() }).optional(),
  weighingRows: z.array(weighingRowSchema).default([]),
  weigher: z.string().optional().default(''),
  weigherTime: z.string().optional().default(''),
  weighSupervisor: z.string().optional().default(''),
  weighSupervisorTime: z.string().optional().default(''),
  mixer: z.string().optional().default(''),
  mixerTime: z.string().optional().default(''),
  mixSupervisor: z.string().optional().default(''),
  mixSupervisorTime: z.string().optional().default(''),
  steps: z.array(productionStepSchema).default([]),
  approver: z.string().optional().default(''),
  approvedAt: z.string().optional().default(''),
});

// ===== Lab request =====
const labRequestRequesterSchema = z.object({
  fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').transform(trim),
  department: z.string().optional().default(''),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  fax: z.string().optional().default(''),
  email: z.string().email('อีเมลไม่ถูกต้อง').or(z.literal('')).optional().default(''),
  contactName: z.string().optional().default(''),
  position: z.string().optional().default(''),
});

export const labRequestFormSchema = z.object({
  batchNo: z.string().min(1),
  sampleSeq: z.number().int().positive(),
  requester: labRequestRequesterSchema,
  serviceAgreement: serviceAgreementSchema,
  reportCustomerName: z.string().optional().default('ICP Ladda Co., LTD.'),
  reportAddressType: z.enum(['default', 'other']).default('default'),
  reportAddressOther: z.string().optional().default(''),
  invoiceAddressType: z.enum(['default', 'other']).default('default'),
  invoiceAddressOther: z.string().optional().default(''),
  testDelivery: z.array(z.enum(['email', 'mail', 'self', 'report', 'fax', 'taxInvoice'])).default([]),
  storageCondition: z
    .array(z.enum(['room', 'chilled']))
    .min(1, 'กรุณาเลือกการเก็บรักษาตัวอย่างอย่างน้อย 1 รายการ'),
  packageType: z
    .array(z.enum(['plasticBag', 'glassBottle', 'plasticBottle', 'can', 'other']))
    .min(1, 'กรุณาเลือกภาชนะบรรจุอย่างน้อย 1 รายการ'),
  packageTypeOther: z.string().optional().default(''),
  sampleReturn: z.enum(['return', 'discard', 'keep']),
});

// ===== Petition forms (per dept) =====
export const productionPetitionFormSchema = z.object({
  dept: z.literal('production'),
  submittedBy: submitterSchema,
  deliveredBy: delivererSchema,
  items: z.array(petitionItemSchema).min(1, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ'),
  productionPlans: z.array(productionPlanSchema).min(1, 'ต้องมีใบวางแผนอย่างน้อย 1 รายการ'),
  labRequests: z.array(labRequestFormSchema).default([]),
  cause: z.string().optional().default(''),
});

export const rmPetitionFormSchema = z.object({
  dept: z.literal('rm'),
  submittedBy: submitterSchema,
  deliveredBy: delivererSchema,
  items: z.array(petitionItemSchema).min(1, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ'),
  cause: z.string().optional().default(''),
});

export const fgPetitionFormSchema = z.object({
  dept: z.literal('fg'),
  submittedBy: submitterSchema,
  deliveredBy: delivererSchema,
  items: z.array(petitionItemSchema).min(1, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ'),
  cause: z.string().optional().default(''),
});

export type ProductionPetitionFormValues = z.infer<typeof productionPetitionFormSchema>;
export type RmPetitionFormValues = z.infer<typeof rmPetitionFormSchema>;
export type FgPetitionFormValues = z.infer<typeof fgPetitionFormSchema>;
export type LabRequestFormValues = z.infer<typeof labRequestFormSchema>;
export type ProductionPlanFormValues = z.infer<typeof productionPlanSchema>;
export type SubmitterFormValues = z.infer<typeof submitterSchema>;
