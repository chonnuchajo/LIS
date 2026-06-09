const express = require('express');
const { fetchMonthlyEmployees } = require('../lib/employeeDirectory');

const router = express.Router();

const ALLOWED_DEPARTMENTS = ['Lab/วิเคราะห์'];

function toAssignee(e) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    department: e.department,
    position: e.position,
    empType: e.empType,
    isActive: e.isActive,
  };
}

function toDirectoryEntry(e) {
  return {
    employeeId: e.employeeId,
    name: e.name,
    department: e.department,
    position: e.position,
    email: e.email,
  };
}

function byDeptThenName(a, b) {
  return (
    a.department.localeCompare(b.department, 'th') ||
    a.name.localeCompare(b.name, 'th')
  );
}

// Lab analysts only — drives the /petitions/assign picker. Unchanged behavior.
router.get('/assignees', async (_req, res) => {
  try {
    const employees = await fetchMonthlyEmployees();
    const result = employees
      .filter((e) => ALLOWED_DEPARTMENTS.includes(e.department))
      .map(toAssignee)
      .sort(byDeptThenName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// All active monthly employees (every department) — drives the Access Control
// "link to employee" picker.
router.get('/directory', async (_req, res) => {
  try {
    const employees = await fetchMonthlyEmployees();
    const result = employees.map(toDirectoryEntry).sort(byDeptThenName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
