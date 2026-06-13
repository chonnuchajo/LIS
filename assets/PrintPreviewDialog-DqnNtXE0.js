import{j as e,u as $}from"./vendor-query-CHuXHqWO.js";import{b as B}from"./vendor-qr-lFkqUVHP.js";import{r as h,L}from"./vendor-react-BrcJiHE1.js";import{c as R,b as k,B as g,I as M,k as w}from"./main-TS2SBxgR.js";import{D as F,a as E,b as z,c as H,e as q}from"./dialog-D3z8_8gs.js";import{L as I}from"./label-DLvv2MPg.js";import{g as W,i as A}from"./printConfig-CO9fxii_.js";import{M as Q}from"./minus-Bz9w-03X.js";import{P as T}from"./plus-BG8KHWLu.js";import{P as Y}from"./printer-BpD7CrPo.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=R("Laptop",[["path",{d:"M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16",key:"tarvll"}]]);function y(a){if(!a)return"";const r=new Date(a);if(Number.isNaN(r.getTime()))return"";const t=String(r.getDate()).padStart(2,"0"),n=String(r.getMonth()+1).padStart(2,"0"),l=String((r.getFullYear()+543)%100).padStart(2,"0");return`${t}/${n}/${l}`}function K(){return String((new Date().getFullYear()+543)%100).padStart(2,"0")}function O(a,r){return JSON.stringify({id:a._id,petitionNo:a.petitionNo,sampleId:r.sampleId||"",itemSeq:r.seq})}function V({value:a}){const r=B.create(a,{errorCorrectionLevel:"M"}),t=r.modules.size,n=Array.from(r.modules.data);return e.jsxs("svg",{viewBox:`0 0 ${t} ${t}`,className:"h-[24mm] w-[24mm] shrink-0",role:"img","aria-label":`QR ${a}`,shapeRendering:"crispEdges",children:[e.jsx("rect",{width:t,height:t,fill:"#fff"}),n.map((l,s)=>{if(!l)return null;const o=s%t,u=Math.floor(s/t);return e.jsx("rect",{x:o,y:u,width:"1",height:"1",fill:"#000"},s)})]})}function m({label:a,value:r,className:t="",valueClassName:n="",multiline:l=!1}){const s=l?"min-h-[3.5mm] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold":"min-h-[3.5mm] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-0.5 font-bold";return e.jsxs("div",{className:`flex min-w-0 items-end gap-1 ${t}`,children:[e.jsx("span",{className:"whitespace-nowrap",children:a}),e.jsx("span",{className:`${s} ${n}`,children:r||""})]})}function J({label:a,value:r}){return e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"whitespace-nowrap",children:a}),e.jsx("div",{className:"min-h-[3.5mm] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-0.5 font-bold leading-tight",children:r||""})]})}function U({petition:a,item:r,yearShort:t}){var o;const n=[r.sampleName,r.commonName].filter(Boolean).join(" "),l=((o=a.submittedBy)==null?void 0:o.name)||r.labelSampledBy||"",s=O(a,r);return e.jsxs("div",{className:"label-card overflow-hidden border border-black text-[9.5px] font-semibold leading-[1.15]",style:{width:"100mm",height:"50mm",padding:"2mm 3mm",boxSizing:"border-box",fontFamily:"Tahoma, Arial, sans-serif",textRendering:"geometricPrecision"},children:[e.jsxs("div",{className:"mb-1 flex items-start gap-1.5",children:[e.jsxs("div",{className:"flex shrink-0 flex-col items-center pt-0.5",children:[e.jsx(V,{value:s}),e.jsx("div",{className:"mt-0.5 w-[24mm] break-all text-center text-[7px] font-bold leading-tight",children:a.petitionNo})]}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-1",children:[e.jsxs("div",{className:"relative min-h-[7mm] pr-[25mm]",children:[e.jsxs("div",{className:"text-center text-[11px] font-bold leading-tight",children:[e.jsx("div",{children:"ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี"}),e.jsx("div",{children:"ลัดดา จำกัด"})]}),e.jsxs("div",{className:"absolute right-0 top-0 flex items-end gap-1 whitespace-nowrap text-[9.5px]",children:[e.jsx("span",{children:"เลขที่"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2.5rem] text-center",children:r.sampleId||" "}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-block border-b border-black px-1 min-w-[2rem] text-center",children:t})]})]}),e.jsx(J,{label:"ชื่อผลิตภัณฑ์ และสารสำคัญ",value:n}),e.jsx("div",{children:e.jsx(m,{label:"วัน เดือน ปี ที่ผลิต/นำเข้า",value:y(r.productionDate)})}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(m,{label:"Lot No.",value:r.lotNo}),e.jsx(m,{label:"แบชนัมเบอร์",value:r.batchNo})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5",children:[e.jsx(m,{label:"ผู้ผลิต",value:r.labelManufacturer}),e.jsx(m,{label:"ผู้ขาย",value:r.labelSeller})]}),e.jsx("div",{children:e.jsx(m,{label:"ปริมาณ",value:r.labelQuantity})}),e.jsxs("div",{className:"grid grid-cols-[1.4fr_1fr] gap-1.5",children:[e.jsx(m,{label:"สุ่มโดย",value:l}),e.jsx(m,{label:"ว/ด/ป",value:y(r.labelSampledDate)})]})]})]}),e.jsx("div",{className:"space-y-1",children:e.jsx(m,{label:"หมายเหตุ",value:r.labelRemark})}),e.jsx("div",{className:"mt-1 text-[7.5px] font-semibold",children:"F-LAB-01-10 Rev : 01 01/04/67"}),e.jsx("div",{className:"sr-only",children:a.petitionNo})]})}function me({petition:a}){const r=K();return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
      `}),e.jsx("div",{className:"sample-label-root",style:{fontFamily:"inherit"},children:a.items.map(t=>e.jsx("div",{className:"label-page",children:e.jsx(U,{petition:a,item:t,yearShort:r})},t.seq))})]})}function S(a,r){if(!a)throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");const t=a.outerHTML;return r?`<style>${r}</style>${t}`:t}function P(){let a="";if(typeof document>"u")return a;for(const r of Array.from(document.styleSheets)){let t;try{t=r.cssRules}catch{continue}if(t)for(const n of Array.from(t))a+=n.cssText+`
`}return a}async function X(a,r,t){const n=[P(),t==null?void 0:t.css].filter(Boolean).join(`
`),l=S(r,n||void 0);return k.printDocument({docType:a,html:l,copies:t==null?void 0:t.copies})}function G(a,r,t){const n=[P(),t==null?void 0:t.css].filter(Boolean).join(`
`),l=S(r,n||void 0),s=window.open("","_blank");if(!s)throw new Error("เปิดหน้าต่าง print preview ไม่สำเร็จ (ป๊อปอัปอาจถูกบล็อก)");s.document.open(),s.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${a}</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      html, body { margin: 0; padding: 0; background: #fff; font-family: "Kanit", sans-serif; }
    </style>
  </head>
  <body>${l}</body>
</html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()}}const Z=18;function ee({printRef:a,children:r}){const t=h.useRef(null),n=h.useRef(null),[l,s]=h.useState(1),[o,u]=h.useState(0),[j,v]=h.useState(0);return h.useLayoutEffect(()=>{const c=t.current,f=n.current;if(!c||!f)return;const x=()=>{const p=c.clientWidth-Z,b=f.scrollWidth;s(b>0?p/b:1),v(b),u(f.scrollHeight)};x();const d=new ResizeObserver(x);return d.observe(c),()=>d.disconnect()},[r]),e.jsx("div",{ref:t,className:"flex justify-center",children:e.jsx("div",{className:"overflow-hidden rounded border bg-white p-2",children:e.jsx("div",{style:{width:j*l,height:o*l},children:e.jsx("div",{ref:n,style:{width:"max-content",transform:`scale(${l})`,transformOrigin:"top left"},children:e.jsx("div",{ref:a,children:r})})})})})}function he({open:a,onOpenChange:r,docType:t,css:n,children:l}){var N;const s=h.useRef(null),[o,u]=h.useState(1),[j,v]=h.useState(!1),c=W(t),f=t==="sample-label"?"sm:max-w-2xl":"sm:max-w-4xl",{data:x}=$({queryKey:["print-config"],queryFn:k.getPrintConfigs,enabled:a}),d=x==null?void 0:x.find(i=>i.slug===t),p=A(d),b=((N=d==null?void 0:d.cupsPrinterUrl)==null?void 0:N.trim())||(d==null?void 0:d.printerName);async function C(){v(!0);try{const i=await X(t,s.current,{css:n,copies:o});w.success(`ส่งพิมพ์ไปยัง ${i.printer} (${i.copies} ชุด)`),r(!1)}catch(i){w.error(i instanceof Error?i.message:"พิมพ์ไม่สำเร็จ")}finally{v(!1)}}function D(){try{G((c==null?void 0:c.label)??t,s.current,{css:n})}catch(i){w.error(i instanceof Error?i.message:"เปิด print preview ไม่สำเร็จ")}}return e.jsx(F,{open:a,onOpenChange:r,children:e.jsxs(E,{className:`${f} max-h-[90vh] overflow-y-auto overflow-x-hidden`,children:[e.jsx(z,{children:e.jsxs(H,{children:["ตัวอย่างก่อนพิมพ์ — ",(c==null?void 0:c.label)??t]})}),e.jsx(ee,{printRef:s,children:l}),!p&&e.jsxs("p",{className:"text-sm text-red-600",children:["ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้"," ",e.jsx(L,{to:"/settings",className:"underline",onClick:()=>r(!1),children:"ไปหน้าตั้งค่าระบบ"})]}),e.jsxs(q,{className:"items-center gap-3 sm:justify-between",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(I,{htmlFor:"print-copies",className:"text-sm",children:"จำนวนชุด"}),e.jsxs("div",{className:"flex items-center",children:[e.jsx(g,{type:"button",variant:"outline",size:"icon",className:"h-9 w-9 rounded-r-none",onClick:()=>u(i=>Math.max(1,i-1)),disabled:o<=1,"aria-label":"ลดจำนวนชุด",children:e.jsx(Q,{className:"h-4 w-4"})}),e.jsx(M,{id:"print-copies",type:"text",inputMode:"numeric",value:o,onChange:i=>u(Math.min(99,Math.max(1,parseInt(i.target.value.replace(/\D/g,"")||"1",10)))),className:"w-12 rounded-none text-center"}),e.jsx(g,{type:"button",variant:"outline",size:"icon",className:"h-9 w-9 rounded-l-none",onClick:()=>u(i=>Math.min(99,i+1)),disabled:o>=99,"aria-label":"เพิ่มจำนวนชุด",children:e.jsx(T,{className:"h-4 w-4"})})]}),p&&e.jsxs("span",{className:"break-all text-sm text-muted-foreground",children:["→ ",b]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(g,{variant:"outline",onClick:()=>r(!1),children:"ปิด"}),e.jsxs(g,{variant:"outline",onClick:D,className:"gap-2",children:[e.jsx(_,{className:"h-4 w-4"}),"Windows Preview"]}),e.jsxs(g,{onClick:C,disabled:!p||j,className:"gap-2",children:[e.jsx(Y,{className:"h-4 w-4"}),j?"กำลังพิมพ์...":"พิมพ์"]})]})]})]})})}export{he as P,me as S};
