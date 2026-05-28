import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Cog, FlaskConical, Hourglass, RefreshCw, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { usePetitionList } from '@/hooks/usePetition';
import { api, type MachineItem } from '@/lib/api';
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionAssignee,
  type PetitionAssignedMachine,
  type PetitionItem,
} from '@/types/petition.types';

type TabKey = 'normal' | 'phase2';

type Instrument = 'GC' | 'HPLC';
const INSTRUMENT_ORDER: Instrument[] = ['GC', 'HPLC'];

type SubstanceGroup = {
  groupKey: string;       // `${sampleName.lower}||${commonName.lower}`
  sampleName: string;
  commonName: string;
  items: PetitionItem[];
  requiredInstruments: Instrument[];
};

// Master-items lookup
type MasterItemRaw = Record<string, unknown>;
const MASTER_COMMON_NAME_KEYS = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];
const MASTER_ITEM_NO_KEYS = ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'];

function pickField(item: MasterItemRaw, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function groupKeyOf(sampleName: string, commonName: string): string {
  return `${(sampleName || '').trim().toLowerCase()}||${(commonName || '').trim().toLowerCase()}`;
}

function sortInstruments(values: Iterable<Instrument>): Instrument[] {
  const set = new Set(values);
  return INSTRUMENT_ORDER.filter((v) => set.has(v));
}

// A machine "is" an instrument if its name starts with that token (e.g. "HPLC 1260 1" → HPLC).
// HPLC is checked first so we don't misclassify it as GC.
function machineInstrument(machine: MachineItem): Instrument | null {
  const text = String(machine.name || '').trim().toUpperCase();
  if (text.startsWith('HPLC')) return 'HPLC';
  if (text.startsWith('GC')) return 'GC';
  return null;
}

// Phase 2 = either explicitly advanced or timer elapsed but list hasn't been refreshed
function isPhase2Petition(petition: Petition): boolean {
  if (petition.currentPhase === 2) return true;
  if (petition.phase2DueAt && new Date(petition.phase2DueAt) <= new Date()) return true;
  return false;
}

interface EmployeeAssignee {
  id: number;
  employeeId: string;
  name: string;
  department: string;
  position: string;
  empType: string;
  isActive: boolean;
}

function employeeLabel(employee: EmployeeAssignee) {
  return `${employee.name} (${employee.employeeId})`;
}

function toAssignedMachine(
  machine: MachineItem,
  group: SubstanceGroup,
): PetitionAssignedMachine {
  return {
    machineId: machine._id || machine.code,
    code: machine.code,
    name: machine.name,
    location: machine.location,
    sampleName: group.sampleName || undefined,
    commonName: group.commonName || undefined,
  };
}

function buildSubstanceGroups(
  petition: Petition,
  commonNameToInstruments: Map<string, Instrument[]>,
): SubstanceGroup[] {
  const groups = new Map<string, SubstanceGroup>();
  petition.items.forEach((item) => {
    const sampleName = (item.sampleName ?? '').trim();
    const commonName = (item.commonName ?? '').trim();
    const key = groupKeyOf(sampleName, commonName);
    let group = groups.get(key);
    if (!group) {
      group = {
        groupKey: key,
        sampleName,
        commonName,
        items: [],
        requiredInstruments: commonNameToInstruments.get(commonName.toLowerCase()) ?? [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  });
  return Array.from(groups.values());
}

export default function PetitionAssignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: pendingData,
    loading: pendingLoading,
    error: pendingError,
    refresh: refreshPending,
  } = usePetitionList({ page: 1, limit: 100, status: 'sampleSent,pendingReview' });
  const {
    data: inProgressData,
    loading: inProgressLoading,
    error: inProgressError,
    refresh: refreshInProgress,
  } = usePetitionList({ page: 1, limit: 100, status: 'inProgress' });
  const [employees, setEmployees] = useState<EmployeeAssignee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [machinesError, setMachinesError] = useState<string | null>(null);
  const [selectedByPetition, setSelectedByPetition] = useState<Record<string, string>>({});
  // machinesByPetition[petitionId][groupKey] = machine ids selected for that substance group
  const [machinesByPetition, setMachinesByPetition] = useState<Record<string, Record<string, string[]>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('normal');

  useEffect(() => {
    let alive = true;
    setEmployeesLoading(true);
    setEmployeesError(null);

    api.get<EmployeeAssignee[]>('/employees/assignees')
      .then((res) => {
        if (!alive) return;
        setEmployees(res.data.data);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setEmployeesError(err.message);
      })
      .finally(() => {
        if (alive) setEmployeesLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setMachinesLoading(true);
    setMachinesError(null);

    api.getMachines()
      .then((items) => {
        if (!alive) return;
        setMachines((items ?? []).filter((m) => m.status !== 'retired'));
      })
      .catch((err: Error) => {
        if (!alive) return;
        setMachinesError(err.message);
      })
      .finally(() => {
        if (alive) setMachinesLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.employeeId, employee])),
    [employees],
  );
  const machineById = useMemo(
    () => new Map(machines.map((machine) => [machine._id || machine.code, machine])),
    [machines],
  );
  const loading = pendingLoading || inProgressLoading;
  const error = pendingError || inProgressError;

  const { data: masterItems = [] } = useQuery<MasterItemRaw[]>({
    queryKey: ['master-items-for-petition-assign'],
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items');
      const payload = res.data.data;
      if (Array.isArray(payload)) return payload as MasterItemRaw[];
      if (payload && typeof payload === 'object') {
        const arr =
          (payload as { data?: unknown }).data ??
          (payload as { items?: unknown }).items;
        if (Array.isArray(arr)) return arr as MasterItemRaw[];
      }
      return [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: simpleMethods = [] } = useQuery<Array<{ itemNo: string; instruments: Instrument[] }>>({
    queryKey: ['simple-methods'],
    queryFn: async () => {
      const res = await api.get<Array<{ itemNo: string; instruments: string[] }>>('/simple-methods');
      return (res.data.data ?? []).map((entry) => ({
        itemNo: entry.itemNo,
        instruments: (entry.instruments ?? []).filter(
          (v): v is Instrument => v === 'GC' || v === 'HPLC',
        ),
      }));
    },
    staleTime: 5 * 60_000,
  });

  // commonName (lowercased) → required instruments (union across master items sharing the commonName)
  const commonNameToInstruments = useMemo(() => {
    const itemNoToInstruments = new Map<string, Instrument[]>();
    simpleMethods.forEach((entry) => {
      if (entry.itemNo) itemNoToInstruments.set(entry.itemNo.trim(), entry.instruments);
    });

    const map = new Map<string, Set<Instrument>>();
    masterItems.forEach((item) => {
      const commonName = pickField(item, MASTER_COMMON_NAME_KEYS);
      if (!commonName) return;
      const itemNo = pickField(item, MASTER_ITEM_NO_KEYS);
      const instruments = itemNoToInstruments.get(itemNo);
      if (!instruments || instruments.length === 0) return;
      const key = commonName.trim().toLowerCase();
      const set = map.get(key) ?? new Set<Instrument>();
      instruments.forEach((v) => set.add(v));
      map.set(key, set);
    });

    const result = new Map<string, Instrument[]>();
    map.forEach((set, key) => result.set(key, sortInstruments(set)));
    return result;
  }, [masterItems, simpleMethods]);

  // Cache substance groups per petition
  const groupsByPetition = useMemo(() => {
    const out = new Map<string, SubstanceGroup[]>();
    [...(pendingData?.items ?? []), ...(inProgressData?.items ?? [])].forEach((petition) => {
      out.set(petition._id, buildSubstanceGroups(petition, commonNameToInstruments));
    });
    return out;
  }, [pendingData?.items, inProgressData?.items, commonNameToInstruments]);

  function getSelectedMachineIdsForGroup(petition: Petition, group: SubstanceGroup): string[] {
    const perGroup = machinesByPetition[petition._id];
    if (perGroup && perGroup[group.groupKey] !== undefined) {
      return perGroup[group.groupKey];
    }
    // Baseline from petition.assignedMachines — entries whose substance identity matches this group
    return (petition.assignedMachines ?? [])
      .filter((m) => groupKeyOf(m.sampleName ?? '', m.commonName ?? '') === group.groupKey)
      .map((m) => m.machineId);
  }

  function toggleMachineForGroup(petitionId: string, groupKey: string, machineKey: string) {
    setMachinesByPetition((prev) => {
      const petition = allPetitions.find((p) => p._id === petitionId);
      const groups = petition ? buildSubstanceGroups(petition, commonNameToInstruments) : [];
      const baselineMap: Record<string, string[]> = { ...(prev[petitionId] ?? {}) };
      if (baselineMap[groupKey] === undefined) {
        const group = groups.find((g) => g.groupKey === groupKey);
        baselineMap[groupKey] = group
          ? (petition?.assignedMachines ?? [])
              .filter(
                (m) => groupKeyOf(m.sampleName ?? '', m.commonName ?? '') === group.groupKey,
              )
              .map((m) => m.machineId)
          : [];
      }
      const current = baselineMap[groupKey];
      baselineMap[groupKey] = current.includes(machineKey)
        ? current.filter((id) => id !== machineKey)
        : [...current, machineKey];
      return { ...prev, [petitionId]: baselineMap };
    });
  }

  function refreshPetitions() {
    refreshPending();
    refreshInProgress();
  }

  const allPetitions = useMemo(
    () => [...(pendingData?.items ?? []), ...(inProgressData?.items ?? [])],
    [inProgressData?.items, pendingData?.items],
  );

  const phase2Petitions = useMemo(
    () => allPetitions.filter(isPhase2Petition),
    [allPetitions],
  );
  const normalPetitions = useMemo(
    () => allPetitions.filter((p) => !isPhase2Petition(p)),
    [allPetitions],
  );

  const visiblePetitions = useMemo(() => {
    const source = activeTab === 'phase2' ? phase2Petitions : normalPetitions;
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((petition) =>
      [
        petition.petitionNo,
        petition.submittedBy?.name,
        petition.dept,
        petition.assignedTo?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [activeTab, normalPetitions, phase2Petitions, search]);

  async function assignPetition(petition: Petition) {
    const employeeId = selectedByPetition[petition._id] || petition.assignedTo?.employeeId || '';
    const employee = employeeById.get(employeeId);
    if (!employee) {
      toast.error('กรุณาเลือกเจ้าหน้าที่');
      return;
    }

    const groups = groupsByPetition.get(petition._id) ?? buildSubstanceGroups(petition, commonNameToInstruments);
    const machinesPayload: PetitionAssignedMachine[] = [];
    groups.forEach((group) => {
      const ids = getSelectedMachineIdsForGroup(petition, group);
      ids.forEach((id) => {
        const machine = machineById.get(id);
        if (machine) machinesPayload.push(toAssignedMachine(machine, group));
      });
    });

    setSavingId(petition._id);
    try {
      await api.patch<Petition>(`/petitions/${petition._id}/assign`, {
        ...({
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          assignedBy: user?.name || user?.email,
        } satisfies PetitionAssignee),
        machines: machinesPayload,
      });
      const machineSummary = machinesPayload.length
        ? ` (เครื่อง: ${machinesPayload.map((m) => m.code).join(', ')})`
        : '';
      toast.success(`Assign ${petition.petitionNo} ให้ ${employee.name}${machineSummary} แล้ว`);
      refreshPetitions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึก assignment ไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppLayout>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Assign คำร้องให้เจ้าหน้าที่</h1>
              <p className="text-sm text-muted-foreground">
                เลือกเจ้าหน้าที่แผนก Lab/วิเคราะห์ เฉพาะประเภทพนักงานรายเดือน
              </p>
            </div>
            <Button
              variant="primary-outline"
              onClick={() => {
                refreshPetitions();
                toast.info('กำลังโหลดรายการคำร้องล่าสุด');
              }}
            >
              <RefreshCw className="h-4 w-4" />
              รีเฟรช
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">คำร้องรอ assign</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {allPetitions.filter((petition) => !petition.assignedTo).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">คำร้องที่มีผู้รับผิดชอบ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {allPetitions.filter((petition) => petition.assignedTo).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Hourglass className="h-3.5 w-3.5 text-amber-500" />
                  Phase 2 (หลังอบ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{phase2Petitions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">เจ้าหน้าที่ที่เลือกได้</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{employees.length}</div>
              </CardContent>
            </Card>
          </div>

          {(error || employeesError || machinesError) && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
              {error
                ? `โหลดคำร้องไม่สำเร็จ: ${error}`
                : employeesError
                  ? `โหลดข้อมูลพนักงานไม่สำเร็จ: ${employeesError}`
                  : `โหลดข้อมูลเครื่องไม่สำเร็จ: ${machinesError}`}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="normal" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                คำร้องปกติ
                <Badge variant="gray-soft" className="ml-1 font-normal">
                  {normalPetitions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="phase2" className="gap-2">
                <FlaskConical className="h-4 w-4" />
                หลังอบเสร็จ (เลือกทำ)
                <Badge variant="yellow-soft" className="ml-1 font-normal">
                  {phase2Petitions.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="normal" className="mt-3 space-y-3">
              <div className="rounded-[10px] border border-black-50 bg-white p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ค้นหาเลขที่คำร้อง / ผู้ยื่น / แผนก / เจ้าหน้าที่..."
                    className="pl-9"
                  />
                </div>
              </div>
              <AssignTable
                petitions={visiblePetitions}
                loading={loading || employeesLoading || machinesLoading}
                employees={employees}
                machines={machines}
                machineById={machineById}
                groupsByPetition={groupsByPetition}
                selectedByPetition={selectedByPetition}
                setSelectedByPetition={setSelectedByPetition}
                getSelectedMachineIdsForGroup={getSelectedMachineIdsForGroup}
                onToggleMachine={toggleMachineForGroup}
                savingId={savingId}
                assignPetition={assignPetition}
                onPetitionClick={(id) => navigate(`/petitions/${id}`)}
                emptyText="ไม่พบคำร้องที่ต้อง assign"
              />
            </TabsContent>

            <TabsContent value="phase2" className="mt-3 space-y-3">
              <div className="rounded-[10px] border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-800">
                <Hourglass className="inline h-3.5 w-3.5 mr-1" />
                คำร้องที่ผ่าน Phase 1 แล้ว และ trigger (เช่น timer อบ) ครบกำหนด — ให้เจ้าหน้าที่เลือกรับเพื่อทำ Phase 2 ต่อ
              </div>
              <div className="rounded-[10px] border border-black-50 bg-white p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ค้นหาเลขที่คำร้อง / ผู้ยื่น / แผนก / เจ้าหน้าที่..."
                    className="pl-9"
                  />
                </div>
              </div>
              <AssignTable
                petitions={visiblePetitions}
                loading={loading || employeesLoading || machinesLoading}
                employees={employees}
                machines={machines}
                machineById={machineById}
                groupsByPetition={groupsByPetition}
                selectedByPetition={selectedByPetition}
                setSelectedByPetition={setSelectedByPetition}
                getSelectedMachineIdsForGroup={getSelectedMachineIdsForGroup}
                onToggleMachine={toggleMachineForGroup}
                savingId={savingId}
                assignPetition={assignPetition}
                onPetitionClick={(id) => navigate(`/petitions/${id}`)}
                emptyText="ยังไม่มีคำร้อง Phase 2 ที่รอเลือก"
                showPhase2Badge
              />
            </TabsContent>
          </Tabs>

        </div>
    </AppLayout>
  );
}

interface MachinePickerProps {
  machines: MachineItem[];
  selectedIds: string[];
  onToggle: (machineKey: string) => void;
  label?: string;
}

function MachinePicker({ machines, selectedIds, onToggle, label = 'เลือกเครื่อง' }: MachinePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) =>
      [m.code, m.name, m.location, m.model, m.manufacturer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [machines, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMachines = useMemo(
    () => machines.filter((m) => selectedSet.has(m._id || m.code)),
    [machines, selectedSet],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="primary-outline"
          size="sm"
          className="w-full justify-start"
        >
          <Cog className="h-4 w-4" />
          {selectedMachines.length === 0
            ? label
            : `${label} (${selectedMachines.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-grey-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเครื่อง (รหัส/ชื่อ/ตำแหน่ง)"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-grey-500">ไม่พบเครื่อง</div>
          ) : (
            filtered.map((machine) => {
              const key = machine._id || machine.code;
              const checked = selectedSet.has(key);
              return (
                <label
                  key={key}
                  className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-grey-50 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-black-500 truncate">
                      {machine.name}
                    </div>
                    {machine.location && (
                      <div className="text-[11px] text-grey-500 truncate">{machine.location}</div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
        {selectedMachines.length > 0 && (
          <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
            {selectedMachines.map((m) => (
              <Badge key={m._id || m.code} variant="primary-soft" className="text-[10px]">
                {m.name}
              </Badge>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface AssignTableProps {
  petitions: Petition[];
  loading: boolean;
  employees: EmployeeAssignee[];
  machines: MachineItem[];
  machineById: Map<string, MachineItem>;
  groupsByPetition: Map<string, SubstanceGroup[]>;
  selectedByPetition: Record<string, string>;
  setSelectedByPetition: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getSelectedMachineIdsForGroup: (petition: Petition, group: SubstanceGroup) => string[];
  onToggleMachine: (petitionId: string, groupKey: string, machineKey: string) => void;
  savingId: string | null;
  assignPetition: (petition: Petition) => Promise<void>;
  onPetitionClick: (id: string) => void;
  emptyText: string;
  showPhase2Badge?: boolean;
}

function AssignTable({
  petitions,
  loading,
  employees,
  machines,
  machineById,
  groupsByPetition,
  selectedByPetition,
  setSelectedByPetition,
  getSelectedMachineIdsForGroup,
  onToggleMachine,
  savingId,
  assignPetition,
  onPetitionClick,
  emptyText,
  showPhase2Badge,
}: AssignTableProps) {
  return (
    <div className="rounded-[10px] border border-black-50 bg-white overflow-x-auto">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead>เลขที่คำร้อง</TableHead>
            <TableHead>ผู้ยื่น</TableHead>
            <TableHead>ตัวอย่าง</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>เจ้าหน้าที่</TableHead>
            <TableHead>เครื่อง</TableHead>
            <TableHead className="text-right">บันทึก</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-grey-500">
                กำลังโหลดข้อมูล...
              </TableCell>
            </TableRow>
          )}
          {!loading && petitions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-grey-500">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
          {!loading && petitions.map((petition) => {
            const statusCfg =
              PETITION_STATUS_CONFIG[petition.status] ?? { label: petition.status, variant: 'gray-soft' as const };
            const selectedEmployeeId =
              selectedByPetition[petition._id] ?? petition.assignedTo?.employeeId ?? '';

            return (
              <TableRow key={petition._id}>
                <TableCell>
                  <button
                    type="button"
                    className="font-semibold text-primary-500 hover:underline"
                    onClick={() => onPetitionClick(petition._id)}
                  >
                    {petition.petitionNo}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-black-500">{petition.submittedBy?.name ?? '-'}</div>
                  <div className="text-xs text-grey-500">{petition.dept}</div>
                </TableCell>
                <TableCell>
                  <div>{petition.items.length} รายการ</div>
                  <div className="mt-1 max-w-[280px] space-y-0.5 text-xs text-grey-500">
                    {(groupsByPetition.get(petition._id) ?? []).map((g) => (
                      <div key={g.groupKey} className="truncate">
                        • {g.commonName || '-'}{' '}
                        <span className="text-grey-400">×{g.items.length}</span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    {showPhase2Badge && (
                      <Badge variant="yellow-soft" className="font-normal">Phase 2</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="min-w-[280px]">
                  <NativeSelect
                    value={selectedEmployeeId}
                    onChange={(event) =>
                      setSelectedByPetition((prev) => ({
                        ...prev,
                        [petition._id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">เลือกเจ้าหน้าที่</option>
                    {employees.map((employee) => (
                      <option key={employee.employeeId} value={employee.employeeId}>
                        {employeeLabel(employee)} - {employee.department}
                      </option>
                    ))}
                  </NativeSelect>
                  {petition.assignedTo && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-grey-500">
                      <UserCheck className="h-3.5 w-3.5" />
                      ปัจจุบัน: {petition.assignedTo.name}
                    </div>
                  )}
                </TableCell>
                <TableCell className="min-w-[280px]">
                  <div className="space-y-2">
                    {(groupsByPetition.get(petition._id) ?? []).map((group) => {
                      const required = group.requiredInstruments;
                      const allSelectedIds = getSelectedMachineIdsForGroup(petition, group);
                      return (
                        <div key={group.groupKey} className="rounded-md border border-grey-100 p-2">
                          <div className="mb-1.5 flex items-center gap-1.5 text-[11px]">
                            <span className="font-medium text-black-500 truncate max-w-[160px]">
                              {group.commonName || group.sampleName || '(ไม่มีชื่อ)'}
                            </span>
                          </div>
                          {required.length === 0 ? (
                            <div className="rounded border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-[11px] text-amber-700">
                              ยังไม่ได้กำหนด method (GC/HPLC) สำหรับสารนี้ใน simple method — เลือกเครื่องไม่ได้
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {required.map((inst) => {
                                const filteredMachines = machines.filter(
                                  (m) => machineInstrument(m) === inst,
                                );
                                const selectedForInst = allSelectedIds.filter((id) => {
                                  const m = machineById.get(id);
                                  return m ? machineInstrument(m) === inst : false;
                                });
                                return (
                                  <div key={inst}>
                                    <MachinePicker
                                      label={`เลือกเครื่อง ${inst}`}
                                      machines={filteredMachines}
                                      selectedIds={selectedForInst}
                                      onToggle={(machineKey: string) =>
                                        onToggleMachine(petition._id, group.groupKey, machineKey)
                                      }
                                    />
                                    {filteredMachines.length === 0 && (
                                      <div className="mt-1 text-[11px] text-red-500">
                                        ไม่พบเครื่อง {inst}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(groupsByPetition.get(petition._id) ?? []).length === 0 && (
                      <div className="text-xs text-grey-500">ไม่มีตัวอย่างให้ assign</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!selectedEmployeeId || savingId === petition._id}
                    onClick={() => assignPetition(petition)}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {savingId === petition._id ? 'กำลังบันทึก...' : 'Assign'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
