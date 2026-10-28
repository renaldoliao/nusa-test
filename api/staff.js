// The kitchen's side. Every request must carry the staff password, so customers'
// names and phone numbers are never visible to the public.
const db = require("../lib/db");
const L = require("../lib/logic");
const { send, body } = require("../lib/http");

const staffOk = (req) => req.headers["x-nusa-key"] === (process.env.NUSA_STAFF_KEY || "nusa2026");

module.exports = async (req, res) => {
  if (!db.enabled()) return send(res, 200, { enabled: false });
  if (!staffOk(req)) return send(res, 401, { enabled: true, error: "That password isn't right." });
  try {
    if (req.method === "GET") {
      const since = Number(new URL(req.url, "http://x").searchParams.get("v") || 0);
      if (since === -1) return send(res, 200, { enabled: true, ok: true });
      if (since && (await db.version()) === since) return send(res, 200, { enabled: true, same: true });
      return send(res, 200, Object.assign({ enabled: true }, await db.read()));
    }
    if (req.method !== "POST") return send(res, 405, { error: "Not allowed." });
    let b;
    try { b = await body(req, 4000000); } catch (e) { return send(res, e.big ? 413 : 400, { error: e.big ? "That change is too large." : "Could not read that change." }); }
    if (!L.isOp(b && b.op)) return send(res, 400, { error: "Could not read that change." });
    const r = await db.mutate((s) => L.applyOp(s, b.op, Date.now()));
    return send(res, 200, Object.assign({ enabled: true }, r));
  } catch (e) {
    console.error("staff api failed", e);
    return send(res, 503, { enabled: true, error: "Could not reach the database. Please try again." });
  }
};
