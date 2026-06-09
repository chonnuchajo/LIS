const { normalizeEmployee, MONTHLY_TYPE } = require('./employeeLink');

const EMPLOYEE_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/employee';

// Fetch the HR webhook and return active monthly employees (all departments),
// normalized. Throws on a non-OK response so callers can decide whether the
// failure is fatal (the directory route) or skippable (auto-link).
async function fetchMonthlyEmployees() {
  const response = await fetch(EMPLOYEE_API_URL);
  if (!response.ok) {
    throw new Error(`โหลดข้อมูลพนักงานไม่สำเร็จ (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.value)
    ? payload.value
    : Array.isArray(payload)
      ? payload
      : [];
  return rows
    .map(normalizeEmployee)
    .filter((e) => e.isActive && e.empType === MONTHLY_TYPE && e.employeeId && e.name);
}

module.exports = { EMPLOYEE_API_URL, fetchMonthlyEmployees };
