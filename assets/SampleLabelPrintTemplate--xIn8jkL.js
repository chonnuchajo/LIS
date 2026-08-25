import{j as e}from"./vendor-query-CD9KNe1W.js";import{b as v}from"./vendor-qr-BPmJ3lcd.js";import{r as h}from"./vendor-react-BrcJiHE1.js";const N=.5;function w({boxHeight:a,measureHeight:t,minScale:s=N,steps:r=8}){if(!Number.isFinite(a)||a<=0)return 1;const l=d=>{const i=t(d);return!Number.isFinite(i)||i<=0?!0:d*i<=a};if(l(1))return 1;if(!l(s))return s;let n=s,o=1;for(let d=0;d<r;d+=1){const i=(n+o)/2;l(i)?n=i:o=i}return n}function y({className:a,style:t,contentClassName:s,contentStyle:r,minScale:l,children:n}){const o=h.useRef(null),d=h.useRef(null);return h.useLayoutEffect(()=>{const i=o.current,c=d.current;if(!i||!c)return;const x=()=>{const b=w({boxHeight:i.clientHeight,minScale:l,measureHeight:j=>(c.style.width=`${100/j}%`,c.style.minHeight="0",c.style.transform="none",c.scrollHeight)}),p=`${100/b}%`;c.style.width=p,c.style.minHeight=p,c.style.transform=b<1?`scale(${b})`:"none"};if(x(),typeof ResizeObserver>"u")return;const u=new ResizeObserver(x);return u.observe(i),()=>u.disconnect()},[n,l]),e.jsx("div",{ref:o,"data-fit-box":"",className:a,style:t,children:e.jsx("div",{ref:d,"data-fit-content":"",className:s,style:{width:"100%",minHeight:"100%",transform:"none",transformOrigin:"top left",...r},children:n})})}function k(a){const t=[a.sampleName,a.commonName].map(r=>r==null?void 0:r.trim()).filter(r=>!!r);return t.filter((r,l)=>t.findIndex(n=>n.toLowerCase()===r.toLowerCase())===l).join(" ")}function f(a){if(!a)return"";const t=new Date(a);if(Number.isNaN(t.getTime()))return"";const s=String(t.getDate()).padStart(2,"0"),r=String(t.getMonth()+1).padStart(2,"0"),l=String((t.getFullYear()+543)%100).padStart(2,"0");return`${s}/${r}/${l}`}function E(){return String((new Date().getFullYear()+543)%100).padStart(2,"0")}function L(a,t){return JSON.stringify({id:a._id,petitionNo:a.petitionNo,sampleId:t.sampleId||"",itemSeq:t.seq})}const S="ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี",F="ลัดดา จำกัด",R=`${S} ${F}`,_="เลขที่";function g({value:a,sizeClass:t="h-[24mm] w-[24mm]"}){const s=v.create(a,{errorCorrectionLevel:"M"}),r=s.modules.size,l=Array.from(s.modules.data);return e.jsxs("svg",{viewBox:`0 0 ${r} ${r}`,className:`${t} shrink-0`,role:"img","aria-label":`QR ${a}`,shapeRendering:"crispEdges",children:[e.jsx("rect",{width:r,height:r,fill:"#fff"}),l.map((n,o)=>{if(!n)return null;const d=o%r,i=Math.floor(o/r);return e.jsx("rect",{x:d,y:i,width:"1",height:"1",fill:"#000"},o)})]})}function m({label:a,value:t,className:s="",valueClassName:r="",valueTestId:l,multiline:n=!1}){const o=n?"min-h-[3.5mm] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold":"min-h-[3.5mm] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-0.5 font-bold";return e.jsxs("div",{className:`flex min-w-0 items-end gap-1 ${s}`,children:[e.jsx("span",{className:"whitespace-nowrap",children:a}),e.jsx("span",{"data-testid":l,className:`${o} ${r}`,children:t||""})]})}function B({label:a,value:t}){return e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"whitespace-nowrap",children:a}),e.jsx("div",{className:"min-h-[3.5mm] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold leading-tight",children:t||""})]})}function $({petition:a,item:t,yearShort:s}){var n;const r=((n=a.submittedBy)==null?void 0:n.name)||t.labelSampledBy||"",l=L(a,t);return e.jsx("div",{className:"label-card overflow-hidden border border-black text-[9.5px] font-semibold leading-[1.15]",style:{width:"100mm",height:"50mm",padding:"2mm 3mm",boxSizing:"border-box",fontFamily:"Tahoma, Arial, sans-serif",textRendering:"geometricPrecision"},children:e.jsxs(y,{className:"h-full",children:[e.jsxs("div",{className:"mb-1 flex items-start gap-1.5",children:[e.jsxs("div",{className:"flex shrink-0 flex-col items-center pt-0.5",children:[e.jsx(g,{value:l}),e.jsx("div",{className:"mt-0.5 w-[24mm] break-all text-center text-[7px] font-bold leading-tight",children:a.petitionNo}),t.batchNo?e.jsxs(e.Fragment,{children:[e.jsx(g,{value:t.batchNo,sizeClass:"mt-0.5 h-[9mm] w-[9mm]"}),e.jsx("div",{"data-testid":"sample-label-batch-qr-text",className:"mt-0.5 w-[24mm] break-all text-center text-[5.5px] font-bold leading-none",children:t.batchNo})]}):null]}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-1",children:[e.jsxs("div",{className:"grid min-h-[7mm] grid-cols-[minmax(0,1fr)_auto] items-start gap-1",children:[e.jsx("div",{"data-testid":"sample-label-header-title",className:"min-w-0 px-0.5 text-center text-[8.5px] font-bold leading-tight",children:e.jsx("span",{"data-testid":"sample-label-title-line",className:"block whitespace-nowrap",children:R})}),e.jsxs("div",{"data-testid":"sample-label-document-number",className:"flex items-end gap-0.5 whitespace-nowrap text-[7px]",children:[e.jsx("span",{children:_}),e.jsx("span",{className:"inline-block min-w-[1.45rem] border-b border-black px-0.5 text-center",children:t.sampleId||" "}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-block min-w-[1.1rem] border-b border-black px-0.5 text-center",children:s})]})]}),e.jsx(B,{label:"ชื่อผลิตภัณฑ์ และสารสำคัญ",value:k(t)}),e.jsx("div",{children:e.jsx(m,{label:"วัน เดือน ปี ที่ผลิต/นำเข้า",value:f(t.productionDate)})}),e.jsx("div",{children:e.jsx(m,{label:"Batch No.",value:t.batchNo,valueClassName:"text-[8px] leading-tight",valueTestId:"sample-label-batch-number-value",multiline:!0})}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(m,{label:"ผู้ผลิต",value:t.labelManufacturer}),e.jsx(m,{label:"ผู้ขาย",value:t.labelSeller})]}),e.jsx("div",{children:e.jsx(m,{label:"ปริมาณ",value:t.labelQuantity})}),e.jsxs("div",{className:"grid grid-cols-[1.4fr_1fr] gap-1.5",children:[e.jsx(m,{label:"สุ่มโดย",value:r}),e.jsx(m,{label:"ว/ด/ป",value:f(t.labelSampledDate)})]})]})]}),e.jsx("div",{className:"space-y-1",children:e.jsx(m,{label:"หมายเหตุ",value:t.labelRemark})}),e.jsx("div",{className:"mt-1 text-[7.5px] font-semibold",children:"F-LAB-01-10 Rev : 01 01/04/67"}),e.jsx("div",{className:"sr-only",children:a.petitionNo})]})})}function T({petition:a}){const t=E();return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
      `}),e.jsx("div",{className:"sample-label-root",style:{fontFamily:"inherit"},children:a.items.map(s=>e.jsx("div",{className:"label-page",children:e.jsx($,{petition:a,item:s,yearShort:t})},s.seq))})]})}export{y as F,T as S};
