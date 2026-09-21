const pending = new Map();

// ponytail: single Node server; use DB transactions before running multiple API processes.
function serializePetitionWrite(handler) {
  return (req, res, next) => {
    const rawKey = String(req.params?.id || req.body?.petitionId || '');
    const key = /^[a-f0-9]{24}$/i.test(rawKey) ? rawKey.toLowerCase() : rawKey;
    const previous = pending.get(key) || Promise.resolve();
    const task = previous.catch(() => {}).then(() => handler(req, res, next));
    pending.set(key, task);
    return task.finally(() => { if (pending.get(key) === task) pending.delete(key); });
  };
}

module.exports = { serializePetitionWrite };
