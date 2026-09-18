import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ValidationDataGrid from "./ValidationDataGrid";
import { preparationResult, type PreparationLevel, type ValidationStock } from "@/lib/validationPreparation";

export default function ValidationLinearityGrid({value,onChange,levels,stock,stocks}:{value:string;onChange:(value:string)=>void;levels:PreparationLevel[];stock:number|null;stocks:ValidationStock[]}) {
  const [raw,setRaw]=useState(false);
  const lines=value ? value.split(/\r?\n/).map(line=>line.split(/[,;\t]/)) : [];
  const count=Math.max(levels.length*3,lines.length);
  const rows=Array.from({length:count},(_,i)=>lines[i] ?? [String(preparationResult(levels[Math.floor(i/3)],stock,stocks)?.actual ?? ""),""]);
  const update=(index:number,column:number,text:string)=>onChange(rows.map((row,i)=>i===index?row.map((v,c)=>c===column?text:v).join("\t"):row.join("\t")).join("\n"));
  const malformed=lines.some(row=>row.length!==2);
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">5 ระดับ × 3 Area = 15 Injection · เว้นผลวัดว่างจนกว่าจะกรอกจริง</p><Button variant="outline" onClick={()=>setRaw(!raw)}>{raw?"แสดงระดับละ 3 Area":"นำเข้า / แก้ข้อมูลราย Injection"}</Button>{raw||malformed?<ValidationDataGrid label="ข้อมูล Linearity" columns={["Actual (mg/mL)","Area"]} value={value} onChange={onChange}/>:<div className="overflow-x-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["ระดับ","Injection","Actual (mg/mL)","Area"].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row,i)=><tr key={i} className="hover:bg-accent">{i%3===0&&<td rowSpan={Math.min(3,count-i)} className="p-2 align-top">LV {Math.floor(i/3)+1}</td>}<td className="p-2">{i%3+1}</td>{[0,1].map(c=><td key={c} className="p-2"><Input aria-label={`Linearity LV ${Math.floor(i/3)+1} Injection ${i%3+1} ${c===0?"Actual":"Area"}`} inputMode="decimal" value={row[c]??""} onChange={e=>update(i,c,e.target.value)}/></td>)}</tr>)}</tbody></table></div>}</div>;
}
