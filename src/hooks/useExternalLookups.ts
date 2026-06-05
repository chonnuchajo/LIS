import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { buildOverrideMap, normalizeCommonName } from '@/lib/commonNameOverride';
import type { CommonNameOverrideRow } from '@/lib/commonNameOverride';

export const MF_LOT_API_URLS = [
  { source: 'LDI', url: 'https://n8n-plant.icpladda.com/webhook/API/findlot-ldi' },
] as const;

export const EMPLOYEE_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/employee';

export interface MfLotOption {
  id: string;
  source: string;
  label: string;
  sampleName: string;
  batchNo: string;
  productionDate: string | null;
  packageUnit: string;
  commonName: string;
  note: string;
}

export interface EmployeeOption {
  id: string;
  label: string;
  name: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord);
  const obj = asRecord(payload);
  for (const key of ['value', 'data', 'items', 'rows', 'result']) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(asRecord);
  }
  return Object.keys(obj).length ? [obj] : [];
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function normalizeLotOptions(payload: unknown, source: string, cnMap: Map<string, string>): MfLotOption[] {
  return rowsFromPayload(payload)
    .map((row, idx) => {
      const productName = pickString(row, [
        'prod_descript',
        'product_name',
        'item_name',
        'trade_name',
        'name',
        'description',
        'prod_descript2',
      ]);
      const packsize = pickString(row, ['packsize', 'packageUnit', 'package_unit', 'uom_code']);
      const rawCommonName = pickString(row, ['common_name', 'commonName', 'active_ingredient']);
      const commonName = normalizeCommonName(rawCommonName, cnMap);
      const sampleName = [productName, packsize, commonName].filter(Boolean).join(' · ');
      const batchNo = pickString(row, [
        'lot_no',
        'lotNo',
        'lot',
        'LOT_NO',
        'batch_no',
        'batchNo',
        'batch',
      ]);
      const productionDate = normalizeDate(
        pickString(row, ['productionDate', 'production_date', 'mfg_date', 'manufacture_date', 'create_date']),
      );
      const itemNo = pickString(row, ['item_no', 'itemNo', 'code', 'short_dm1_code']);
      const labelParts = [sampleName, batchNo ? `Lot ${batchNo}` : '', itemNo ? `Item ${itemNo}` : ''];
      return {
        id: `${source}-${batchNo || itemNo || idx}`,
        source,
        label: `[${source}] ${labelParts.filter(Boolean).join(' | ')}`,
        sampleName,
        batchNo,
        productionDate,
        packageUnit: packsize,
        commonName,
        note: itemNo ? `${source}: ${itemNo}` : source,
      };
    })
    .filter((option) => option.sampleName);
}

function normalizeEmployeeOptions(payload: unknown): EmployeeOption[] {
  return rowsFromPayload(payload)
    .map((row, idx) => {
      const employeeId = pickString(row, ['employee_id', 'employeeId', 'code', 'id']);
      const name = pickString(row, ['name', 'employee_name', 'fullName']);
      const department = pickString(row, ['department', 'department_name']);
      const position = pickString(row, ['position']);
      const detail = [employeeId, department, position].filter(Boolean).join(' | ');
      return {
        id: employeeId || String(idx),
        label: detail ? `${name} (${detail})` : name,
        name,
      };
    })
    .filter((option) => option.name);
}

export function useLotOptions() {
  const [options, setOptions] = useState<MfLotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      let cnMap = new Map<string, string>();
      try {
        const res = await api.get<CommonNameOverrideRow[]>('/common-name-overrides');
        cnMap = buildOverrideMap(res.data.data);
      } catch {
        // overrides are optional — fall back to raw names
      }
      const results = await Promise.allSettled(
        MF_LOT_API_URLS.map(async ({ source, url }) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
          return normalizeLotOptions(await res.json(), source, cnMap);
        }),
      );
      if (!alive) return;
      const opts = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      const failed = results.filter((r) => r.status === 'rejected').length;
      setOptions(opts);
      setError(failed ? 'โหลดตัวเลือกจาก LDI API ไม่สำเร็จ' : null);
      setLoading(false);
    })().catch((e: Error) => {
      if (alive) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const optionMap = useMemo(() => {
    const map = new Map<string, MfLotOption>();
    for (const opt of options) {
      map.set(opt.label, opt);
      map.set(opt.sampleName, opt);
    }
    return map;
  }, [options]);

  return { options, loading, error, optionMap };
}

export function useEmployeeOptions() {
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(EMPLOYEE_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Employee HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (alive) setOptions(normalizeEmployeeOptions(payload));
      })
      .catch(() => {
        if (alive) setOptions([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const optionMap = useMemo(() => {
    const map = new Map<string, EmployeeOption>();
    for (const opt of options) {
      map.set(opt.label, opt);
      map.set(opt.name, opt);
    }
    return map;
  }, [options]);

  return { options, loading, optionMap };
}
