const employeeDirectory = require('./employeeDirectory');
const { findEmployeeByEmail, findEmployeeById, findEmployeeByName } = require('./employeeLink');

function clean(value) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function actorSnapshot(input, employee) {
  const source = input || {};
  if (!employee) {
    return {
      ...source,
      employeeId: clean(source.employeeId),
      name: clean(source.name),
      email: clean(source.email)?.toLowerCase(),
      department: clean(source.department),
    };
  }
  return {
    ...source,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email || clean(source.email)?.toLowerCase(),
    department: employee.department || clean(source.department),
    position: employee.position || clean(source.position),
  };
}

async function resolveEmployeeActor(input) {
  const source = input || {};
  const email = clean(source.email)?.toLowerCase();
  const employeeId = clean(source.employeeId);
  const name = clean(source.name);
  if (!email && !employeeId && !name) return actorSnapshot(source);

  try {
    const employees = await employeeDirectory.fetchActiveEmployees();
    const employee =
      findEmployeeByEmail(employees, email) ||
      findEmployeeById(employees, employeeId) ||
      findEmployeeByName(employees, name);
    return actorSnapshot(source, employee);
  } catch (error) {
    console.warn('[employeeResolver] HR lookup skipped:', error.message);
    return actorSnapshot(source);
  }
}

module.exports = { actorSnapshot, resolveEmployeeActor };
