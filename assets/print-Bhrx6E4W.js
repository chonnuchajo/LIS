import{c as f,aO as c,e as l,aQ as m,aR as d,aS as h}from"./main-DdNnymB4.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=f("Printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);function s(n,i){if(!n)throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");const e=n.outerHTML;return i?`<style>${i}</style>${e}`:e}function g(){let n="";if(typeof document>"u")return n;for(const i of Array.from(document.styleSheets)){let e;try{e=i.cssRules}catch{continue}if(e)for(const t of Array.from(e))n+=t.cssText+`
`}return n}function y(n){const i=m(n),e=d(n),t=h(n);return i?[`html, body { font-family: ${i}; font-size: ${e}; }`,`h1, h2, h3, h4, h5, h6, th, .print-heading { font-weight: ${t}; }`].join(`
`):""}function w(n,i,e){const t=[g(),y(n),e].filter(Boolean).join(`
`);return s(i,t||void 0)}function b(n){return n==="sample-label"?"@page { size: 100mm 50mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }":n==="stock-label"?"@page { size: 152.4mm 101.6mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }":"@page { size: A4; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }"}function P(n,i,e){return`<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${n}</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${b(e)}</style>
  </head>
  <body>${i}</body>
</html>`}function u(n,i,e){const t=document.createElement("iframe");t.title=n,t.style.position="fixed",t.style.right="0",t.style.bottom="0",t.style.width="0",t.style.height="0",t.style.border="0",t.style.opacity="0",t.setAttribute("aria-hidden","true");const r=()=>{window.setTimeout(()=>t.remove(),500)};t.onload=()=>{const a=t.contentWindow;if(!a)throw r(),new Error("เปิด print dialog ของเครื่องนี้ไม่สำเร็จ");a.onafterprint=r,a.focus(),window.setTimeout(()=>{a.print(),window.setTimeout(r,6e4)},50)},document.body.appendChild(t);const o=t.contentDocument;if(!o)throw r(),new Error("เตรียมเอกสารสำหรับพิมพ์จากเครื่องนี้ไม่สำเร็จ");o.open(),o.write(P(n,i,e)),o.close()}async function F(n,i,e){const t=w(n,i,e==null?void 0:e.css);return((e==null?void 0:e.outputMode)??c(n))==="local"?(u(n,t,n),{printer:"เครื่องนี้",copies:(e==null?void 0:e.copies)??1}):l.printDocument({docType:n,html:t,copies:e==null?void 0:e.copies,printerConfigId:e==null?void 0:e.printerConfigId})}async function k(n,i,e){return((e==null?void 0:e.outputMode)??c(n))==="local"?(u(n,i,n),{printer:"เครื่องนี้",copies:(e==null?void 0:e.copies)??1}):l.printDocument({docType:n,html:i,copies:e==null?void 0:e.copies,printerConfigId:e==null?void 0:e.printerConfigId})}export{C as P,F as a,k as p};
