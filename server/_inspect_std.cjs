const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'Stock Control ที่ใช้ในห้องปฏิบัติการเคมีวิเคราะห์.xlsx');
const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets['STD'];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log('TOTAL ROWS:', aoa.length);
for (let i = 2; i < aoa.length; i++) {
  let r = aoa[i] || [];
  let last = r.length - 1;
  while (last >= 0 && (r[last] === '' || r[last] == null)) last--;
  if (last < 0) { console.log(i, '(blank)'); continue; }
  console.log(i, JSON.stringify(r.slice(0, last + 1)));
}
