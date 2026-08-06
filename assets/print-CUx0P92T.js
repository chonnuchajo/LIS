import{c as m,aN as c,e as l,aQ as s,aR as f,aS as d}from"./main-BrhUa0kp.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=m("Printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);function h(t,i){if(!t)throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");const e=t.outerHTML;return i?`<style>${i}</style>${e}`:e}function g(){let t="";if(typeof document>"u")return t;for(const i of Array.from(document.styleSheets)){let e;try{e=i.cssRules}catch{continue}if(e)for(const n of Array.from(e))t+=n.cssText+`
`}return t}function y(t){const i=s(t),e=f(t),n=d(t);return i?[`html, body { font-family: ${i}; font-size: ${e}; }`,`h1, h2, h3, h4, h5, h6, th, .print-heading { font-weight: ${n}; }`].join(`
`):""}function w(t,i,e){const n=[g(),y(t),e].filter(Boolean).join(`
`);return h(i,n||void 0)}function b(t){return t==="sample-label"?"@page { size: 100mm 50mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }":t==="stock-label"?"@page { size: 152.4mm 101.6mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }":"@page { size: A4; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }"}function P(t,i,e){return`<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t}</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${b(e)}</style>
  </head>
  <body>${i}</body>
</html>`}function u(t,i,e){const n=document.createElement("iframe");n.title=t,n.style.position="fixed",n.style.right="0",n.style.bottom="0",n.style.width="0",n.style.height="0",n.style.border="0",n.style.opacity="0",n.setAttribute("aria-hidden","true");const r=()=>{window.setTimeout(()=>n.remove(),500)};n.onload=()=>{const a=n.contentWindow;if(!a)throw r(),new Error("เปิด print dialog ของเครื่องนี้ไม่สำเร็จ");a.onafterprint=r,a.focus(),window.setTimeout(()=>{a.print(),window.setTimeout(r,6e4)},50)},document.body.appendChild(n);const o=n.contentDocument;if(!o)throw r(),new Error("เตรียมเอกสารสำหรับพิมพ์จากเครื่องนี้ไม่สำเร็จ");o.open(),o.write(P(t,i,e)),o.close()}async function F(t,i,e){const n=w(t,i,e==null?void 0:e.css);return((e==null?void 0:e.outputMode)??c(t))==="local"?(u(t,n,t),{printer:"เครื่องนี้",copies:(e==null?void 0:e.copies)??1}):l.printDocument({docType:t,html:n,copies:e==null?void 0:e.copies})}async function k(t,i,e){return((e==null?void 0:e.outputMode)??c(t))==="local"?(u(t,i,t),{printer:"เครื่องนี้",copies:(e==null?void 0:e.copies)??1}):l.printDocument({docType:t,html:i,copies:e==null?void 0:e.copies})}export{p as P,F as a,k as p};
