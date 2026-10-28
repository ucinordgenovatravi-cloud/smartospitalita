# Ospitalità Genova – PDF forms

index.html = one page with two forms:
1. **Comunicazione di ospitalità** in favore di cittadino extracomunitario (art. 7 D.Lgs. 286/98)
2. **Ospitalità da proprietario** – dichiarazione al Commissariato P.S. Prè

Fill what you need (nothing is mandatory), duplicate pages with "+ Aggiungi pagina", then press Stampa (opens one combined PDF) or Scarica PDF.
The PDFs in templates/ are filled in the browser with pdf-lib. No server, nothing is uploaded. Data is kept in the browser (localStorage) until you press "Cancella tutto".

## Linked fields (↔)
Owner, property, guest, place and date are typed once and appear in both forms. Lines that combine several fields
(e.g. "Io sottoscritto/a", "Residenza", "Sito a Genova in Via", "Luogo e data") are filled automatically but can be edited by hand.
Guest data is linked only between the original pages, so an added page can hold a different guest.
Defaults: immobile in Genova (GE), luogo "Genova" – change them in the fields.

## Publish
Public GitHub repo -> upload ALL files, keeping the folders templates/, lib/ and fonts/ -> Settings -> Pages -> Deploy from branch main / root.
Local test: `python -m http.server 8000`, then open http://localhost:8000

## Files
- `spec.json` – every field and its position on the PDF page (points, origin top-left; `h` = page height). Edit it to rename a field or nudge a box.
  Field types: `t` text, `d` date (typed as gg/mm/aaaa; `parts` = separate day/month/year boxes), `c` checkbox, `s` select.
  Extras: `k` link key, `tpl` auto-filled line, `def` default, `nd` not printed (helper input), `ctr` centered, `cover` white box over pre-printed text.
- `fill.js` – writes the values on the PDFs. `app.js` – the page.
- `templates/commissariato_pre.pdf` is the scanned form, saved upright (the original scan was rotated 270°).

Notes: in form 1 the year boxes already print "20", so only the last two digits are written. The pre-printed "(PD)" next to the property's comune is covered and replaced by the province you enter (default GE).
