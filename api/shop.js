// The customer's side. Anyone can read the menu and pickup days. Orders and chats
// are only returned to the device that holds their private key.
const db = require("../lib/db");
const L = require("../lib/logic");
const { send, body } = require("../lib/http");

const keys = (v) => (Array.isArray(v) ? v.slice(0, 40).filter((k) => k && (typeof k.id === "string" || typeof k.id === "number") && typeof k.token === "string") : []);

module.exports = async (req, res) => {
  if (!db.enabled()) return send(res, 200, { enabled: false });
  try {
    if (req.method === "GET") {
      const { state, version } = await db.read();
      return send(res, 200, { enabled: true, version, view: L.publicView(state) });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Not allowed." });
    let b;
    try { b = await body(req, 100000); } catch (e) { return send(res, 400, { error: "Could not read that." }); }
    if (b && b.mine) {
      // Nothing changed since this device last looked: answer in a few bytes.
      if (b.since && (await db.version()) === Number(b.since)) return send(res, 200, { enabled: true, same: true, version: Number(b.since) });
      const { state, version } = await db.read();
      return send(res, 200, Object.assign({ enabled: true, version }, L.mineView(state, { orders: keys(b.mine.orders), threads: keys(b.mine.threads) })));
    }
    if (!L.isCOp(b && b.cop)) return send(res, 400, { error: "Could not read that." });
    const r = await db.mutate((s) => L.applyCustomer(s, b.cop, Date.now()));
    if (r.error) return send(res, 200, { enabled: true, error: r.error, view: L.publicView(r.state) });
    return send(res, 200, { enabled: true, ok: true, id: r.id, thread: r.thread, view: L.publicView(r.state) });
  } catch (e) {
    console.error("shop api failed", e);
    return send(res, 503, { enabled: true, error: "Could not reach Nusa right now. Please try again." });
  }
};
