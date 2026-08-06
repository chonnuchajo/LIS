const ApiPolicyMode = require('../models/ApiPolicyMode');

function resolveMode(modes, policy) {
  return (modes && modes[policy.id]) || policy.defaultMode;
}

// แคชในหน่วยความจำ: middleware อ่านทุก request ที่ตรง policy จึงไม่ควรยิง DB ทุกครั้ง
// รีเฟรชเมื่อ (ก) แก้ผ่าน API → invalidate() หรือ (ข) เลย TTL (เผื่อมีคนแก้ DB ตรงๆ)
function createModeCache({ load, ttlMs = 30000, now = () => Date.now() }) {
  let cache = null;
  let loadedAt = 0;
  let inflight = null;

  async function get() {
    if (cache && now() - loadedAt < ttlMs) return cache;
    if (!inflight) {
      inflight = Promise.resolve()
        .then(load)
        .then((value) => {
          cache = value || {};
          loadedAt = now();
          inflight = null;
          return cache;
        })
        .catch((err) => {
          inflight = null;
          throw err;
        });
    }
    return inflight;
  }

  function invalidate() {
    cache = null;
    loadedAt = 0;
  }

  return { get, invalidate };
}

async function loadModesFromDb() {
  const docs = await ApiPolicyMode.find().lean();
  return Object.fromEntries(docs.map((d) => [d.policyId, d.mode]));
}

const modeCache = createModeCache({ load: loadModesFromDb });

module.exports = { createModeCache, resolveMode, loadModesFromDb, modeCache };
