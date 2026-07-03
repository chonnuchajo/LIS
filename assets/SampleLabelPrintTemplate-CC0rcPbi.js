import{j as e}from"./vendor-query-CHuXHqWO.js";import{b as m}from"./vendor-qr-BPmJ3lcd.js";function o(l){if(!l)return"";const a=new Date(l);if(Number.isNaN(a.getTime()))return"";const r=String(a.getDate()).padStart(2,"0"),t=String(a.getMonth()+1).padStart(2,"0"),i=String((a.getFullYear()+543)%100).padStart(2,"0");return`${r}/${t}/${i}`}function b(){return String((new Date().getFullYear()+543)%100).padStart(2,"0")}function h(l,a){return JSON.stringify({id:l._id,petitionNo:l.petitionNo,sampleId:a.sampleId||"",itemSeq:a.seq})}function x({value:l}){const a=m.create(l,{errorCorrectionLevel:"M"}),r=a.modules.size,t=Array.from(a.modules.data);return e.jsxs("svg",{viewBox:`0 0 ${r} ${r}`,className:"h-[24mm] w-[24mm] shrink-0",role:"img","aria-label":`QR ${l}`,shapeRendering:"crispEdges",children:[e.jsx("rect",{width:r,height:r,fill:"#fff"}),t.map((i,n)=>{if(!i)return null;const d=n%r,c=Math.floor(n/r);return e.jsx("rect",{x:d,y:c,width:"1",height:"1",fill:"#000"},n)})]})}function s({label:l,value:a,className:r="",valueClassName:t="",multiline:i=!1}){const n=i?"min-h-[3.5mm] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold":"min-h-[3.5mm] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-0.5 font-bold";return e.jsxs("div",{className:`flex min-w-0 items-end gap-1 ${r}`,children:[e.jsx("span",{className:"whitespace-nowrap",children:l}),e.jsx("span",{className:`${n} ${t}`,children:a||""})]})}function p({label:l,value:a}){return e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"whitespace-nowrap",children:l}),e.jsx("div",{className:"min-h-[3.5mm] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold leading-tight",children:a||""})]})}function g({petition:l,item:a,yearShort:r}){var d;const t=[a.sampleName,a.commonName].filter(Boolean).join(" "),i=((d=l.submittedBy)==null?void 0:d.name)||a.labelSampledBy||"",n=h(l,a);return e.jsxs("div",{className:"label-card overflow-hidden border border-black text-[9.5px] font-semibold leading-[1.15]",style:{width:"100mm",height:"50mm",padding:"2mm 3mm",boxSizing:"border-box",fontFamily:"Tahoma, Arial, sans-serif",textRendering:"geometricPrecision"},children:[e.jsxs("div",{className:"mb-1 flex items-start gap-1.5",children:[e.jsxs("div",{className:"flex shrink-0 flex-col items-center pt-0.5",children:[e.jsx(x,{value:n}),e.jsx("div",{className:"mt-0.5 w-[24mm] break-all text-center text-[7px] font-bold leading-tight",children:l.petitionNo})]}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-1",children:[e.jsxs("div",{className:"relative min-h-[7mm] pr-[25mm]",children:[e.jsxs("div",{className:"text-center text-[11px] font-bold leading-tight",children:[e.jsx("div",{children:"ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี"}),e.jsx("div",{children:"ลัดดา จำกัด"})]}),e.jsxs("div",{className:"absolute right-0 top-0 flex items-end gap-1 whitespace-nowrap text-[9.5px]",children:[e.jsx("span",{children:"เลขที่"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2.5rem] text-center",children:a.sampleId||" "}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2rem] text-center",children:r})]})]}),e.jsx(p,{label:"ชื่อผลิตภัณฑ์ และสารสำคัญ",value:t}),e.jsx("div",{children:e.jsx(s,{label:"วัน เดือน ปี ที่ผลิต/นำเข้า",value:o(a.productionDate)})}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(s,{label:"Lot No.",value:a.lotNo}),e.jsx(s,{label:"แบชนัมเบอร์",value:a.batchNo})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(s,{label:"ผู้ผลิต",value:a.labelManufacturer}),e.jsx(s,{label:"ผู้ขาย",value:a.labelSeller})]}),e.jsx("div",{children:e.jsx(s,{label:"ปริมาณ",value:a.labelQuantity})}),e.jsxs("div",{className:"grid grid-cols-[1.4fr_1fr] gap-1.5",children:[e.jsx(s,{label:"สุ่มโดย",value:i}),e.jsx(s,{label:"ว/ด/ป",value:o(a.labelSampledDate)})]})]})]}),e.jsx("div",{className:"space-y-1",children:e.jsx(s,{label:"หมายเหตุ",value:a.labelRemark})}),e.jsx("div",{className:"mt-1 text-[7.5px] font-semibold",children:"F-LAB-01-10 Rev : 01 01/04/67"}),e.jsx("div",{className:"sr-only",children:l.petitionNo})]})}function j({petition:l}){const a=b();return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
        @page {
          size: 100mm 50mm;
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        .sample-label-root {
          width: 100mm;
          margin: 0;
          padding: 0;
        }
        .label-page {
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          width: 100mm;
          height: 50mm;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .label-card {
          flex: 0 0 100mm;
        }
        /* เครื่องพิมพ์ฉลากเป็น thermal ขาวดำ (1-bit) — บังคับดำล้วน/ขาวล้วน ไม่งั้น
           ตัวอักษรจะ inherit สี --foreground (กรมท่าเข้ม 215 25% 20%) ของ theme แล้ว
           ถูก dither เป็นเฉดเทาเพี้ยน (เส้นกรอบ .border-black ดำอยู่แล้วเลยไม่เพี้ยน) */
        .label-card, .label-card * {
          color: #000 !important;
          border-color: #000 !important;
          background-color: transparent !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-card { background-color: #fff !important; }
        @media print {
          html, body { margin: 0; padding: 0; width: 100mm; height: 50mm; }
          .label-page {
            break-after: page;
            page-break-after: always;
          }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}),e.jsx("div",{className:"sample-label-root",style:{fontFamily:"inherit"},children:l.items.map(r=>e.jsx("div",{className:"label-page",children:e.jsx(g,{petition:l,item:r,yearShort:a})},r.seq))})]})}export{j as S};
