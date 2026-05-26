import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, FlaskConical, Hourglass, RefreshCw, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { api } from '@/lib/api';
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionAssignee,
} from '@/types/petition.types';

type TabKey = 'normal' | 'phase2';

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

function getCommonNames(petition: Petition) {
  return Array.from(
    new Set(
      petition.items
        .map((item) => item.commonName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );
}

export default function PetitionAssignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: pendingData,
    loading: pendingLoading,
    error: pendingError,
    refresh: refreshPending,
  } = usePetitionList({ page: 1, limit: 100, status: 'pendingReview' });
  const {
    data: inProgressData,
    loading: inProgressLoading,
    error: inProgressError,
    refresh: refreshInProgress,
  } = usePetitionList({ page: 1, limit: 100, status: 'inProgress' });
  const [employees, setEmployees] = useState<EmployeeAssignee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [selectedByPetition, setSelectedByPetition] = useState<Record<string, string>>({});
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

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.employeeId, employee])),
    [employees],
  );
  const loading = pendingLoading || inProgressLoading;
  const error = pendingError || inProgressError;

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

    setSavingId(petition._id);
    try {
      await api.patch<Petition>(`/petitions/${petition._id}/assign`, {
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        assignedBy: user?.name || user?.email,
      } satisfies PetitionAssignee);
      toast.success(`Assign ${petition.petitionNo} ให้ ${employee.name} แล้ว`);
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

          {(error || employeesError) && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
              {error ? `โหลดคำร้องไม่สำเร็จ: ${error}` : `โหลดข้อมูลพนักงานไม่สำเร็จ: ${employeesError}`}
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
                loading={loading || employeesLoading}
                employees={employees}
                selectedByPetition={selectedByPetition}
                setSelectedByPetition={setSelectedByPetition}
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
                loading={loading || employeesLoading}
                employees={employees}
                selectedByPetition={selectedByPetition}
                setSelectedByPetition={setSelectedByPetition}
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

interface AssignTableProps {
  petitions: Petition[];
  loading: boolean;
  employees: EmployeeAssignee[];
  selectedByPetition: Record<string, string>;
  setSelectedByPetition: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
  selectedByPetition,
  setSelectedByPetition,
  savingId,
  assignPetition,
  onPetitionClick,
  emptyText,
  showPhase2Badge,
}: AssignTableProps) {
  return (
    <div className="rounded-[10px] border border-black-50 bg-white overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>เลขที่คำร้อง</TableHead>
            <TableHead>ผู้ยื่น</TableHead>
            <TableHead>ตัวอย่าง</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>เจ้าหน้าที่</TableHead>
            <TableHead className="text-right">บันทึก</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-grey-500">
                กำลังโหลดข้อมูล...
              </TableCell>
            </TableRow>
          )}
          {!loading && petitions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-grey-500">
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
                  {getCommonNames(petition).length > 0 && (
                    <div className="mt-1 max-w-[260px] text-xs text-grey-500">
                      Common name: {getCommonNames(petition).join(', ')}
                    </div>
                  )}
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
