import{j as e}from"./vendor-query-CHuXHqWO.js";import{r as f,j as se,h as te,u as ie}from"./vendor-react-BrcJiHE1.js";import{A as re}from"./AppLayout-CV-ssW1z.js";import{P as ae}from"./PageHeader-DMrnE_-D.js";import{d as H,n as W,b as $,u as ne,B as P,W as le,w as de,A as ce,x as pe,y as oe,z as me,D as he,E as xe,H as je,J as ge}from"./main-BjwS7OOu.js";import{B as A}from"./badge-B3qgSfCh.js";import{C as B,a as L,b as O,c as _}from"./card-C57_L6PL.js";import{a as Y,i as J,P as ue}from"./petition.types-CQphHsuN.js";import{m as fe}from"./petitionTestItems-aeDl6GqR.js";import{u as ve}from"./useItemGroupMembership-CjPhov0i.js";import{I as K}from"./branding-C5idXEhi.js";import{P as Q,S as Ne}from"./PrintPreviewDialog-C7Cj0cph.js";import{a as be,e as we,f as ye}from"./usePetition-gx5RlI7t.js";import{R as U}from"./rotate-ccw-Bg02H1x3.js";import{P as ke}from"./printer-BzYXajXL.js";import{T as Se}from"./trash-2-DXJe1vib.js";import"./index-DzI8krqU.js";import"./user-V-qkimMB.js";import"./vendor-msal-VPL71qaw.js";import"./vendor-charts-Cd8K-1ef.js";import"./productClassification-ClRcNgCK.js";import"./vendor-qr-lFkqUVHP.js";import"./dialog-CnfXfuFZ.js";import"./label-DkV6xbt_.js";import"./printConfig-CO9fxii_.js";import"./minus-Dvme_kvj.js";import"./plus-DG9CeTro.js";function Ae(t){return t==null||t===""?"-":typeof t=="boolean"?t?"✓":"✗":typeof t=="object"?JSON.stringify(t):String(t)}function j({label:t,value:i}){const r=i==null||i===""?"-":i;return e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-grey-500 mb-0.5",children:t}),e.jsx("div",{className:"text-sm text-black-500",children:r})]})}function De({petition:t}){var o,x,D,C,I;const{user:i}=H(),r=W(i),s=r.length>0&&r.some(l=>l!=="viewer"),[m,p]=f.useState([]),h=ve(),a=l=>h.get(String((l==null?void 0:l.sampleId)??"").trim())??[],[u,g]=f.useState([]);f.useEffect(()=>{s&&$.getParameters().then(p).catch(()=>{})},[s]),f.useEffect(()=>{!s||!t._id||$.getQCResults(t._id).then(g).catch(()=>{})},[s,t._id]);const c=f.useMemo(()=>{const l=new Map;for(const y of u)l.set(`${y.itemSeq}__${y.parameterId}`,y);return l},[u]);return e.jsxs("div",{className:"space-y-4",children:[e.jsxs(B,{children:[e.jsx(L,{children:e.jsx(O,{className:"text-xl",children:"ข้อมูลคำขอ"})}),e.jsxs(_,{className:"grid gap-4 md:grid-cols-2",children:[e.jsx(j,{label:"ผู้ยื่นคำขอ",value:(o=t.submittedBy)==null?void 0:o.name}),e.jsx(j,{label:"แผนกผู้ยื่น",value:(x=t.submittedBy)==null?void 0:x.department}),e.jsx(j,{label:"วัน-เวลาที่ส่งคำร้อง",value:(D=t.submittedBy)!=null&&D.submittedAt?new Date(t.submittedBy.submittedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-"}),e.jsx(j,{label:"แผนก",value:e.jsx(A,{variant:"blue-soft",children:Y[t.dept]})}),e.jsx(j,{label:"เลขที่คำร้อง",value:t.petitionNo}),e.jsx(j,{label:"ผู้นำส่ง",value:((C=t.deliveredBy)==null?void 0:C.name)??((I=t.submittedBy)==null?void 0:I.name)}),e.jsx(j,{label:"วันที่นำส่ง",value:t.sampleSentAt?new Date(t.sampleSentAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-"})]})]}),e.jsxs(B,{children:[e.jsx(L,{children:e.jsxs(O,{children:["รายการตัวอย่าง (",t.items.length,")"]})}),e.jsx(_,{className:"space-y-3",children:t.items.map(l=>{const y=l.batchNo&&J(l.batchNo),S=s?fe(l,m,a(l)):[];return e.jsxs("div",{className:"rounded-[10px] border border-black-50 p-4 space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-baseline gap-2",children:[e.jsxs("p",{className:"text-sm font-semibold text-black-500",children:["ตัวอย่างที่ ",l.seq,": ",l.sampleName||"-"]}),l.sampleId&&e.jsxs("span",{className:"text-xs text-primary-500",children:["[",l.sampleId,"]"]}),y&&e.jsx(A,{variant:"blue-soft",children:"ส่ง lab"})]}),e.jsxs("div",{className:"grid gap-3 md:grid-cols-2",children:[e.jsx(j,{label:"Batch No.",value:l.batchNo}),e.jsx(j,{label:"Lot No.",value:l.lotNo}),e.jsx(j,{label:"วันที่ผลิต",value:l.productionDate}),e.jsx(j,{label:"ขนาดบรรจุ",value:l.packageUnit}),e.jsx(j,{label:"ชื่อสามัญ",value:l.commonName}),e.jsx(j,{label:"เลขที่ใบนำส่ง",value:l.submissionNo})]}),l.note&&e.jsx(j,{label:"หมายเหตุ",value:l.note}),s&&e.jsx(j,{label:"รายการทดลอง / ผลตรวจ",value:S.length>0?e.jsx("div",{className:"space-y-1.5",children:S.map(N=>{const b=N._id?c.get(`${l.seq}__${N._id}`):void 0,T=b?Object.entries(b.values??{}).filter(([k])=>!k.endsWith("__note")):[];return e.jsxs("div",{className:"rounded-[8px] border border-grey-200 px-3 py-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide ${(N.scope??"qc")==="lab"?"bg-sky-100 text-sky-800":"bg-indigo-100 text-indigo-800"}`,children:(N.scope??"qc")==="lab"?"Lab":"QC"}),e.jsx("span",{className:"text-sm font-medium text-black-500",children:N.name})]}),T.length===0&&e.jsx(A,{variant:"gray-soft",children:"ยังไม่บันทึก"})]}),T.length>0&&e.jsx("div",{className:"mt-1.5 grid gap-1 text-xs text-grey-700 md:grid-cols-2",children:T.map(([k,R])=>e.jsxs("div",{className:"flex gap-1.5",children:[e.jsxs("span",{className:"text-grey-500",children:[k,":"]}),e.jsx("span",{className:"text-black-500 font-medium",children:Ae(R)})]},k))})]},N._id??N.name)})}):void 0})]},l.seq)})})]}),t.cause&&e.jsxs(B,{children:[e.jsx(L,{children:e.jsx(O,{children:"สาเหตุการตรวจ / ข้อมูลเพิ่มเติม"})}),e.jsx(_,{children:e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:t.cause})})]})]})}const Ce=({petitionId:t,status:i,onChanged:r})=>(H(),f.useState(!1),f.useState(null),null);function Te(t){const i=(t??"").trim();if(!i)return"";const r=i.toLowerCase().replace(/\s+/g," "),s=r.match(/(?:ผลิต|prod(?:uction)?)\s*([1-5])/);return s?`TI P0${s[1]}`:r.includes("inter")?"TI INT":/วิจัย|r\s*&?\s*d|\brd\b/.test(r)?"TI RD":/\bqc\b|คิวซี/.test(r)?"TI QC":i}function z(t){if(!t)return"";const i=new Date(t);if(Number.isNaN(i.getTime()))return"";const r=String(i.getDate()).padStart(2,"0"),s=String(i.getMonth()+1).padStart(2,"0"),m=String((i.getFullYear()+543)%100).padStart(2,"0");return`${r}/${s}/${m}`}function G(t){if(!t)return{d:"",m:"",y:""};const i=new Date(t);return Number.isNaN(i.getTime())?{d:"",m:"",y:""}:{d:String(i.getDate()).padStart(2,"0"),m:String(i.getMonth()+1).padStart(2,"0"),y:String((i.getFullYear()+543)%100).padStart(2,"0")}}function n({checked:t}){return e.jsx("span",{className:`pr-cb${t?" pr-cb-x":""}`,"aria-hidden":!0})}function v({checked:t}){return e.jsx("span",{className:`pr-rd${t?" pr-rd-x":""}`,"aria-hidden":!0})}function d({value:t,width:i}){return e.jsx("span",{className:"pr-line",style:i?{minWidth:i}:void 0,children:t||" "})}function Pe(t){var i;return t.reportAddressType==="other"?t.reportAddressOther||"":((i=t.requester)==null?void 0:i.address)||""}function Ie(t){var i;return t.invoiceAddressType==="other"?t.invoiceAddressOther||"":((i=t.requester)==null?void 0:i.address)||""}function V(t){return t?Array.isArray(t)?t:[t]:[]}function ze(t,i){var s;const r=t.reviewHistory??[];for(let m=r.length-1;m>=0;m-=1){const p=(s=r[m].specificGravities)==null?void 0:s.find(h=>h.seq===i);if(p!=null&&p.value)return p.value}return""}function Be({lr:t,submissionNo:i}){const r=t.serviceAgreement,s=t.labAgreementReview,m=G(t.createdAt),p=G(s==null?void 0:s.reviewedAt),h=t.requester,a=r==null?void 0:r.sampleDelivery,u=r==null?void 0:r.testMethod,g=r==null?void 0:r.testDuration,c=(r==null?void 0:r.testDurationDays)??"",o=u==="custom",x=u==="standard";return e.jsx("section",{className:"pr-page1",children:e.jsxs("div",{className:"pr-p1-inner",children:[e.jsx("div",{className:"pr-p1-logo",children:e.jsx("img",{src:K,alt:"ICP Ladda"})}),e.jsx("div",{className:"pr-p1-title pr-center",children:e.jsx("b",{children:"เรื่อง: การทบทวนข้อตกลงการบริการทดสอบ"})}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"อ้างอิงใบขอรับบริการเลขที่"})," ",e.jsx("span",{className:"pr-line pr-line-md",children:i})]}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"รหัสลูกค้า"})," ",e.jsx("span",{className:"pr-line pr-line-sm",children:Te(h==null?void 0:h.department)}),e.jsx("span",{children:" / "}),e.jsx("span",{className:"pr-line pr-line-xs",children:m.y})]}),e.jsxs("div",{className:"pr-p1-notify",children:[e.jsxs("div",{className:"pr-p1-notify-line",children:["ห้องปฏิบัติการได้รับแจ้งการทบทวนข้อตกลงการบริการทดสอบทางโทรศัพท์, อีเมล์  ",e.jsx(n,{})," ใช่  ",e.jsx(n,{})," ไม่ใช่"]}),e.jsxs("div",{className:"pr-p1-notify-line",children:["ลงชื่อ ",e.jsx(d,{width:"4cm"})," ผู้แจ้ง  ",e.jsx(d,{width:"4cm"})," ผู้รับแจ้ง"]})]}),e.jsxs("table",{className:"pr-p1-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsxs("th",{className:"pr-p1-head-l",children:[e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับลูกค้ากรอก"})}),e.jsx("div",{className:"pr-p1-sub",children:"(หากลูกค้าไม่สะดวกให้เจ้าหน้าห้องปฏิบัติการกรอกแทนโดยสอบถามข้อมูลและให้ลงนามทั้งผู้สอบถามและลูกค้า)"})]}),e.jsx("th",{className:"pr-p1-head-r",children:e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับหัวหน้าห้องปฏิบัติการ"})})})]})}),e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsx("td",{className:"pr-p1-body-l",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. ตัวอย่างนำส่งห้องปฏิบัติการโดย"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a==="self"})," 1.1 ลูกค้ามาเอง  ",e.jsx(n,{checked:a==="courier"})," 1.2 จัดส่งทางไปรษณีย์"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. วิธีทดสอบโปรดระบุ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:u==="standard"})," 2.1 วิธีปกติ ",e.jsx("span",{className:"pr-note",children:"(กรณีลูกค้าไม่ระบุวิธี)"})]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:u==="custom"})," 2.2 วิธีเฉพาะตามเอกสารของลูกค้า"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:u==="previous"})," เคยทำ  ",e.jsx(n,{checked:o&&u!=="previous"})," ไม่เคยทำ"]}),e.jsx("div",{className:"pr-ind2 pr-note",children:"(วิธีเทคนิค/เครื่องมือ/สารเคมี/ชนิดตัวอย่าง / Detection Limit)"}),(r==null?void 0:r.testMethodDetail)&&e.jsx("div",{className:"pr-ind pr-italic",children:r.testMethodDetail}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. ระยะเวลาดำเนินการทดสอบ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:g==="normal"})," 3.1 ปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:g==="extended"})," 3.2 ช้ากว่าปกติได้ (ภายใน"," ",e.jsx(d,{width:"1.2cm",value:g==="extended"?String(c):""})," วัน)"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:g==="urgent"})," 3.3 เร็วกว่าปกติได้ (ภายใน"," ",e.jsx(d,{width:"1.2cm",value:g==="urgent"?String(c):""})," วัน)"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"4. ค่า Uncertainty"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:!!(r!=null&&r.requireUncertainty)})," ต้องการ  ",e.jsx(n,{checked:r?!r.requireUncertainty:!1})," ไม่ต้องการ"]}),e.jsxs("div",{className:"pr-terms",children:[e.jsx("div",{className:"pr-terms-title",children:e.jsx("b",{children:"เงื่อนไขการให้บริการ"})}),e.jsxs("div",{className:"pr-terms-list",children:[e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"1."}),e.jsx("span",{children:"ห้องปฏิบัติการฯให้บริการทดสอบตัวอย่างด้วยวิธีการตามเอกสาร วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชของห้องปฏิบัติการฯ (FM-QP-07-01-002)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"2."}),e.jsx("span",{children:"การรายงานผลทดสอบจะไม่มีบริการด้านการให้ความเห็น และการแปรผลไม่ตัดสินผล"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"3."}),e.jsx("span",{children:"ปริมาณตัวอย่างขั้นต่ำที่นำส่ง 500 ml, 500 g"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"4."}),e.jsx("span",{children:"ระยะเวลาในการออกผลการทดสอบ ภายใน 3 วัน (กรณีหากมีข้อสงสัยในผลการวิเคราะห์ ขอขยายเวลาออกไปอีก 3 วัน)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"5."}),e.jsx("span",{children:"ส่งตัวอย่างไม่เกิน 15.00 น. ของทุกวัน"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"6."}),e.jsx("span",{children:"ห้องปฏิบัติการฯรับผิดชอบผลการทดลองเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"7."}),e.jsx("span",{children:"ยินยอมให้เปิดเผยข้อมูลตัวอย่าง และผลทดสอบแก่หน่วยงานอื่น (กรณีลูกค้าภายในองค์กร)"})]})]}),e.jsx("div",{className:"pr-terms-ack",children:"ข้าพเจ้าได้รับทราบ และยอมรับเงื่อนไขการให้บริการของห้องปฏิบัติการ บริษัท ไอ ซี พี ลัดดา จำกัด ทุกประการ"})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(d,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(d,{width:"0.8cm",value:m.d}),"/",e.jsx(d,{width:"0.8cm",value:m.m}),"/",e.jsx(d,{width:"0.8cm",value:m.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(d,{width:"6.5cm",value:(h==null?void 0:h.fullName)??""})," )"]})]})]})}),e.jsx("td",{className:"pr-p1-body-r",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีทดสอบตามปกติ"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. บุคลากร"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:x&&(s==null?void 0:s.capabilityOk)===!0})," 1.1 ทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ได้รับการฝึกอบรมแล้ว"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ได้รับการมอบหมายให้ทดลอง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:x&&(s==null?void 0:s.capabilityOk)===!1})," 1.2 ไม่สามารถทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ยังไม่เคยทำการทดลอง"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ยังไม่ได้รับการฝึกอบรม"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. ปริมาณงาน"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:x&&(s==null?void 0:s.scheduleOk)===!0})," 2.1 ยังมีความสามารถรับงานได้ตามปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:x&&(s==null?void 0:s.scheduleOk)===!1})," 2.2 สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{})," 2.3 ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. การใช้บริการผู้รับเหมาช่วงการทดสอบ (Sub contractor)"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{})," 3.1 ไม่ใช้ผู้รับเหมาช่วง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{})," 3.2 การทดสอบนี้ใช้บริการทดสอบโดยผู้รับเหมาช่วง บริษัท/หน่วยงาน"," ",e.jsx(d,{width:"5cm"})]}),e.jsx("div",{className:"pr-ind3 pr-note",children:"(เนื่องจากห้องปฏิบัติการทดสอบไม่สามารถทดสอบได้ ซึ่งลูกค้ารับทราบ และยินยอมแล้ว)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:x&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:x&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:x&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.remark:" "})]}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"พิจารณาแล้วว่า"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:["1. ",e.jsx(n,{checked:o&&(s==null?void 0:s.methodOk)===!0})," เหมาะสม  ",e.jsx(n,{checked:o&&(s==null?void 0:s.methodOk)===!1})," ไม่เหมาะสม เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:o&&(s==null?void 0:s.methodOk)===!1?s==null?void 0:s.remark:" "})]}),e.jsxs("div",{className:"pr-ind",children:["2. เครื่องมือทดสอบ (เครื่องมือ ",e.jsx(d,{width:"4cm"})," )"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{})," 2.1 มีความพร้อม เนื่องจาก ",e.jsx(v,{})," มีเครื่องมือ ",e.jsx(v,{})," สอบเทียบแล้ว"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{})," 2.2 ไม่มีความพร้อม เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ไม่มีเครื่องมือ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," ยังไม่มีการสอบเทียบ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(v,{})," เครื่องมือเสีย"]}),e.jsx("div",{className:"pr-ind",children:"3. บุคลากร และปริมาณงาน ทบทวน ตามวิธีทดสอบของ ไอ ซี พี ลัดดา จำกัด (ข้อ 1 และ 2)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:o&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:o&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:o&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.remark:" "})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(d,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(d,{width:"0.8cm",value:p.d}),"/",e.jsx(d,{width:"0.8cm",value:p.m}),"/",e.jsx(d,{width:"0.8cm",value:p.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(d,{width:"6.5cm",value:(s==null?void 0:s.reviewedBy)??""})," )"]}),e.jsx("div",{className:"pr-sig-title",children:"หัวหน้าห้องปฏิบัติการเคมี"})]})]})})]})})]}),e.jsx("div",{className:"pr-p1-footer",children:"FM-QP-07-01-001 R02 (16/12/67) P1/1"})]})})}function Le({lr:t,petition:i,items:r}){const s=i.receivedAt?new Date(i.receivedAt):null,m=s?`${String(s.getHours()).padStart(2,"0")}.${String(s.getMinutes()).padStart(2,"0")} น.`:"",p=new Set(t.testDelivery??[]),h=String((new Date(i.createdAt).getFullYear()+543)%100).padStart(2,"0"),a=t.requester,u=t.sampleReturn==="return",g=t.sampleReturn==="discard";return e.jsx("section",{className:"pr-page2",children:e.jsxs("div",{className:"pr-p2-inner",children:[e.jsxs("div",{className:"pr-p2-top",children:[e.jsx("img",{src:K,alt:"ICP Ladda",className:"pr-p2-logo"}),e.jsx("div",{className:"pr-p2-title",children:e.jsx("b",{children:"ใบคำขอรับบริการ"})}),e.jsxs("div",{className:"pr-p2-top-r",children:[e.jsxs("div",{className:"pr-p2-sheet",children:[e.jsx("span",{children:"แผ่นที่"}),e.jsx("span",{className:"pr-line-fill pr-center",children:"1"}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"pr-line-fill pr-center",children:h})]}),e.jsxs("div",{className:"pr-p2-infobox",children:[e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เลขที่ขอรับบริการ :"}),e.jsx("span",{className:"pr-line-fill",children:t.labRequestNo})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"วันที่รับตัวอย่าง :"}),e.jsx("span",{className:"pr-line-fill",children:z(i.receivedAt)})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เวลา :"}),e.jsx("span",{className:"pr-line-fill",children:m})]})]})]})]}),e.jsx("table",{className:"pr-p2-info",children:e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsxs("td",{className:"pr-p2-info-l",children:[e.jsxs("div",{children:["ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล :"," ",e.jsx(d,{width:"14cm",value:t.reportCustomerName||(a==null?void 0:a.fullName)})]}),e.jsxs("div",{children:["ที่อยู่ที่ระบุในใบรายงานผล :"," ",e.jsx(d,{width:"16cm",value:Pe(t)})]}),e.jsxs("div",{children:["ที่อยู่ในการออกใบกำกับภาษี :"," ",e.jsx(d,{width:"16cm",value:Ie(t)})]}),e.jsxs("div",{children:["โทรศัพท์ : ",e.jsx(d,{width:"3.5cm",value:a==null?void 0:a.phone})," โทรสาร : ",e.jsx(d,{width:"3.5cm",value:a==null?void 0:a.fax})," E-mail : ",e.jsx(d,{width:"6cm",value:a==null?void 0:a.email})]}),e.jsxs("div",{children:["ชื่อ-สกุลผู้ติดต่อ :"," ",e.jsx(d,{width:"6cm",value:(a==null?void 0:a.contactName)||(a==null?void 0:a.fullName)})," ตำแหน่ง : ",e.jsx(d,{width:"5cm",value:a==null?void 0:a.position})]}),e.jsxs("div",{children:["ตัวอย่างหลังการทดสอบ :"," ",e.jsx(n,{checked:u})," ขอรับคืน ",e.jsx("span",{className:"pr-note",children:"(ภายใน 3 วันหลังจากได้รับผลทดสอบ)"}),"  ",e.jsx(n,{checked:g})," ไม่ขอรับคืน / No return"]}),e.jsxs("div",{children:["รายละเอียดการส่งผล : ",e.jsx(n,{checked:p.has("self")})," มารับเอง  ",e.jsx(n,{checked:p.has("mail")})," ส่งทางไปรษณีย์  ",e.jsx(n,{checked:p.has("email")})," E-Mail"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:p.has("report")})," ใบรายงานผล  ",e.jsx(n,{checked:p.has("taxInvoice")})," ใบกำกับภาษี"]})]}),e.jsx("td",{className:"pr-p2-info-r",children:(()=>{const c=V(t.storageCondition),o=V(t.packageType);return e.jsxs(e.Fragment,{children:[e.jsx("div",{children:e.jsx("b",{children:"การเก็บรักษาตัวอย่าง"})}),e.jsxs("div",{children:[e.jsx(n,{checked:c.includes("room")})," อุณหภูมิห้อง ",e.jsx(n,{checked:c.includes("chilled")})," แช่เย็น"]}),e.jsx("div",{className:"pr-mt-xs",children:e.jsx("b",{children:"ภาชนะบรรจุ"})}),e.jsxs("div",{children:[e.jsx(n,{checked:o.includes("plasticBag")})," ถุงพลาสติก ",e.jsx(n,{checked:o.includes("glassBottle")})," ขวดแก้ว ",e.jsx(n,{checked:o.includes("plasticBottle")})," ขวดพลาสติก ",e.jsx(n,{checked:o.includes("can")})," กระป๋อง"]}),e.jsxs("div",{children:[e.jsx(n,{checked:o.includes("other")})," อื่นๆ ระบุ"," ",e.jsx(d,{width:"5cm",value:o.includes("other")?t.packageTypeOther:""})]})]})})()})]})})}),e.jsxs("table",{className:"pr-p2-items",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"3%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"9%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"4.5%"}}),e.jsx("col",{style:{width:"4.5%"}}),e.jsx("col",{style:{width:"5.5%"}})]}),e.jsxs("thead",{children:[e.jsxs("tr",{children:[e.jsx("th",{rowSpan:2,children:"ลำดับ"}),e.jsx("th",{rowSpan:2,children:"ชื่อตัวอย่าง"}),e.jsx("th",{rowSpan:2,children:"เลขแบช"}),e.jsx("th",{rowSpan:2,children:"วันผลิต/ นำเข้า"}),e.jsx("th",{rowSpan:2,children:"เลขที่ใบนำส่งตัวอย่าง"}),e.jsx("th",{rowSpan:2,children:"ค่า ถ.พ."}),e.jsx("th",{rowSpan:2,children:"จำนวนหน่วยบรรจุ"}),e.jsx("th",{rowSpan:2,children:"หน่วยทดสอบ"}),e.jsx("th",{rowSpan:2,children:"รายการทดสอบ"}),e.jsx("th",{rowSpan:2,children:"หมายเหตุ"}),e.jsx("th",{colSpan:5,className:"pr-officer-head",children:"สำหรับเจ้าหน้าที่"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"เลขที่ตัวอย่าง"}),e.jsx("th",{children:"สภาพตัวอย่าง"}),e.jsx("th",{children:"ราคา"}),e.jsx("th",{children:"Vat 7%"}),e.jsx("th",{children:"ราคารวม"})]})]}),e.jsx("tbody",{children:r.length>0?r.map(c=>e.jsxs("tr",{children:[e.jsx("td",{className:"pr-center",children:c.seq}),e.jsx("td",{children:c.commonName||c.sampleName}),e.jsx("td",{children:c.batchNo}),e.jsx("td",{className:"pr-center",children:z(c.productionDate)}),e.jsx("td",{children:c.submissionNo??""}),e.jsx("td",{className:"pr-center",children:ze(i,c.seq)}),e.jsx("td",{children:c.packageUnit??""}),e.jsx("td",{children:c.testUnit??""}),e.jsx("td",{children:c.testItems??""}),e.jsx("td",{children:c.note??""}),e.jsx("td",{children:c.sampleId??""}),e.jsx("td",{className:"pr-center",children:c.condition==="normal"?"ปกติ":c.condition==="defective"?"ไม่ปกติ":""}),e.jsx("td",{}),e.jsx("td",{}),e.jsx("td",{})]},c.seq)):e.jsx("tr",{children:e.jsx("td",{colSpan:15,className:"pr-center",children:"ไม่พบรายการตัวอย่างที่อ้างอิง"})})})]}),e.jsxs("div",{className:"pr-p2-middle",children:[e.jsxs("div",{className:"pr-p2-sign",children:[e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้ส่งตัวอย่าง "}),e.jsx(d,{width:"6cm",value:(a==null?void 0:a.fullName)??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(d,{width:"6cm",value:z(i.sampleSentAt)})]})]}),e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้รับตัวอย่าง "}),e.jsx(d,{width:"6cm",value:i.receivedBy??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(d,{width:"6cm",value:z(i.receivedAt)})]})]})]}),e.jsx("div",{className:"pr-p2-warn",children:e.jsx("b",{children:"“หากสงสัยเกี่ยวกับผลการทดสอบ กรุณาติดต่อกลับภายใน 7 วัน หลังจากรับใบรายงานผลการทดสอบ”"})})]}),e.jsx("div",{className:"pr-p2-footer",children:"FM-QP-07-04-001-R01 (30/05/68) P1/1"})]})})}function Oe({labRequest:t,petition:i}){var p,h;const r=i.items.filter(a=>J(a.batchNo)),s=r.length>0?r:i.items.filter(a=>a.seq===t.sampleSeq),m=((p=s[0])==null?void 0:p.submissionNo)??((h=i.items[0])==null?void 0:h.submissionNo)??"";return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:_e}),e.jsxs("div",{className:"pr-root",children:[e.jsx(Be,{lr:t,submissionNo:m}),e.jsx(Le,{lr:t,petition:i,items:s})]})]})}const _e=`
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
.pr-p2-items thead th { text-align: center; font-weight: bold; font-size: 9.5pt; }
.pr-officer-head { background: #f1f1f1; }

.pr-p2-middle {
  margin-top: auto;
  margin-bottom: auto;
}
.pr-p2-sign {
  display: flex; justify-content: center; gap: 80pt;
}
.pr-p2-sign-col { flex: 0 1 auto; font-size: 11pt; min-width: 8cm; }

.pr-p2-warn { text-align: center; margin-top: 10pt; font-size: 11pt; }
`,Re={note:"บันทึก QC",approve:"อนุมัติ",reject:"ไม่ผ่าน",startTesting:"เริ่มตรวจ"},He={note:"gray-soft",approve:"green-soft",reject:"red-soft",startTesting:"blue-soft"};function qe({history:t}){return!t||t.length===0?null:e.jsx("div",{className:"space-y-3",children:t.map((i,r)=>e.jsxs("div",{className:"rounded-[10px] border border-black-50 bg-grey-50 p-3 space-y-1",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-0.5",children:[e.jsx(A,{variant:He[i.action],children:Re[i.action]}),e.jsxs("span",{className:"text-xs text-grey-500",children:["โดย ",i.reviewedBy," ·"," ",new Date(i.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),i.note&&e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:i.note})]},r))})}function Fe({petition:t}){const i=(t.reviewHistory??[]).find(s=>s.action==="note")??null,r=t.items.filter(s=>s.sampleId||s.condition);return e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-black-700 mb-2",children:"QC บันทึก"}),i?e.jsxs("div",{className:"rounded-[10px] border border-primary-200 bg-primary-50 p-4 space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-0.5",children:[e.jsx("span",{className:"text-sm font-semibold text-primary-600",children:"บันทึก QC"}),e.jsxs("span",{className:"text-xs text-grey-500",children:["โดย ",i.reviewedBy," ·"," ",new Date(i.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),i.note&&e.jsx("p",{className:"text-sm text-black-500 whitespace-pre-wrap",children:i.note}),r.length>0&&e.jsx("div",{className:"space-y-1.5",children:r.map(s=>e.jsxs("p",{className:"text-xs text-grey-500",children:[e.jsxs("span",{className:"font-semibold text-black-500",children:[s.seq,". ",s.sampleName]}),s.sampleId&&e.jsxs("span",{children:[" · เลขตัวอย่าง: ",e.jsx("span",{className:"text-black-500",children:s.sampleId})]}),s.condition&&e.jsxs("span",{children:[" ","· สภาพ:"," ",e.jsx("span",{className:s.condition==="normal"?"text-green-500 font-medium":"text-red-500 font-medium",children:s.condition==="normal"?"ปกติ":"ไม่ปกติ"})]})]},s.seq))})]}):e.jsx("p",{className:"text-sm text-grey-500",children:"ยังไม่มีการบันทึก QC"})]})}function Me({history:t}){return t.length===0?null:e.jsxs("div",{className:"border-t border-black-50 pt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-black-700 mb-3",children:"ผลการพิจารณา"}),e.jsx(qe,{history:t})]})}function js(){const{id:t}=se(),i=te(),r=ie(),{data:s,loading:m,error:p,refresh:h}=be(t),{user:a}=H(),{refetch:u}=ne(),{data:g}=we(s==null?void 0:s._id),[c,o]=f.useState(!1),[x,D]=f.useState(!1),C=f.useRef(!1),[I,l]=f.useState(!1),[y,S]=f.useState(!1);f.useEffect(()=>{const b=r.state;b!=null&&b.autoPrint&&s&&!m&&!C.current&&(C.current=!0,i(r.pathname,{replace:!0,state:{}}),setTimeout(()=>S(!0),300))},[s,m]);async function N(){if(s){D(!0);try{await ye(s._id,(a==null?void 0:a.name)||(a==null?void 0:a.email)),u(),i("/petitions",{replace:!0})}catch{D(!1),o(!1)}}}return e.jsx(re,{className:"print:block print:min-h-0 print:bg-white",mainClassName:"p-4 sm:p-6 overflow-auto print:block print:w-full print:p-0 print:overflow-visible",children:m?e.jsx("p",{className:"text-grey-500",children:"กำลังโหลดข้อมูล..."}):p||!s?e.jsxs("div",{className:"rounded-[10px] border border-red-500 bg-red-50 p-4 text-sm text-red-500",children:["โหลดข้อมูลไม่สำเร็จ: ",p??"ไม่พบคำร้อง"]}):(()=>{var F,M;const b=ue[s.status]??{label:s.status,variant:"gray-soft"},T=W(a).includes("admin"),k=(a==null?void 0:a.name)===((F=s.submittedBy)==null?void 0:F.name),R=s.status==="deliveringQC"&&k,X=T||s.status==="deliveringQC"&&k,q=((g==null?void 0:g.length)??0)>0;return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"print:hidden space-y-6",children:[s.status==="rejected"&&(()=>{var E;const w=[...s.reviewHistory??[]].reverse().find(ee=>ee.action==="reject"),Z=!!(a!=null&&a.employeeId)&&!!((E=s.submittedBy)!=null&&E.employeeId)&&a.employeeId===s.submittedBy.employeeId;return e.jsxs("div",{className:"rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(U,{className:"h-5 w-5 text-orange-500"}),e.jsx("p",{className:"text-sm font-semibold text-orange-800",children:"คำร้องนี้ถูกส่งกลับให้แก้ไข"})]}),w&&e.jsxs(e.Fragment,{children:[e.jsxs("p",{className:"text-xs text-orange-700",children:["ผู้ตรวจสอบ: ",w.reviewedBy," · เมื่อ"," ",new Date(w.reviewedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]}),w.note&&e.jsx("p",{className:"text-sm text-black-700 whitespace-pre-wrap rounded border border-orange-200 bg-white px-3 py-2",children:w.note})]}),Z&&e.jsxs(P,{variant:"primary",size:"sm",onClick:()=>i(`/petitions/new?revisionOf=${s._id}`),className:"gap-2",children:[e.jsx(U,{className:"h-4 w-4"}),"ยื่นแก้ไขใหม่"]})]})})(),e.jsx(ae,{onBack:()=>i("/petitions"),title:s.petitionNo,actions:e.jsxs(e.Fragment,{children:[e.jsxs(P,{variant:"primary-outline",size:"sm",onClick:()=>S(!0),children:[e.jsx(ke,{className:"h-4 w-4"}),"พิมพ์ฉลาก"]}),q&&e.jsxs(P,{variant:"primary-outline",size:"sm",onClick:()=>l(!0),children:[e.jsx(le,{className:"h-4 w-4"}),"พิมพ์ใบคำขอรับบริการ"]}),R&&e.jsxs(P,{variant:"primary-outline",size:"sm",onClick:()=>i(`/petitions/${s._id}/edit`),children:[e.jsx(de,{className:"h-4 w-4"}),"แก้ไข"]}),X&&e.jsxs(P,{variant:"danger-outline",size:"sm",onClick:()=>o(!0),children:[e.jsx(Se,{className:"h-4 w-4"}),"ลบคำร้อง"]})]})}),e.jsx(ce,{open:c,onOpenChange:w=>{!w&&!x&&o(!1)},children:e.jsxs(pe,{children:[e.jsxs(oe,{children:[e.jsx(me,{children:"ยืนยันการลบคำร้องนี้?"}),e.jsxs(he,{children:['กำลังจะลบคำร้อง "',s.petitionNo,'" — การลบไม่สามารถย้อนกลับได้']})]}),e.jsxs(xe,{children:[e.jsx(je,{disabled:x,children:"ยกเลิก"}),e.jsx(ge,{disabled:x,onClick:w=>{w.preventDefault(),N()},className:"bg-destructive hover:bg-destructive/90",children:x?"กำลังลบ...":"ยืนยัน"})]})]})}),e.jsxs("div",{className:"flex flex-wrap items-baseline gap-3",children:[e.jsx(A,{variant:b.variant,children:b.label}),e.jsx(A,{variant:"blue-soft",children:Y[s.dept]}),e.jsxs("span",{className:"text-xs text-grey-500",children:["ยื่นเมื่อ"," ",new Date(s.createdAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})]})]}),e.jsx(Ce,{petitionId:s._id,status:s.status,onChanged:h}),e.jsx(De,{petition:s}),(((M=s.reviewHistory)==null?void 0:M.length)??0)>0&&e.jsxs(B,{children:[e.jsx(L,{children:e.jsx(O,{children:"บันทึก QC / ผลการพิจารณา"})}),e.jsxs(_,{className:"space-y-4",children:[e.jsx(Fe,{petition:s}),e.jsx(Me,{history:s.reviewHistory??[]})]})]})]}),q&&e.jsx(Q,{open:I,onOpenChange:l,docType:"service-request",children:e.jsx(Oe,{labRequest:g[0],petition:s})}),s&&e.jsx(Q,{open:y,onOpenChange:S,docType:"sample-label",children:e.jsx(Ne,{petition:s})})]})})()})}export{js as default};
