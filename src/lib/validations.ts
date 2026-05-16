import { z } from 'zod';

const trim = (s: string) => s.trim();

const serviceAgreementSchema = z.object({
  sampleDelivery: z.enum(['self', 'courier']),
  testMethod: z.enum(['standard', 'custom', 'previous']),
  testMethodDoneBefore: z.string().nullable().optional(),
  testMethodDetail: z.string().optional(),
  testDuration: z.enum(['normal', 'extended', 'urgent']),
  testDurationDays: z.number().int().positive().nullable().optional(),
  requireUncertainty: z.boolean(),
});

const requesterSchema = z.object({
  fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').transform(trim),
  department: z.string().min(1, 'กรุณากรอกแผนก').transform(trim),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  fax: z.string().optional().default(''),
  email: z.string().email('อีเมลไม่ถูกต้อง').or(z.literal('')).optional().default(''),
  contactName: z.string().optional().default(''),
  position: z.string().optional().default(''),
});

export const petitionItemSchema = z.object({
  seq: z.number().int().positive(),
  sampleName: z.string().min(1, 'กรุณากรอกชื่อตัวอย่าง').transform(trim),
  commonName: z.string().optional().default(''),
  batchNo: z.string()
    .min(1, 'กรุณากรอกเลขแบช')
    .refine((val) => /[16]$/.test(val), { message: 'เลขแบชต้องลงท้ายด้วย 1 หรือ 6' }),
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

export const petitionFormSchema = z.object({
  serviceAgreement: serviceAgreementSchema,
  requester: requesterSchema,
  sampleReturn: z.enum(['return', 'discard', 'keep']),
  testDelivery: z.array(z.enum(['email', 'mail', 'self', 'report', 'fax', 'taxInvoice'])).default([]),
  reportCustomerName: z.string().optional().default('ICP Ladda Co., LTD.'),
  reportAddressType: z.enum(['default', 'other']).default('default'),
  reportAddressOther: z.string().optional().default(''),
  invoiceAddressType: z.enum(['default', 'other']).default('default'),
  invoiceAddressOther: z.string().optional().default(''),
  storageCondition: z.enum(['room', 'chilled']).default('room'),
  packageType: z.enum(['plasticBag', 'glassBottle', 'plasticBottle', 'can', 'other']).default('plasticBottle'),
  packageTypeOther: z.string().optional().default(''),
  sampleSubmittedBy: z.string().min(1, 'กรุณาเลือกผู้นำส่งตัวอย่าง').transform(trim),
  sampleSubmittedDate: z.string().min(1, 'กรุณาเลือกวันที่นำส่ง').nullable().refine((v) => !!v, { message: 'กรุณาเลือกวันที่นำส่ง' }),
  items: z.array(petitionItemSchema).min(1, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ'),
  cause: z.string().optional().default(''),
});

export type PetitionFormValues = z.infer<typeof petitionFormSchema>;
