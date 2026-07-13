import{j as e}from"./vendor-query-B9oVrpGH.js";import{b as h}from"./vendor-qr-BPmJ3lcd.js";function o(l){if(!l)return"";const a=new Date(l);if(Number.isNaN(a.getTime()))return"";const t=String(a.getDate()).padStart(2,"0"),r=String(a.getMonth()+1).padStart(2,"0"),n=String((a.getFullYear()+543)%100).padStart(2,"0");return`${t}/${r}/${n}`}function x(){return String((new Date().getFullYear()+543)%100).padStart(2,"0")}function p(l,a){return JSON.stringify({id:l._id,petitionNo:l.petitionNo,sampleId:a.sampleId||"",itemSeq:a.seq})}const g="ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี",u="ลัดดา จำกัด",f=`${g} ${u}`,j="เลขที่";function c({value:l,sizeClass:a="h-[24mm] w-[24mm]"}){const t=h.create(l,{errorCorrectionLevel:"M"}),r=t.modules.size,n=Array.from(t.modules.data);return e.jsxs("svg",{viewBox:`0 0 ${r} ${r}`,className:`${a} shrink-0`,role:"img","aria-label":`QR ${l}`,shapeRendering:"crispEdges",children:[e.jsx("rect",{width:r,height:r,fill:"#fff"}),n.map((d,i)=>{if(!d)return null;const m=i%r,b=Math.floor(i/r);return e.jsx("rect",{x:m,y:b,width:"1",height:"1",fill:"#000"},i)})]})}function s({label:l,value:a,className:t="",valueClassName:r="",valueTestId:n,multiline:d=!1}){const i=d?"min-h-[3.5mm] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold":"min-h-[3.5mm] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-0.5 font-bold";return e.jsxs("div",{className:`flex min-w-0 items-end gap-1 ${t}`,children:[e.jsx("span",{className:"whitespace-nowrap",children:l}),e.jsx("span",{"data-testid":n,className:`${i} ${r}`,children:a||""})]})}function v({label:l,value:a}){return e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"whitespace-nowrap",children:l}),e.jsx("div",{className:"min-h-[3.5mm] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold leading-tight",children:a||""})]})}function N({petition:l,item:a,yearShort:t}){var i;const r=[a.sampleName,a.commonName].filter(Boolean).join(" "),n=((i=l.submittedBy)==null?void 0:i.name)||a.labelSampledBy||"",d=p(l,a);return e.jsxs("div",{className:"label-card overflow-hidden border border-black text-[9.5px] font-semibold leading-[1.15]",style:{width:"100mm",height:"50mm",padding:"2mm 3mm",boxSizing:"border-box",fontFamily:"Tahoma, Arial, sans-serif",textRendering:"geometricPrecision"},children:[e.jsxs("div",{className:"mb-1 flex items-start gap-1.5",children:[e.jsxs("div",{className:"flex shrink-0 flex-col items-center pt-0.5",children:[e.jsx(c,{value:d}),e.jsx("div",{className:"mt-0.5 w-[24mm] break-all text-center text-[7px] font-bold leading-tight",children:l.petitionNo}),a.batchNo?e.jsxs(e.Fragment,{children:[e.jsx(c,{value:a.batchNo,sizeClass:"mt-0.5 h-[9mm] w-[9mm]"}),e.jsx("div",{"data-testid":"sample-label-batch-qr-text",className:"mt-0.5 w-[24mm] break-all text-center text-[5.5px] font-bold leading-none",children:a.batchNo})]}):null]}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-1",children:[e.jsxs("div",{className:"grid min-h-[7mm] grid-cols-[minmax(0,1fr)_auto] items-start gap-1",children:[e.jsx("div",{"data-testid":"sample-label-header-title",className:"min-w-0 px-0.5 text-center text-[8.5px] font-bold leading-tight",children:e.jsx("span",{"data-testid":"sample-label-title-line",className:"block whitespace-nowrap",children:f})}),e.jsxs("div",{"data-testid":"sample-label-document-number",className:"flex items-end gap-0.5 whitespace-nowrap text-[7px]",children:[e.jsx("span",{children:j}),e.jsx("span",{className:"inline-block min-w-[1.45rem] border-b border-black px-0.5 text-center",children:a.sampleId||" "}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-block min-w-[1.1rem] border-b border-black px-0.5 text-center",children:t})]})]}),e.jsx(v,{label:"ชื่อผลิตภัณฑ์ และสารสำคัญ",value:r}),e.jsx("div",{children:e.jsx(s,{label:"วัน เดือน ปี ที่ผลิต/นำเข้า",value:o(a.productionDate)})}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(s,{label:"Lot No.",value:a.lotNo}),e.jsx(s,{label:"แบชนัมเบอร์",value:a.batchNo,valueClassName:"text-[8px] leading-tight",valueTestId:"sample-label-batch-number-value",multiline:!0})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(s,{label:"ผู้ผลิต",value:a.labelManufacturer}),e.jsx(s,{label:"ผู้ขาย",value:a.labelSeller})]}),e.jsx("div",{children:e.jsx(s,{label:"ปริมาณ",value:a.labelQuantity})}),e.jsxs("div",{className:"grid grid-cols-[1.4fr_1fr] gap-1.5",children:[e.jsx(s,{label:"สุ่มโดย",value:n}),e.jsx(s,{label:"ว/ด/ป",value:o(a.labelSampledDate)})]})]})]}),e.jsx("div",{className:"space-y-1",children:e.jsx(s,{label:"หมายเหตุ",value:a.labelRemark})}),e.jsx("div",{className:"mt-1 text-[7.5px] font-semibold",children:"F-LAB-01-10 Rev : 01 01/04/67"}),e.jsx("div",{className:"sr-only",children:l.petitionNo})]})}function y({petition:l}){const a=x();return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
      `}),e.jsx("div",{className:"sample-label-root",style:{fontFamily:"inherit"},children:l.items.map(t=>e.jsx("div",{className:"label-page",children:e.jsx(N,{petition:l,item:t,yearShort:a})},t.seq))})]})}export{y as S};
