// Pure helpers for matching LIS users to HR employee records. No network here —
// the live webhook fetch lives in employeeDirectory.js so these stay unit-testable.

const MONTHLY_TYPE = 'รายเดือน';

function normalizeEmployee(row) {
  return {
    id: row.id,
    employeeId: String(row.employee_id ?? '').trim(),
    name: String(row.name ?? '').trim(),
    department: String(row.department ?? '').trim(),
    position: String(row.position ?? '').trim(),
    empType: String(row.emp_type ?? '').trim(),
    isActive: Number(row.is_active) === 1,
    email: String(row.email ?? '').trim().toLowerCase(),
  };
}

function findEmployeeByEmail(employees, email) {
  const key = String(email ?? '').trim().toLowerCase();
  if (!key) return null;
  return employees.find((e) => e.email && e.email.toLowerCase() === key) || null;
}

function findEmployeeById(employees, employeeId) {
  const key = String(employeeId ?? '').trim();
  if (!key) return null;
  return employees.find((e) => e.employeeId === key) || null;
}

// Given the current users and the employee directory, decide which users to link.
// Only fills users with an empty employeeId — never overwrites an existing link.
function planEmployeeSync(users, employees) {
  let linked = 0;
  let alreadyLinked = 0;
  let unmatched = 0;
  const updates = [];
  for (const user of users) {
    if (user.employeeId) {
      alreadyLinked += 1;
      continue;
    }
    const emp = findEmployeeByEmail(employees, user.email);
    if (!emp) {
      unmatched += 1;
      continue;
    }
    linked += 1;
    updates.push({
      userId: user.id,
      employeeId: emp.employeeId,
      department: emp.department,
      position: emp.position,
    });
  }
  return { updates, linked, alreadyLinked, unmatched };
}

module.exports = {
  MONTHLY_TYPE,
  normalizeEmployee,
  findEmployeeByEmail,
  findEmployeeById,
  planEmployeeSync,
};
