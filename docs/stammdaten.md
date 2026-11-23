# Stammdaten-Abgleich (Artikel und Kunden)

Artikel- und Kundenstamm werden aus Sage übernommen. Der Abgleich
(`backend/app/services/jobs/masterdata.py`) läuft

- **automatisch jede Nacht** im Worker (Celery-Beat-Job `masterdata.sync`, Minute 17
  der Stunde `MASTERDATA_SYNC_HOUR_UTC`, Standard 02:17 UTC), sobald
  `MASTERDATA_SOURCE` gesetzt ist, oder
- **manuell** mit `python -m scripts.import_data --resources <Ordner>` (CSV).

Bestehende Datensätze werden aktualisiert (Schlüssel: Artikelnummer + Variante bzw.
Kundennummer), neue angelegt. Datensätze, die die Quelle nicht mehr liefert, werden
**deaktiviert, nicht gelöscht** (`MASTERDATA_DEACTIVATE_MISSING=true`), damit
frühere Anfragen gültig bleiben. Das Matching schlägt nur aktive Artikel vor.

Vor dem Schreiben wird jede Zeile geprüft; ein Fehler bricht den Abgleich ab, ohne
etwas zu ändern (eine Transaktion für Artikel und Kunden).

## Quelle 1: CSV-Exporte (`MASTERDATA_SOURCE=csv`)

`Artikelstamm.csv` und `Kundenstamm.csv` im Ordner `MASTERDATA_CSV_DIR`
(Standard `/data/stammdaten`), Trennzeichen `;`, Zeichensatz Windows-1252, wie der
bisherige Export aus Sage. Der Ordner muss in den Worker-Container eingebunden
werden, z. B. als Freigabe, in die Sage nachts exportiert.

## Quelle 2: Datenbank (`MASTERDATA_SOURCE=sql`)

Der Worker liest mit zwei SQL-Abfragen direkt aus der Datenbank. Am einfachsten
legt die IT von estaro **zwei Views** an, deren Spalten **genau so heißen wie im
CSV-Export**, und einen Benutzer, der nur diese Views lesen darf.

```env
MASTERDATA_SOURCE=sql
MASTERDATA_SQL_URL=<SQLAlchemy-URL, z. B. mssql+pymssql://estaro_read:<Passwort>@<Server>/<Datenbank>>
MASTERDATA_ARTICLES_QUERY=SELECT * FROM estaro_artikel
MASTERDATA_CUSTOMERS_QUERY=SELECT * FROM estaro_kunden
```

Erwartete Spalten von `estaro_artikel`:

"Artikelnummer", "Variante", "Matchcode Artikel", "Bezeichnung 1", "Bezeichnung 2",
"Verkaufsmengeneinheit_Wert", "Verkaufsmengeneinheit_Bezeichnung", "Lagerbestand",
"Gewicht in kg", "Lagermengeneinheit_Wert", "Lagermengeneinheit_Bezeichnung",
"Artikelgruppe_Wert", "Artikelgruppe_Bezeichnung", "Aktiv", "Warennummer",
"Hauptlieferant", "Hauptlagerplatz", "Memo", "Hersteller", "Mengenberechnung_Wert",
"Mengenberechnung_Bezeichnung", "Verkauf", "Beschaffung", "Steuerklasse_Wert",
"Steuerklasse_Bezeichnung", "Chargenpflicht", "Chargen Auswahl_Wert",
"Chargen Auswahl_Bezeichnung", "Intrastat Eigenmasse in kg", "Exot"

Erwartete Spalten von `estaro_kunden`:

"Kundennummer", "Kunden-Matchcode", "Anrede", "Name", "Namenszusatz",
"Druckprozess-Variante_Wert", "Gruppe-Adresse_Wert", "Gruppe-Adresse_Bezeichnung",
"Land_Wert", "Land_Bezeichnung", "PLZ", "Ort", "Telefon", "Währung_Wert",
"Währung_Bezeichnung", "Zahlungskondition_Wert", "Zahlungskondition_Bezeichnung",
"Vertreter", "Preisliste_Wert", "Preisliste_Bezeichnung", "Kundengruppe_Wert",
"Kundengruppe_Bezeichnung", "Sprache_Wert", "Sprache_Bezeichnung", "Liefersperre",
"UStID-Nr.", "Aktiv-Kunden", "Besteuerungsart_Wert", "Besteuerungsart_Bezeichnung",
"Aufnahme", "Länderkürzel (nur EU)_Wert", "Länderkürzel (nur EU)_Bezeichnung",
"Rechnungskreis_Wert", "Rechnungskreis_Bezeichnung", "Rabattliste_Wert",
"Rabattliste_Bezeichnung"

Werte dürfen als Text im Format des CSV-Exports kommen (`Ja`/`Nein`, `16,33`,
`31.12.2024`) oder als passende Datenbanktypen (Bit/Boolean, Dezimalzahl, Datum).

**Sage 100 (Version 9.0) bei estaro** läuft auf Microsoft SQL Server und wird bei
Skysystems gehostet. Der Treiber `pymssql` ist im Backend enthalten; die URL hat die
Form `mssql+pymssql://<Benutzer>:<Passwort>@<Server>:1433/<Datenbank>`.

Noch zu klären mit estaro, Skysystems und ISales:

- Lese-Benutzer und die zwei Views (Spaltennamen siehe oben)
- Netzwerkweg vom Pilot-Server (Sliplane) zum SQL Server bei Skysystems, z. B.
  Freigabe der festen IP-Adresse des Servers in der Firewall oder ein VPN;
  Verbindung verschlüsselt
- Falls ein direkter Zugriff nicht möglich ist: Ausweichweg über einen nächtlichen
  CSV-Export (`MASTERDATA_SOURCE=csv`) auf einen Speicherort, den der Server lesen
  kann

## Test

Getestet am 23.11.2026 mit den echten Exporten (6.839 Artikel, 3.143 Kunden):
CSV-Import und Wiederholung ohne Dubletten; SQL-Quelle über Views mit
CSV-Spaltennamen und einer numerischen Spalte; 10 in der Quelle entfernte Artikel
wurden deaktiviert, Lagerbestände korrekt übernommen.
