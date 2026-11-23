# Export nach Sage

Eine geprüfte Anfrage lässt sich über das Aktionsmenü (*…* → *Für Sage
exportieren*) als Importdatei herunterladen. API: `GET /inquiries/{id}/export`.

Voraussetzung: Kundennummer und Artikelnummer jeder Position sind gesetzt.
Andernfalls meldet der Export, was fehlt (HTTP 409).

## Zuordnung anpassen

Aufbau und Spalten der Datei stehen in einer JSON-Datei. Standard ist
`backend/app/exports/sage_default.json`, ein **Platzhalter**, bis estaro die echte
Sage-Importvorlage liefert. Eine eigene Datei wird mit `SAGE_EXPORT_MAPPING=<Pfad>`
aktiviert; Code muss dafür nicht geändert werden.

| Feld | Bedeutung |
|---|---|
| `format` | `csv` oder `xlsx` |
| `layout` | `flat`: eine Zeile pro Position, Kopfdaten in jeder Zeile wiederholt. `records`: ein Kopfsatz, danach je Position ein Positionssatz |
| `delimiter`, `encoding` | nur CSV; Standard `;` und `cp1252` (Windows) wie der Sage-Export |
| `header_row` | nur `flat`: erste Zeile mit Spaltentiteln |
| `columns` | Spalten für `flat` |
| `header_columns`, `position_columns` | Spalten für `records` |

Jede Spalte hat `title`, `source` und optional `default`. Mögliche Quellen:

- Feld der Anfrage als Pfad, z. B. `kundeninformationen.kunde`,
  `belegdetails.ihreBelegnummer`, `beleginformationen.lieferdatum`, `kopftext`
  (alle Felder: `backend/app/models/domain/inquiry_data.py`)
- Feld der Position: `position.artikel`, `position.menge`, `position.mengeneinheit`,
  `position.langtext`, `position.zeugnis`, …
- `position.index`: laufende Positionsnummer ab 1
- `literal:<Wert>`: fester Wert, z. B. `literal:Angebot` oder Satzart `literal:P`

Zeilenumbrüche in Texten werden zu Leerzeichen.

Beispiel für Kopf- und Positionssätze:

```json
{
  "format": "csv",
  "layout": "records",
  "header_columns": [
    {"title": "Satzart", "source": "literal:K"},
    {"title": "Kunde", "source": "kundeninformationen.kunde"}
  ],
  "position_columns": [
    {"title": "Satzart", "source": "literal:P"},
    {"title": "Pos", "source": "position.index"},
    {"title": "Artikel", "source": "position.artikel"},
    {"title": "Menge", "source": "position.menge"}
  ]
}
```

## Offen bis zur Vorlage von estaro

- Echte Spalten, Reihenfolge und Satzarten der Sage-Importschnittstelle
- Wohin Normen und Prüfanforderungen gehören (Artikeltext, Kopftext, eigene Position)
- Zubehör wie Zeugnisse als eigene Positionen mit Artikelnummer (hängt an der
  Bezeichnungsliste, AP9)
- Testimport bei estaro mit drei echten Anfragen
