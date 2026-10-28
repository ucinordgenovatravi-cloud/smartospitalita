/* PDF writer: puts the values onto the template PDFs with pdf-lib. No DOM needed, so it can also run under Node for tests. */
(function (root) {
  var INK = [0.05, 0.1, 0.45];

  function flat(page) {            // controls of a page in a fixed order
    var out = [];
    page.sections.forEach(function (s) { s.c.forEach(function (c) { out.push(c); }); });
    return out;
  }

  // items: [{ d: docIndex, p: pageIndex, vals: [value per control] }]
  async function fillPdf(o) {
    var PL = o.PL, SPEC = o.SPEC, ink = PL.rgb(INK[0], INK[1], INK[2]);
    var out = await PL.PDFDocument.create(); out.registerFontkit(o.fontkit);
    var font = await out.embedFont(o.fontBytes, { subset: true }), cs = new Set(font.getCharacterSet());
    var clean = function (s) { return Array.from(String(s).replace(/\t/g, " ")).map(function (ch) { return cs.has(ch.codePointAt(0)) ? ch : "?"; }).join(""); };
    var src = {}, n = 0;

    function text(pg, PH, s, b, c, forceCenter) {
      s = clean(s); if (!s.trim()) return;
      var fs = c.fs || 10; while (fs > 5 && font.widthOfTextAtSize(s, fs) > b[2] - 2) fs -= 0.5;
      var w = font.widthOfTextAtSize(s, fs), x = (c.ctr || forceCenter) ? b[0] + (b[2] - w) / 2 : b[0] + 1;
      pg.drawText(s, { x: x, y: PH - (b[1] + b[3]) + 2.4 + (c.dy || 0), size: fs, font: font, color: ink });
    }
    function slices(pg, PH, s, b, c) {   // one character per equal slice of the box (pre-printed digit cells)
      var n = b[4], w = b[2] / n; s = clean(s).slice(-n);
      for (var i = 0; i < s.length; i++) text(pg, PH, s[i], [b[0] + (n - s.length + i) * w, b[1], w, b[3]], c, true);
    }
    function drawX(pg, PH, b) {
      var w = b[2] || 8.5, o2 = { thickness: 1.3, color: ink }, x = b[0], y = b[1], a = w * 0.18, z = w * 0.82;
      pg.drawLine(Object.assign({ start: { x: x + a, y: PH - (y + a) }, end: { x: x + z, y: PH - (y + z) } }, o2));
      pg.drawLine(Object.assign({ start: { x: x + a, y: PH - (y + z) }, end: { x: x + z, y: PH - (y + a) } }, o2));
    }

    for (var gi = 0; gi < o.items.length; gi++) {
      var it = o.items[gi], doc = SPEC[it.d], PH = doc.h || 842;
      if (!src[doc.file]) src[doc.file] = await PL.PDFDocument.load(await o.loadBytes(doc.file));
      var pg = (await out.copyPages(src[doc.file], [it.p]))[0]; out.addPage(pg); n++;
      flat(doc.pages[it.p]).forEach(function (c, i) {
        var v = it.vals[i]; if (v === "" || v === false || v == null) return;
        if (c.t === "s") { drawX(pg, PH, c.o[+v].slice(1)); return; }
        if (c.t === "c") { drawX(pg, PH, c.b); return; }
        if (c.cover) c.cover.forEach(function (r) { pg.drawRectangle({ x: r[0], y: PH - r[1] - r[3], width: r[2], height: r[3], color: PL.rgb(1, 1, 1) }); });
        if (c.t === "d" && c.parts) {
          var p = String(v).split("/");
          c.parts.forEach(function (b, j) { if (!p[j]) return; if (b[4]) slices(pg, PH, p[j], b, c); else text(pg, PH, p[j], b, c, true); });
        } else if (c.b) text(pg, PH, v, c.b, c);
      });
    }
    return n ? out.save() : null;
  }

  root.FillCore = { fillPdf: fillPdf, flat: flat };
  if (typeof module !== "undefined") module.exports = root.FillCore;
})(typeof window !== "undefined" ? window : globalThis);
