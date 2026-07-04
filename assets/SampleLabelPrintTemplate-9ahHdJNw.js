import{j as e}from"./vendor-query-CHuXHqWO.js";import{b as h}from"./vendor-qr-BPmJ3lcd.js";function o(l){if(!l)return"";const a=new Date(l);if(Number.isNaN(a.getTime()))return"";const s=String(a.getDate()).padStart(2,"0"),r=String(a.getMonth()+1).padStart(2,"0"),i=String((a.getFullYear()+543)%100).padStart(2,"0");return`${s}/${r}/${i}`}function x(){return String((new Date().getFullYear()+543)%100).padStart(2,"0")}function p(l,a){return JSON.stringify({id:l._id,petitionNo:l.petitionNo,sampleId:a.sampleId||"",itemSeq:a.seq})}function c({value:l,sizeClass:a="h-[24mm] w-[24mm]"}){const s=h.create(l,{errorCorrectionLevel:"M"}),r=s.modules.size,i=Array.from(s.modules.data);return e.jsxs("svg",{viewBox:`0 0 ${r} ${r}`,className:`${a} shrink-0`,role:"img","aria-label":`QR ${l}`,shapeRendering:"crispEdges",children:[e.jsx("rect",{width:r,height:r,fill:"#fff"}),i.map((d,n)=>{if(!d)return null;const m=n%r,b=Math.floor(n/r);return e.jsx("rect",{x:m,y:b,width:"1",height:"1",fill:"#000"},n)})]})}function t({label:l,value:a,className:s="",valueClassName:r="",multiline:i=!1}){const d=i?"min-h-[3.5mm] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold":"min-h-[3.5mm] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-0.5 font-bold";return e.jsxs("div",{className:`flex min-w-0 items-end gap-1 ${s}`,children:[e.jsx("span",{className:"whitespace-nowrap",children:l}),e.jsx("span",{className:`${d} ${r}`,children:a||""})]})}function g({label:l,value:a}){return e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"whitespace-nowrap",children:l}),e.jsx("div",{className:"min-h-[3.5mm] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold leading-tight",children:a||""})]})}function u({petition:l,item:a,yearShort:s}){var n;const r=[a.sampleName,a.commonName].filter(Boolean).join(" "),i=((n=l.submittedBy)==null?void 0:n.name)||a.labelSampledBy||"",d=p(l,a);return e.jsxs("div",{className:"label-card overflow-hidden border border-black text-[9.5px] font-semibold leading-[1.15]",style:{width:"100mm",height:"50mm",padding:"2mm 3mm",boxSizing:"border-box",fontFamily:"Tahoma, Arial, sans-serif",textRendering:"geometricPrecision"},children:[e.jsxs("div",{className:"mb-1 flex items-start gap-1.5",children:[e.jsxs("div",{className:"flex shrink-0 flex-col items-center pt-0.5",children:[e.jsx(c,{value:d}),e.jsx("div",{className:"mt-0.5 w-[24mm] break-all text-center text-[7px] font-bold leading-tight",children:l.petitionNo}),a.batchNo?e.jsx(c,{value:a.batchNo,sizeClass:"mt-0.5 h-[9mm] w-[9mm]"}):null]}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-1",children:[e.jsxs("div",{className:"relative min-h-[7mm] pr-[25mm]",children:[e.jsxs("div",{className:"text-center text-[11px] font-bold leading-tight",children:[e.jsx("div",{children:"ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี"}),e.jsx("div",{children:"ลัดดา จำกัด"})]}),e.jsxs("div",{className:"absolute right-0 top-0 flex items-end gap-1 whitespace-nowrap text-[9.5px]",children:[e.jsx("span",{children:"เลขที่"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2.5rem] text-center",children:a.sampleId||" "}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2rem] text-center",children:s})]})]}),e.jsx(g,{label:"ชื่อผลิตภัณฑ์ และสารสำคัญ",value:r}),e.jsx("div",{children:e.jsx(t,{label:"วัน เดือน ปี ที่ผลิต/นำเข้า",value:o(a.productionDate)})}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(t,{label:"Lot No.",value:a.lotNo}),e.jsx(t,{label:"แบชนัมเบอร์",value:a.batchNo})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(t,{label:"ผู้ผลิต",value:a.labelManufacturer}),e.jsx(t,{label:"ผู้ขาย",value:a.labelSeller})]}),e.jsx("div",{children:e.jsx(t,{label:"ปริมาณ",value:a.labelQuantity})}),e.jsxs("div",{className:"grid grid-cols-[1.4fr_1fr] gap-1.5",children:[e.jsx(t,{label:"สุ่มโดย",value:i}),e.jsx(t,{label:"ว/ด/ป",value:o(a.labelSampledDate)})]})]})]}),e.jsx("div",{className:"space-y-1",children:e.jsx(t,{label:"หมายเหตุ",value:a.labelRemark})}),e.jsx("div",{className:"mt-1 text-[7.5px] font-semibold",children:"F-LAB-01-10 Rev : 01 01/04/67"}),e.jsx("div",{className:"sr-only",children:l.petitionNo})]})}function v({petition:l}){const a=x();return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
      `}),e.jsx("div",{className:"sample-label-root",style:{fontFamily:"inherit"},children:l.items.map(s=>e.jsx("div",{className:"label-page",children:e.jsx(u,{petition:l,item:s,yearShort:a})},s.seq))})]})}export{v as S};
