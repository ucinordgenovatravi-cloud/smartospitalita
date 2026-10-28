/* Builds one form per PDF page from spec.json, links the fields that are the same in both modules,
   lets people duplicate pages, and hands everything to fill.js (pdf-lib) to write the PDF. */
(function () {
  var KEY = "genova-ospitalita-v1";
  var $ = function (id) { return document.getElementById(id); };
  var SPEC = [], pages = [], keyCount = {}, saveT;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function isGuestKey(k) { return /^g\d/.test(k); }      // guest data is linked only between the original pages, never copies

  // ---------- small helpers ----------
  function fmtDate(s) {                                   // 05031978 -> 05/03/1978
    var d = String(s).replace(/\D/g, "").slice(0, 8), o = d.slice(0, 2);
    if (d.length > 2) o += "/" + d.slice(2, 4);
    if (d.length > 4) o += "/" + d.slice(4);
    return o;
  }
  function expand(tpl, get) {                             // "{key}" or "{key|before|after}"; empty keys vanish
    return tpl.replace(/\{([^}|]+)(?:\|([^}|]*))?(?:\|([^}]*))?\}/g, function (_, k, a, b) {
      var v = String(get(k) || "").trim(); return v ? (a || "") + v + (b || "") : "";
    }).replace(/^[\s,]+|[\s,]+$/g, "");
  }
  function computed(g, k) { return expand(k.c.tpl, function (key) { return g.byKey[key] ? g.byKey[key].get() : ""; }); }
  function refreshAuto(g) {                               // recompute auto-filled lines that the person has not edited by hand
    g.ctrls.forEach(function (k) { if (k.c.tpl && !k.touched) { var v = computed(g, k); if (k.get() !== v) k.set(v); } });
  }

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(pages.map(function (g) { return { d: g.d, p: g.p, copy: g.copy, inc: g.inc, v: g.ctrls.map(function (k) { return k.get(); }) }; }))); } catch (e) {}
    }, 300);
  }

  function edited(g, k) {
    if (k.c.tpl) { var v = k.get(); k.touched = v !== "" && v !== computed(g, k); }
    if (k.c.k) {
      pages.forEach(function (g2) {
        if (g2 === g) return;
        var k2 = g2.byKey[k.c.k]; if (!k2) return;
        if (isGuestKey(k.c.k) && (g.copy || g2.copy)) return;
        k2.set(k.get());
      });
    }
    pages.forEach(refreshAuto);
    save();
  }

  // ---------- form building ----------
  function buildControls(g, host) {
    SPEC[g.d].pages[g.p].sections.forEach(function (s) {
      if (s.title) host.appendChild(el("h3", "sec", s.title));
      var grid = el("div", "grid"); host.appendChild(grid);
      s.c.forEach(function (c) {
        var k = { c: c, touched: false }, lab = el("label", c.t === "c" || c.full ? "full" : "");
        if (c.t === "c") {
          lab.className = "chk full"; var cb = el("input"); cb.type = "checkbox"; lab.appendChild(cb); lab.appendChild(document.createTextNode(c.l));
          k.get = function () { return cb.checked; }; k.set = function (v) { cb.checked = !!v; }; cb.onchange = function () { edited(g, k); };
        } else {
          lab.appendChild(document.createTextNode(c.l));
          if (c.k && keyCount[c.k] > 1) { var lk = el("span", "lnk", " ↔"); lk.title = "Collegato: si compila anche nell’altro modulo"; lab.appendChild(lk); }
          if (c.tpl) lab.appendChild(el("small", "", "compilato in automatico – puoi modificarlo"));
          if (c.n) lab.appendChild(el("small", "", c.n));
          var inp;
          if (c.t === "s") {
            inp = el("select"); inp.appendChild(new Option("—", ""));
            c.o.forEach(function (o, i) { inp.appendChild(new Option(o[0], String(i))); });
          } else {
            inp = el("input"); inp.type = "text"; inp.autocomplete = "off";
            if (c.t === "d") { inp.inputMode = "numeric"; inp.placeholder = "gg/mm/aaaa"; inp.maxLength = 10; }
          }
          lab.appendChild(inp);
          k.get = function () { return inp.value; }; k.set = function (v) { inp.value = v == null ? "" : v; };
          inp.oninput = inp.onchange = function () { if (c.t === "d") { var f = fmtDate(inp.value); if (f !== inp.value) inp.value = f; } edited(g, k); };
        }
        g.ctrls.push(k); if (c.k && !g.byKey[c.k]) g.byKey[c.k] = k; grid.appendChild(lab);
      });
    });
  }

  function makePage(d, p, copy, vals, inc) {
    var doc = SPEC[d], g = { d: d, p: p, copy: !!copy, inc: inc !== false, ctrls: [], byKey: {} };
    var fs = el("fieldset"), lg = el("legend", "", doc.title);
    fs.appendChild(lg);
    var head = el("div", "page-head"), b = el("b", "", copy ? "Copia aggiuntiva / Extra copy" : "Pagina originale");
    if (copy) head.appendChild(el("span", "badge", "copia"));
    head.appendChild(b);
    var lab = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = g.inc;
    cb.onchange = function () { g.inc = cb.checked; save(); }; lab.appendChild(cb); lab.appendChild(document.createTextNode("Includi nella stampa / Include")); head.appendChild(lab);
    var add = el("button", "sm ghost", "+ Aggiungi pagina / Add page"); add.type = "button";
    add.title = "Duplica questa pagina con i dati già inseriti (utile per altri ospiti)";
    add.onclick = function () {
      var n = makePage(d, p, true, g.ctrls.map(function (k) { return k.get(); }));
      pages.splice(pages.indexOf(g) + 1, 0, n.g); fs.after(n.fs); n.fs.scrollIntoView({ behavior: "smooth", block: "start" }); save();
    };
    head.appendChild(add);
    if (copy) {
      var rm = el("button", "sm danger", "Rimuovi / Remove"); rm.type = "button";
      rm.onclick = function () { if (confirm("Rimuovere questa copia?")) { pages.splice(pages.indexOf(g), 1); fs.remove(); save(); } };
      head.appendChild(rm);
    }
    fs.appendChild(head);
    buildControls(g, fs);

    if (vals) {                                           // restored or duplicated page: keep exactly what was there
      g.ctrls.forEach(function (k, i) { k.set(vals[i]); });
    } else {                                              // new page: defaults, then pick up what is already typed elsewhere
      g.ctrls.forEach(function (k) {
        if (k.c.def) k.set(k.c.def);
        if (k.c.k) pages.some(function (g2) {
          var k2 = g2.byKey[k.c.k];
          if (k2 && k2.get() !== "" && !(isGuestKey(k.c.k) && (copy || g2.copy))) { k.set(k2.get()); return true; }
        });
      });
    }
    g.ctrls.forEach(function (k) { if (k.c.tpl) { var v = k.get(); k.touched = v !== "" && v !== computed(g, k); } });
    refreshAuto(g);
    g.root = fs; return { g: g, fs: fs };
  }

  function buildAll(saved) {
    $("docs").textContent = ""; $("jump").textContent = ""; pages = [];
    SPEC.forEach(function (doc, di) {
      var h = el("h2", "doc", doc.title); h.id = "doc" + di; $("docs").appendChild(h);
      var a = el("a", "", doc.title); a.href = "#doc" + di; $("jump").appendChild(a);
      var list = saved ? saved.filter(function (s) { return s.d === di; }) : doc.pages.map(function (_, p) { return { d: di, p: p, copy: false, inc: true }; });
      list.forEach(function (s) { var n = makePage(s.d, s.p, s.copy, s.v, s.inc); pages.push(n.g); $("docs").appendChild(n.fs); });
    });
  }

  // ---------- PDF ----------
  async function makePdf() {
    if (!window.PDFLib || !window.fontkit) throw new Error("Libreria PDF non caricata: carica su GitHub anche la cartella lib/ (pdf-lib.min.js e fontkit.umd.min.js) mantenendo la struttura delle cartelle.");
    var get = async function (u) { var r = await fetch(u); if (!r.ok) throw new Error("Impossibile caricare " + u); return r.arrayBuffer(); };
    var items = pages.filter(function (g) { return g.inc; }).map(function (g) { return { d: g.d, p: g.p, vals: g.ctrls.map(function (k) { return k.get(); }) }; });
    return FillCore.fillPdf({ PL: PDFLib, fontkit: fontkit, SPEC: SPEC, items: items, fontBytes: await get("fonts/LiberationSans-Regular.ttf"), loadBytes: get });
  }

  async function run(mode) {
    var msg = $("msg"), w = mode === "print" ? window.open("", "_blank") : null;
    msg.className = ""; msg.textContent = "Creo il PDF…"; $("print").disabled = $("dl").disabled = true;
    try {
      var bytes = await makePdf();
      if (!bytes) { if (w) w.close(); msg.className = "err"; msg.textContent = "Nessuna pagina selezionata."; return; }
      var url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      var a = document.createElement("a"); a.href = url; a.download = "ospitalita_genova_compilato.pdf"; a.textContent = "scarica il PDF";
      if (w) w.location = url; else { document.body.appendChild(a); a.click(); a.remove(); }
      msg.textContent = "Fatto! "; msg.appendChild(a);
    } catch (err) { if (w) w.close(); msg.className = "err"; msg.textContent = err.message || "Errore durante la creazione del PDF."; }
    finally { $("print").disabled = $("dl").disabled = false; }
  }
  $("print").onclick = function () { run("print"); };
  $("dl").onclick = function () { run("dl"); };
  $("clear").onclick = function () { if (confirm("Cancellare tutto quello che hai scritto e le copie aggiunte?")) { buildAll(); save(); } };

  fetch("spec.json").then(function (r) { return r.json(); }).then(function (s) {
    SPEC = s; var saved = null;
    SPEC.forEach(function (doc) { doc.pages.forEach(function (pg) { FillCore.flat(pg).forEach(function (c) { if (c.k) keyCount[c.k] = (keyCount[c.k] || 0) + 1; }); }); });
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    var ok = Array.isArray(saved) && saved.length && saved.every(function (x) {
      return SPEC[x.d] && SPEC[x.d].pages[x.p] && Array.isArray(x.v) && x.v.length === FillCore.flat(SPEC[x.d].pages[x.p]).length;
    });
    buildAll(ok ? saved : null);
  }).catch(function () {
    $("msg").className = "err"; $("msg").textContent = "Impossibile caricare spec.json. Apri il sito tramite GitHub Pages o un server locale (python -m http.server), non con doppio clic.";
  });
})();
