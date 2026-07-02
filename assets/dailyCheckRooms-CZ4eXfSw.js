import{T as l}from"./thermometer-CwaSEx_d.js";import{L as p}from"./list-BwloATJq.js";import{F as m}from"./file-down-BLtFaCoZ.js";import{c as r,a as h,F as d}from"./main-CYPaaZm1.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=r("Beaker",[["path",{d:"M4.5 3h15",key:"c7n0jr"}],["path",{d:"M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3",key:"m1uhx7"}],["path",{d:"M6 14h12",key:"4cwo0f"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=r("Microscope",[["path",{d:"M6 18h8",key:"1borvv"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M14 22a7 7 0 1 0 0-14h-1",key:"1jwaiy"}],["path",{d:"M9 14h2",key:"197e7h"}],["path",{d:"M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z",key:"1bmzmy"}],["path",{d:"M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3",key:"1drr47"}]]),t="/daily-check",a=(e,o,c,n,s=!1)=>({slug:e,route:`${t}/${e}`,label:o,icon:c,forms:n,ready:s}),i=[a("balance","ห้องเครื่องชั่ง",h,["อุณหภูมิ/ความชื้น (ห้องชั่งสาร)","Dry cabinet","เครื่องชั่ง 2 ตำแหน่ง","เครื่องชั่ง 4 ตำแหน่ง","เครื่องชั่ง 5 ตำแหน่ง","Hood"],!0),a("sample-prep","ห้องเตรียมตัวอย่าง",y,["อุณหภูมิ/ความชื้น","Ultrasonic / Ultrasonic Cleaner","Asirator pump","Desiccator","Hotplate","Magnetic stirrer","Oven","pH Meter","Water bath","milli-Q","Hood","Density"],!0),a("analysis","ห้องวิเคราะห์",u,["อุณหภูมิ/ความชื้น (ห้องวิเคราะห์)","GC 7890A","GC 8850","GC 8890","HPLC 1260 Infinity III","HPLC Agilent 1260"],!0),a("extraction","ห้องสกัด",d,["Asirator pump","Cooling","Desiccator","Heating mantle","Magnetic stirrer"],!0)],b=e=>i.find(o=>o.slug===e),A=[{route:`${t}/environment`,label:"อุณหภูมิ/ความชื้น",icon:l},...i.map(e=>({route:e.route,label:e.label,icon:e.icon})),{route:`${t}/records`,label:"รายการบันทึก",icon:p},{route:`${t}/documents`,label:"โหลดเอกสาร",icon:m}];export{A as D,b as g};
