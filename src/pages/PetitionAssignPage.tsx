import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, RefreshCw, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
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
import { formatPetitionWorkSections, petitionHasLabItems } from '@/lib/petitionSections';
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionAssignee,
} from '@/types/petition.types';

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

function isLabAssignee(employee: EmployeeAssignee) {
  const department = employee.department.trim().toLowerCase();
  return department.includes('lab') || department.includes('\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30');
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
    data: sampleSentData,
    loading: sampleSentLoading,
    error: sampleSentError,
    refresh: refreshSampleSent,
  } = usePetitionList({ page: 1, limit: 100, status: 'sampleSent' });
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

  useEffect(() => {
    let alive = true;
    setEmployeesLoading(true);
    setEmployeesError(null);

    api.get<EmployeeAssignee[]>('/employees/assignees')
      .then((res) => {
        if (!alive) return;
        setEmployees(res.data.data.filter(isLabAssignee));
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
  const loading = sampleSentLoading || pendingLoading || inProgressLoading;
  const error = sampleSentError || pendingError || inProgressError;

  function refreshPetitions() {
    refreshSampleSent();
    refreshPending();
    refreshInProgress();
  }

  const petitions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [
      ...(sampleSentData?.items ?? []),
      ...(pendingData?.items ?? []),
      ...(inProgressData?.items ?? []),
    ]
      .filter(petitionHasLabItems)
      .filter((petition) => {
        if (!query) return true;
        return [
          petition.petitionNo,
          petition.requester.fullName,
          petition.requester.department,
          petition.assignedTo?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [inProgressData?.items, pendingData?.items, sampleSentData?.items, search]);

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
              <h1 className="text-2xl font-bold text-foreground">Assign คำร้องให้เจ้าหน้าที่</h1>
              <p className="text-sm text-muted-foreground">
                เลือกเจ้าหน้าที่แผนกควบคุมคุณภาพหรือ Lab/วิเคราะห์ เฉพาะประเภทพนักงานรายเดือน
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">คำร้องรอ assign</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {petitions.filter((petition) => !petition.assignedTo).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">คำร้องที่มีผู้รับผิดชอบ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {petitions.filter((petition) => petition.assignedTo).length}
                </div>
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

          <div className="rounded-[10px] border border-black-50 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่คำร้อง</TableHead>
                  <TableHead>ผู้ยื่น</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>ตัวอย่าง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>เจ้าหน้าที่</TableHead>
                  <TableHead className="text-right">บันทึก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(loading || employeesLoading) && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-grey-500">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !employeesLoading && petitions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-grey-500">
                      ไม่พบคำร้องที่ต้อง assign
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !employeesLoading && petitions.map((petition) => {
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
                          onClick={() => navigate(`/petitions/${petition._id}`)}
                        >
                          {petition.petitionNo}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-black-500">{petition.requester.fullName}</div>
                        <div className="text-xs text-grey-500">{petition.requester.department}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="primary-soft">{formatPetitionWorkSections(petition)}</Badge>
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
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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
        </div>
    </AppLayout>
  );
}
