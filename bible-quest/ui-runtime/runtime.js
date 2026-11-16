// Runs inside the sandboxed iframe. SOURCE is the widget code from the database.
(function () {
  var P = htmPreact;
  var html = P.html;
  var root = document.getElementById("root");
  var state = { data: null, ctx: {} };
  var failed = false;

  function send(m) {
    m.bq = 1;
    parent.postMessage(m, "*");
  }
  function fail(e) {
    failed = true;
    send({ t: "error", message: String((e && e.message) || e), stack: String((e && e.stack) || "") });
  }
  window.addEventListener("error", function (e) { fail(e.error || e.message); });
  window.addEventListener("unhandledrejection", function (e) { fail(e.reason); });

  var COLORS = { Fire: "#f97316", Water: "#38bdf8", Plant: "#4ade80", Ground: "#c2a878", Air: "#a5f3fc", Ice: "#bae6fd", Lightning: "#fde047", Metal: "#cbd5e1", Poison: "#c084fc", Spore: "#a3a380", Crystal: "#f0abfc", Star: "#fbbf24" };

  var ui = {
    color: function (element) { return COLORS[element] || "#a8a29e"; },
    Tick: function () { return html`<span class="tick">✓</span>`; },
    Input: function (p) {
      return html`<input class="input" value=${p.value || ""} placeholder=${p.placeholder || ""} disabled=${p.disabled} onInput=${function (e) { p.onInput(e.target.value); }} />`;
    },
    // A textarea that grows with its text.
    Area: function (p) {
      var ref = P.useRef(null);
      P.useLayoutEffect(function () {
        var el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + 2 + "px";
      });
      return html`<textarea ref=${ref} class="area" rows=${p.rows || 2} placeholder=${p.placeholder || ""} disabled=${p.disabled} value=${p.value || ""} onInput=${function (e) { p.onInput(e.target.value); }}></textarea>`;
    },
    // options: strings or { value, label, color, hint }. multi=true makes value an array.
    Chips: function (p) {
      var opts = (p.options || []).map(function (o) { return typeof o === "string" ? { value: o, label: o } : o; });
      var isOn = function (v) { return p.multi ? (p.value || []).indexOf(v) !== -1 : p.value === v; };
      var pick = function (v) {
        if (!p.multi) return p.onChange(isOn(v) ? undefined : v);
        var cur = p.value || [];
        p.onChange(isOn(v) ? cur.filter(function (x) { return x !== v; }) : cur.concat([v]));
      };
      return html`<div class="row wrap" style="gap:6px">${opts.map(function (o) {
        return html`<button type="button" key=${o.value} class=${"chip" + (isOn(o.value) ? " on" : "")} title=${o.hint || ""} disabled=${p.disabled || o.disabled} onClick=${function () { pick(o.value); }}>
          ${o.color ? html`<span class="dot" style=${"background:" + o.color}></span>` : null}${o.label}
        </button>`;
      })}</div>`;
    },
  };

  var mod;
  try {
    var make = new Function(
      "html", "ui", "useState", "useEffect", "useMemo", "useRef", "useCallback",
      SOURCE + '\n;return { Widget: typeof Widget !== "undefined" ? Widget : null, meta: typeof meta !== "undefined" ? meta : null };'
    );
    mod = make(html, ui, P.useState, P.useEffect, P.useMemo, P.useRef, P.useCallback);
    if (typeof mod.Widget !== "function") throw new Error("The code must define function Widget({ data, save, ctx })");
  } catch (e) {
    fail(e);
    return;
  }

  function pushMeta() {
    if (!mod.meta) return;
    try { send({ t: "meta", meta: mod.meta(state.data, state.ctx) }); } catch (e) { fail(e); }
  }
  function save(next) {
    state.data = typeof next === "function" ? next(state.data) : next;
    send({ t: "save", data: state.data });
    pushMeta();
    draw();
  }
  function draw() {
    if (failed) return;
    try {
      P.render(html`<${mod.Widget} data=${state.data} ctx=${state.ctx} save=${save} />`, root);
    } catch (e) { fail(e); }
  }

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.bq !== 1 || e.source !== parent) return;
    if (m.t === "init" || m.t === "data") {
      state.data = m.data;
      if (m.ctx) state.ctx = m.ctx;
      draw();
      if (m.t === "init") pushMeta();
    }
  });
  new ResizeObserver(function () { send({ t: "height", h: Math.ceil(document.documentElement.getBoundingClientRect().height) + 4 }); }).observe(document.documentElement);
  send({ t: "ready" });
})();
