# Anmeldung mit Microsoft Entra ID

Die Anwendung meldet Benutzer über das Microsoft-Konto des Unternehmens an
(OpenID Connect, Autorisierungscode mit PKCE). Das Backend führt die Anmeldung
durch; der Browser erhält nur ein HTTP-only-Sitzungscookie (`estaro_session`) mit
einem signierten Token, das Benutzer-ID, Name und Rollen enthält und nach
`SESSION_MAX_AGE_SECONDS` (Standard 8 Stunden) abläuft.

## Rollen

| Rolle (Entra-App-Rolle) | Rechte |
|---|---|
| `bearbeiter` | Anfragen hochladen, prüfen, zuordnen; Regeln anlegen und ändern; Stammdaten ansehen |
| `admin` | zusätzlich Regeln löschen und das Outlook-Postfach verbinden oder trennen |

Benutzer ohne eine dieser Rollen können sich nicht anmelden und sehen eine Hinweisseite.
Die Rollennamen lassen sich mit `AUTH_ADMIN_ROLE` und `AUTH_USER_ROLE` anpassen.

## Einrichtung durch die IT (Microsoft Entra Admin Center)

1. **App-Registrierung anlegen:** *Identität → Anwendungen → App-Registrierungen →
   Neue Registrierung*
   - Name: z. B. „estaro Anfragebearbeitung“
   - Unterstützte Kontotypen: *Nur Konten in diesem Organisationsverzeichnis*
   - Umleitungs-URI (Plattform *Web*): `https://<öffentliche Adresse>/api/session/callback`
2. **Abmelde-URL** (optional): unter *Authentifizierung* die *URL für die
   Front-Channel-Abmeldung* auf `https://<öffentliche Adresse>/` setzen.
3. **Geheimen Clientschlüssel** erstellen: *Zertifikate & Geheimnisse → Neuer
   geheimer Clientschlüssel*. Den Wert sicher an Multiplexo übergeben (nicht per
   E-Mail im Klartext).
4. **App-Rollen anlegen:** *App-Rollen → App-Rolle erstellen*, zulässige
   Mitgliedstypen *Benutzer/Gruppen*:
   - Anzeigename „Administrator“, Wert `admin`
   - Anzeigename „Bearbeiter“, Wert `bearbeiter`
5. **Zugriff einschränken:** *Unternehmensanwendungen → estaro Anfragebearbeitung →
   Eigenschaften → Zuweisung erforderlich = Ja*.
6. **Benutzer zuweisen:** *Benutzer und Gruppen → Benutzer/Gruppe hinzufügen*, jeweils
   mit Rolle (am einfachsten über eine Gruppe „estaro Pilot“).
7. An Multiplexo übergeben: **Verzeichnis-ID (Tenant-ID)**, **Anwendungs-ID
   (Client-ID)** und den **geheimen Clientschlüssel**.

Weitere API-Berechtigungen sind für die Anmeldung nicht nötig (`openid`, `profile`,
`email` sind Standard). Die Outlook-Anbindung (AP6) wird separat eingerichtet.

## Konfiguration

| Variable | Beispiel |
|---|---|
| `AUTH_ENABLED` | `true` (in `compose.production.yaml` Standard) |
| `AUTH_TENANT_ID` | Verzeichnis-ID aus Schritt 7 |
| `AUTH_CLIENT_ID` | Anwendungs-ID aus Schritt 7 |
| `AUTH_CLIENT_SECRET` | geheimer Clientschlüssel |
| `SESSION_SECRET` | mind. 32 zufällige Zeichen, z. B. `openssl rand -base64 48` |
| `AUTH_REDIRECT_URI` | wird in Compose aus `PUBLIC_URL` gebildet |

Fehlt bei `AUTH_ENABLED=true` eine Angabe, startet das Backend nicht.

Lokal bleibt `AUTH_ENABLED=false`; dann arbeiten alle Anfragen als lokaler
Administrator.

## Sicherheitseigenschaften

- Gültigkeit des ID-Tokens wird gegen die Signaturschlüssel von Microsoft geprüft
  (Aussteller, Zielgruppe, Ablauf, Nonce); State und PKCE schützen den Rückruf.
- Weiterleitungen nach der Anmeldung nur auf Pfade der eigenen Anwendung.
- Sitzungscookie `HttpOnly`, `SameSite=Lax`, bei HTTPS `Secure`.
- Alle API-Endpunkte außer `/session/*` und `/` verlangen eine Anmeldung.

Getestet am 23.11.2026 gegen einen nachgebildeten Identitätsanbieter (Anmeldung,
Rollen, Abmeldung, manipulierte Cookies, falscher State/Nonce, Benutzer ohne Rolle,
offene Weiterleitung). Ein Test gegen einen echten Entra-Tenant steht aus.

## Bekannte Grenzen

- Download-Links für Originaldokumente sind vorsignierte MinIO-Adressen und eine
  Stunde lang ohne Anmeldung gültig, wenn jemand den Link kennt.
- Eine Sitzung bleibt bis zu ihrem Ablauf gültig, auch wenn der Benutzer in Entra
  deaktiviert wird; Rollenänderungen greifen bei der nächsten Anmeldung.
