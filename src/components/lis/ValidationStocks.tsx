import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stockConcentration, type PreparationLevel, type ValidationStock } from "@/lib/validationPreparation";

export default function ValidationStocks({ stocks, levels, onChange, measurementStockIds = [] }: {
  stocks: ValidationStock[]; levels: PreparationLevel[]; onChange: (stocks: ValidationStock[]) => void; measurementStockIds?: string[];
}) {
  const update = (id: string, key: keyof ValidationStock, value: string) => onChange(stocks.map(stock => stock.id === id ? { ...stock, [key]: value } : stock));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold">Stock เพิ่มเติม</h3><p className="text-sm text-muted-foreground">แยกชุดชั่งมาตรฐานสำหรับ Calibration, Accuracy หรือ QC แล้วเลือก Stock ในแผนแต่ละระดับ</p></div><Button variant="outline" onClick={() => onChange([...stocks, { id: crypto.randomUUID(), name: `Stock ${stocks.length + 2}`, weight: "", purity: "", volume: "25", certificate: "", preparedOn: "" }])}><Plus className="mr-2 h-4 w-4" />เพิ่ม Stock</Button></div>
    {stocks.map((stock, index) => {
      const actual = stockConcentration(Number(stock.weight), Number(stock.purity), Number(stock.volume));
      const linked = levels.some(level => level.stockId === stock.id) || measurementStockIds.includes(stock.id);
      return <div key={stock.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([
          ["name", "ชื่อ / รหัส Stock"], ["weight", "น้ำหนักมาตรฐาน (mg)"], ["purity", "Purity (%)"], ["volume", "ปริมาตร Stock (mL)"], ["certificate", "Certificate / Lot มาตรฐาน"], ["preparedOn", "วันที่เตรียม / ผู้เตรียม"],
        ] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input aria-label={`${label} Stock เพิ่มเติม ${index + 1}`} type={["weight", "purity", "volume"].includes(key) ? "number" : "text"} step="any" value={stock[key]} onChange={e => update(stock.id, key, e.target.value)} /></label>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">C stock: <strong>{actual?.toLocaleString("en-US", { maximumFractionDigits: 8 }) ?? "—"} mg/mL</strong></p><Button variant="ghost" size="sm" disabled={linked} onClick={() => onChange(stocks.filter(row => row.id !== stock.id))}><Trash2 className="mr-2 h-4 w-4" />ลบ Stock</Button></div>
        {linked && <p className="text-xs text-muted-foreground">มีแผนหรือตัวอย่างใช้ Stock นี้ เปลี่ยน Stock ของรายการนั้นก่อนลบ</p>}
      </div>;
    })}
  </div>;
}
