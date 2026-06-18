import{j as e}from"./vendor-query-CHuXHqWO.js";import{r as x,j as ne,h as ae,u as le}from"./vendor-react-BrcJiHE1.js";import{A as ce,T as de}from"./AppLayout-B7_PT3Ml.js";import{P as pe}from"./PageHeader-BAEl7hQZ.js";import{d as M,n as W,b as H,u as oe,B as z,Y as me,x as he,A as xe,y as je,z as ue,D as ge,E as fe,H as be,J as Ne,K as ve}from"./main-BaUNz_5E.js";import{B as I}from"./badge-BZzOcR04.js";import{C as L,a as q,b as O,c as F}from"./card-B5UkH7v5.js";import{a as X,i as Z,P as we}from"./petition.types-CQphHsuN.js";import{m as ye}from"./petitionTestItems-aeDl6GqR.js";import{u as ke}from"./useItemGroupMembership-DR48P2IL.js";import{I as ee}from"./branding-CtUiNaUF.js";import{r as Se,f as Ae}from"./formSpecificGravity-qIP9ybIB.js";import{P as V,S as De}from"./PrintPreviewDialog-V0YlMqxO.js";import{a as Re,b as Ce,f as Pe}from"./usePetition-BSB0N12K.js";import{R as Y}from"./rotate-ccw-Ct6-nogh.js";import{P as Te}from"./printer-DYOCYlUv.js";import"./index-CC5b1TUf.js";import"./user-Dzlrkz9N.js";import"./vendor-msal-VPL71qaw.js";import"./productClassification-ClRcNgCK.js";import"./vendor-qr-BPmJ3lcd.js";import"./dialog-D8SSIW4J.js";import"./label-CT9htlym.js";import"./printConfig-CO9fxii_.js";import"./minus-CbG-4oKd.js";import"./plus-Dx-qYkRF.js";function Ie(t){return t==null||t===""?"-":typeof t=="boolean"?t?"✓":"✗":typeof t=="object"?JSON.stringify(t):String(t)}function g({label:t,value:i}){const r=i==null||i===""?"-":i;return e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-grey-500 mb-0.5",children:t}),e.jsx("div",{className:"text-sm text-black-500",children:r})]})}function ze({petition:t}){var h,l,u,R,w;const{user:i}=M(),r=W(i),s=r.length>0&&r.some(c=>c!=="viewer"),[o,j]=x.useState([]),f=ke(),p=c=>f.get(String((c==null?void 0:c.sampleId)??"").trim())??[],[m,a]=x.useState([]);x.useEffect(()=>{s&&H.getParameters().then(j).catch(()=>{})},[s]),x.useEffect(()=>{!s||!t._id||H.getQCResults(t._id).then(a).catch(()=>{})},[s,t._id]);const D=x.useMemo(()=>{const c=new Map;for(const v of m)c.set(`${v.itemSeq}__${v.parameterId}`,v);return c},[m]);return e.jsxs("div",{className:"space-y-4",children:[e.jsxs(L,{children:[e.jsx(q,{children:e.jsx(O,{className:"text-xl",children:"ข้อมูลคำขอ"})}),e.jsxs(F,{className:"grid gap-4 md:grid-cols-2",children:[e.jsx(g,{label:"ผู้ยื่นคำขอ",value:(h=t.submittedBy)==null?void 0:h.name}),e.jsx(g,{label:"แผนกผู้ยื่น",value:(l=t.submittedBy)==null?void 0:l.department}),e.jsx(g,{label:"วัน-เวลาที่ส่งคำร้อง",value:(u=t.submittedBy)!=null&&u.submittedAt?new Date(t.submittedBy.submittedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-"}),e.jsx(g,{label:"แผนก",value:e.jsx(I,{variant:"blue-soft",children:X[t.dept]})}),e.jsx(g,{label:"เลขที่คำร้อง",value:t.petitionNo}),e.jsx(g,{label:"ผู้นำส่ง",value:((R=t.deliveredBy)==null?void 0:R.name)??((w=t.submittedBy)==null?void 0:w.name)}),e.jsx(g,{label:"วันที่นำส่ง",value:t.sampleSentAt?new Date(t.sampleSentAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-"})]})]}),e.jsxs(L,{children:[e.jsx(q,{children:e.jsxs(O,{children:["รายการตัวอย่าง (",t.items.length,")"]})}),e.jsx(F,{className:"space-y-3",children:t.items.map(c=>{const v=c.batchNo&&Z(c.batchNo),y=s?ye(c,o,p(c)):[];return e.jsxs("div",{className:"rounded-[10px] border border-black-50 p-4 space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-baseline gap-2",children:[e.jsxs("p",{className:"text-sm font-semibold text-black-500",children:["ตัวอย่างที่ ",c.seq,": ",c.sampleName||"-"]}),c.sampleId&&e.jsxs("span",{className:"text-xs text-primary-500",children:["[",c.sampleId,"]"]}),v&&e.jsx(I,{variant:"blue-soft",children:"ส่ง lab"})]}),e.jsxs("div",{className:"grid gap-3 md:grid-cols-2",children:[e.jsx(g,{label:"Batch No.",value:c.batchNo}),e.jsx(g,{label:"Lot No.",value:c.lotNo}),e.jsx(g,{label:"วันที่ผลิต",value:c.productionDate}),e.jsx(g,{label:"ขนาดบรรจุ",value:c.packageUnit}),e.jsx(g,{label:"ชื่อสามัญ",value:c.commonName}),e.jsx(g,{label:"เลขที่ใบนำส่ง",value:c.submissionNo})]}),c.note&&e.jsx(g,{label:"หมายเหตุ",value:c.note}),s&&e.jsx(g,{label:"รายการทดลอง / ผลตรวจ",value:y.length>0?e.jsx("div",{className:"space-y-1.5",children:y.map(b=>{const P=b._id?D.get(`${c.seq}__${b._id}`):void 0,C=P?Object.entries(P.values??{}).filter(([k])=>!k.endsWith("__note")):[];return e.jsxs("div",{className:"rounded-[8px] border border-grey-200 px-3 py-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide ${(b.scope??"qc")==="lab"?"bg-sky-100 text-sky-800":"bg-indigo-100 text-indigo-800"}`,children:(b.scope??"qc")==="lab"?"Lab":"QC"}),e.jsx("span",{className:"text-sm font-medium text-black-500",children:b.name})]}),C.length===0&&e.jsx(I,{variant:"gray-soft",children:"ยังไม่บันทึก"})]}),C.length>0&&e.jsx("div",{className:"mt-1.5 grid gap-1 text-xs text-grey-700 md:grid-cols-2",children:C.map(([k,T])=>e.jsxs("div",{className:"flex gap-1.5",children:[e.jsxs("span",{className:"text-grey-500",children:[k,":"]}),e.jsx("span",{className:"text-black-500 font-medium",children:Ie(T)})]},k))})]},b._id??b.name)})}):void 0})]},c.seq)})})]}),t.cause&&e.jsxs(L,{children:[e.jsx(q,{children:e.jsx(O,{children:"สาเหตุการตรวจ / ข้อมูลเพิ่มเติม"})}),e.jsx(F,{children:e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:t.cause})})]})]})}const Be=({petitionId:t,status:i,onChanged:r})=>(M(),x.useState(!1),x.useState(null),null);function _e(t){const i=(t??"").trim();if(!i)return"";const r=i.toLowerCase().replace(/\s+/g," "),s=r.match(/(?:ผลิต|prod(?:uction)?)\s*([1-5])/);return s?`TI P0${s[1]}`:r.includes("inter")?"TI INT":/วิจัย|r\s*&?\s*d|\brd\b/.test(r)?"TI RD":/\bqc\b|คิวซี/.test(r)?"TI QC":i}function _(t){if(!t)return"";const i=new Date(t);if(Number.isNaN(i.getTime()))return"";const r=String(i.getDate()).padStart(2,"0"),s=String(i.getMonth()+1).padStart(2,"0"),o=String((i.getFullYear()+543)%100).padStart(2,"0");return`${r}/${s}/${o}`}function K(t){if(!t)return{d:"",m:"",y:""};const i=new Date(t);return Number.isNaN(i.getTime())?{d:"",m:"",y:""}:{d:String(i.getDate()).padStart(2,"0"),m:String(i.getMonth()+1).padStart(2,"0"),y:String((i.getFullYear()+543)%100).padStart(2,"0")}}function n({checked:t}){return e.jsx("span",{className:`pr-cb${t?" pr-cb-x":""}`,"aria-hidden":!0})}function N({checked:t}){return e.jsx("span",{className:`pr-rd${t?" pr-rd-x":""}`,"aria-hidden":!0})}function d({value:t,width:i}){return e.jsx("span",{className:"pr-line",style:i?{minWidth:i}:void 0,children:t||" "})}function Le(t){var i;return t.reportAddressType==="other"?t.reportAddressOther||"":((i=t.requester)==null?void 0:i.address)||""}function qe(t){var i;return t.invoiceAddressType==="other"?t.invoiceAddressOther||"":((i=t.requester)==null?void 0:i.address)||""}function J(t){return t?Array.isArray(t)?t:[t]:[]}function Oe({lr:t,submissionNo:i}){var u,R,w,c,v,y,b,P,C,k,T;const r=t.serviceAgreement,s=t.labAgreementReview,o=K(t.createdAt),j=K(s==null?void 0:s.reviewedAt),f=t.requester,p=r==null?void 0:r.sampleDelivery,m=r==null?void 0:r.testMethod,a=r==null?void 0:r.testDuration,D=(r==null?void 0:r.testDurationDays)??"",h=m==="custom",l=m==="standard";return e.jsx("section",{className:"pr-page1",children:e.jsxs("div",{className:"pr-p1-inner",children:[e.jsx("div",{className:"pr-p1-logo",children:e.jsx("img",{src:ee,alt:"ICP Ladda"})}),e.jsx("div",{className:"pr-p1-title pr-center",children:e.jsx("b",{children:"เรื่อง: การทบทวนข้อตกลงการบริการทดสอบ"})}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"อ้างอิงใบขอรับบริการเลขที่"})," ",e.jsx("span",{className:"pr-line pr-line-md",children:i})]}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"รหัสลูกค้า"})," ",e.jsx("span",{className:"pr-line pr-line-sm",children:_e(f==null?void 0:f.department)}),e.jsx("span",{children:" / "}),e.jsx("span",{className:"pr-line pr-line-xs",children:o.y})]}),e.jsxs("div",{className:"pr-p1-notify",children:[e.jsxs("div",{className:"pr-p1-notify-line",children:["ห้องปฏิบัติการได้รับแจ้งการทบทวนข้อตกลงการบริการทดสอบทางโทรศัพท์, อีเมล์  ",e.jsx(n,{})," ใช่  ",e.jsx(n,{})," ไม่ใช่"]}),e.jsxs("div",{className:"pr-p1-notify-line",children:["ลงชื่อ ",e.jsx(d,{width:"4cm"})," ผู้แจ้ง  ",e.jsx(d,{width:"4cm"})," ผู้รับแจ้ง"]})]}),e.jsxs("table",{className:"pr-p1-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsxs("th",{className:"pr-p1-head-l",children:[e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับลูกค้ากรอก"})}),e.jsx("div",{className:"pr-p1-sub",children:"(หากลูกค้าไม่สะดวกให้เจ้าหน้าห้องปฏิบัติการกรอกแทนโดยสอบถามข้อมูลและให้ลงนามทั้งผู้สอบถามและลูกค้า)"})]}),e.jsx("th",{className:"pr-p1-head-r",children:e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับหัวหน้าห้องปฏิบัติการ"})})})]})}),e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsx("td",{className:"pr-p1-body-l",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. ตัวอย่างนำส่งห้องปฏิบัติการโดย"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:p==="self"})," 1.1 ลูกค้ามาเอง  ",e.jsx(n,{checked:p==="courier"})," 1.2 จัดส่งทางไปรษณีย์"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. วิธีทดสอบโปรดระบุ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:m==="standard"})," 2.1 วิธีปกติ ",e.jsx("span",{className:"pr-note",children:"(กรณีลูกค้าไม่ระบุวิธี)"})]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:m==="custom"})," 2.2 วิธีเฉพาะตามเอกสารของลูกค้า"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:m==="previous"})," เคยทำ  ",e.jsx(n,{checked:h&&m!=="previous"})," ไม่เคยทำ"]}),e.jsx("div",{className:"pr-ind2 pr-note",children:"(วิธีเทคนิค/เครื่องมือ/สารเคมี/ชนิดตัวอย่าง / Detection Limit)"}),(r==null?void 0:r.testMethodDetail)&&e.jsx("div",{className:"pr-ind pr-italic",children:r.testMethodDetail}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. ระยะเวลาดำเนินการทดสอบ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a==="normal"})," 3.1 ปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a==="extended"})," 3.2 ช้ากว่าปกติได้ (ภายใน"," ",e.jsx(d,{width:"1.2cm",value:a==="extended"?String(D):""})," วัน)"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a==="urgent"})," 3.3 เร็วกว่าปกติได้ (ภายใน"," ",e.jsx(d,{width:"1.2cm",value:a==="urgent"?String(D):""})," วัน)"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"4. ค่า Uncertainty"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:!!(r!=null&&r.requireUncertainty)})," ต้องการ  ",e.jsx(n,{checked:r?!r.requireUncertainty:!1})," ไม่ต้องการ"]}),e.jsxs("div",{className:"pr-terms",children:[e.jsx("div",{className:"pr-terms-title",children:e.jsx("b",{children:"เงื่อนไขการให้บริการ"})}),e.jsxs("div",{className:"pr-terms-list",children:[e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"1."}),e.jsx("span",{children:"ห้องปฏิบัติการฯให้บริการทดสอบตัวอย่างด้วยวิธีการตามเอกสาร วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชของห้องปฏิบัติการฯ (FM-QP-07-01-002)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"2."}),e.jsx("span",{children:"การรายงานผลทดสอบจะไม่มีบริการด้านการให้ความเห็น และการแปรผลไม่ตัดสินผล"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"3."}),e.jsx("span",{children:"ปริมาณตัวอย่างขั้นต่ำที่นำส่ง 500 ml, 500 g"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"4."}),e.jsx("span",{children:"ระยะเวลาในการออกผลการทดสอบ ภายใน 3 วัน (กรณีหากมีข้อสงสัยในผลการวิเคราะห์ ขอขยายเวลาออกไปอีก 3 วัน)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"5."}),e.jsx("span",{children:"ส่งตัวอย่างไม่เกิน 15.00 น. ของทุกวัน"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"6."}),e.jsx("span",{children:"ห้องปฏิบัติการฯรับผิดชอบผลการทดลองเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"7."}),e.jsx("span",{children:"ยินยอมให้เปิดเผยข้อมูลตัวอย่าง และผลทดสอบแก่หน่วยงานอื่น (กรณีลูกค้าภายในองค์กร)"})]})]}),e.jsx("div",{className:"pr-terms-ack",children:"ข้าพเจ้าได้รับทราบ และยอมรับเงื่อนไขการให้บริการของห้องปฏิบัติการ บริษัท ไอ ซี พี ลัดดา จำกัด ทุกประการ"})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(d,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(d,{width:"0.8cm",value:o.d}),"/",e.jsx(d,{width:"0.8cm",value:o.m}),"/",e.jsx(d,{width:"0.8cm",value:o.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(d,{width:"6.5cm",value:(f==null?void 0:f.fullName)??""})," )"]})]})]})}),e.jsx("td",{className:"pr-p1-body-r",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีทดสอบตามปกติ"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. บุคลากร"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.personnel)==="able"})," 1.1 ทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(u=s==null?void 0:s.personnelAbleReasons)==null?void 0:u.includes("trained")})," ได้รับการฝึกอบรมแล้ว"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(R=s==null?void 0:s.personnelAbleReasons)==null?void 0:R.includes("assigned")})," ได้รับการมอบหมายให้ทดลอง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.personnel)==="unable"})," 1.2 ไม่สามารถทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(w=s==null?void 0:s.personnelUnableReasons)==null?void 0:w.includes("neverDone")})," ยังไม่เคยทำการทดลอง"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(c=s==null?void 0:s.personnelUnableReasons)==null?void 0:c.includes("notTrained")})," ยังไม่ได้รับการฝึกอบรม"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(v=s==null?void 0:s.personnelUnableReasons)==null?void 0:v.includes("notAssigned")})," ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. ปริมาณงาน"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.workload)==="normal"})," 2.1 ยังมีความสามารถรับงานได้ตามปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.workload)==="slower"})," 2.2 สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.workload)==="cannot"})," 2.3 ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. การใช้บริการผู้รับเหมาช่วงการทดสอบ (Sub contractor)"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.subcontractor)==="none"})," 3.1 ไม่ใช้ผู้รับเหมาช่วง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:l&&(s==null?void 0:s.subcontractor)==="used"})," 3.2 การทดสอบนี้ใช้บริการทดสอบโดยผู้รับเหมาช่วง บริษัท/หน่วยงาน"," ",e.jsx(d,{width:"5cm",value:(s==null?void 0:s.subcontractor)==="used"?(s==null?void 0:s.subcontractorName)??"":""})]}),e.jsx("div",{className:"pr-ind3 pr-note",children:"(เนื่องจากห้องปฏิบัติการทดสอบไม่สามารถทดสอบได้ ซึ่งลูกค้ารับทราบ และยินยอมแล้ว)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:l&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:l&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:l&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.notAcceptableReason:" "})]}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"พิจารณาแล้วว่า"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:["1. ",e.jsx(n,{checked:h&&(s==null?void 0:s.methodSuitable)===!0})," เหมาะสม  ",e.jsx(n,{checked:h&&(s==null?void 0:s.methodSuitable)===!1})," ไม่เหมาะสม เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:h&&(s==null?void 0:s.methodSuitable)===!1?s==null?void 0:s.methodSuitableReason:" "})]}),e.jsxs("div",{className:"pr-ind",children:["2. เครื่องมือทดสอบ (เครื่องมือ ",e.jsx(d,{width:"4cm",value:(s==null?void 0:s.equipmentName)??""})," )"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:(s==null?void 0:s.equipment)==="ready"})," 2.1 มีความพร้อม เนื่องจาก ",e.jsx(N,{checked:(y=s==null?void 0:s.equipmentReadyReasons)==null?void 0:y.includes("hasInstrument")})," มีเครื่องมือ ",e.jsx(N,{checked:(b=s==null?void 0:s.equipmentReadyReasons)==null?void 0:b.includes("calibrated")})," สอบเทียบแล้ว"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:(s==null?void 0:s.equipment)==="notReady"})," 2.2 ไม่มีความพร้อม เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(P=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:P.includes("noInstrument")})," ไม่มีเครื่องมือ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(C=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:C.includes("notCalibrated")})," ยังไม่มีการสอบเทียบ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(k=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:k.includes("outOfRange")})," เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(N,{checked:(T=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:T.includes("broken")})," เครื่องมือเสีย"]}),e.jsx("div",{className:"pr-ind",children:"3. บุคลากร และปริมาณงาน ทบทวน ตามวิธีทดสอบของ ไอ ซี พี ลัดดา จำกัด (ข้อ 1 และ 2)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:h&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:h&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:h&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.notAcceptableReason:" "})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(d,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(d,{width:"0.8cm",value:j.d}),"/",e.jsx(d,{width:"0.8cm",value:j.m}),"/",e.jsx(d,{width:"0.8cm",value:j.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(d,{width:"6.5cm",value:(s==null?void 0:s.reviewedBy)??""})," )"]}),e.jsx("div",{className:"pr-sig-title",children:"หัวหน้าห้องปฏิบัติการเคมี"})]})]})})]})})]}),e.jsx("div",{className:"pr-p1-footer",children:"FM-QP-07-01-001 R02 (16/12/67) P1/1"})]})})}function Fe({lr:t,petition:i,items:r,qcResults:s,sgParam:o}){const j=i.receivedAt?new Date(i.receivedAt):null,f=j?`${String(j.getHours()).padStart(2,"0")}.${String(j.getMinutes()).padStart(2,"0")} น.`:"",p=new Set(t.testDelivery??[]),m=String((new Date(i.createdAt).getFullYear()+543)%100).padStart(2,"0"),a=t.requester,D=t.sampleReturn==="return",h=t.sampleReturn==="discard";return e.jsx("section",{className:"pr-page2",children:e.jsxs("div",{className:"pr-p2-inner",children:[e.jsxs("div",{className:"pr-p2-top",children:[e.jsx("img",{src:ee,alt:"ICP Ladda",className:"pr-p2-logo"}),e.jsx("div",{className:"pr-p2-title",children:e.jsx("b",{children:"ใบคำขอรับบริการ"})}),e.jsxs("div",{className:"pr-p2-top-r",children:[e.jsxs("div",{className:"pr-p2-sheet",children:[e.jsx("span",{children:"แผ่นที่"}),e.jsx("span",{className:"pr-line-fill pr-center",children:"1"}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"pr-line-fill pr-center",children:m})]}),e.jsxs("div",{className:"pr-p2-infobox",children:[e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เลขที่ขอรับบริการ :"}),e.jsx("span",{className:"pr-line-fill",children:t.labRequestNo})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"วันที่รับตัวอย่าง :"}),e.jsx("span",{className:"pr-line-fill",children:_(i.receivedAt)})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เวลา :"}),e.jsx("span",{className:"pr-line-fill",children:f})]})]})]})]}),e.jsx("table",{className:"pr-p2-info",children:e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsxs("td",{className:"pr-p2-info-l",children:[e.jsxs("div",{children:["ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล :"," ",e.jsx(d,{width:"14cm",value:t.reportCustomerName||(a==null?void 0:a.fullName)})]}),e.jsxs("div",{children:["ที่อยู่ที่ระบุในใบรายงานผล :"," ",e.jsx(d,{width:"16cm",value:Le(t)})]}),e.jsxs("div",{children:["ที่อยู่ในการออกใบกำกับภาษี :"," ",e.jsx(d,{width:"16cm",value:qe(t)})]}),e.jsxs("div",{children:["โทรศัพท์ : ",e.jsx(d,{width:"3.5cm",value:a==null?void 0:a.phone})," โทรสาร : ",e.jsx(d,{width:"3.5cm",value:a==null?void 0:a.fax})," E-mail : ",e.jsx(d,{width:"6cm",value:a==null?void 0:a.email})]}),e.jsxs("div",{children:["ชื่อ-สกุลผู้ติดต่อ :"," ",e.jsx(d,{width:"6cm",value:(a==null?void 0:a.contactName)||(a==null?void 0:a.fullName)})," ตำแหน่ง : ",e.jsx(d,{width:"5cm",value:a==null?void 0:a.position})]}),e.jsxs("div",{children:["ตัวอย่างหลังการทดสอบ :"," ",e.jsx(n,{checked:D})," ขอรับคืน ",e.jsx("span",{className:"pr-note",children:"(ภายใน 3 วันหลังจากได้รับผลทดสอบ)"}),"  ",e.jsx(n,{checked:h})," ไม่ขอรับคืน / No return"]}),e.jsxs("div",{children:["รายละเอียดการส่งผล : ",e.jsx(n,{checked:p.has("self")})," มารับเอง  ",e.jsx(n,{checked:p.has("mail")})," ส่งทางไปรษณีย์  ",e.jsx(n,{checked:p.has("email")})," E-Mail"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:p.has("report")})," ใบรายงานผล  ",e.jsx(n,{checked:p.has("taxInvoice")})," ใบกำกับภาษี"]})]}),e.jsx("td",{className:"pr-p2-info-r",children:(()=>{const l=J(t.storageCondition),u=J(t.packageType);return e.jsxs(e.Fragment,{children:[e.jsx("div",{children:e.jsx("b",{children:"การเก็บรักษาตัวอย่าง"})}),e.jsxs("div",{children:[e.jsx(n,{checked:l.includes("room")})," อุณหภูมิห้อง ",e.jsx(n,{checked:l.includes("chilled")})," แช่เย็น"]}),e.jsx("div",{className:"pr-mt-xs",children:e.jsx("b",{children:"ภาชนะบรรจุ"})}),e.jsxs("div",{children:[e.jsx(n,{checked:u.includes("plasticBag")})," ถุงพลาสติก ",e.jsx(n,{checked:u.includes("glassBottle")})," ขวดแก้ว ",e.jsx(n,{checked:u.includes("plasticBottle")})," ขวดพลาสติก ",e.jsx(n,{checked:u.includes("can")})," กระป๋อง"]}),e.jsxs("div",{children:[e.jsx(n,{checked:u.includes("other")})," อื่นๆ ระบุ"," ",e.jsx(d,{width:"5cm",value:u.includes("other")?t.packageTypeOther:""})]})]})})()})]})})}),e.jsxs("table",{className:"pr-p2-items",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"3%"}}),e.jsx("col",{style:{width:"18%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"4.5%"}}),e.jsx("col",{style:{width:"3.25%"}}),e.jsx("col",{style:{width:"3.25%"}}),e.jsx("col",{style:{width:"8.5%"}})]}),e.jsxs("thead",{children:[e.jsxs("tr",{children:[e.jsx("th",{rowSpan:3,children:"ลำดับ"}),e.jsx("th",{rowSpan:3,children:"ชื่อตัวอย่าง"}),e.jsx("th",{rowSpan:3,children:"เลขแบช"}),e.jsx("th",{rowSpan:3,children:"วันผลิต/ นำเข้า"}),e.jsx("th",{rowSpan:3,children:"เลขที่ใบนำส่งตัวอย่าง"}),e.jsx("th",{rowSpan:3,children:"ค่า ถ.พ."}),e.jsx("th",{rowSpan:3,children:"จำนวนหน่วยบรรจุ"}),e.jsx("th",{rowSpan:3,children:"หน่วยทดสอบ"}),e.jsx("th",{rowSpan:3,children:"รายการทดสอบ"}),e.jsx("th",{rowSpan:3,children:"หมายเหตุ"}),e.jsx("th",{colSpan:4,className:"pr-officer-head",children:"สำหรับเจ้าหน้าที่"})]}),e.jsxs("tr",{children:[e.jsxs("th",{rowSpan:2,children:["เลขที่",e.jsx("br",{}),"ตัวอย่าง"]}),e.jsx("th",{colSpan:2,children:"สภาพตัวอย่าง"}),e.jsx("th",{rowSpan:2,children:"ราคา"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"ปกติ"}),e.jsx("th",{children:"ไม่ปกติ"})]})]}),e.jsx("tbody",{children:r.length>0?r.map(l=>e.jsxs("tr",{children:[e.jsx("td",{className:"pr-center",children:l.seq}),e.jsx("td",{children:l.commonName||l.sampleName}),e.jsx("td",{children:l.batchNo}),e.jsx("td",{className:"pr-center",children:_(l.productionDate)}),e.jsx("td",{children:l.submissionNo??""}),e.jsx("td",{className:"pr-center",children:Se(s,l.seq,o)}),e.jsx("td",{children:l.packageUnit??""}),e.jsx("td",{children:l.testUnit??""}),e.jsx("td",{children:l.testItems??""}),e.jsx("td",{children:l.note??""}),e.jsx("td",{children:l.sampleId??""}),e.jsx("td",{className:"pr-center",children:l.condition==="normal"?"✓":""}),e.jsx("td",{className:"pr-center",children:l.condition==="defective"?"✓":""}),e.jsx("td",{})]},l.seq)):e.jsx("tr",{children:e.jsx("td",{colSpan:14,className:"pr-center",children:"ไม่พบรายการตัวอย่างที่อ้างอิง"})})}),e.jsxs("tfoot",{children:[e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"ราคา"}),e.jsx("td",{})]}),e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"Vat 7 %"}),e.jsx("td",{})]}),e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"ราคารวม"}),e.jsx("td",{})]})]})]}),e.jsxs("div",{className:"pr-p2-middle",children:[e.jsxs("div",{className:"pr-p2-sign",children:[e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้ส่งตัวอย่าง "}),e.jsx(d,{width:"6cm",value:(a==null?void 0:a.fullName)??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(d,{width:"6cm",value:_(i.sampleSentAt)})]})]}),e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้รับตัวอย่าง "}),e.jsx(d,{width:"6cm",value:i.receivedBy??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(d,{width:"6cm",value:_(i.receivedAt)})]})]})]}),e.jsx("div",{className:"pr-p2-warn",children:e.jsx("b",{children:"“หากสงสัยเกี่ยวกับผลการทดสอบ กรุณาติดต่อกลับภายใน 7 วัน หลังจากรับใบรายงานผลการทดสอบ”"})})]}),e.jsx("div",{className:"pr-p2-footer",children:"FM-QP-07-04-001-R01 (30/05/68) P1/1"})]})})}function He({labRequest:t,petition:i,qcResults:r=[],sgParam:s=null}){var p,m;const o=i.items.filter(a=>Z(a.batchNo)),j=o.length>0?o:i.items.filter(a=>a.seq===t.sampleSeq),f=((p=j[0])==null?void 0:p.submissionNo)??((m=i.items[0])==null?void 0:m.submissionNo)??"";return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:Ee}),e.jsxs("div",{className:"pr-root",children:[e.jsx(Oe,{lr:t,submissionNo:f}),e.jsx(Fe,{lr:t,petition:i,items:j,qcResults:r,sgParam:s})]})]})}const Ee=`
@page { size: A4 portrait; margin: 0; }
@page pageA4L { size: A4 landscape; margin: 0; }

.pr-root, .pr-root * {
  font-family: 'Angsana New', 'Cordia New', 'Sarabun', 'TH SarabunPSK', serif;
  color: #000;
  box-sizing: border-box;
}
.pr-root { font-size: 11pt; line-height: 1.12; }

.pr-page1 {
  width: 210mm; height: 297mm;
  padding: 6mm 8mm 6mm 10mm;
  display: flex; flex-direction: column;
  overflow: hidden;
  page-break-after: always;
}
.pr-page2 {
  page: pageA4L;
  width: 297mm; height: 210mm;
  padding: 5mm 6mm;
  display: flex; flex-direction: column;
  overflow: hidden;
  page-break-after: always;
}

@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  .pr-p2-info, .pr-p2-top { break-inside: avoid; page-break-inside: avoid; }
  .pr-p2-items tr { break-inside: avoid; page-break-inside: avoid; }
  .pr-p2-warn { break-inside: avoid; page-break-inside: avoid; }
}
@media screen {
  .pr-page1 { margin: 0 auto 16px; background: #fff; box-shadow: 0 0 0 1px #ddd; }
  .pr-page2 { margin: 0 auto; background: #fff; box-shadow: 0 0 0 1px #ddd; }
}

.pr-cb {
  display: inline-block;
  width: 9pt; height: 9pt;
  border: 0.6pt solid #000;
  vertical-align: -1pt;
  margin-right: 1.5pt;
  position: relative;
}
.pr-cb-x::before {
  content: '✓'; position: absolute; inset: -1pt 0 0 0;
  text-align: center; font-size: 9pt; line-height: 9pt; font-weight: bold;
}
.pr-rd {
  display: inline-block;
  width: 7pt; height: 7pt;
  border: 0.6pt solid #000;
  border-radius: 50%;
  vertical-align: -0.5pt;
  margin: 0 2pt 0 0;
  position: relative;
}
.pr-rd-x::before {
  content: ''; position: absolute; inset: 1pt;
  background: #000; border-radius: 50%;
}
.pr-line {
  display: inline-block;
  min-width: 2.2cm;
  border-bottom: 0.4pt dotted #000;
  padding: 0 2pt;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: baseline;
}
.pr-line-xs { min-width: 0.9cm; }
.pr-line-sm { min-width: 1.8cm; }
.pr-line-md { min-width: 4.5cm; }
.pr-center { text-align: center; }
.pr-italic { font-style: italic; color: #333; }
.pr-note { font-size: 9pt; color: #333; }
.pr-mt-xs { margin-top: 1pt; }
.pr-mt-sm { margin-top: 3pt; }
.pr-sig-row {
  display: flex; align-items: baseline; flex-wrap: nowrap; gap: 0; white-space: nowrap;
}
.pr-sig-label { display: inline-block; }
.pr-sig-date {
  display: inline-flex; align-items: baseline; white-space: nowrap; margin-left: 8pt;
}
.pr-sig-name { margin-top: 1pt; text-align: center; font-size: 10pt; }
.pr-sig-title { margin-top: 1pt; text-align: center; font-size: 10pt; }

.pr-p1-logo { margin-bottom: 2pt; }
.pr-p1-logo img { height: 50pt; width: auto; display: block; }
.pr-p1-title { font-size: 14pt; margin: 2pt 0 3pt; }
.pr-p1-meta-row { text-align: right; font-size: 11pt; line-height: 1.25; }

.pr-p1-notify {
  border: 0.6pt solid #000;
  padding: 3pt 6pt;
  margin: 4pt 0 0;
  font-size: 10.5pt;
}
.pr-p1-notify-line { line-height: 1.5; }

.pr-p1-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}
.pr-p1-table th, .pr-p1-table td {
  border: 0.6pt solid #000;
  padding: 2pt 4pt;
  vertical-align: top;
  font-weight: normal;
}
.pr-p1-head-l, .pr-p1-head-r { padding: 3pt 6pt; }
.pr-p1-sub {
  font-size: 8.5pt; font-style: italic; color: #333; line-height: 1.1;
  margin-top: 2pt; text-align: center;
}
.pr-fill-row { display: flex; align-items: baseline; gap: 4pt; width: 100%; }
.pr-line-fill {
  flex: 1 1 auto;
  border-bottom: 0.4pt dotted #000;
  padding: 0 3pt; line-height: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pr-p1-body-l, .pr-p1-body-r {
  font-size: 10.5pt; line-height: 1.15; vertical-align: top;
  height: 1px;
}
.pr-cell { display: flex; flex-direction: column; height: 100%; }
.pr-cell-main > div { margin: 0.5pt 0; }
.pr-cell-sig { margin-top: auto; padding-top: 4pt; }
.pr-q { margin-top: 1.5pt !important; }
.pr-ind { padding-left: 0; }
.pr-ind2 { padding-left: 0.5cm; }
.pr-ind3 { padding-left: 1.0cm; font-size: 10pt; }

.pr-terms {
  margin-top: 4pt;
  border-top: 0.4pt dashed #777;
  padding-top: 3pt;
}
.pr-terms-title { font-size: 10.5pt; }
.pr-terms-list {
  margin: 3pt 0 4pt 0;
  font-size: 9.5pt;
  line-height: 1.2;
}
.pr-terms-item {
  display: flex;
  align-items: flex-start;
  gap: 4pt;
  margin-bottom: 5pt;
}
.pr-terms-num {
  flex: 0 0 auto;
  min-width: 14pt;
}
.pr-terms-ack {
  font-size: 10pt;
  margin-top: 4pt;
}

.pr-p1-inner, .pr-p2-inner {
  display: flex; flex-direction: column; flex: 1 1 auto; min-height: 100%;
}
.pr-p1-footer, .pr-p2-footer {
  padding-top: 4pt;
  text-align: left; font-size: 10pt;
}
.pr-p1-footer { margin-top: auto; }

.pr-p2-top {
  display: grid;
  grid-template-areas: "logo  .      right" "title title  right";
  grid-template-columns: auto 1fr auto;
  column-gap: 8pt; row-gap: 4pt; margin-bottom: 4pt; align-items: start;
}
.pr-p2-logo { grid-area: logo; height: 40pt; width: auto; display: block; }
.pr-p2-title { grid-area: title; font-size: 16pt; text-align: center; }
.pr-p2-top-r {
  grid-area: right; display: flex; flex-direction: column; align-items: stretch;
  gap: 2pt; font-size: 11pt; line-height: 1.2;
}
.pr-p2-sheet {
  display: flex; align-items: baseline; gap: 4pt; margin-left: auto; min-width: 7cm;
}
.pr-p2-infobox {
  border: 0.6pt solid #000; padding: 4pt 6pt;
  display: flex; flex-direction: column; gap: 2pt;
  margin-left: auto; min-width: 7cm; width: fit-content;
}

.pr-p2-info {
  width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10pt;
}
.pr-p2-info td {
  border: 0.6pt solid #000; padding: 3pt 5pt; vertical-align: top;
  font-size: 11pt; line-height: 1.25;
}
.pr-p2-info-l { width: 72%; }
.pr-p2-info-r { width: 28%; }

.pr-p2-items {
  width: 100%; border-collapse: collapse; table-layout: fixed;
  font-size: 9.5pt; margin-bottom: 12pt;
}
.pr-p2-items th, .pr-p2-items td {
  border: 0.5pt solid #000; padding: 2pt 3pt; vertical-align: top;
  word-break: break-word; overflow-wrap: anywhere; line-height: 1.2;
}
.pr-p2-items thead th { text-align: center; vertical-align: middle; font-weight: bold; font-size: 9.5pt; }
.pr-p2-items tbody td { text-align: center; vertical-align: middle; }
.pr-officer-head { background: #f1f1f1; }
.pr-p2-items tfoot .pr-officer-filler { border: none; background: transparent; }
.pr-p2-items tfoot .pr-officer-sum { font-weight: bold; }

.pr-p2-middle {
  margin-top: auto;
  margin-bottom: auto;
}
.pr-p2-sign {
  display: flex; justify-content: center; gap: 80pt;
}
.pr-p2-sign-col { flex: 0 1 auto; font-size: 11pt; min-width: 8cm; }

.pr-p2-warn { text-align: center; margin-top: 10pt; font-size: 11pt; }
`,Me={note:"บันทึก QC",approve:"อนุมัติ",reject:"ไม่ผ่าน",startTesting:"เริ่มตรวจ"},Qe={note:"gray-soft",approve:"green-soft",reject:"red-soft",startTesting:"blue-soft"};function $e({history:t}){return!t||t.length===0?null:e.jsx("div",{className:"space-y-3",children:t.map((i,r)=>e.jsxs("div",{className:"rounded-[10px] border border-black-50 bg-grey-50 p-3 space-y-1",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-0.5",children:[e.jsx(I,{variant:Qe[i.action],children:Me[i.action]}),e.jsxs("span",{className:"text-xs text-grey-500",children:["โดย ",i.reviewedBy," ·"," ",new Date(i.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),i.note&&e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:i.note})]},r))})}function Ue({petition:t}){const i=(t.reviewHistory??[]).find(s=>s.action==="note")??null,r=t.items.filter(s=>s.sampleId||s.condition);return e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-black-700 mb-2",children:"QC บันทึก"}),i?e.jsxs("div",{className:"rounded-[10px] border border-primary-200 bg-primary-50 p-4 space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-0.5",children:[e.jsx("span",{className:"text-sm font-semibold text-primary-600",children:"บันทึก QC"}),e.jsxs("span",{className:"text-xs text-grey-500",children:["โดย ",i.reviewedBy," ·"," ",new Date(i.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),i.note&&e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:i.note}),r.length>0&&e.jsx("div",{className:"space-y-1.5",children:r.map(s=>e.jsxs("p",{className:"text-xs text-grey-500",children:[e.jsxs("span",{className:"font-semibold text-black-500",children:[s.seq,". ",s.sampleName]}),s.sampleId&&e.jsxs("span",{children:[" · เลขตัวอย่าง: ",e.jsx("span",{className:"text-black-500",children:s.sampleId})]}),s.condition&&e.jsxs("span",{children:[" ","· สภาพ:"," ",e.jsx("span",{className:s.condition==="normal"?"text-green-500 font-medium":"text-red-500 font-medium",children:s.condition==="normal"?"ปกติ":"ไม่ปกติ"})]})]},s.seq))})]}):e.jsx("p",{className:"text-sm text-grey-500",children:"ยังไม่มีการบันทึก QC"})]})}function Ge({history:t}){return t.length===0?null:e.jsxs("div",{className:"border-t border-black-50 pt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-black-700 mb-3",children:"ผลการพิจารณา"}),e.jsx($e,{history:t})]})}function bs(){const{id:t}=ne(),i=ae(),r=le(),{data:s,loading:o,error:j,refresh:f}=Re(t),{user:p}=M(),{refetch:m}=oe(),{data:a}=Ce(s==null?void 0:s._id),[D,h]=x.useState(!1),[l,u]=x.useState(!1),R=x.useRef(!1),[w,c]=x.useState(!1),[v,y]=x.useState(!1),[b,P]=x.useState([]),[C,k]=x.useState(null);x.useEffect(()=>{if(!w||!(s!=null&&s._id))return;let S=!1;return(async()=>{try{const[E,B]=await Promise.all([H.getQCResults(s._id),H.getParameters()]);if(S)return;P(E??[]),k(Ae(B))}catch{}})(),()=>{S=!0}},[w,s==null?void 0:s._id]),x.useEffect(()=>{const S=r.state;S!=null&&S.autoPrint&&s&&!o&&!R.current&&(R.current=!0,i(r.pathname,{replace:!0,state:{}}),setTimeout(()=>y(!0),300))},[s,o]);async function T(){if(s){u(!0);try{await Pe(s._id,(p==null?void 0:p.name)||(p==null?void 0:p.email)),m(),i("/petitions",{replace:!0})}catch{u(!1),h(!1)}}}return e.jsx(ce,{className:"print:block print:min-h-0 print:bg-white",mainClassName:"p-4 sm:p-6 overflow-auto print:block print:w-full print:p-0 print:overflow-visible",children:o?e.jsx("p",{className:"text-grey-500",children:"กำลังโหลดข้อมูล..."}):j||!s?e.jsxs("div",{className:"rounded-[10px] border border-red-500 bg-red-50 p-4 text-sm text-red-500",children:["โหลดข้อมูลไม่สำเร็จ: ",j??"ไม่พบคำร้อง"]}):(()=>{var $,U;const S=we[s.status]??{label:s.status,variant:"gray-soft"},E=W(p).includes("admin"),B=(p==null?void 0:p.name)===(($=s.submittedBy)==null?void 0:$.name),se=s.status==="deliveringQC"&&B,te=E||s.status==="deliveringQC"&&B,Q=((a==null?void 0:a.length)??0)>0;return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"print:hidden space-y-6",children:[s.status==="rejected"&&(()=>{var G;const A=[...s.reviewHistory??[]].reverse().find(re=>re.action==="reject"),ie=!!(p!=null&&p.employeeId)&&!!((G=s.submittedBy)!=null&&G.employeeId)&&p.employeeId===s.submittedBy.employeeId;return e.jsxs("div",{className:"rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Y,{className:"h-5 w-5 text-orange-500"}),e.jsx("p",{className:"text-sm font-semibold text-orange-800",children:"คำร้องนี้ถูกส่งกลับให้แก้ไข"})]}),A&&e.jsxs(e.Fragment,{children:[e.jsxs("p",{className:"text-xs text-orange-700",children:["ผู้ตรวจสอบ: ",A.reviewedBy," · เมื่อ"," ",new Date(A.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]}),A.note&&e.jsx("p",{className:"text-sm text-black-700 whitespace-pre-wrap rounded border border-orange-200 bg-white px-3 py-2",children:A.note})]}),ie&&e.jsxs(z,{variant:"primary",size:"sm",onClick:()=>i(`/petitions/new?revisionOf=${s._id}`),className:"gap-2",children:[e.jsx(Y,{className:"h-4 w-4"}),"ยื่นแก้ไขใหม่"]})]})})(),e.jsx(pe,{onBack:()=>i("/petitions"),title:s.petitionNo,actions:e.jsxs(e.Fragment,{children:[e.jsxs(z,{variant:"primary-outline",size:"sm",onClick:()=>y(!0),children:[e.jsx(Te,{className:"h-4 w-4"}),"พิมพ์ฉลาก"]}),Q&&e.jsxs(z,{variant:"primary-outline",size:"sm",onClick:()=>c(!0),children:[e.jsx(me,{className:"h-4 w-4"}),"พิมพ์ใบคำขอรับบริการ"]}),se&&e.jsxs(z,{variant:"primary-outline",size:"sm",onClick:()=>i(`/petitions/${s._id}/edit`),children:[e.jsx(he,{className:"h-4 w-4"}),"แก้ไข"]}),te&&e.jsxs(z,{variant:"danger-outline",size:"sm",onClick:()=>h(!0),children:[e.jsx(de,{className:"h-4 w-4"}),"ลบคำร้อง"]})]})}),e.jsx(xe,{open:D,onOpenChange:A=>{!A&&!l&&h(!1)},children:e.jsxs(je,{children:[e.jsxs(ue,{children:[e.jsx(ge,{children:"ยืนยันการลบคำร้องนี้?"}),e.jsxs(fe,{children:['กำลังจะลบคำร้อง "',s.petitionNo,'" — การลบไม่สามารถย้อนกลับได้']})]}),e.jsxs(be,{children:[e.jsx(Ne,{disabled:l,children:"ยกเลิก"}),e.jsx(ve,{disabled:l,onClick:A=>{A.preventDefault(),T()},className:"bg-destructive hover:bg-destructive/90",children:l?"กำลังลบ...":"ยืนยัน"})]})]})}),e.jsxs("div",{className:"flex flex-wrap items-baseline gap-3",children:[e.jsx(I,{variant:S.variant,children:S.label}),e.jsx(I,{variant:"blue-soft",children:X[s.dept]}),e.jsxs("span",{className:"text-xs text-grey-500",children:["ยื่นเมื่อ"," ",new Date(s.createdAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),e.jsx(Be,{petitionId:s._id,status:s.status,onChanged:f}),e.jsx(ze,{petition:s}),(((U=s.reviewHistory)==null?void 0:U.length)??0)>0&&e.jsxs(L,{children:[e.jsx(q,{children:e.jsx(O,{children:"บันทึก QC / ผลการพิจารณา"})}),e.jsxs(F,{className:"space-y-4",children:[e.jsx(Ue,{petition:s}),e.jsx(Ge,{history:s.reviewHistory??[]})]})]})]}),Q&&e.jsx(V,{open:w,onOpenChange:c,docType:"service-request",children:e.jsx(He,{labRequest:a[0],petition:s,qcResults:b,sgParam:C})}),s&&e.jsx(V,{open:v,onOpenChange:y,docType:"sample-label",children:e.jsx(De,{petition:s})})]})})()})}export{bs as default};
