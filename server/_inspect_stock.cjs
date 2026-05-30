const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'Stock Control ที่ใช้ในห้องปฏิบัติการเคมีวิเคราะห์.xlsx');
const wb = XLSX.readFile(file, { cellDates: true });
console.log('SHEETS:', JSON.stringify(wb.SheetNames));
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\n===== SHEET: ' + sn + ' | rows: ' + aoa.length + ' =====');
  for (let i = 0; i < Math.min(aoa.length, 6); i++) {
    let r = aoa[i] || [];
    let last = r.length - 1;
    while (last >= 0 && (r[last] === '' || r[last] == null)) last--;
    console.log(i, JSON.stringify(r.slice(0, last + 1)));
  }
}
