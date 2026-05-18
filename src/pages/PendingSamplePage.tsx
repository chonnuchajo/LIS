import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Send, RefreshCw, CheckSquare, Square } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSubmittedOrderNos } from '@/hooks/usePetition';

const MF_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/item-MF';

export interface MFItem {
  prod_order_no: string;
  create_date: string;
  status_: string;
  prod_descript: string;
  prod_descript2: string;
  header_location: string;
  header_qty: number;
  item_no: string;
  location_code: string;
  short_dm1_code: string;
  bin_code: string;
  line_qty: number;
  uom_code: string;
  packsize: string;
  trade_name: string;
  common_name: string;
  prod_group_name: string;
  prod_type_name: string;
}

interface GroupedOrder {
  prod_order_no: string;
  create_date: string;
  status_: string;
  header_qty: number;
  uom_code: string;
  items: MFItem[];
}

export function getSampleName(item: MFItem): string {
  return [item.prod_descript, item.packsize, item.common_name].filter(Boolean).join(' · ');
}

function isPendingQC(prod_order_no: string): boolean {
  return prod_order_no.endsWith('1') || prod_order_no.endsWith('6');
}

function groupByOrder(items: MFItem[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>();
  for (const item of items) {
    if (!isPendingQC(item.prod_order_no)) continue;
    if (!map.has(item.prod_order_no)) {
      map.set(item.prod_order_no, {
        prod_order_no: item.prod_order_no,
        create_date: item.create_date,
        status_: item.status_,
        header_qty: item.header_qty,
        uom_code: item.uom_code,
        items: [],
      });
    }
    map.get(item.prod_order_no)!.items.push(item);
  }
  return Array.from(map.values());
}

function buildPrefillItems(selectedOrders: GroupedOrder[]) {
  let seq = 1;
  return selectedOrders.flatMap((order) =>
    order.items.map((item) => ({
      seq: seq++,
      sampleName: getSampleName(item),
      commonName: item.common_name || '',
      batchNo: '',
      productionDate: item.create_date || null,
      submissionNo: '',
      packageUnit: item.packsize || '',
      testUnit: '',
      testItems: '',
      note: '',
    })),
  );
}

export default function PendingSamplePage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<GroupedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function loadData() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    Promise.all([
      fetch(MF_API_URL).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MFItem[]>;
      }),
      getSubmittedOrderNos().catch(() => new Set<string>()),
    ])
      .then(([data, submittedNos]) => {
        const all = groupByOrder(Array.isArray(data) ? data : []);
        setOrders(all.filter((o) => !submittedNos.has(o.prod_order_no)));
      })
      .catch((e: Error) => setError(`โหลดข้อมูลไม่สำเร็จ: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSelect(prod_order_no: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(prod_order_no)) next.delete(prod_order_no);
      else next.add(prod_order_no);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.prod_order_no)));
    }
  }

  function handleSendSelected() {
    const selectedOrders = orders.filter((o) => selected.has(o.prod_order_no));
    const prefillItems = buildPrefillItems(selectedOrders);
    const prodOrderNos = selectedOrders.map((o) => o.prod_order_no);
    navigate('/petitions/new', {
      state: { prefill: { items: prefillItems }, prodOrderNos },
    });
  }

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0;
  const selectedItemCount = orders
    .filter((o) => selected.has(o.prod_order_no))
    .reduce((sum, o) => sum + o.items.length, 0);

  return (
    <AppLayout mainClassName="p-4 sm:p-6 overflow-auto pb-28">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-black-500">รอส่งคำขอ</h1>
              <p className="text-sm text-grey-500">
                รายการใบสั่งผลิตที่ต้องส่งตรวจ QC (ลงท้ายด้วย 1 หรือ 6)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && <Badge variant="yellow-soft">{orders.length} รายการ</Badge>}
              <Button variant="primary-outline" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                รีเฟรช
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500 flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="danger-outline" size="sm" onClick={loadData}>
                ลองใหม่
              </Button>
            </div>
          )}

          {loading && (
            <div className="text-center text-grey-500 py-16">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary-500" />
              กำลังโหลดข้อมูล...
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="text-center text-grey-500 py-16">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 text-grey-300" />
              <p>ไม่มีรายการรอส่งตรวจในขณะนี้</p>
            </div>
          )}

          {!loading && orders.length > 0 && (
            <div className="flex items-center gap-3 rounded-[10px] border border-black-50 bg-white px-4 py-2.5">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium text-black-500 hover:text-primary-500 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary-500" />
                ) : (
                  <Square className="h-5 w-5 text-grey-400" />
                )}
                {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
              {someSelected && (
                <span className="text-sm text-grey-500">
                  เลือกแล้ว{' '}
                  <span className="font-semibold text-primary-500">{selected.size}</span>{' '}
                  ใบสั่งผลิต ({selectedItemCount} ตัวอย่าง)
                </span>
              )}
            </div>
          )}

          {!loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => {
                const first = order.items[0];
                const isSelected = selected.has(order.prod_order_no);
                return (
                  <Card
                    key={order.prod_order_no}
                    onClick={() => toggleSelect(order.prod_order_no)}
                    className={cn(
                      'cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md'
                        : 'hover:shadow-md hover:border-primary-200',
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary-500" />
                          ) : (
                            <Square className="h-5 w-5 text-grey-300" />
                          )}
                        </div>
                        <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                          <CardTitle className="text-base text-primary-500 font-bold truncate">
                            {order.prod_order_no}
                          </CardTitle>
                          <Badge variant="yellow-soft" className="flex-shrink-0">
                            {order.status_}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-grey-500 font-medium uppercase tracking-wide">
                          ชื่อตัวอย่าง
                        </p>
                        <p className="text-sm font-semibold text-black-700 leading-snug">
                          {first.prod_descript}
                        </p>
                        {first.packsize && (
                          <p className="text-xs text-grey-500">{first.packsize}</p>
                        )}
                        {first.common_name && (
                          <p className="text-xs text-grey-400 italic">{first.common_name}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-grey-500 border-t border-black-50 pt-2">
                        <span>
                          จำนวน:{' '}
                          <span className="text-black-500 font-medium">
                            {order.header_qty?.toLocaleString()} {order.uom_code}
                          </span>
                        </span>
                        <span className="text-grey-400">{order.items.length} ตัวอย่าง</span>
                      </div>
                      <p className="text-xs text-grey-400">วันที่สร้าง: {order.create_date}</p>

                      <div className="pt-1">
                        <Button
                          variant="primary-outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/pending-samples/${order.prod_order_no}`);
                          }}
                        >
                          <FlaskConical className="h-4 w-4" />
                          ดูรายละเอียด
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {someSelected && (
            <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center justify-between gap-3 border-t border-primary-200 bg-white px-4 sm:px-6 py-3 sm:py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:left-72">
              <div className="text-sm">
                <span className="font-semibold text-primary-500">{selected.size}</span>{' '}
                <span className="text-black-500">ใบสั่งผลิต</span>
                <span className="text-grey-500 ml-1">({selectedItemCount} ตัวอย่าง)</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  ยกเลิก
                </Button>
                <Button variant="primary" size="default" onClick={handleSendSelected}>
                  <Send className="h-4 w-4" />
                  ส่งคำขอ {selected.size} รายการ
                </Button>
              </div>
            </div>
          )}
        </div>
    </AppLayout>
  );
}
