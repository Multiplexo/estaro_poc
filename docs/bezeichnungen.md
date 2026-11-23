# Bezeichnungsliste (Synonyme für das Artikel-Matching)

estaro pflegt eine Excel-Liste (`Bezeichnungen.xlsx`), die Kundenformulierungen auf
interne Kürzel abbildet. Der Artikel-Agent nutzt sie über das Werkzeug
`resolve_terms`, um den Matchcode des Artikelstamms zusammenzusetzen:

| Kunde schreibt | Liste liefert | Matchcode |
|---|---|---|
| nahtloses Edelstahlrohr 14 x 1,50 mm, AISI 316Ti | `nr`, `4571` | `nr 14x1,5 4571` |
| geschweißtes Rohr 60,3 x 2,6, 1.4571 | `gr`, `4571` | `gr 60,3x2,6 4571` |
| Rundstahl Ø 20, X15CrNiSi25-21 | `rd`, `4841` | `Rd 20 4841` |
| Blech 1,5 mm, 1250 x 2500, 1.4845 | `Stärke M`, `4845` | `1,5m 4845` |
| welded elbow 60,3x2, 1.4828 | `gb`, `4828` | `gb 60,3x2 4828` |
| mit 3.1-Zeugnis | Zubehör `WAZ`, Artikel 9001004 | eigene Position |

Diese fünf Beispiele finden im echten Artikelstamm jeweils genau den richtigen
Artikel (Test vom 23.11.2026).

## Import

Die Liste liegt nicht im Repository, sondern in der Tabelle `article_term`:

```sh
uv --directory backend run python -m scripts.import_terms --file Bezeichnungen.xlsx
```

Der Import ersetzt die gesamte Liste. Erwartet wird das Tabellenblatt mit den
Spalten *Art* (Artikel Kategorie, Werkstoff, Artikel Zubehör), *Artikelnummer*,
*estaro Bezeichnung* und beliebig vielen *Synonym*-Spalten.

## Abgleich

- Groß-/Kleinschreibung, Leerzeichen und Bindestrich-Varianten werden ignoriert;
  Treffer nur auf ganze Wörter.
- Gewinnt der längere Treffer („welded elbow“ statt „welded“, „certificate of
  origin“ statt „certificate“).
- Blech: Nennt die Anfrage ein Maß (1250 x 2500), wird nur dieses Format geliefert,
  sonst alle Formate; der Agent markiert das offene Format als Konflikt.
- Kurze Zahlen als Werkstoff (`304`, `321`) zählen nur mit Zusatz wie *AISI*, *TP*
  oder *grade*, damit Mengen und Maße nicht als Werkstoff gelten.
- „zur Verfügung“ zählt nicht in Höflichkeitsformeln („stehe Ihnen zur Verfügung“).

## Annahmen bis zur Bestätigung durch estaro (Tina)

1. **„geschweißter Bogen“ hat in der Liste den Code `gr`** (wie geschweißtes Rohr). Der
   Artikelstamm verwendet `gb`; der Import korrigiert das und protokolliert eine
   Warnung (`CODE_CORRECTIONS` in `backend/app/services/domain/terms.py`).
2. **Ersatzwerkstoffe:** In den Zeilen 1.4404 und 1.4301 folgen Synonyme eines
   anderen Werkstoffs (1.4401/AISI 316 bzw. 1.4307/AISI 304L). Sie werden als
   Ersatz behandelt: Der Agent schlägt 4404 bzw. 4301 vor und nennt die Abweichung.
3. **Blechformat ohne Maßangabe:** kein Standardformat, Hinweis zur Prüfung.
4. **Zubehör ohne Artikelnummer** (Lieferantenerklärung, neutraler Versand, EUR1, ATR):
   Hinweis zur Anfrage, keine Position.
5. **Zubehör mit Artikelnummer** (Zeugnis, Ursprungszeugnis, Zolldokumente, Zuschnitt,
   zur Verfügung): wird als zusätzliche Position vorgeschlagen; Menge noch offen.
6. **Schreibfehler** in der Liste („seemless“, „Certifikate“, „Urspungszeugnis“)
   bleiben als Synonyme erhalten; die korrekte Schreibweise wird automatisch ergänzt.
7. **Pflege:** vorerst per Excel und Importskript; eine Bearbeitung in der Oberfläche
   ist möglich, sobald gewünscht.
