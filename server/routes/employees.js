const express = require('express');

const router = express.Router();

const EMPLOYEE_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/employee';
const MONTHLY_TYPE = 'รายเดือน';
const ALLOWED_DEPARTMENTS = ['ควบคุมคุณภาพ', 'Lab/วิเคราะห์'];

function normalizeEmployee(row) {
  return {
    id: row.id,
    employeeId: String(row.employee_id ?? '').trim(),
    name: String(row.name ?? '').trim(),
    department: String(row.department ?? '').trim(),
    position: String(row.position ?? '').trim(),
    empType: String(row.emp_type ?? '').trim(),
    isActive: Number(row.is_active) === 1,
  };
}

router.get('/assignees', async (_req, res) => {
  try {
    const response = await fetch(EMPLOYEE_API_URL);
    if (!response.ok) {
      return res.status(response.status).json({
        error: { message: `โหลดข้อมูลพนักงานไม่สำเร็จ (${response.status})` },
      });
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.value)
      ? payload.value
      : Array.isArray(payload)
        ? payload
        : [];

    const employees = rows
      .map(normalizeEmployee)
      .filter((employee) =>
        employee.isActive &&
        employee.empType === MONTHLY_TYPE &&
        ALLOWED_DEPARTMENTS.includes(employee.department) &&
        employee.employeeId &&
        employee.name,
      )
      .sort((a, b) =>
        a.department.localeCompare(b.department, 'th') ||
        a.name.localeCompare(b.name, 'th'),
      );

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
