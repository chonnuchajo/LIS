import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Cog, FlaskConical, Hourglass, Pencil, RefreshCw, Search, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import PageHeader from '@/components/lis/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { usePetitionList } from '@/hooks/usePetition';
import { api, type MachineItem } from '@/lib/api';
import { DEV_MODE, synthesizeDevAssignees } from '@/config/dev';
import { parseSubstances } from '@/lib/substances';
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionAssignee,
  type PetitionAssignedMachine,
  type PetitionItem,
} from '@/types/petition.types';

type TabKey = 'normal' | 'phase2';

type Instrument = 'GC' | 'HPLC';
// What a substance slot requires: a single instrument, or 'BOTH' (usable on
// either — picker offers GC and HPLC machines; QC chooses one at assign time).
type SlotRequirement = Instrument | 'BOTH';

// One substance within a commonName (split by "+"), with the instrument the
// simple-method config assigned to it. `instrument === null` means "not yet
// configured" → that slot blocks Assign.
type SubstanceSlot = {
  name: string;
  instrument: SlotRequirement | null;
};

type SubstanceGroup = {
  groupKey: string;       // `${sampleName.lower}||${commonName.lower}`
  sampleName: string;
  commonName: string;
  items: PetitionItem[];
  slots: SubstanceSlot[];  // per-substance, positional — aligned to parseSubstances(commonName)
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

// Sample-number label for a substance group, e.g. items with seq 1 and 2 → "1+2".
function sampleSeqLabel(group: SubstanceGroup): string {
  return group.items
    .map((item) => item.seq)
    .filter((seq) => seq !== undefined && seq !== null)
    .sort((a, b) => a - b)
    .join('+');
}

// A machine "is" an instrument if its name starts with that token (e.g. "HPLC 1260 1" → HPLC).
// HPLC is checked first so we don't misclassify it as GC.
function machineInstrument(machine: MachineItem): Instrument | null {
  const text = String(machine.name || '').trim().toUpperCase();
  if (text.startsWith('HPLC')) return 'HPLC';
  if (text.startsWith('GC')) return 'GC';
  return null;
}

// Does a machine satisfy a slot requirement? BOTH accepts any GC or HPLC machine.
function machineMatchesSlot(mi: Instrument | null, requirement: SlotRequirement): boolean {
  if (mi === null) return false;
  return requirement === 'BOTH' ? true : mi === requirement;
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

// commonName (lowercased) → positional instruments, index i = parseSubstances()[i].
// '' means that substance has no configured method.
type SlotInstruments = (SlotRequirement | '')[];

function buildSubstanceGroups(
  petition: Petition,
  commonNameToSlots: Map<string, SlotInstruments>,
): SubstanceGroup[] {
  const groups = new Map<string, SubstanceGroup>();
  petition.items.forEach((item) => {
    const sampleName = (item.sampleName ?? '').trim();
    const commonName = (item.commonName ?? '').trim();
    const key = groupKeyOf(sampleName, commonName);
    let group = groups.get(key);
    if (!group) {
      const substances = parseSubstances(commonName);
      const slotInstruments = commonNameToSlots.get(commonName.toLowerCase()) ?? [];
      group = {
        groupKey: key,
        sampleName,
        commonName,
        items: [],
        slots: substances.map((name, idx) => ({
          name,
          instrument: slotInstruments[idx] || null,
        })),
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
  } = usePetitionList(
    { page: 1, limit: 100, status: 'sampleSent,pendingReview' },
    { refetchOnFocus: true, pollMs: 30_000 },
  );
  const {
    data: inProgressData,
    loading: inProgressLoading,
    error: inProgressError,
    refresh: refreshInProgress,
  } = usePetitionList(
    { page: 1, limit: 100, status: 'inProgress' },
    { refetchOnFocus: true, pollMs: 30_000 },
  );
  const [fetchedEmployees, setFetchedEmployees] = useState<EmployeeAssignee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [machinesError, setMachinesError] = useState<string | null>(null);
  const [selectedByPetition, setSelectedByPetition] = useState<Record<string, string>>({});
  // machinesByPetition[petitionId][groupKey] = machine ids selected for that substance group
  const [machinesByPetition, setMachinesByPetition] = useState<Record<string, Record<string, string[]>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // petitions currently in edit mode (already assigned but reopened for changes)
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('normal');

  function startEditing(petitionId: string) {
    setEditingIds((prev) => new Set(prev).add(petitionId));
  }
  function stopEditing(petitionId: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(petitionId);
      return next;
    });
  }

  useEffect(() => {
    let alive = true;
    setEmployeesLoading(true);
    setEmployeesError(null);

    api.get<EmployeeAssignee[]>('/employees/assignees')
      .then((res) => {
        if (!alive) return;
        setFetchedEmployees(res.data.data);
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

  // In dev mode prepend fake Lab dev users so a petition can be assigned and
  // then viewed on the lab pages by switching to that role (HR API has no dev
  // staff). Always shown, even if the HR fetch failed.
  const employees = useMemo(
    () => (DEV_MODE ? [...synthesizeDevAssignees(), ...fetchedEmployees] : fetchedEmployees),
    [fetchedEmployees],
  );

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

  const { data: simpleMethods = [] } = useQuery<Array<{ itemNo: string; instruments: SlotInstruments }>>({
    queryKey: ['simple-methods'],
    queryFn: async () => {
      const res = await api.get<Array<{ itemNo: string; instruments: string[] }>>('/simple-methods');
      return (res.data.data ?? []).map((entry) => ({
        itemNo: entry.itemNo,
        // keep positions — only the value is normalised; invalid/blank → '' so the
        // index still lines up with its substance.
        instruments: (entry.instruments ?? []).map((v) =>
          v === 'GC' || v === 'HPLC' || v === 'BOTH' ? (v as SlotRequirement) : '',
        ),
      }));
    },
    staleTime: 5 * 60_000,
  });

  // commonName (lowercased) → positional instruments per substance.
  // Master items sharing a commonName are merged slot-by-slot (first non-blank wins),
  // preserving which instrument belongs to which substance.
  const commonNameToSlots = useMemo(() => {
    const itemNoToInstruments = new Map<string, SlotInstruments>();
    simpleMethods.forEach((entry) => {
      if (entry.itemNo) itemNoToInstruments.set(entry.itemNo.trim(), entry.instruments);
    });

    const map = new Map<string, SlotInstruments>();
    masterItems.forEach((item) => {
      const commonName = pickField(item, MASTER_COMMON_NAME_KEYS);
      if (!commonName) return;
      const itemNo = pickField(item, MASTER_ITEM_NO_KEYS);
      const instruments = itemNoToInstruments.get(itemNo);
      if (!instruments || instruments.length === 0) return;
      const key = commonName.trim().toLowerCase();
      const count = parseSubstances(commonName).length;
      const current = map.get(key) ?? (Array.from({ length: count }, () => '') as SlotInstruments);
      const merged = Array.from(
        { length: Math.max(count, current.length, instruments.length) },
        (_, i) => current[i] || instruments[i] || '',
      ) as SlotInstruments;
      map.set(key, merged);
    });

    return map;
  }, [masterItems, simpleMethods]);

  // Cache substance groups per petition
  const groupsByPetition = useMemo(() => {
    const out = new Map<string, SubstanceGroup[]>();
    [...(pendingData?.items ?? []), ...(inProgressData?.items ?? [])].forEach((petition) => {
      out.set(petition._id, buildSubstanceGroups(petition, commonNameToSlots));
    });
    return out;
  }, [pendingData?.items, inProgressData?.items, commonNameToSlots]);

  // Baseline slot→machineId mapping for a group, derived from saved assignedMachines:
  // each saved machine is matched (first-fit by instrument) to a substance slot.
  function baselineSlotsForGroup(petition: Petition, group: SubstanceGroup): string[] {
    const saved = (petition.assignedMachines ?? []).filter(
      (m) => groupKeyOf(m.sampleName ?? '', m.commonName ?? '') === group.groupKey,
    );
    const result = group.slots.map(() => '');
    const used = new Set<string>();
    group.slots.forEach((slot, i) => {
      if (!slot.instrument) return;
      const match = saved.find((m) => {
        if (used.has(m.machineId)) return false;
        const machine = machineById.get(m.machineId);
        return !!machine && slot.instrument !== null
          && machineMatchesSlot(machineInstrument(machine), slot.instrument);
      });
      if (match) {
        result[i] = match.machineId;
        used.add(match.machineId);
      }
    });
    return result;
  }

  // Selected machine id per substance slot (index-aligned to group.slots).
  function getSelectedSlotMachines(petition: Petition, group: SubstanceGroup): string[] {
    const perGroup = machinesByPetition[petition._id];
    if (perGroup && perGroup[group.groupKey] !== undefined) {
      return perGroup[group.groupKey];
    }
    return baselineSlotsForGroup(petition, group);
  }

  // Single-select per substance slot: picking a machine sets that slot; picking the
  // already-selected machine clears it. Each substance gets exactly one machine.
  function setMachineForSlot(
    petitionId: string,
    groupKey: string,
    slotIndex: number,
    machineKey: string,
  ) {
    setMachinesByPetition((prev) => {
      const petition = allPetitions.find((p) => p._id === petitionId);
      const groups = petition ? buildSubstanceGroups(petition, commonNameToSlots) : [];
      const group = groups.find((g) => g.groupKey === groupKey);
      const baselineMap: Record<string, string[]> = { ...(prev[petitionId] ?? {}) };
      if (baselineMap[groupKey] === undefined) {
        baselineMap[groupKey] = petition && group ? baselineSlotsForGroup(petition, group) : [];
      }
      const current = [...baselineMap[groupKey]];
      while (current.length <= slotIndex) current.push('');
      current[slotIndex] = current[slotIndex] === machineKey ? '' : machineKey;
      baselineMap[groupKey] = current;
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

    const groups = groupsByPetition.get(petition._id) ?? buildSubstanceGroups(petition, commonNameToSlots);

    // every substance that needs an instrument must have a machine picked
    const incomplete = groups.some((group) => {
      const sel = getSelectedSlotMachines(petition, group);
      return group.slots.length === 0 || group.slots.some((s, i) => s.instrument !== null && !sel[i]);
    });
    if (incomplete) {
      toast.error('กรุณาเลือกเครื่องให้ครบทุกสารก่อน assign');
      return;
    }

    const machinesPayload: PetitionAssignedMachine[] = [];
    groups.forEach((group) => {
      getSelectedSlotMachines(petition, group).forEach((id) => {
        if (!id) return;
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
      stopEditing(petition._id);
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
          <PageHeader
            title="Assign คำร้องให้เจ้าหน้าที่"
            description="เลือกเจ้าหน้าที่แผนก Lab/วิเคราะห์ เฉพาะประเภทพนักงานรายเดือน"
            actions={
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
            }
          />

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
                getSelectedSlotMachines={getSelectedSlotMachines}
                onSelectMachine={setMachineForSlot}
                savingId={savingId}
                editingIds={editingIds}
                onEdit={startEditing}
                onCancelEdit={stopEditing}
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
                getSelectedSlotMachines={getSelectedSlotMachines}
                onSelectMachine={setMachineForSlot}
                savingId={savingId}
                editingIds={editingIds}
                onEdit={startEditing}
                onCancelEdit={stopEditing}
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

interface SingleMachinePickerProps {
  machines: MachineItem[];
  selectedId: string | null;
  onSelect: (machineKey: string) => void;
  slotLabel: string;        // e.g. "เครื่องที่ 1"
  substanceName: string;    // e.g. "PROPANIL 36%"
  instrument: SlotRequirement;   // GC | HPLC | BOTH
  readOnly?: boolean;       // locked view — show selection without the picker
}

// One box = one machine slot. Single-select: picking a machine replaces the slot,
// picking the already-selected one clears it.
function SingleMachinePicker({
  machines,
  selectedId,
  onSelect,
  slotLabel,
  substanceName,
  instrument,
  readOnly = false,
}: SingleMachinePickerProps) {
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

  const selected = useMemo(
    () => machines.find((m) => (m._id || m.code) === selectedId) ?? null,
    [machines, selectedId],
  );

  if (readOnly) {
    return (
      <div
        title={substanceName}
        className="w-[170px] shrink-0 rounded-md border border-grey-100 bg-grey-50/60 px-2 py-1.5"
      >
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] font-medium text-black-500">
            {substanceName || slotLabel}
          </span>
          <Badge
            variant={instrument === 'GC' ? 'green-soft' : instrument === 'HPLC' ? 'blue-soft' : 'outline'}
            className="ml-auto shrink-0 px-1 py-0 text-[9px] font-medium"
          >
            {instrument === 'BOTH' ? 'GC/HPLC' : instrument}
          </Badge>
        </div>
        <div className="text-[9px] text-grey-400">{slotLabel}</div>
        <div className="mt-0.5 flex items-center gap-1">
          <Cog className="h-3 w-3 shrink-0 text-grey-400" />
          <span
            className={`truncate text-xs ${
              selected ? 'font-medium text-black-500' : 'text-grey-400'
            }`}
          >
            {selected ? selected.name : 'ไม่ได้เลือก'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={substanceName}
          className="w-[170px] shrink-0 rounded-md border border-grey-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/30 data-[state=open]:border-primary-400"
        >
          <div className="flex items-center gap-1">
            <span className="truncate text-[11px] font-medium text-black-500">
              {substanceName || slotLabel}
            </span>
            <Badge
              variant={instrument === 'GC' ? 'green-soft' : 'blue-soft'}
              className="ml-auto shrink-0 px-1 py-0 text-[9px] font-medium"
            >
              {instrument}
            </Badge>
          </div>
          <div className="text-[9px] text-grey-400">{slotLabel}</div>
          <div className="mt-0.5 flex items-center gap-1">
            <Cog className="h-3 w-3 shrink-0 text-grey-400" />
            <span
              className={`truncate text-xs ${
                selected ? 'font-medium text-black-500' : 'text-grey-400'
              }`}
            >
              {selected ? selected.name : 'เลือกเครื่อง'}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
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
              const checked = key === selectedId;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => {
                    onSelect(key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-grey-50 ${
                    checked ? 'bg-primary-50' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      checked ? 'border-primary-500' : 'border-grey-300'
                    }`}
                  >
                    {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-black-500">
                      {machine.name}
                    </span>
                    {machine.location && (
                      <span className="block truncate text-[11px] text-grey-500">
                        {machine.location}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
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
  getSelectedSlotMachines: (petition: Petition, group: SubstanceGroup) => string[];
  onSelectMachine: (
    petitionId: string,
    groupKey: string,
    slotIndex: number,
    machineKey: string,
  ) => void;
  savingId: string | null;
  editingIds: Set<string>;
  onEdit: (petitionId: string) => void;
  onCancelEdit: (petitionId: string) => void;
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
  getSelectedSlotMachines,
  onSelectMachine,
  savingId,
  editingIds,
  onEdit,
  onCancelEdit,
  assignPetition,
  onPetitionClick,
  emptyText,
  showPhase2Badge,
}: AssignTableProps) {
  return (
    <div className="rounded-[10px] border border-black-50 bg-white overflow-x-auto">
      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow>
            <TableHead>เลขที่คำร้อง</TableHead>
            <TableHead>ชื่อสาร</TableHead>
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
            const petitionGroups = groupsByPetition.get(petition._id) ?? [];
            const hasUnassignableGroup = petitionGroups.some((g) =>
              g.slots.length === 0 || g.slots.some((s) => s.instrument === null),
            );
            // every substance slot that needs an instrument must have a machine picked
            const allMachinesSelected = petitionGroups.every((g) => {
              const sel = getSelectedSlotMachines(petition, g);
              return g.slots.every((s, i) => s.instrument === null || !!sel[i]);
            });
            const assignDisabledReason = hasUnassignableGroup
              ? 'ยังไม่ได้กำหนด method ของสารใน simple method — assign ไม่ได้'
              : !selectedEmployeeId
                ? 'เลือกเจ้าหน้าที่ก่อน'
                : !allMachinesSelected
                  ? 'เลือกเครื่องให้ครบทุกสารก่อน'
                  : null;
            const assignDisabled =
              !selectedEmployeeId ||
              savingId === petition._id ||
              hasUnassignableGroup ||
              !allMachinesSelected;
            // already-assigned petitions are read-only until the user clicks "แก้ไข"
            const isAssigned = !!petition.assignedTo;
            const locked = isAssigned && !editingIds.has(petition._id);

            return (
              <TableRow key={petition._id}>
                <TableCell className="align-top">
                  <button
                    type="button"
                    className="font-semibold text-primary-500 hover:underline"
                    onClick={() => onPetitionClick(petition._id)}
                  >
                    {petition.petitionNo}
                  </button>
                  <div className="mt-0.5 text-xs text-grey-500">
                    ผู้ยื่น: {petition.submittedBy?.name ?? '-'}
                    <span className="text-grey-400"> · {petition.dept}</span>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {petitionGroups.length === 0 ? (
                    <span className="text-xs text-grey-500">-</span>
                  ) : (
                    <div className="divide-y divide-grey-100">
                      {petitionGroups.map((group) => (
                        <div
                          key={group.groupKey}
                          className="min-h-[60px] py-1.5 first:pt-0 last:pb-0"
                        >
                          <div className="font-medium text-black-500 max-w-[200px] truncate">
                            {group.commonName || group.sampleName || '(ไม่มีชื่อ)'}
                          </div>
                          {group.slots.length > 1 && (
                            <div className="mt-0.5 space-y-0.5">
                              {group.slots.map((slot, idx) => (
                                <div
                                  key={`${slot.name}-${idx}`}
                                  className="flex items-center gap-1 text-[11px] text-grey-500"
                                >
                                  <span className="truncate max-w-[150px]">• {slot.name}</span>
                                  {slot.instrument === 'BOTH' ? (
                                    <>
                                      <Badge variant="green-soft" className="px-1 py-0 text-[9px] font-medium">GC</Badge>
                                      <Badge variant="blue-soft" className="px-1 py-0 text-[9px] font-medium">HPLC</Badge>
                                    </>
                                  ) : slot.instrument ? (
                                    <Badge
                                      variant={slot.instrument === 'GC' ? 'green-soft' : 'blue-soft'}
                                      className="px-1 py-0 text-[9px] font-medium"
                                    >
                                      {slot.instrument}
                                    </Badge>
                                  ) : (
                                    <Badge variant="red-soft" className="px-1 py-0 text-[9px] font-medium">
                                      ไม่ได้ตั้ง
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {petitionGroups.length === 0 ? (
                    <span className="text-xs text-grey-500">-</span>
                  ) : (
                    <div className="divide-y divide-grey-100">
                      {petitionGroups.map((group) => {
                        const seqLabel = sampleSeqLabel(group);
                        return (
                          <div
                            key={group.groupKey}
                            className="flex min-h-[60px] items-center py-1.5 first:pt-0 last:pb-0"
                          >
                            <span className="font-medium tabular-nums text-black-500">
                              {seqLabel || '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    {showPhase2Badge && (
                      <Badge variant="yellow-soft" className="font-normal">Phase 2</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="min-w-[280px] align-top">
                  {locked ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-black-500">
                      <UserCheck className="h-4 w-4 text-green-500" />
                      {petition.assignedTo?.name ?? '-'}
                      {petition.assignedTo?.department && (
                        <span className="text-xs font-normal text-grey-500">
                          · {petition.assignedTo.department}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </TableCell>
                <TableCell className="min-w-[420px] align-top">
                  {petitionGroups.length === 0 ? (
                    <div className="text-xs text-grey-500">ไม่มีตัวอย่างให้ assign</div>
                  ) : (
                    <div className="divide-y divide-grey-100">
                      {petitionGroups.map((group) => {
                        const slotMachines = getSelectedSlotMachines(petition, group);
                        return (
                          <div
                            key={group.groupKey}
                            className="flex min-h-[60px] items-center py-1.5 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {group.slots.map((slot, idx) => {
                                const inst = slot.instrument;
                                return (
                                  <div key={`${slot.name}-${idx}`} className="flex items-center gap-1.5">
                                    {idx > 0 && (
                                      <span className="text-grey-400 font-medium">+</span>
                                    )}
                                    {inst === null ? (
                                      <div
                                        title={slot.name}
                                        className="w-[170px] shrink-0 rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-[10px] text-amber-700"
                                      >
                                        <div className="font-medium truncate">
                                          {slot.name || `เครื่องที่ ${idx + 1}`}
                                        </div>
                                        ยังไม่ได้ตั้ง method ในซิมเปิลเมธอด
                                      </div>
                                    ) : (
                                      (() => {
                                        const filteredMachines = machines.filter(
                                          (m) => machineMatchesSlot(machineInstrument(m), inst),
                                        );
                                        return (
                                          <div>
                                            <SingleMachinePicker
                                              slotLabel={`เครื่องที่ ${idx + 1}`}
                                              substanceName={slot.name}
                                              instrument={inst}
                                              readOnly={locked}
                                              machines={filteredMachines}
                                              selectedId={slotMachines[idx] || null}
                                              onSelect={(machineKey: string) =>
                                                onSelectMachine(
                                                  petition._id,
                                                  group.groupKey,
                                                  idx,
                                                  machineKey,
                                                )
                                              }
                                            />
                                            {filteredMachines.length === 0 && (
                                              <div className="mt-0.5 text-[11px] text-red-500">
                                                ไม่พบเครื่อง {inst === 'BOTH' ? 'GC/HPLC' : inst}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>
                                );
                              })}
                              {group.slots.length === 0 && (
                                <span className="text-xs text-grey-500">ไม่มีสาร</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right align-top">
                  {locked ? (
                    <Button
                      size="sm"
                      variant="primary-outline"
                      onClick={() => onEdit(petition._id)}
                    >
                      <Pencil className="h-4 w-4" />
                      แก้ไข
                    </Button>
                  ) : (
                    (() => {
                      const saveBtn = (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={assignDisabled}
                          onClick={() => assignPetition(petition)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          {savingId === petition._id
                            ? 'กำลังบันทึก...'
                            : isAssigned
                              ? 'บันทึก'
                              : 'Assign'}
                        </Button>
                      );
                      const wrapped = assignDisabledReason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">{saveBtn}</span>
                          </TooltipTrigger>
                          <TooltipContent>{assignDisabledReason}</TooltipContent>
                        </Tooltip>
                      ) : (
                        saveBtn
                      );
                      return (
                        <div className="flex items-center justify-end gap-1.5">
                          {isAssigned && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onCancelEdit(petition._id)}
                            >
                              <X className="h-4 w-4" />
                              ยกเลิก
                            </Button>
                          )}
                          {wrapped}
                        </div>
                      );
                    })()
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
