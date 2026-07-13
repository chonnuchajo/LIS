import{e as l,aG as u,aH as h,aI as w}from"./main-BaZR-m_V.js";function d(n,t){if(!n)throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");const e=n.outerHTML;return t?`<style>${t}</style>${e}`:e}function f(){let n="";if(typeof document>"u")return n;for(const t of Array.from(document.styleSheets)){let e;try{e=t.cssRules}catch{continue}if(e)for(const i of Array.from(e))n+=i.cssText+`
`}return n}function s(n){const t=u(n),e=h(n),i=w(n);return t?[`html, body { font-family: ${t}; font-size: ${e}; }`,`h1, h2, h3, h4, h5, h6, th, .print-heading { font-weight: ${i}; }`].join(`
`):""}function m(n,t,e){const i=[f(),s(n),e].filter(Boolean).join(`
`);return d(t,i||void 0)}async function b(n,t,e){const i=m(n,t,e==null?void 0:e.css);return l.printDocument({docType:n,html:i,copies:e==null?void 0:e.copies})}async function g(n,t,e){const i=m(n,t,e==null?void 0:e.css),a=await l.downloadPrintPdf({docType:n,html:i}),o=URL.createObjectURL(a);if(e!=null&&e.fileName){const r=document.createElement("a");r.href=o,r.download=e.fileName,document.body.appendChild(r),r.click(),r.remove()}else if(!window.open(o,"_blank","noopener")){const c=document.createElement("a");c.href=o,c.download=`${n}.pdf`,document.body.appendChild(c),c.click(),c.remove()}window.setTimeout(()=>URL.revokeObjectURL(o),6e4)}function P(n,t,e){const i=[f(),e!=null&&e.docType?s(e.docType):"",e==null?void 0:e.css].filter(Boolean).join(`
`),a=d(t,i||void 0),o=window.open("","_blank");if(!o)throw new Error("เปิดหน้าต่าง print preview ไม่สำเร็จ (ป๊อปอัปอาจถูกบล็อก)");o.document.open(),o.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${n}</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      html, body { margin: 0; padding: 0; background: #fff; font-family: "Kanit", sans-serif; }
    </style>
  </head>
  <body>${a}</body>
</html>`),o.document.close(),o.onload=()=>{o.focus(),o.print()}}export{g as a,P as o,b as p};
