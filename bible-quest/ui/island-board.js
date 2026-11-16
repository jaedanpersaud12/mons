// title: Island board: sources grouped by island
// Live UI for the island skeleton quest. Same data as the built-in board:
//   { islands: { [slotId]: { element, island, biome, inspiration, stone, mons } } }
// ctx.slots is the route (home, tier 1, midpoint, ...), ctx.elements the island elements.

var STAGE = { "Home": "Start", "Tier 1": "First boat", "Midpoint": "Midpoint", "Tier 2": "Reef hull", "Reveal": "Reveal", "Tier 3": "Storm sail", "Ruined": "Finale" };
var STAGE_ORDER = ["Start", "First boat", "Midpoint", "Reef hull", "Reveal", "Storm sail", "Finale"];
var UNPLACED = "Not placed yet";

function isDone(slot, i) {
  var rel = !!(i.mons || "").trim() && (slot.noStone || !!(i.stone || "").trim());
  return !!(i.biome || "").trim() && rel && (slot.noStone || (!!i.element && !!(i.island || "").trim()));
}

function Source(p) {
  var slot = p.slot, i = p.value, set = p.set, ctx = p.ctx;
  var done = isDone(slot, i);
  var color = slot.noStone ? "#a8a29e" : ui.color(i.element);
  var picks = slot.group === "Tier 1" ? ctx.elements.filter(function (e) { return ctx.starters.indexOf(e) !== -1; }) : ctx.elements;
  var others = p.islandNames.filter(function (n) { return n !== (i.island || "").trim(); });

  return html`
    <div class=${"card" + (done ? " done" : "")}>
      <button type="button" class="row between" style="width:100%;background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-align:left" onClick=${p.toggle}>
        <span class="row grow" style="gap:10px">
          <span class="badge" style=${"background:" + color + "22;color:" + color}>
            <span style=${"width:8px;height:8px;border-radius:50%;background:" + color}></span>
            ${slot.noStone ? "No stone" : i.element || "No element"}
          </span>
          <span class="small muted" style="white-space:nowrap">${STAGE[slot.group]}</span>
          <span class="small grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.biome || html`<span class="dim">No biome yet</span>`}</span>
        </span>
        <span class="row">${done ? html`<${ui.Tick} />` : null}<span class="dim">${p.open ? "–" : "+"}</span></span>
      </button>

      ${p.open
        ? html`<div class="stack fade" style="margin-top:12px">
            ${slot.noStone
              ? null
              : html`<div>
                  <p class="label" style="margin-bottom:6px">Element${slot.group === "Tier 1" ? " · a starter's home" : ""}</p>
                  <${ui.Chips}
                    disabled=${ctx.disabled}
                    value=${i.element}
                    onChange=${function (v) { set({ element: v }); }}
                    options=${picks.map(function (e) { return { value: e, label: e, color: ui.color(e), hint: p.used.indexOf(e) !== -1 && e !== i.element ? "Used by another source" : "" }; })}
                  />
                </div>`}
            ${slot.noStone || !others.length
              ? null
              : html`<div>
                  <p class="label" style="margin-bottom:6px">Move to another island</p>
                  <${ui.Chips} disabled=${ctx.disabled} value=${undefined} onChange=${function (v) { if (v) set({ island: v }); }} options=${others.concat(["New island"])} />
                </div>`}
            <div class="grid2">
              <div><p class="label" style="margin-bottom:6px">Biome</p><${ui.Input} value=${i.biome} disabled=${ctx.disabled} placeholder="e.g. reef shallows" onInput=${function (v) { set({ biome: v }); }} /></div>
              <div><p class="label" style="margin-bottom:6px">Inspiration · bonus</p><${ui.Input} value=${i.inspiration} disabled=${ctx.disabled} placeholder="A real place, light touch" onInput=${function (v) { set({ inspiration: v }); }} /></div>
            </div>
            ${slot.noStone
              ? null
              : html`<div><p class="label" style="margin-bottom:6px">Its stone · what people say, what they do</p><${ui.Area} value=${i.stone} disabled=${ctx.disabled} placeholder="Faith, economy, law, folk, secret, contested… or something else entirely" onInput=${function (v) { set({ stone: v }); }} /></div>`}
            <div><p class="label" style="margin-bottom:6px">Its mons · how people live with them</p><${ui.Area} value=${i.mons} disabled=${ctx.disabled} placeholder="Partners, revered, resource, feared, rivals… or something else entirely" onInput=${function (v) { set({ mons: v }); }} /></div>
          </div>`
        : null}
    </div>`;
}

function Widget(props) {
  var ctx = props.ctx, save = props.save;
  var islands = (props.data && props.data.islands) || {};
  var slots = ctx.slots || [];
  var view = useState("island"), mode = view[0], setMode = view[1];
  var opened = useState({}), open = opened[0], setOpen = opened[1];

  var set = function (id, patch) {
    save(function (d) {
      var cur = (d && d.islands) || {};
      var next = Object.assign({}, cur);
      next[id] = Object.assign({}, cur[id], patch);
      return Object.assign({}, d, { islands: next });
    });
  };
  var val = function (s) { return islands[s.id] || {}; };
  var sources = slots.filter(function (s) { return !s.noStone; });
  var home = slots.filter(function (s) { return s.noStone; });
  var used = sources.map(function (s) { return val(s).element; }).filter(Boolean);

  // Islands in the order the route first reaches them.
  var names = [];
  sources.forEach(function (s) {
    var n = (val(s).island || "").trim() || UNPLACED;
    if (names.indexOf(n) === -1) names.push(n);
  });
  var realNames = names.filter(function (n) { return n !== UNPLACED; });

  var newIsland = function (id) {
    var n = 1;
    while (realNames.indexOf("New island " + n) !== -1) n++;
    set(id, { island: "New island " + n });
  };
  var row = function (s) {
    return html`<${Source}
      key=${s.id}
      slot=${s}
      value=${val(s)}
      ctx=${ctx}
      used=${used}
      islandNames=${realNames}
      open=${!!open[s.id]}
      toggle=${function () { var o = Object.assign({}, open); o[s.id] = !o[s.id]; setOpen(o); }}
      set=${function (patch) { if (patch.island === "New island") return newIsland(s.id); set(s.id, patch); }}
    />`;
  };
  var rename = function (from, to) {
    save(function (d) {
      var cur = (d && d.islands) || {};
      var next = Object.assign({}, cur);
      sources.forEach(function (s) {
        var n = ((cur[s.id] || {}).island || "").trim() || UNPLACED;
        if (n === from) next[s.id] = Object.assign({}, cur[s.id], { island: to });
      });
      return Object.assign({}, d, { islands: next });
    });
  };

  var doneCount = slots.filter(function (s) { return isDone(s, val(s)); }).length;
  var allOpen = slots.every(function (s) { return open[s.id]; });

  var byIsland = html`
    ${names.map(function (n, idx) {
      var mine = sources.filter(function (s) { return ((val(s).island || "").trim() || UNPLACED) === n; });
      var stages = [];
      mine.forEach(function (s) { if (stages.indexOf(STAGE[s.group]) === -1) stages.push(STAGE[s.group]); });
      return html`<div class="card big fade" key=${"island-" + idx}>
        <div class="row between" style="margin-bottom:10px">
          <div class="row grow">
            ${n === UNPLACED
              ? html`<span class="title muted">${UNPLACED}</span>`
              : html`<input class="input title" style="max-width:280px;background:transparent;border-color:transparent;padding-left:0" value=${n} disabled=${ctx.disabled} onInput=${function (e) { rename(n, e.target.value); }} />`}
            <span class="row" style="gap:4px">${mine.map(function (s) { return html`<span title=${val(s).element || ""} style=${"width:10px;height:10px;border-radius:50%;background:" + ui.color(val(s).element)}></span>`; })}</span>
          </div>
          <span class="small muted">${mine.length} ${mine.length === 1 ? "source" : "sources"} · opens with ${stages.join(", ").toLowerCase()}</span>
        </div>
        <div class="stack" style="--gap:8px">${mine.map(row)}</div>
      </div>`;
    })}`;

  var byRoute = html`
    ${STAGE_ORDER.filter(function (st) { return st !== "Start"; }).map(function (st) {
      var mine = sources.filter(function (s) { return STAGE[s.group] === st; });
      if (!mine.length) return null;
      return html`<div class="fade" key=${st}>
        <p class=${"label" + (mine.length > 1 ? " accent" : "")} style="margin-bottom:6px">${st}${mine.length > 1 ? " · any order" : " · fixed story stop"}</p>
        <div class="stack">${mine.map(function (s) {
          return html`<div key=${s.id}><p class="small dim" style="margin:0 0 4px 2px">${(val(s).island || "").trim() || UNPLACED}</p>${row(s)}</div>`;
        })}</div>
      </div>`;
    })}`;

  return html`
    <div class="stack">
      <div class="row between wrap">
        <${ui.Chips} value=${mode} onChange=${function (v) { if (v) setMode(v); }} options=${[{ value: "island", label: "By island" }, { value: "route", label: "By route" }]} />
        <div class="row">
          <span class="small muted">${sources.length} sources on ${realNames.length} ${realNames.length === 1 ? "island" : "islands"} · ${doneCount}/${slots.length} filled in</span>
          <button type="button" class="btn" onClick=${function () { var o = {}; if (!allOpen) slots.forEach(function (s) { o[s.id] = true; }); setOpen(o); }}>${allOpen ? "Collapse all" : "Expand all"}</button>
        </div>
      </div>
      ${home.length
        ? html`<div class="card big"><div class="row between" style="margin-bottom:10px"><span class="title">Home</span><span class="small muted">No source · archive and rescue station</span></div>${home.map(row)}</div>`
        : null}
      ${mode === "island" ? byIsland : byRoute}
    </div>`;
}
