function clean(value) {
  return String(value ?? '').trim();
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function usableName(name, email) {
  const value = clean(name);
  if (!value) return '';
  if (email && value.toLowerCase() === clean(email).toLowerCase()) return '';
  if (isEmailLike(value)) return '';
  return value;
}

function normalizeActorFields(input = {}, storedUser = {}) {
  const email = clean(input.email || storedUser.email).toLowerCase();
  const submittedName = usableName(input.name, email);
  const storedName = usableName(storedUser.name, email);
  const fallbackName = clean(input.name || storedUser.name);
  return {
    email,
    name: submittedName || storedName || (isEmailLike(fallbackName) ? '' : fallbackName),
  };
}

module.exports = { normalizeActorFields, usableName };
