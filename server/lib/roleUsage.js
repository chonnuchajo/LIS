function roleInUse(users, roleId) {
  return (users || []).some((u) => {
    const ids = Array.isArray(u.roleIds) && u.roleIds.length ? u.roleIds : (u.roleId ? [u.roleId] : []);
    return ids.includes(roleId);
  });
}

module.exports = { roleInUse };
