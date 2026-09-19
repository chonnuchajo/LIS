import { useState } from "react";
import { Button } from "@/components/ui/button";
import ValidationAccuracyGrid from "./ValidationAccuracyGrid";
export default function ValidationPrecisionDays({value, targets, onChange, readOnly = false}: {value:string;targets:number[];onChange:(value:string)=>void;readOnly?:boolean}) {
 const [day,setDay]=useState(1);
 const lines=value ? value.split(/\r?\n/).map(line=>line.split(/[,;\t]/)) : [];
 const data=lines.filter(row=>Number(row[0])===day).map(row=>row.slice(1).join("\t")).join("\n");
 const dayOne = lines.filter(row => Number(row[0]) === 1);
 const levels = [...new Set([...targets, ...dayOne.map(row => Number(row[1]))])].filter(level => Number.isFinite(level) && level > 0).sort((a,b) => a-b);
 const emptyDay = levels.flatMap(level => {
   const reference = dayOne.filter(row => Number(row[1]) === level);
   return Array.from({ length: reference.length || 10 }, () => `${level}\t${level}\t`);
 }).join("\n");
 const displayedData = day > 1 && !data ? emptyDay : data;
 return <div className="space-y-3"><div className="flex flex-wrap gap-2" aria-label="วันวิเคราะห์ Precision">{[1,2,3,4,5,6].map(n=><Button key={n} variant={day===n?"default":"outline"} onClick={()=>setDay(n)}>วันที่ {n}{n===1?" · Accuracy":""}</Button>)}</div><p className="text-sm text-muted-foreground">{day===1?"วันที่ 1 เชื่อมผลจาก Accuracy อัตโนมัติ แก้ไขผลที่หัวข้อ Accuracy":"กรอกผลวันที่ "+day+" แยกตามความเข้มข้น ใช้จำนวนซ้ำเท่ากับ Accuracy"}</p><ValidationAccuracyGrid key={day} targets={levels} value={displayedData} readOnly={readOnly||day===1} onChange={next=>onChange([...lines.filter(row=>Number(row[0])!==day).map(row=>row.join("\t")),...next.split(/\r?\n/).filter(Boolean).map(line=>`${day}\t${line}`)].join("\n"))}/></div>;
}
