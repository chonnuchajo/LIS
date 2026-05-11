import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, RefreshCw, Package, MapPin, Hash, FlaskConical } from 'lucide-react';
import AppSidebar from '@/components/lis/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { type MFItem, getSampleName } from './PendingSamplePage';

const MF_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/item-MF';

export default function PendingSampleDetailPage() {
  const { prodOrderNo } = useParams<{ prodOrderNo: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<MFItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prodOrderNo) return;
    setLoading(true);
    setError(null);
    fetch(MF_API_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: MFItem[]) => {
        setItems(
          (Array.isArray(data) ? data : []).filter((i) => i.prod_order_no === prodOrderNo),
        );
      })
      .catch((e: Error) => setError(`โหลดข้อมูลไม่สำเร็จ: ${e.message}`))
      .finally(() => setLoading(false));
  }, [prodOrderNo]);

  function handleSend() {
    let seq = 1;
    const prefillItems = items.map((item) => ({
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
    }));
    navigate('/petitions/new', {
      state: { prefill: { items: prefillItems }, prodOrderNos: [prodOrderNo!] },
    });
  }

  const header = items[0];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-black-500 truncate">{prodOrderNo}</h1>
              <p className="text-sm text-grey-500">รายละเอียดตัวอย่างก่อนส่งตรวจ</p>
            </div>
            {!loading && items.length > 0 && (
              <Button variant="primary" onClick={handleSend}>
                <Send className="h-4 w-4" />
                ส่งคำขอตรวจ
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center text-grey-500 py-16">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary-500" />
              กำลังโหลดข้อมูล...
            </div>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="text-center text-grey-500 py-16">
              ไม่พบข้อมูลสำหรับ {prodOrderNo}
            </div>
          )}

          {!loading && header && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ข้อมูลใบสั่งผลิต</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <p className="text-xs text-grey-500 mb-1">เลขที่ใบสั่งผลิต</p>
                    <p className="font-bold text-primary-500">{header.prod_order_no}</p>
                  </div>
                  <div>
                    <p className="text-xs text-grey-500 mb-1">วันที่สร้าง</p>
                    <p className="font-medium">{header.create_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-grey-500 mb-1">สถานะ</p>
                    <Badge variant="yellow-soft">{header.status_}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-grey-500 mb-1">จำนวนรวม</p>
                    <p className="font-medium">
                      {header.header_qty?.toLocaleString()} {header.uom_code}
                    </p>
                  </div>
                  {header.header_location && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-grey-500 mb-1">สถานที่</p>
                      <p className="font-medium">{header.header_location}</p>
                    </div>
                  )}
                  {header.prod_group_name && (
                    <div>
                      <p className="text-xs text-grey-500 mb-1">กลุ่มสินค้า</p>
                      <p className="font-medium">{header.prod_group_name}</p>
                    </div>
                  )}
                  {header.prod_type_name && (
                    <div>
                      <p className="text-xs text-grey-500 mb-1">ประเภทสินค้า</p>
                      <p className="font-medium">{header.prod_type_name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-black-500">รายละเอียดตัวอย่าง</h2>
                <Badge variant="gray-soft">{items.length} รายการ</Badge>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <Card key={`${item.item_no}-${idx}`}>
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-grey-500 font-medium">
                            Item No: {item.item_no}
                          </span>
                        </div>
                        {item.short_dm1_code && (
                          <Badge variant="gray-soft">{item.short_dm1_code}</Badge>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <FlaskConical className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs text-grey-500 font-medium">
                              ชื่อสินค้า (prod_descript)
                            </p>
                            <p className="text-sm font-bold text-black-700 leading-snug">
                              {item.prod_descript}
                            </p>
                            {item.prod_descript2 && (
                              <p className="text-xs text-grey-500">{item.prod_descript2}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-grey-400 mt-0.5 flex-shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs text-grey-500 font-medium">
                              ขนาดบรรจุ (packsize)
                            </p>
                            <p className="text-sm font-medium text-black-600">
                              {item.packsize || (
                                <span className="text-grey-300 italic">ไม่ระบุ</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Hash className="h-4 w-4 text-grey-400 mt-0.5 flex-shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs text-grey-500 font-medium">
                              สารสำคัญ (common_name)
                            </p>
                            <p className="text-sm italic text-grey-600">
                              {item.common_name || (
                                <span className="text-grey-300 not-italic">ไม่ระบุ</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 text-sm">
                        <div>
                          <p className="text-xs text-grey-500 mb-0.5">จำนวน</p>
                          <p className="font-semibold text-black-700">
                            {item.line_qty?.toLocaleString()} {item.uom_code}
                          </p>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-grey-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-grey-500 mb-0.5">Location</p>
                            <p className="font-medium text-black-600">
                              {item.location_code || '—'}
                            </p>
                            {item.bin_code && (
                              <p className="text-xs text-grey-400">Bin: {item.bin_code}</p>
                            )}
                          </div>
                        </div>
                        {item.trade_name && item.trade_name !== item.prod_descript && (
                          <div>
                            <p className="text-xs text-grey-500 mb-0.5">Trade Name</p>
                            <p className="font-medium text-black-600">{item.trade_name}</p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-[8px] bg-primary-50 border border-primary-100 px-3 py-2">
                        <p className="text-xs text-primary-500 font-medium mb-0.5">
                          ชื่อที่จะใช้ในคำร้อง
                        </p>
                        <p className="text-sm text-primary-700 font-medium">
                          {getSampleName(item)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" size="lg" onClick={handleSend}>
                  <Send className="h-5 w-5" />
                  ส่งคำขอตรวจทั้งหมด {items.length} รายการ
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
