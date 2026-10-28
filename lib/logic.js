/*
 * Nusa shared logic.
 * The website, the dashboard and the server all load this same file, so a change
 * gives the same result everywhere. All the shop's data lives in one "state" object:
 * products, pickup settings, orders, catering requests and chats.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NusaLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = 4;

  /* ---------- dates, always in San Francisco time ---------- */
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function today() {
    try {
      var p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    } catch (e) {}
    return iso(new Date());
  }
  function monday(off, base) { var d = parse(base || today()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * (off || 0)); return iso(d); }
  function longDate(s) { return parse(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
  function money(n) { n = Math.round(n * 100) / 100; return "$" + (n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function token() { var s = ""; for (var i = 0; i < 3; i++) s += Math.random().toString(36).slice(2, 10); return s.slice(0, 24); }
  function clean(v, n) { return typeof v === "string" ? v.trim().slice(0, n) : ""; }
  function copy(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---------- the way Nusa sells ---------- */
  function basePoints() {
    return {
      market: { name: "Farmers market", place: "Ferry Plaza, 1 Ferry Building #50", hours: "8 am to 2 pm", days: [6], slots: ["8 to 10 am", "10 am to 12 pm", "12 to 2 pm"], cap: 60, on: true, done: "Picked up" },
      kitchen: { name: "Kitchen pickup", place: "Dogpatch kitchen, 3450 3rd St, Suite 4A", hours: "5 to 6 pm", days: [4], slots: ["5 to 6 pm"], cap: 25, on: true, done: "Picked up" },
      hub: { name: "HubShop", place: "HubShop pickup spots around the Bay", hours: "Afternoon", days: [4, 5], slots: ["Afternoon window"], cap: 30, on: true, done: "Dropped off" },
      delivery: { name: "Delivery", place: "Delivered by Neon", hours: "Afternoon", days: [4, 5], slots: ["Afternoon window"], cap: 20, on: true, done: "Delivered" }
    };
  }
  var PORDER = ["kitchen", "market", "hub", "delivery"];
  function P(id, name, cat, sizes, on) { return { id: id, name: name, cat: cat, img: id, sizes: sizes.map(function (s, i) { return { id: id + "-" + i, label: s[0], price: s[1], on: on !== false }; }) }; }
  function baseProducts() {
    return [
      P("lapis", "1000 Layer Cake", "classic", [["Small", 26], ["Whole", 149]]),
      P("chiffon", "Pandan Chiffon Cake", "classic", [["Quarter", 10], ["Whole 10 inch", 39]]),
      P("klepon", "Klepon", "vgf", [["Box", 9.5]], false),
      P("mochi", "Pandan Coconut Mochi Layer", "vgf", [["Box", 9.5]]),
      P("custard", "Sweet Rice Pandan Custard", "gf", [["Single", 8], ["Tray", 23.25]]),
      P("cassava", "Cassava Brûlée", "gf", [["Single", 5]]),
      P("mochibar", "Baked Pandan Coconut Mochi Bar", "gf", [["Single", 6.5], ["Box", 19]]),
      P("lemper", "Lemper Ayam", "gf", [["Small", 15], ["Large", 43]]),
      P("sampler", "Chef’s Choice Dessert Sampler", "box", [["Box of 4", 14.95]]),
      P("rendang", "Beef Rendang", "sav", [["Pack", 30]]),
      P("jackfruit", "Jackfruit Rendang", "sav", [["Pack", 30]]),
      P("pastel", "Pastel", "sav", [["Pack of 3", 10.5]]),
      P("acar", "Acar", "sav", [["Jar", 4.95]])
    ];
  }
  function sizeIndex(products) { var m = {}; (products || []).forEach(function (p) { p.sizes.forEach(function (z) { m[z.id] = { p: p, z: z }; }); }); return m; }
  function live(o) { return o.status !== "cancelled" && !o.declined; }
  function oTotal(o, ix) { return o.items.reduce(function (a, i) { var m = ix[i.s]; return a + (m ? m.z.price : i.price || 0) * i.q; }, 0); }
  function firstName(n) { return String(n || "").trim().split(" ")[0] || "there"; }
  function slotDay(o) { return longDate(o.date) + (o.slot ? ", " + o.slot : ""); }

  /* ---------- sample data ---------- */
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var PEOPLE = [["Maya Lin", "415-555-0142"], ["Daniel Ortiz", "510-555-0188"], ["Priya Shah", "628-555-0120"], ["Tom Becker", "415-555-0199"], ["Aiko Tanaka", "415-555-0176"], ["Rosa Delgado", "650-555-0133"], ["Chris Wu", "415-555-0111"], ["Grace Park", "415-555-0154"], ["Ben Hartono", "415-555-0163"], ["Laura Kim", "510-555-0102"], ["Sam Rivera", "415-555-0117"], ["Nadia Rahman", "628-555-0145"], ["Owen Fischer", "415-555-0128"], ["Lily Chen", "650-555-0191"], ["Marco Rossi", "415-555-0182"], ["Hana Wijaya", "510-555-0137"], ["Jess Morgan", "415-555-0156"], ["Eli Brooks", "628-555-0109"], ["Mei Huang", "415-555-0170"], ["Ravi Patel", "510-555-0124"], ["Clara Dubois", "415-555-0193"], ["Kenji Sato", "650-555-0115"], ["Sofia Alvarez", "415-555-0138"], ["Noah Green", "628-555-0166"], ["Dewi Santoso", "415-555-0147"], ["Leah Cohen", "510-555-0159"]];
  var NOTES = ["Birthday gift, please add a card", "Will send a friend to pick up", "Less sweet if possible", "Running late, before 2 pm", "Extra napkins please", "Leave with the front desk", "Gate code 4412"];
  function seed() {
    var T = today(), r = rng(1801), ord = [], id = 1001, prods = baseProducts(), pts = basePoints(), threads = {};
    function pickP() { var w = r() < .6 ? Math.floor(r() * 8) : Math.floor(r() * PEOPLE.length); return PEOPLE[w]; }
    function items() { var n = 1 + Math.floor(r() * 3), out = [], used = {}; for (var k = 0; k < n; k++) { var p = prods[Math.floor(r() * prods.length)]; if (used[p.id] || p.id === "klepon") continue; used[p.id] = 1; var z = p.sizes[r() < .75 ? 0 : p.sizes.length - 1]; out.push({ s: z.id, q: 1 + (r() < .3 ? 1 : 0) }); } return out.length ? out : [{ s: "sampler-0", q: 1 }]; }
    function make(date, pt) {
      var c = pickP(), on = r() < .75, past = date < T;
      var st = past ? (r() < .04 ? "cancelled" : "done") : (date === T ? (r() < .5 ? "packed" : "new") : (r() < .18 ? "packed" : "new"));
      var P0 = pts[pt];
      ord.push({ id: id++, date: date, point: pt, loc: pt === "hub" ? "HubShop, Mission District" : pt === "delivery" ? "San Francisco" : "", slot: P0.slots[Math.floor(r() * P0.slots.length)], name: c[0], phone: c[1], items: items(), note: r() < .16 ? NOTES[Math.floor(r() * NOTES.length)] : "", source: on ? "online" : "by hand", paid: on || r() < .5, status: st, placed: Date.now() - Math.floor(r() * 6) * 864e5 });
    }
    for (var w = -9; w <= 1; w++) {
      var mon = monday(w, T), thu = addDays(mon, 3), fri = addDays(mon, 4), sat = addDays(mon, 5);
      var k = w === 1 ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 4), m = w === 1 ? 2 + Math.floor(r() * 3) : 6 + Math.floor(r() * 7), h = w === 1 ? 0 : 1 + Math.floor(r() * 3), d = w === 1 ? 0 : 1 + Math.floor(r() * 3), i;
      for (i = 0; i < k; i++) make(thu, "kitchen"); for (i = 0; i < m; i++) make(sat, "market"); for (i = 0; i < h; i++) make(fri, "hub"); for (i = 0; i < d; i++) make(fri, "delivery");
    }
    // Two fresh online orders waiting for a yes, each with its chat.
    var nextSat = addDays(monday(0, T), 5); if (nextSat <= T) nextSat = addDays(nextSat, 7);
    var now = Date.now();
    [["Indah Wulandari", "415-555-0181", [{ s: "lapis-1", q: 1 }, { s: "custard-1", q: 1 }], "It's for my mom's birthday. Could you write Selamat Ulang Tahun on the box?"],
     ["Kevin Tran", "628-555-0172", [{ s: "sampler-0", q: 2 }, { s: "rendang-0", q: 1 }], ""]].forEach(function (x, n) {
      var t = token(), o = { id: id++, token: t, date: nextSat, point: "market", loc: "", slot: pts.market.slots[n], name: x[0], phone: x[1], email: "", items: x[2], note: "", source: "online", paid: false, status: "new", pending: true, placed: now - (n + 1) * 36e5 };
      ord.push(o);
      var msgs = [{ id: uid(), from: "nusa", text: "Thank you, " + firstName(o.name) + "! We have your order and will confirm it shortly. Message us here if you need anything.", at: o.placed }];
      if (x[3]) msgs.push({ id: uid(), from: "customer", text: x[3], at: o.placed + 6e4 });
      threads["o-" + o.id] = { id: "o-" + o.id, token: t, name: o.name, phone: o.phone, orderId: o.id, msgs: msgs, staffSeen: 1, custSeen: msgs.length, at: msgs[msgs.length - 1].at };
    });
    threads["c-sample"] = { id: "c-sample", token: token(), name: "Website visitor", msgs: [{ id: uid(), from: "customer", text: "Hi! Will you have klepon at the market this Saturday?", at: now - 2 * 36e5 }], staffSeen: 0, custSeen: 1, at: now - 2 * 36e5 };
    var cat = [
      { event: "Fundraiser night", org: "Mission Library Friends", contact: "Sam Ortega", phone: "415-555-0123", email: "sam@mlf.example", date: addDays(T, 4), time: "6:00 pm", guests: 60, mode: "Delivery", address: "300 Bartlett St, San Francisco", diet: "None", menu: "Individual dessert boxes x60", quote: 900, notes: "Boxes individually labeled. Set up by 5:30.", status: "confirmed", got: -12 },
      { event: "Team lunch", org: "Northbeam Studio", contact: "Jules Hart", phone: "415-555-0101", email: "jules@northbeam.example", date: addDays(T, 11), time: "11:30 am", guests: 40, mode: "Delivery", address: "Near the Embarcadero", diet: "4 vegetarian, 1 nut allergy", menu: "Beef rendang tray, jackfruit rendang tray, pandan custard platter", quote: 0, notes: "Asked for something everyone can share.", status: "new", got: 0 },
      { event: "Open house", org: "Dogpatch Makers Collective", contact: "Ava Lindqvist", phone: "628-555-0177", email: "ava@dogpatchmakers.example", date: addDays(T, 19), time: "4:00 pm", guests: 80, mode: "Pickup", address: "", diet: "Mostly vegetarian", menu: "Plated desserts, sampler boxes", quote: 0, notes: "Budget around $1,000.", status: "new", got: -1 },
      { event: "Wedding dessert table", org: "Lestari and Park wedding", contact: "Dewi Lestari", phone: "510-555-0166", email: "dewi@lestari.example", date: addDays(T, 33), time: "7:00 pm", guests: 120, mode: "Delivery", address: "Fort Mason, San Francisco", diet: "Halal", menu: "Whole 1000 layer cake as centerpiece, plated desserts for 120", quote: 1720, notes: "Sent quote with two options. Waiting on their pick.", status: "quoted", got: -5 },
      { event: "Staff party", org: "Oakline Dental", contact: "Hana Cho", phone: "510-555-0148", email: "hana@oakline.example", date: addDays(T, -10), time: "12:00 pm", guests: 25, mode: "Pickup", address: "", diet: "None", menu: "Dessert boxes x25", quote: 410, notes: "", status: "done", got: -30 },
      { event: "Quarterly offsite", org: "Pier 9 Design", contact: "Marcus Bell", phone: "415-555-0131", email: "marcus@pier9.example", date: addDays(T, -24), time: "12:30 pm", guests: 50, mode: "Delivery", address: "Pier 9, San Francisco", diet: "6 vegan", menu: "Rendang trays x3, pandan custard platters x2", quote: 1150, notes: "", status: "done", got: -40 },
      { event: "Lunar New Year lunch", org: "Sunset Tech Hub", contact: "Iris Fong", phone: "415-555-0174", email: "iris@sunsethub.example", date: addDays(T, -52), time: "12:00 pm", guests: 35, mode: "Delivery", address: "Irving St, San Francisco", diet: "None", menu: "Beef rendang trays x2, dessert boxes x35", quote: 860, notes: "", status: "done", got: -70 }
    ].map(function (c, i) { c.id = i + 1; c.got = now + c.got * 864e5; return c; });
    return { v: VERSION, products: prods, points: pts, closed: {}, orders: ord, catering: cat, threads: threads, nid: id, cid: 100 };
  }

  /* ---------- notes from Nusa that the customer sees ---------- */
  function nusaNote(s, orderId, text, at) {
    var th = threadForOrder(s, orderId); if (!th) return s;
    at = at || Date.now();
    var t = Object.assign({}, th, { msgs: th.msgs.concat([{ id: uid(), from: "nusa", text: text, at: at }]), at: at });
    t.staffSeen = t.msgs.length;
    var threads = Object.assign({}, s.threads); threads[t.id] = t;
    return Object.assign({}, s, { threads: threads });
  }
  function threadForOrder(s, orderId) { var all = s.threads || {}; for (var k in all) if (all[k].orderId === orderId) return all[k]; return null; }
  function threadForCatering(s, cid) { var all = s.threads || {}; for (var k in all) if (all[k].cateringId === cid) return all[k]; return null; }
  function orderOf(s, id) { return s.orders.filter(function (o) { return o.id == id; })[0]; }
  function replaceOrder(s, o) { return Object.assign({}, s, { orders: s.orders.map(function (x) { return x.id === o.id ? o : x; }) }); }

  /* how full a pickup day is */
  function load(s, date, point, skipId) { return s.orders.filter(function (o) { return o.date === date && o.point === point && live(o) && o.id !== skipId; }).length; }
  function dayOpen(s, date, point) {
    var P = s.points[point]; if (!P || !P.on) return "That pickup option is paused right now.";
    if (P.days.indexOf(parse(date).getDay()) < 0) return "That day isn't a pickup day.";
    if (date < addDays(today(), 2)) return "Orders need two days' notice. Please pick a later day.";
    if (s.closed[date + "|" + point]) return "Sorry, that day just closed for online orders. Please pick another day.";
    if (load(s, date, point) >= (P.cap || 999)) return "Sorry, that day just filled up. Please pick another day.";
    return "";
  }

  /* ---------- the dashboard's changes ---------- */
  function applyOp(s, op, now) {
    now = now || Date.now();
    var o, next, out, th;
    switch (op.t) {
      case "reset": return { state: seed() };
      case "add": {
        var ord = copy(op.order); ord.id = s.nid; ord.placed = now; ord.source = "by hand"; ord.status = "new";
        return { state: Object.assign({}, s, { orders: s.orders.concat([ord]), nid: s.nid + 1 }), id: ord.id };
      }
      case "update": {
        o = orderOf(s, op.order.id); if (!o) return { error: "That order was deleted on another device." };
        next = Object.assign({}, o, { date: op.order.date, point: op.order.point, slot: op.order.slot || o.slot, name: clean(op.order.name, 80), phone: clean(op.order.phone, 30), items: op.order.items, note: clean(op.order.note, 300), paid: !!op.order.paid });
        return { state: replaceOrder(s, next) };
      }
      case "delete": return { state: Object.assign({}, s, { orders: s.orders.filter(function (x) { return x.id !== op.id; }) }) };
      case "paid": o = orderOf(s, op.id); if (!o) return { error: "That order is no longer here." }; return { state: replaceOrder(s, Object.assign({}, o, { paid: true })) };
      case "status": {
        o = orderOf(s, op.id); if (!o) return { error: "That order is no longer here." };
        if (o.status === "cancelled" && o.by === "customer" && op.s !== "new") return { error: "The customer cancelled this order." };
        var P = s.points[o.point] || {}, note = "";
        next = Object.assign({}, o);
        if (op.s === "confirm") { next.pending = false; delete next.declined; note = "Your order is confirmed. See you " + slotDay(o) + (o.point === "delivery" ? ". We'll let you know when it's on the way." : " at " + (o.point === "market" ? "the Ferry Plaza market." : o.point === "kitchen" ? "our Dogpatch kitchen." : (o.loc || "your pickup spot") + ".")); }
        else if (op.s === "decline") { next.pending = false; next.declined = clean(op.reason, 300) || "We can't take this order."; note = "Sorry, we can't take this order. " + next.declined; }
        else if (op.s === "packed") { next.pending = false; next.status = "packed"; note = o.point === "delivery" ? "Your order is packed and goes out with Neon on " + longDate(o.date) + "." : "Your order is packed and ready for you, " + slotDay(o) + "."; }
        else if (op.s === "done") { next.pending = false; next.status = "done"; note = o.point === "delivery" ? "Delivered. Enjoy, and thank you for ordering from Nusa." : "Picked up. Enjoy, and thank you for ordering from Nusa."; }
        else if (op.s === "new") { next.status = "new"; delete next.by; }
        else if (op.s === "cancelled") { next.status = "cancelled"; next.by = "nusa"; note = "We cancelled this order. Message us here if you have any questions."; }
        out = replaceOrder(s, next);
        if (note && o.source === "online") out = nusaNote(out, o.id, note, now);
        return { state: out };
      }
      case "products": return { state: Object.assign({}, s, { products: op.products }) };
      case "points": {
        var pts = {};
        for (var k in s.points) {
          var a = s.points[k], b = op.points[k] || a;
          var slots = (b.slots || []).map(function (x) { return clean(x, 40); }).filter(Boolean).slice(0, 8);
          pts[k] = Object.assign({}, a, { on: !!b.on, days: (b.days || []).filter(function (d) { return d >= 0 && d <= 6; }), slots: slots.length ? slots : a.slots, cap: Math.max(1, Math.min(999, +b.cap || a.cap)), place: clean(b.place, 120) || a.place, hours: clean(b.hours, 60) || a.hours });
        }
        return { state: Object.assign({}, s, { points: pts }) };
      }
      case "closed": {
        var c = Object.assign({}, s.closed), key = op.date + "|" + op.point;
        if (op.v) c[key] = true; else delete c[key];
        return { state: Object.assign({}, s, { closed: c }) };
      }
      case "reply": {
        th = s.threads[op.thread]; var text = clean(op.text, 1000);
        if (!th) return { error: "That conversation is gone." };
        if (!text) return { error: "Write a message first." };
        var t = Object.assign({}, th, { msgs: th.msgs.concat([{ id: uid(), from: "nusa", text: text, at: now }]), at: now }); t.staffSeen = t.msgs.length;
        var ts = Object.assign({}, s.threads); ts[t.id] = t; return { state: Object.assign({}, s, { threads: ts }) };
      }
      case "seen": {
        th = s.threads[op.thread]; if (!th || th.staffSeen === th.msgs.length) return { state: s };
        var ts2 = Object.assign({}, s.threads); ts2[th.id] = Object.assign({}, th, { staffSeen: th.msgs.length }); return { state: Object.assign({}, s, { threads: ts2 }) };
      }
      case "csave": {
        var c0 = copy(op.c), list = s.catering.slice(), prev = null, cid = s.cid;
        if (c0.id) { var ix = list.findIndex(function (x) { return x.id === c0.id; }); if (ix < 0) return { error: "That request was deleted on another device." }; prev = list[ix]; c0.got = prev.got; list[ix] = c0; }
        else { c0.id = s.cid; c0.got = now; list.push(c0); cid = s.cid + 1; }
        out = Object.assign({}, s, { catering: list, cid: cid });
        var cth = threadForCatering(out, c0.id);
        if (cth && prev && prev.status !== c0.status) {
          var msg = c0.status === "quoted" ? "Here is your quote for " + c0.guests + " guests on " + longDate(c0.date) + ": " + money(+c0.quote) + ". Reply here to confirm or ask for changes."
            : c0.status === "confirmed" ? "Your catering is confirmed for " + longDate(c0.date) + " at " + c0.time + ". Thank you!" : "";
          if (msg) { var t2 = Object.assign({}, cth, { msgs: cth.msgs.concat([{ id: uid(), from: "nusa", text: msg, at: now }]), at: now }); t2.staffSeen = t2.msgs.length; var ts3 = Object.assign({}, out.threads); ts3[t2.id] = t2; out = Object.assign({}, out, { threads: ts3 }); }
        }
        return { state: out, id: c0.id };
      }
      case "cdel": return { state: Object.assign({}, s, { catering: s.catering.filter(function (x) { return x.id !== op.id; }) }) };
    }
    return { error: "Could not read that change." };
  }
  function isOp(x) {
    if (!x || typeof x !== "object") return false;
    var isOrder = function (v) { return !!v && typeof v === "object" && typeof v.date === "string" && Array.isArray(v.items) && v.items.length <= 50; };
    switch (x.t) {
      case "reset": return true;
      case "add": return isOrder(x.order);
      case "update": return isOrder(x.order) && typeof x.order.id === "number";
      case "delete": case "paid": return typeof x.id === "number";
      case "status": return typeof x.id === "number" && ["confirm", "decline", "packed", "done", "new", "cancelled"].indexOf(x.s) > -1;
      case "products": return Array.isArray(x.products) && x.products.length <= 80;
      case "points": return !!x.points && typeof x.points === "object";
      case "closed": return typeof x.date === "string" && typeof x.point === "string" && typeof x.v === "boolean";
      case "reply": return typeof x.thread === "string" && typeof x.text === "string";
      case "seen": return typeof x.thread === "string";
      case "csave": return !!x.c && typeof x.c === "object";
      case "cdel": return typeof x.id === "number";
    }
    return false;
  }

  /* ---------- the customer's side ---------- */
  function publicView(s) {
    var ld = {};
    s.orders.forEach(function (o) { if (live(o) && o.date >= today()) { var k = o.date + "|" + o.point; ld[k] = (ld[k] || 0) + 1; } });
    var products = s.products.map(function (p) { return { id: p.id, name: p.name, cat: p.cat, img: p.img, photo: p.photo, sizes: p.sizes }; });
    return { products: products, points: s.points, closed: s.closed, load: ld, today: today() };
  }
  function mineView(s, keys) {
    var ok = function (id, tk, list) { return !!tk && list.some(function (k) { return k.id == id && k.token === tk; }); };
    var orders = s.orders.filter(function (o) { return o.token && ok(o.id, o.token, keys.orders || []); });
    var ids = orders.map(function (o) { return o.id; });
    var threads = Object.keys(s.threads || {}).map(function (k) { return s.threads[k]; }).filter(function (t) { return ok(t.id, t.token, keys.threads || []) || (t.orderId && ids.indexOf(t.orderId) > -1); });
    return { orders: orders, threads: threads, points: s.points };
  }
  function applyCustomer(s, op, now) {
    now = now || Date.now();
    var th, threads, msgs;
    switch (op.t) {
      case "place": {
        var o = op.order || {}, tk = op.token;
        if (!tk || tk.length < 16) return { error: "Please refresh the page and try again." };
        var name = clean(o.name, 80), phone = clean(o.phone, 30);
        if (!name) return { error: "Add your name." };
        if (phone.replace(/\D/g, "").length < 7) return { error: "Add a phone number so we can reach you." };
        if (!s.points[o.point]) return { error: "Pick how you'd like to get your order." };
        var shut = dayOpen(s, String(o.date), o.point); if (shut) return { error: shut };
        var ix = sizeIndex(s.products), items = [];
        (o.items || []).slice(0, 30).forEach(function (i) { var q = Math.max(1, Math.min(50, +i.q || 1)); if (ix[i.s]) items.push({ s: i.s, q: q }); });
        if (!items.length) return { error: "Your cart is empty." };
        var off = items.filter(function (i) { return !ix[i.s].z.on; })[0];
        if (off) return { error: ix[off.s].p.name + " just sold out. Please remove it and try again." };
        var ord = { id: s.nid, token: tk, date: String(o.date), point: o.point, loc: clean(o.loc, 80), slot: clean(o.slot, 40), name: name, phone: phone, email: clean(o.email, 80), items: items, note: clean(o.note, 300), source: "online", paid: false, status: "new", pending: true, placed: now };
        var t = { id: "o-" + ord.id, token: tk, name: name, phone: phone, orderId: ord.id, at: now, staffSeen: 1, custSeen: 1, msgs: [{ id: uid(), from: "nusa", text: "Thank you, " + firstName(name) + "! We have your order and will confirm it shortly. Message us here if you need anything.", at: now }] };
        if (ord.note) { t.msgs.push({ id: uid(), from: "customer", text: ord.note, at: now }); t.custSeen = 2; }
        threads = Object.assign({}, s.threads); threads[t.id] = t;
        return { state: Object.assign({}, s, { orders: s.orders.concat([ord]), nid: s.nid + 1, threads: threads }), id: ord.id };
      }
      case "cater": {
        var r = op.req || {}, tk2 = op.token;
        if (!tk2 || tk2.length < 16) return { error: "Please refresh the page and try again." };
        var cname = clean(r.contact, 80), cphone = clean(r.phone, 30), cemail = clean(r.email, 80);
        if (!cname) return { error: "Add your name." };
        if (!cemail && cphone.replace(/\D/g, "").length < 7) return { error: "Add an email or phone so we can send your quote." };
        if (s.catering.length > 500) return { error: "Requests are paused right now. Please email us." };
        var c = { id: s.cid, event: clean(r.event, 80) || "Event", org: clean(r.org, 80) || cname, contact: cname, phone: cphone, email: cemail, date: clean(r.date, 10), time: clean(r.time, 20) || "12:00 pm", guests: Math.max(1, Math.min(2000, +r.guests || 10)), mode: r.mode === "Pickup" ? "Pickup" : "Delivery", address: clean(r.address, 160), diet: clean(r.diet, 120) || "None", menu: clean(r.menu, 400), quote: 0, estimate: +r.estimate || 0, notes: clean(r.notes, 400), status: "new", got: now, source: "online" };
        var ct = { id: "k-" + c.id, token: tk2, name: cname, phone: cphone, cateringId: c.id, at: now, staffSeen: 1, custSeen: 1, msgs: [{ id: uid(), from: "nusa", text: "Thank you, " + firstName(cname) + "! We have your catering request for " + c.guests + " guests and will send a quote within a day. Ask us anything here.", at: now }] };
        threads = Object.assign({}, s.threads); threads[ct.id] = ct;
        return { state: Object.assign({}, s, { catering: s.catering.concat([c]), cid: s.cid + 1, threads: threads }), id: c.id, thread: ct.id };
      }
      case "say": {
        var text = clean(op.text, 1000); if (!text) return { error: "Write a message first." };
        threads = Object.assign({}, s.threads); th = threads[op.thread];
        if (th && th.token !== op.token) return { error: "That conversation could not be found." };
        if (!th) {
          if (!op.token || op.token.length < 16 || !/^c-[a-z0-9]{6,30}$/.test(op.thread)) return { error: "Please refresh the page and try again." };
          if (Object.keys(threads).length > 3000) return { error: "Messages are paused right now. Please email us." };
          th = { id: op.thread, token: op.token, name: clean(op.name, 80) || "Website visitor", msgs: [], staffSeen: 0, custSeen: 0, at: now };
        }
        if (th.msgs.length >= 300) return { error: "This conversation is full. Please email us." };
        if (op.name && th.name === "Website visitor") th = Object.assign({}, th, { name: clean(op.name, 80) });
        msgs = th.msgs.concat([{ id: uid(), from: "customer", text: text, at: now }]);
        threads[th.id] = Object.assign({}, th, { msgs: msgs, custSeen: msgs.length, at: now });
        return { state: Object.assign({}, s, { threads: threads }) };
      }
      case "cancel": {
        var x = orderOf(s, op.id);
        if (!x || !x.token || x.token !== op.token) return { error: "That order could not be found." };
        if (x.status === "cancelled") return { state: s };
        if (x.status === "done") return { error: "This order was already picked up." };
        if (x.status === "packed") return { error: "Your order is already packed. Please message us instead." };
        var out = replaceOrder(s, Object.assign({}, x, { status: "cancelled", by: "customer", pending: false }));
        th = threadForOrder(out, x.id);
        if (th) { msgs = th.msgs.concat([{ id: uid(), from: "customer", text: "I cancelled this order.", at: now }]); var ts = Object.assign({}, out.threads); ts[th.id] = Object.assign({}, th, { msgs: msgs, custSeen: msgs.length, at: now }); out = Object.assign({}, out, { threads: ts }); }
        return { state: out };
      }
      case "read": {
        th = (s.threads || {})[op.thread];
        if (!th || th.token !== op.token || th.custSeen === th.msgs.length) return { state: s };
        threads = Object.assign({}, s.threads); threads[th.id] = Object.assign({}, th, { custSeen: th.msgs.length });
        return { state: Object.assign({}, s, { threads: threads }) };
      }
    }
    return { error: "Could not read that." };
  }
  function isCOp(x) {
    if (!x || typeof x !== "object") return false;
    switch (x.t) {
      case "place": return !!x.order && typeof x.order === "object" && Array.isArray(x.order.items) && typeof x.token === "string";
      case "cater": return !!x.req && typeof x.req === "object" && typeof x.token === "string";
      case "say": return typeof x.thread === "string" && typeof x.token === "string" && typeof x.text === "string";
      case "cancel": return typeof x.id === "number" && typeof x.token === "string";
      case "read": return typeof x.thread === "string" && typeof x.token === "string";
    }
    return false;
  }

  /* what the customer sees on their order page */
  function customerStage(o) {
    if (o.declined) return { k: "declined", t: "Nusa couldn't take this order", step: -1 };
    if (o.status === "cancelled") return { k: "cancelled", t: o.by === "customer" ? "You cancelled this order" : "This order was cancelled", step: -1 };
    if (o.status === "done") return { k: "done", t: o.point === "delivery" ? "Delivered" : "Picked up", step: 3 };
    if (o.status === "packed") return { k: "packed", t: o.point === "delivery" ? "Packed, going out with Neon" : "Packed and ready for you", step: 2 };
    if (o.pending) return { k: "pending", t: "Sent. Waiting for Nusa to confirm", step: 0 };
    return { k: "confirmed", t: "Confirmed", step: 1 };
  }

  return { VERSION: VERSION, iso: iso, parse: parse, addDays: addDays, today: today, monday: monday, longDate: longDate, money: money, uid: uid, token: token, copy: copy,
    basePoints: basePoints, PORDER: PORDER, baseProducts: baseProducts, sizeIndex: sizeIndex, live: live, oTotal: oTotal, seed: seed, dayOpen: dayOpen, load: load,
    applyOp: applyOp, isOp: isOp, publicView: publicView, mineView: mineView, applyCustomer: applyCustomer, isCOp: isCOp, customerStage: customerStage, threadForOrder: threadForOrder, threadForCatering: threadForCatering };
});
