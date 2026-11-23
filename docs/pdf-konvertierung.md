# PDF-Konvertierung: Konfiguration und Ressourcenbedarf

Die Extraktion wandelt PDFs mit Docling in Textabschnitte, Tabellen und Seitenbilder
um (`backend/app/pipelines/extraction/document_classification.py`). Dieser Schritt
bestimmt den Arbeitsspeicherbedarf des Workers.

## Einstellungen

| Variable | Standard | Wirkung |
|---|---|---|
| `PDF_NUM_THREADS` | `4` | CPU-Threads für Layout-, Tabellen- und OCR-Modelle |
| `PDF_IMAGES_SCALE` | `2.0` | Auflösung der Seitenbilder, die zusätzlich an das Sprachmodell gehen |
| `PDF_OCR_ENABLED` | `true` | Texterkennung für Bildbereiche (Logos, Briefköpfe, Scans) |

Die Variablen heißen bewusst nicht `DOCLING_…`, weil Docling Umgebungsvariablen mit
diesem Präfix selbst ausliest.

Der Konverter wird pro Prozess einmal erstellt und wiederverwendet. Jeder
Celery-Worker-Prozess hält seine eigenen Modelle im Speicher; das Backend-Image
startet den Worker deshalb mit `--concurrency=1`.

## Modelle und Netzwerk

- Layout- und Tabellenmodelle (ca. 500 MB) werden beim Image-Build mit
  `python -m scripts.prefetch_models` geladen. Zur Laufzeit gilt `HF_HUB_OFFLINE=1`;
  der Container braucht keinen Zugriff auf Hugging Face.
- OCR nutzt RapidOCR mit den im Python-Paket enthaltenen ONNX-Modellen
  (`onnxruntime`). Ohne `onnxruntime` würde Docling RapidOCR mit PyTorch wählen und
  die Gewichte zur Laufzeit von modelscope.cn laden.
- PyTorch wird unter Linux als CPU-Version installiert (keine CUDA-Bibliotheken).

## Messung

Messung vom 23.11.2026 mit `python -m scripts.benchmark_pdf_conversion PDF_DIR`:
12 Beispiel-PDFs aus den estaro-Anfragen (14 Seiten), nacheinander konvertiert wie
im Worker, jede Konfiguration in einem frischen Prozess. Linux, 4 vCPU, nur CPU.

| Threads | Bildskala | OCR | PDFs | Seiten | Fehler | Sekunden | Peak RAM (MB) |
|---:|---:|:---:|---:|---:|---:|---:|---:|
| 16 | 2.0 | an | 12 | 14 | 0 | 87.8 | 2323 |
| 4 | 2.0 | an | 12 | 14 | 0 | 71.0 | 2227 |
| 2 | 2.0 | an | 12 | 14 | 0 | 99.9 | 2147 |
| 4 | 1.0 | an | 12 | 14 | 0 | 69.9 | 2152 |
| 4 | 2.0 | aus | 12 | 14 | 0 | 25.4 | 1455 |
| 2 | 1.0 | aus | 12 | 14 | 0 | 30.2 | 1396 |

Vor der Wiederverwendung des Konverters (Modelle pro Dokument neu geladen) lag der
Spitzenwert mit OCR bei rund 3,1 GB und die Laufzeit bei 100–130 Sekunden.

Gemessen ist nur die Konvertierung. Der Worker-Prozess braucht zusätzlich Speicher
für Python, Bibliotheken und die Modellaufrufe.

## Erkenntnisse

- **OCR ist der größte Kostenfaktor**, liefert aber bei 8 von 12 PDFs zusätzlichen
  Text: vor allem Firmennamen in Logos (z. B. „LINSTER EDELSTAHLHANDEL“),
  Briefköpfe mit Adresse und Fußzeilen. Das ist für das Kunden-Matching und die
  Quellenbelege relevant. OCR bleibt deshalb aktiviert.
- **4 Threads** waren auf 4 vCPU am schnellsten; mehr Threads als Kerne bremsen.
- **Die Bildskala** beeinflusst Laufzeit und Speicher kaum; sie bleibt bei 2.0, weil die
  Seitenbilder dem Sprachmodell beim Lesen von Tabellen helfen.

## Empfehlung Pilot

- Worker mit `--concurrency=1` und mindestens **4 GB RAM** für den Worker-Container.
- Für mehr Durchsatz lieber weitere Worker-Container mit je 4 GB als mehr Prozesse in
  einem Container.
