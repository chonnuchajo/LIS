const ipp = require('ipp');
const uri = 'ipps://192.168.0.237:631/printers/ZD-230-IT';
const printer = ipp.Printer({ protocol:'https:', hostname:'192.168.0.237', port:631, path:'/printers/ZD-230-IT', rejectUnauthorized:false }, { uri, version:'2.0' });
function call(op, extra){ return new Promise((res,rej)=>printer.execute(op, extra||{ 'operation-attributes-tag':{} }, (e,r)=>e?rej(e):res(r))); }
(async()=>{
 try{
   const pa = await call('Get-Printer-Attributes');
   const a = pa['printer-attributes-tag']||{};
   console.log('--- PRINTER ---');
   console.log('state         :', a['printer-state']);
   console.log('state-reasons :', JSON.stringify(a['printer-state-reasons']));
   console.log('is-accepting  :', a['printer-is-accepting-jobs']);
   console.log('auth-info-req :', JSON.stringify(a['auth-info-required']));
   console.log('uri-auth      :', JSON.stringify(a['uri-authentication-supported']));
   console.log('doc-formats   :', JSON.stringify(a['document-format-supported']));
 }catch(e){ console.log('Get-Printer-Attributes ERR:', e.message); }
 try{
   const gj = await call('Get-Jobs', { 'operation-attributes-tag':{ 'which-jobs':'completed', 'limit':8, 'requested-attributes':['job-id','job-name','job-state','job-state-reasons','job-originating-user-name','time-at-creation','time-at-completed','job-printer-state-message'] } });
   console.log('--- RECENT COMPLETED/CANCELED JOBS ---');
   const groups = gj.groups || [];
   const jobs = groups.filter(g=>g.tag==='job-attributes-tag').map(g=>g.attributes);
   if(!jobs.length){ console.log('(no job groups parsed) raw:', JSON.stringify(gj).slice(0,1500)); }
   const now = Math.floor(Date.now()/1000);
   for(const j of jobs){
     const ago = j['time-at-completed'] ? (now - j['time-at-completed']) : null;
     console.log(`#${j['job-id']} state=${j['job-state']} reasons=${JSON.stringify(j['job-state-reasons'])} user=${j['job-originating-user-name']} name="${j['job-name']}" completedAgo=${ago!=null?Math.round(ago/60)+'min':'?'}`);
   }
 }catch(e){ console.log('Get-Jobs ERR:', e.message); }
})();
