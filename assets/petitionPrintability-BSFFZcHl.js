import{j as e}from"./vendor-query-CD9KNe1W.js";import{F}from"./SampleLabelPrintTemplate-B-dImDrY.js";import{I as S}from"./branding-CtUiNaUF.js";import{i as O}from"./petition.types-X-nE6l3o.js";import{r as M}from"./formSpecificGravity-qIP9ybIB.js";import{A as C,m as y,o as L}from"./main-DvpsCCFE.js";function q(r){const i=(r??"").trim();if(!i)return"";const t=i.toLowerCase().replace(/\s+/g," "),s=t.match(/(?:ผลิต|prod(?:uction)?)\s*([1-5])/);return s?`TI P0${s[1]}`:t.includes("inter")?"TI INT":/วิจัย|r\s*&?\s*d|\brd\b/.test(t)?"TI RD":/\bqc\b|คิวซี/.test(t)?"TI QC":i}function w(r){if(!r)return"";const i=new Date(r);if(Number.isNaN(i.getTime()))return"";const t=String(i.getDate()).padStart(2,"0"),s=String(i.getMonth()+1).padStart(2,"0"),o=String((i.getFullYear()+543)%100).padStart(2,"0");return`${t}/${s}/${o}`}function I(r){if(!r)return{d:"",m:"",y:""};const i=new Date(r);return Number.isNaN(i.getTime())?{d:"",m:"",y:""}:{d:String(i.getDate()).padStart(2,"0"),m:String(i.getMonth()+1).padStart(2,"0"),y:String((i.getFullYear()+543)%100).padStart(2,"0")}}function n({checked:r}){return e.jsx("span",{className:`pr-cb${r?" pr-cb-x":""}`,"aria-hidden":!0})}function f({checked:r}){return e.jsx("span",{className:`pr-rd${r?" pr-rd-x":""}`,"aria-hidden":!0})}function c({value:r,width:i}){return e.jsx("span",{className:"pr-line",style:i?{minWidth:i}:void 0,children:r||" "})}function E(r){var i;return r.reportAddressType==="other"?r.reportAddressOther||"":((i=r.requester)==null?void 0:i.address)||""}function U(r){var i;return r.invoiceAddressType==="other"?r.invoiceAddressOther||"":((i=r.requester)==null?void 0:i.address)||""}function _(r){return r?Array.isArray(r)?r:[r]:[]}function W({lr:r,submissionNo:i}){var g,x,b,v,N,A,R,z,T,P,D;const t=r.serviceAgreement,s=r.labAgreementReview,o=I(r.createdAt),h=I(s==null?void 0:s.reviewedAt),l=r.requester,m=t==null?void 0:t.sampleDelivery,p=t==null?void 0:t.testMethod,d=t==null?void 0:t.testDuration,u=(t==null?void 0:t.testDurationDays)??"",j=p==="custom",a=p==="standard";return e.jsx("section",{className:"pr-page1",children:e.jsxs(F,{className:"pr-p1-inner",contentClassName:"pr-fit-col",children:[e.jsx("div",{className:"pr-p1-logo",children:e.jsx("img",{src:S,alt:"ICP Ladda"})}),e.jsx("div",{className:"pr-p1-title pr-center",children:e.jsx("b",{children:"เรื่อง: การทบทวนข้อตกลงการบริการทดสอบ"})}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"อ้างอิงใบขอรับบริการเลขที่"})," ",e.jsx("span",{className:"pr-line pr-line-md",children:i})]}),e.jsxs("div",{className:"pr-p1-meta-row",children:[e.jsx("b",{children:"รหัสลูกค้า"})," ",e.jsx("span",{className:"pr-line pr-line-sm",children:q(l==null?void 0:l.department)}),e.jsx("span",{children:" / "}),e.jsx("span",{className:"pr-line pr-line-xs",children:o.y})]}),e.jsxs("div",{className:"pr-p1-notify",children:[e.jsxs("div",{className:"pr-p1-notify-line",children:["ห้องปฏิบัติการได้รับแจ้งการทบทวนข้อตกลงการบริการทดสอบทางโทรศัพท์, อีเมล์  ",e.jsx(n,{})," ใช่  ",e.jsx(n,{})," ไม่ใช่"]}),e.jsxs("div",{className:"pr-p1-notify-line",children:["ลงชื่อ ",e.jsx(c,{width:"4cm"})," ผู้แจ้ง  ",e.jsx(c,{width:"4cm"})," ผู้รับแจ้ง"]})]}),e.jsxs("table",{className:"pr-p1-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsxs("th",{className:"pr-p1-head-l",children:[e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับลูกค้ากรอก"})}),e.jsx("div",{className:"pr-p1-sub",children:"(หากลูกค้าไม่สะดวกให้เจ้าหน้าห้องปฏิบัติการกรอกแทนโดยสอบถามข้อมูลและให้ลงนามทั้งผู้สอบถามและลูกค้า)"})]}),e.jsx("th",{className:"pr-p1-head-r",children:e.jsx("div",{className:"pr-center",children:e.jsx("b",{children:"สำหรับหัวหน้าห้องปฏิบัติการ"})})})]})}),e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsx("td",{className:"pr-p1-body-l",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. ตัวอย่างนำส่งห้องปฏิบัติการโดย"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:m==="self"})," 1.1 ลูกค้ามาเอง  ",e.jsx(n,{checked:m==="courier"})," 1.2 จัดส่งทางไปรษณีย์"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. วิธีทดสอบโปรดระบุ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:p==="standard"})," 2.1 วิธีปกติ ",e.jsx("span",{className:"pr-note",children:"(กรณีลูกค้าไม่ระบุวิธี)"})]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:p==="custom"})," 2.2 วิธีเฉพาะตามเอกสารของลูกค้า"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:p==="previous"})," เคยทำ  ",e.jsx(n,{checked:j&&p!=="previous"})," ไม่เคยทำ"]}),e.jsx("div",{className:"pr-ind2 pr-note",children:"(วิธีเทคนิค/เครื่องมือ/สารเคมี/ชนิดตัวอย่าง / Detection Limit)"}),(t==null?void 0:t.testMethodDetail)&&e.jsx("div",{className:"pr-ind pr-italic",children:t.testMethodDetail}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. ระยะเวลาดำเนินการทดสอบ"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:d==="normal"})," 3.1 ปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:d==="extended"})," 3.2 ช้ากว่าปกติได้ (ภายใน"," ",e.jsx(c,{width:"1.2cm",value:d==="extended"?String(u):""})," วัน)"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:d==="urgent"})," 3.3 เร็วกว่าปกติได้ (ภายใน"," ",e.jsx(c,{width:"1.2cm",value:d==="urgent"?String(u):""})," วัน)"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"4. ค่า Uncertainty"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:!!(t!=null&&t.requireUncertainty)})," ต้องการ  ",e.jsx(n,{checked:t?!t.requireUncertainty:!1})," ไม่ต้องการ   ค่า ",e.jsx(c,{width:"4cm",value:t==null?void 0:t.uncertaintyValue})]}),e.jsxs("div",{className:"pr-terms",children:[e.jsx("div",{className:"pr-terms-title",children:e.jsx("b",{children:"เงื่อนไขการให้บริการ"})}),e.jsxs("div",{className:"pr-terms-list",children:[e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"1."}),e.jsx("span",{children:"ห้องปฏิบัติการฯให้บริการทดสอบตัวอย่างด้วยวิธีการตามเอกสาร วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชของห้องปฏิบัติการฯ (FM-QP-07-01-002)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"2."}),e.jsx("span",{children:"การรายงานผลทดสอบจะไม่มีบริการด้านการให้ความเห็น และการแปรผลไม่ตัดสินผล"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"3."}),e.jsx("span",{children:"ปริมาณตัวอย่างขั้นต่ำที่นำส่ง 500 ml, 500 g"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"4."}),e.jsx("span",{children:"ระยะเวลาในการออกผลการทดสอบ ภายใน 3 วัน (กรณีหากมีข้อสงสัยในผลการวิเคราะห์ ขอขยายเวลาออกไปอีก 3 วัน)"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"5."}),e.jsx("span",{children:"ส่งตัวอย่างไม่เกิน 15.00 น. ของทุกวัน"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"6."}),e.jsx("span",{children:"ห้องปฏิบัติการฯรับผิดชอบผลการทดลองเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น"})]}),e.jsxs("div",{className:"pr-terms-item",children:[e.jsx("span",{className:"pr-terms-num",children:"7."}),e.jsx("span",{children:"ยินยอมให้เปิดเผยข้อมูลตัวอย่าง และผลทดสอบแก่หน่วยงานอื่น (กรณีลูกค้าภายในองค์กร)"})]})]}),e.jsx("div",{className:"pr-terms-ack",children:"ข้าพเจ้าได้รับทราบ และยอมรับเงื่อนไขการให้บริการของห้องปฏิบัติการ บริษัท ไอ ซี พี ลัดดา จำกัด ทุกประการ"})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(c,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(c,{width:"0.8cm",value:o.d}),"/",e.jsx(c,{width:"0.8cm",value:o.m}),"/",e.jsx(c,{width:"0.8cm",value:o.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(c,{width:"6.5cm",value:(l==null?void 0:l.fullName)??""})," )"]})]})]})}),e.jsx("td",{className:"pr-p1-body-r",children:e.jsxs("div",{className:"pr-cell",children:[e.jsxs("div",{className:"pr-cell-main",children:[e.jsx("div",{children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีทดสอบตามปกติ"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"1. บุคลากร"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.personnel)==="able"})," 1.1 ทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(g=s==null?void 0:s.personnelAbleReasons)==null?void 0:g.includes("trained")})," ได้รับการฝึกอบรมแล้ว"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(x=s==null?void 0:s.personnelAbleReasons)==null?void 0:x.includes("assigned")})," ได้รับการมอบหมายให้ทดลอง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.personnel)==="unable"})," 1.2 ไม่สามารถทำได้เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(b=s==null?void 0:s.personnelUnableReasons)==null?void 0:b.includes("neverDone")})," ยังไม่เคยทำการทดลอง"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(v=s==null?void 0:s.personnelUnableReasons)==null?void 0:v.includes("notTrained")})," ยังไม่ได้รับการฝึกอบรม"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(N=s==null?void 0:s.personnelUnableReasons)==null?void 0:N.includes("notAssigned")})," ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"2. ปริมาณงาน"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.workload)==="normal"})," 2.1 ยังมีความสามารถรับงานได้ตามปกติ"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.workload)==="slower"})," 2.2 สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.workload)==="cannot"})," 2.3 ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก"]}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"3. การใช้บริการผู้รับเหมาช่วงการทดสอบ (Sub contractor)"})}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.subcontractor)==="none"})," 3.1 ไม่ใช้ผู้รับเหมาช่วง"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:a&&(s==null?void 0:s.subcontractor)==="used"})," 3.2 การทดสอบนี้ใช้บริการทดสอบโดยผู้รับเหมาช่วง บริษัท/หน่วยงาน"," ",e.jsx(c,{width:"5cm",value:(s==null?void 0:s.subcontractor)==="used"?(s==null?void 0:s.subcontractorName)??"":""})]}),e.jsx("div",{className:"pr-ind3 pr-note",children:"(เนื่องจากห้องปฏิบัติการทดสอบไม่สามารถทดสอบได้ ซึ่งลูกค้ารับทราบ และยินยอมแล้ว)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:a&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:a&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:a&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.notAcceptableReason:" "})]}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:e.jsx("u",{children:"กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า"})})}),e.jsx("div",{className:"pr-q",children:e.jsx("b",{children:"พิจารณาแล้วว่า"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:["1. ",e.jsx(n,{checked:j&&(s==null?void 0:s.methodSuitable)===!0})," เหมาะสม  ",e.jsx(n,{checked:j&&(s==null?void 0:s.methodSuitable)===!1})," ไม่เหมาะสม เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:j&&(s==null?void 0:s.methodSuitable)===!1?s==null?void 0:s.methodSuitableReason:" "})]}),e.jsxs("div",{className:"pr-ind",children:["2. เครื่องมือทดสอบ (เครื่องมือ ",e.jsx(c,{width:"4cm",value:(s==null?void 0:s.equipmentName)??""})," )"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:(s==null?void 0:s.equipment)==="ready"})," 2.1 มีความพร้อม เนื่องจาก ",e.jsx(f,{checked:(A=s==null?void 0:s.equipmentReadyReasons)==null?void 0:A.includes("hasInstrument")})," มีเครื่องมือ ",e.jsx(f,{checked:(R=s==null?void 0:s.equipmentReadyReasons)==null?void 0:R.includes("calibrated")})," สอบเทียบแล้ว"]}),e.jsxs("div",{className:"pr-ind2",children:[e.jsx(n,{checked:(s==null?void 0:s.equipment)==="notReady"})," 2.2 ไม่มีความพร้อม เนื่องจาก"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(z=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:z.includes("noInstrument")})," ไม่มีเครื่องมือ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(T=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:T.includes("notCalibrated")})," ยังไม่มีการสอบเทียบ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(P=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:P.includes("outOfRange")})," เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ"]}),e.jsxs("div",{className:"pr-ind3",children:[e.jsx(f,{checked:(D=s==null?void 0:s.equipmentNotReadyReasons)==null?void 0:D.includes("broken")})," เครื่องมือเสีย"]}),e.jsx("div",{className:"pr-ind",children:"3. บุคลากร และปริมาณงาน ทบทวน ตามวิธีทดสอบของ ไอ ซี พี ลัดดา จำกัด (ข้อ 1 และ 2)"}),e.jsx("div",{className:"pr-mt-sm",children:e.jsx("b",{children:"สรุปความพร้อมของงานบริการ"})}),e.jsxs("div",{className:"pr-ind pr-fill-row",children:[e.jsxs("span",{children:[e.jsx(n,{checked:j&&(s==null?void 0:s.acceptable)===!0})," พร้อมรับงาน  ",e.jsx(n,{checked:j&&(s==null?void 0:s.acceptable)===!1})," ไม่พร้อมรับงาน เนื่องจาก"]}),e.jsx("span",{className:"pr-line-fill",children:j&&(s==null?void 0:s.acceptable)===!1?s==null?void 0:s.notAcceptableReason:" "})]})]}),e.jsxs("div",{className:"pr-cell-sig",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ลงชื่อ "}),e.jsx(c,{width:"4.5cm"}),e.jsxs("span",{className:"pr-sig-date",children:["วันเดือนปี"," ",e.jsx(c,{width:"0.8cm",value:h.d}),"/",e.jsx(c,{width:"0.8cm",value:h.m}),"/",e.jsx(c,{width:"0.8cm",value:h.y})]})]}),e.jsxs("div",{className:"pr-sig-name",children:["( ",e.jsx(c,{width:"6.5cm",value:(s==null?void 0:s.reviewedBy)??""})," )"]}),e.jsx("div",{className:"pr-sig-title",children:"หัวหน้าห้องปฏิบัติการเคมี"})]})]})})]})})]}),e.jsx("div",{className:"pr-p1-footer",children:"FM-QP-07-01-001 R02 (16/12/67) P1/1"})]})})}function G({lr:r,petition:i,items:t,qcResults:s,sgParam:o}){const h=i.receivedAt?new Date(i.receivedAt):null,l=h?`${String(h.getHours()).padStart(2,"0")}.${String(h.getMinutes()).padStart(2,"0")} น.`:"",m=new Set(r.testDelivery??[]),p=String((new Date(i.createdAt).getFullYear()+543)%100).padStart(2,"0"),d=r.requester,u=r.sampleReturn==="return",j=r.sampleReturn==="discard";return e.jsx("section",{className:"pr-page2",children:e.jsxs(F,{className:"pr-p2-inner",contentClassName:"pr-fit-col",children:[e.jsxs("div",{className:"pr-p2-top",children:[e.jsx("img",{src:S,alt:"ICP Ladda",className:"pr-p2-logo"}),e.jsx("div",{className:"pr-p2-title",children:e.jsx("b",{children:"ใบคำขอรับบริการ"})}),e.jsxs("div",{className:"pr-p2-top-r",children:[e.jsxs("div",{className:"pr-p2-sheet",children:[e.jsx("span",{children:"แผ่นที่"}),e.jsx("span",{className:"pr-line-fill pr-center",children:"1"}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"pr-line-fill pr-center",children:p})]}),e.jsxs("div",{className:"pr-p2-infobox",children:[e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เลขที่ขอรับบริการ :"}),e.jsx("span",{className:"pr-line-fill",children:r.labRequestNo})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"วันที่รับตัวอย่าง :"}),e.jsx("span",{className:"pr-line-fill",children:w(i.receivedAt)})]}),e.jsxs("div",{className:"pr-fill-row",children:[e.jsx("span",{children:"เวลา :"}),e.jsx("span",{className:"pr-line-fill",children:l})]})]})]})]}),e.jsx("table",{className:"pr-p2-info",children:e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsxs("td",{className:"pr-p2-info-l",children:[e.jsxs("div",{children:["ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล :"," ",e.jsx(c,{width:"14cm",value:r.reportCustomerName||(d==null?void 0:d.fullName)})]}),e.jsxs("div",{children:["ที่อยู่ที่ระบุในใบรายงานผล :"," ",e.jsx(c,{width:"16cm",value:E(r)})]}),e.jsxs("div",{children:["ที่อยู่ในการออกใบกำกับภาษี :"," ",e.jsx(c,{width:"16cm",value:U(r)})]}),e.jsxs("div",{children:["โทรศัพท์ : ",e.jsx(c,{width:"3.5cm",value:d==null?void 0:d.phone})," โทรสาร : ",e.jsx(c,{width:"3.5cm",value:d==null?void 0:d.fax})," E-mail : ",e.jsx(c,{width:"6cm",value:d==null?void 0:d.email})]}),e.jsxs("div",{children:["ชื่อ-สกุลผู้ติดต่อ :"," ",e.jsx(c,{width:"6cm",value:(d==null?void 0:d.contactName)||(d==null?void 0:d.fullName)})," ตำแหน่ง : ",e.jsx(c,{width:"5cm",value:d==null?void 0:d.position})]}),e.jsxs("div",{children:["ตัวอย่างหลังการทดสอบ :"," ",e.jsx(n,{checked:u})," ขอรับคืน ",e.jsx("span",{className:"pr-note",children:"(ภายใน 3 วันหลังจากได้รับผลทดสอบ)"}),"  ",e.jsx(n,{checked:j})," ไม่ขอรับคืน / No return"]}),e.jsxs("div",{children:["รายละเอียดการส่งผล : ",e.jsx(n,{checked:m.has("self")})," มารับเอง  ",e.jsx(n,{checked:m.has("mail")})," ส่งทางไปรษณีย์  ",e.jsx(n,{checked:m.has("email")})," E-Mail"]}),e.jsxs("div",{className:"pr-ind",children:[e.jsx(n,{checked:m.has("report")})," ใบรายงานผล  ",e.jsx(n,{checked:m.has("taxInvoice")})," ใบกำกับภาษี"]})]}),e.jsx("td",{className:"pr-p2-info-r",children:(()=>{const a=_(r.storageCondition),g=_(r.packageType);return e.jsxs(e.Fragment,{children:[e.jsx("div",{children:e.jsx("b",{children:"การเก็บรักษาตัวอย่าง"})}),e.jsxs("div",{children:[e.jsx(n,{checked:a.includes("room")})," อุณหภูมิห้อง ",e.jsx(n,{checked:a.includes("chilled")})," แช่เย็น"]}),e.jsx("div",{className:"pr-mt-xs",children:e.jsx("b",{children:"ภาชนะบรรจุ"})}),e.jsxs("div",{children:[e.jsx(n,{checked:g.includes("plasticBag")})," ถุงพลาสติก ",e.jsx(n,{checked:g.includes("glassBottle")})," ขวดแก้ว ",e.jsx(n,{checked:g.includes("plasticBottle")})," ขวดพลาสติก ",e.jsx(n,{checked:g.includes("can")})," กระป๋อง"]}),e.jsxs("div",{children:[e.jsx(n,{checked:g.includes("other")})," อื่นๆ ระบุ"," ",e.jsx(c,{width:"5cm",value:g.includes("other")?r.packageTypeOther:""})]})]})})()})]})})}),e.jsxs("table",{className:"pr-p2-items",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"3%"}}),e.jsx("col",{style:{width:"18%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"6.5%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"7.5%"}}),e.jsx("col",{style:{width:"4.5%"}}),e.jsx("col",{style:{width:"3.25%"}}),e.jsx("col",{style:{width:"3.25%"}}),e.jsx("col",{style:{width:"8.5%"}})]}),e.jsxs("thead",{children:[e.jsxs("tr",{children:[e.jsx("th",{rowSpan:3,children:"ลำดับ"}),e.jsx("th",{rowSpan:3,children:"ชื่อตัวอย่าง"}),e.jsx("th",{rowSpan:3,children:"เลขแบช"}),e.jsx("th",{rowSpan:3,children:"วันผลิต/ นำเข้า"}),e.jsx("th",{rowSpan:3,children:"เลขที่ใบนำส่งตัวอย่าง"}),e.jsx("th",{rowSpan:3,children:"ค่า ถ.พ."}),e.jsx("th",{rowSpan:3,children:"จำนวนหน่วยบรรจุ"}),e.jsx("th",{rowSpan:3,children:"หน่วยทดสอบ"}),e.jsx("th",{rowSpan:3,children:"รายการทดสอบ"}),e.jsx("th",{rowSpan:3,children:"หมายเหตุ"}),e.jsx("th",{colSpan:4,className:"pr-officer-head",children:"สำหรับเจ้าหน้าที่"})]}),e.jsxs("tr",{children:[e.jsxs("th",{rowSpan:2,children:["เลขที่",e.jsx("br",{}),"ตัวอย่าง"]}),e.jsx("th",{colSpan:2,children:"สภาพตัวอย่าง"}),e.jsx("th",{rowSpan:2,children:"ราคา"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"ปกติ"}),e.jsx("th",{children:"ไม่ปกติ"})]})]}),e.jsx("tbody",{children:t.length>0?t.map(a=>e.jsxs("tr",{children:[e.jsx("td",{className:"pr-center",children:a.seq}),e.jsx("td",{children:a.commonName||a.sampleName}),e.jsx("td",{children:a.batchNo}),e.jsx("td",{className:"pr-center",children:w(a.productionDate)}),e.jsx("td",{children:a.submissionNo??""}),e.jsx("td",{className:"pr-center",children:M(s,a.seq,o)}),e.jsx("td",{children:a.packageUnit??""}),e.jsx("td",{children:a.testUnit??""}),e.jsx("td",{children:a.testItems??""}),e.jsx("td",{children:a.note??""}),e.jsx("td",{children:a.sampleId??""}),e.jsx("td",{className:"pr-center",children:a.condition==="normal"?"✓":""}),e.jsx("td",{className:"pr-center",children:a.condition==="defective"?"✓":""}),e.jsx("td",{})]},a.seq)):e.jsx("tr",{children:e.jsx("td",{colSpan:14,className:"pr-center",children:"ไม่พบรายการตัวอย่างที่อ้างอิง"})})}),e.jsxs("tfoot",{children:[e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"ราคา"}),e.jsx("td",{})]}),e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"Vat 7 %"}),e.jsx("td",{})]}),e.jsxs("tr",{children:[e.jsx("td",{colSpan:11,className:"pr-officer-filler"}),e.jsx("td",{colSpan:2,className:"pr-center pr-officer-sum",children:"ราคารวม"}),e.jsx("td",{})]})]})]}),e.jsxs("div",{className:"pr-p2-middle",children:[e.jsxs("div",{className:"pr-p2-sign",children:[e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้ส่งตัวอย่าง "}),e.jsx(c,{width:"6cm",value:(d==null?void 0:d.fullName)??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(c,{width:"6cm",value:w(i.sampleSentAt)})]})]}),e.jsxs("div",{className:"pr-p2-sign-col",children:[e.jsxs("div",{className:"pr-sig-row",children:[e.jsx("span",{className:"pr-sig-label",children:"ผู้รับตัวอย่าง "}),e.jsx(c,{width:"6cm",value:i.receivedBy??""})]}),e.jsxs("div",{className:"pr-sig-row pr-mt-xs",children:[e.jsx("span",{className:"pr-sig-label",children:"วันที่ "}),e.jsx(c,{width:"6cm",value:w(i.receivedAt)})]})]})]}),e.jsx("div",{className:"pr-p2-warn",children:e.jsx("b",{children:"“หากสงสัยเกี่ยวกับผลการทดสอบ กรุณาติดต่อกลับภายใน 7 วัน หลังจากรับใบรายงานผลการทดสอบ”"})})]}),e.jsx("div",{className:"pr-p2-footer",children:"FM-QP-07-04-001-R01 (30/05/68) P1/1"})]})})}function ie({labRequest:r,petition:i,qcResults:t=[],sgParam:s=null}){var m,p;const o=i.items.filter(d=>O(d.batchNo)),h=o.length>0?o:i.items.filter(d=>d.seq===r.sampleSeq),l=((m=h[0])==null?void 0:m.submissionNo)??((p=i.items[0])==null?void 0:p.submissionNo)??"";return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:H}),e.jsxs("div",{className:"pr-root",children:[e.jsx(W,{lr:r,submissionNo:l}),e.jsx(G,{lr:r,petition:i,items:h,qcResults:t,sgParam:s})]})]})}const H=`
@page { size: A4 portrait; margin: 0; }
@page pageA4L { size: A4 landscape; margin: 0; }

.pr-root, .pr-root * {
  font-family: ${C};
  font-size: ${y};
  color: #000;
  box-sizing: border-box;
}
.pr-root { line-height: 1.12; }

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
/* FitToBox วัดความสูงจริงของคอลัมน์นี้ แล้ว scale ลงถ้าล้นกรอบหน้ากระดาษ */
.pr-fit-col { display: flex; flex-direction: column; }
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

.pr-root, .pr-root * {
  font-size: ${y} !important;
}
.pr-root h1,
.pr-root h2,
.pr-root h3,
.pr-root h4,
.pr-root h5,
.pr-root h6,
.pr-root th,
.pr-p1-title,
.pr-p2-title,
.pr-terms-title,
.pr-q b,
.pr-officer-sum,
.print-heading {
  font-weight: ${L} !important;
}
`;function k(r){const i=r?new Date(r):new Date;return Number.isNaN(i.getTime())?"":i.toLocaleDateString("th-TH",{day:"2-digit",month:"2-digit",year:"numeric"})}function B(r){if(r==null||r==="")return"-";if(Array.isArray(r))return r.map(B).join(", ");if(typeof r=="object"){const i=r;return typeof i.name=="string"?i.name:typeof i.url=="string"?i.url:JSON.stringify(r)}return String(r)}function Q(r){if(!r||typeof r!="object")return"-";const i=r;return[i.instrument?String(i.instrument):i.source?String(i.source):"",i.sampleName?String(i.sampleName):""].filter(Boolean).join(" / ")||"-"}function Y(r,i){return i.find(t=>t.sampleSeq===r.seq)??i.find(t=>t.batchNo===r.batchNo)??i[0]}function V(r,i){return i.filter(t=>t.itemSeq===r.seq).flatMap(t=>{var h;const s=(h=t.entries)!=null&&h.length?t.entries:[t.values??{}],o=t.valuesPhase2&&Object.keys(t.valuesPhase2).length?[t.valuesPhase2]:[];return[...s,...o].flatMap((l,m)=>Object.entries(l).filter(([p])=>!p.startsWith("__")&&!p.endsWith("__note")&&!p.endsWith("__source")&&!p.endsWith("__provenance")).map(([p,d])=>({key:`${t.parameterId}-${m}-${p}`,testItem:t.parameterName&&t.parameterName!==p?`${t.parameterName} - ${p}`:t.parameterName||p,value:B(d),refSource:Q(l[`${p}__source`])})))})}function te({kind:r,petition:i,labRequests:t=[],qcResults:s=[]}){var u,j,a,g;const o=r==="final",h=o?"FINAL REPORT":"PRE REPORT",l=t[0],m=`${o?"FR":"PR"}-${i.petitionNo}`,p=(l==null?void 0:l.reportCustomerName)||((u=l==null?void 0:l.requester)==null?void 0:u.fullName)||((j=i.submittedBy)==null?void 0:j.name)||"-",d=(l==null?void 0:l.reportAddressType)==="other"?l.reportAddressOther:(a=l==null?void 0:l.requester)==null?void 0:a.address;return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:J}),e.jsx("div",{className:"rr-root",children:e.jsxs("section",{className:"rr-page",children:[e.jsxs("header",{className:"rr-header",children:[e.jsx("img",{src:S,alt:"ICP Ladda"}),e.jsxs("div",{children:[e.jsx("h1",{children:"บริษัท ไอ ซี พี ลัดดา จำกัด"}),e.jsx("p",{children:"รายงานผลการทดสอบ / Certificate of Analysis"})]}),e.jsxs("div",{className:"rr-meta",children:[e.jsxs("div",{children:["เลขที่รายงาน: ",m]}),e.jsxs("div",{children:["วันที่รายงาน: ",k(o?i.approvedAt:void 0)]}),e.jsxs("div",{children:["เลขคำร้อง: ",i.petitionNo]})]})]}),e.jsx("h2",{children:h}),!o&&e.jsx("div",{className:"rr-watermark",children:"ใช้สำหรับตรวจสอบผลเบื้องต้น"}),e.jsx("table",{className:"rr-info",children:e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("th",{children:"ชื่อลูกค้า/หน่วยงาน"}),e.jsx("td",{children:p}),e.jsx("th",{children:"ผู้ยื่นคำร้อง"}),e.jsx("td",{children:((g=i.submittedBy)==null?void 0:g.name)||"-"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"ที่อยู่รายงานผล"}),e.jsx("td",{colSpan:3,children:d||"-"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"วันที่รับตัวอย่าง"}),e.jsx("td",{children:k(i.receivedAt||i.sampleSentAt||i.createdAt)}),e.jsx("th",{children:"สถานะรายงาน"}),e.jsx("td",{children:o?"Final":"Preliminary"})]})]})}),i.items.map(x=>{const b=Y(x,t),v=V(x,s);return e.jsxs("div",{className:"rr-sample",children:[e.jsx("table",{className:"rr-info",children:e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("th",{children:"ลำดับ"}),e.jsx("td",{children:x.seq}),e.jsx("th",{children:"เลขที่ตัวอย่าง"}),e.jsx("td",{children:x.sampleId||(b==null?void 0:b.labRequestNo)||"-"})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"ชื่อตัวอย่าง"}),e.jsx("td",{colSpan:3,children:x.commonName||x.sampleName})]}),e.jsxs("tr",{children:[e.jsx("th",{children:"Batch/Lot"}),e.jsx("td",{children:x.batchNo||x.lotNo||"-"}),e.jsx("th",{children:"วันที่ผลิต/นำเข้า"}),e.jsx("td",{children:k(x.productionDate)})]})]})}),e.jsxs("table",{className:"rr-results",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"รายการทดสอบ"}),e.jsx("th",{children:"ผลการทดสอบ"}),e.jsx("th",{children:"Ref. source"})]})}),e.jsx("tbody",{children:v.length?v.map(N=>e.jsxs("tr",{children:[e.jsx("td",{children:N.testItem}),e.jsx("td",{children:N.value}),e.jsx("td",{children:N.refSource})]},N.key)):e.jsx("tr",{children:e.jsx("td",{colSpan:3,className:"rr-empty",children:"ยังไม่พบผลทดสอบของตัวอย่างนี้"})})})]})]},x.seq)}),e.jsxs("footer",{className:"rr-footer",children:[e.jsxs("div",{children:[e.jsx("div",{className:"rr-line"}),e.jsx("p",{children:"ผู้ทดสอบ / Analyst"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"rr-line"}),e.jsx("p",{children:o?"ผู้อนุมัติ / Authorized by":"ผู้ตรวจสอบ / Reviewed by"})]})]}),e.jsxs("p",{className:"rr-note",children:["หมายเหตุ: รายงานนี้แสดงผลเฉพาะตัวอย่างที่นำมาทดสอบเท่านั้น",o?"":" และยังไม่ใช่รายงานผลฉบับสมบูรณ์"]})]})})]})}const J=`
@page { size: A4 portrait; margin: 0; }
.rr-root, .rr-root * { box-sizing: border-box; color: #000; font-family: ${C}; font-size: ${y}; }
.rr-page { width: 210mm; min-height: 297mm; padding: 12mm; background: #fff; }
.rr-header { display: grid; grid-template-columns: 26mm 1fr 55mm; gap: 8mm; align-items: start; border-bottom: 1.2pt solid #000; padding-bottom: 6mm; }
.rr-header img { width: 24mm; height: auto; }
.rr-header h1 { margin: 0 0 2mm; font-size: 16pt; }
.rr-header p, .rr-note, .rr-footer p { margin: 0; }
.rr-meta { font-size: 9.5pt; line-height: 1.45; }
h2 { text-align: center; margin: 6mm 0 3mm; font-size: 18pt; letter-spacing: 0; }
.rr-watermark { text-align: center; border: 1pt solid #777; padding: 2mm; margin-bottom: 4mm; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 0.7pt solid #000; padding: 2.2mm; vertical-align: top; word-break: break-word; }
th { width: 25%; background: #f3f3f3; text-align: left; }
.rr-info { margin-bottom: 4mm; }
.rr-sample { margin-top: 5mm; break-inside: avoid; page-break-inside: avoid; }
.rr-results th { text-align: center; }
.rr-results td:nth-child(3) { font-weight: 600; }
.rr-empty { text-align: center; color: #555; font-weight: 400 !important; }
.rr-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 18mm; margin-top: 16mm; text-align: center; }
.rr-line { border-bottom: 0.8pt dotted #000; height: 12mm; }
.rr-note { margin-top: 8mm; font-size: 9.5pt; }
@media screen { .rr-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
.rr-root, .rr-root * { font-size: ${y} !important; }
.rr-root h1,
.rr-root h2,
.rr-root h3,
.rr-root h4,
.rr-root h5,
.rr-root h6,
.rr-root th,
.rr-watermark,
.print-heading {
  font-weight: ${L} !important;
}
`,$=r=>!!(r!=null&&r.trim());function ne(r){return!$(r.qcReceivedBy)&&!$(r.labReceivedBy)}function de(r){return r.status!=="approved"}function ae(r){return!!(r.labCompletedAt||r.labApprovedAt)}export{ie as P,te as R,ne as a,ae as b,de as c};
