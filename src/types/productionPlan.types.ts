export interface MachineCheck {
  name: string;
  ok?: boolean;
  dateOk?: string;
}

export interface PhysicalCheck {
  name: string;
  result1?: string;
  pass1?: boolean;
  inspector1?: string;
  result2?: string;
  pass2?: boolean;
}

export interface WeighingRow {
  seq: number;
  rawMaterial?: string;
  amounts: (number | null)[];
}

export interface ProductionStep {
  description?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export interface DowntimeEntry {
  fromTime?: string;
  toTime?: string;
  reason?: string;
}

export interface CleaningRecord {
  continuous: boolean;
  solvent?: number;
  water?: number;
  kaolin?: number;
  sand?: number;
  inspectedBy?: string;
  inspectedAt?: string;
}

export interface ProductionPlan {
  batchNo: string;
  batchNos?: string[];

  // ส่วนที่ 1
  planDate?: string;
  productionDate?: string;
  commonName?: string;
  quantity?: string;
  staffNames?: string;

  // ส่วนที่ 2
  machineChecks: MachineCheck[];
  machineInspectedBy?: string;
  machineInspectedAt?: string;
  machineDefectNote?: string;

  // ส่วนที่ 3
  cleaning: CleaningRecord;

  // ส่วนที่ 4
  actualStart?: { date?: string; time?: string };
  actualEnd?: { date?: string; time?: string };
  actualQty?: string;
  downtimes: DowntimeEntry[];
  physicalChecks: PhysicalCheck[];
  sendToLab?: boolean;
  followUpFail1?: string;
  followUpFail2?: string;
  weighingRef?: { docNo?: string; docDate?: string };
  weighingRows: WeighingRow[];
  weigher?: string;
  weigherTime?: string;
  weighSupervisor?: string;
  weighSupervisorTime?: string;
  mixer?: string;
  mixerTime?: string;
  mixSupervisor?: string;
  mixSupervisorTime?: string;
  steps: ProductionStep[];
  approver?: string;
  approvedAt?: string;
}

export const MACHINE_CHECK_NAMES = [
  '1.   สวิตซ์ไฟเมน',
  '2.   แผงควบคุมเครื่องผสม',
  '3.   แผงควบคุมเครื่องชั่งทราย',
  '4.   แผงควบคุมถังอบแห้ง',
  '5.   เครื่องบดละเอียด',
  '6.   เครื่องป้อนสาร',
  '7.   เครื่องบดเหลว',
  '8.   เครื่องกรอง',
  '9.   เครื่องชั่งน้ำหนัก',
  '10. เครื่องดักฝุ่น',
  '11.ระบบบำบัดอากาศ',
  '12.',
] as const;

export const PHYSICAL_CHECK_NAMES = [
  '1. การละลาย',
  '2. การเคลือบเม็ดทราย',
  '3. ค่า ถพ.',
] as const;

export function makeBlankProductionPlan(batchNo: string, batchNos?: string[]): ProductionPlan {
  return {
    batchNo,
    batchNos: batchNos ?? [batchNo],
    planDate: '',
    productionDate: '',
    commonName: '',
    quantity: '',
    staffNames: '',
    machineChecks: MACHINE_CHECK_NAMES.map((name) => ({ name })),
    cleaning: { continuous: false },
    downtimes: [],
    physicalChecks: PHYSICAL_CHECK_NAMES.map((name) => ({ name })),
    weighingRows: Array.from({ length: 30 }, (_, i) => ({
      seq: i + 1,
      amounts: Array.from({ length: 9 }, () => null),
    })),
    steps: Array.from({ length: 30 }, () => ({})),
  };
}

export function isLabBatch(batchNo: string): boolean {
  const last = batchNo.trim().slice(-1);
  return last === '1' || last === '6';
}
