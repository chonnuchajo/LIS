import{c as t,G as l,H as i}from"./main-DvlOhqvZ.js";import{U as n}from"./AppLayout-DExHwBKv.js";import{A as s}from"./activity-Beu-e6me.js";import{H as r}from"./history-CgAihSma.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=t("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=t("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]),c="deny:",k={"/stock":[{key:"standard",label:"Standards"},{key:"solvent",label:"สารเคมี"},{key:"glassware",label:"เครื่องแก้ว"},{key:"receive",label:"รับเข้า"},{key:"history",label:"ประวัติ"}],"/stock-deduction":[{key:"in-use",label:"กำลังใช้งานอยู่"},{key:"history",label:"ประวัติการตัด stock"}],"/settings":[{key:"environment",label:"ห้องตรวจสภาพแวดล้อม"},{key:"printers",label:"เครื่องพิมพ์เอกสาร"},{key:"doc-numbers",label:"รหัสเอกสาร"},{key:"instruments",label:"เครื่องมือ/API"},{key:"dashboard",label:"แดชบอร์ด"},{key:"line",label:"LINE",adminOnly:!0},{key:"api-keys",label:"API Key",adminOnly:!0}],"/report":[{key:"dashboard",label:"Dashboard ภาพรวม",icon:y},{key:"trend",label:"%AI",icon:d},{key:"oee",label:"OEE เครื่องวิเคราะห์",icon:l},{key:"workload",label:"Workload บุคลากร",icon:n}],"/admin-data":[{key:"database",label:"ฐานข้อมูลผลลัพธ์",icon:i},{key:"activelog",label:"Active Log",icon:s},{key:"auditlog",label:"Audit Log",icon:r}]},b=(e,a)=>`${e}/${a}`,h=(e,a)=>`${c}${b(e,a)}`,u=e=>k[e]??[],v=e=>u(e).filter(a=>!a.adminOnly),w=(e,a,o)=>e.includes(h(a,o));export{d as T,v as c,h as d,w as i,u as t};
