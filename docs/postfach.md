# Postfach-Anbindung (Microsoft 365)

Neue E-Mails werden per Microsoft Graph abgerufen (Celery-Beat-Job `outlook.fetch`
im Abstand von `MS_FETCH_INTERVAL_SECONDS`). Eine Delta-Abfrage auf den Posteingang
liefert nur neue Nachrichten; bereits importierte Mails werden über ihre ID erkannt
und nicht doppelt angelegt. E-Mail (als `.eml`) und Anhänge landen in MinIO und
starten die Extraktion.

Es gibt zwei Betriebsarten:

| | Sonderpostfach (Pilot) | Persönliches Postfach (PoC) |
|---|---|---|
| Einstellung | `MS_MAILBOX=anfragen@estaro.de` | `MS_MAILBOX` leer |
| Berechtigung | Anwendungsberechtigung `Mail.Read` | delegierte Berechtigung eines Benutzers |
| Verbindung | automatisch, kein Login nötig | ein Admin verbindet in *Einstellungen* |
| `MS_AUTHORITY` | `https://login.microsoftonline.com/<Tenant-ID>` | auch `.../common` möglich |

Mails werden nur gelesen, nicht verschoben oder als gelesen markiert.

## Einrichtung Sonderpostfach durch die IT

1. **Postfach anlegen** (freigegebenes Postfach), z. B. `anfragen@estaro.de`, und
   die Anfragen dorthin leiten oder weiterleiten.
2. **App-Registrierung** (eigene oder dieselbe wie für die Anmeldung, siehe
   [Anmeldung](anmeldung.md)):
   - *API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph →
     Anwendungsberechtigungen → `Mail.Read`*
   - *Administratorzustimmung erteilen*
   - *Zertifikate & Geheimnisse → geheimer Clientschlüssel*
3. **Zugriff auf genau dieses Postfach beschränken.** Ohne diesen Schritt darf die
   App mit `Mail.Read` *alle* Postfächer des Unternehmens lesen. In Exchange Online
   PowerShell, mit einer E-Mail-aktivierten Sicherheitsgruppe, die nur das
   Sonderpostfach enthält:

   ```powershell
   New-ApplicationAccessPolicy -AppId <Client-ID> `
     -PolicyScopeGroupId estaro-anfragen-zugriff@estaro.de `
     -AccessRight RestrictAccess `
     -Description "estaro: nur Anfragepostfach"
   Test-ApplicationAccessPolicy -AppId <Client-ID> -Identity anfragen@estaro.de
   Test-ApplicationAccessPolicy -AppId <Client-ID> -Identity irgendwer@estaro.de
   ```

   Der erste Test muss `Granted`, der zweite `Denied` ergeben. Alternativ kann die
   IT die neueren *RBAC-Rollen für Anwendungen* in Exchange Online verwenden.
4. An Multiplexo übergeben: **Tenant-ID**, **Client-ID**, **geheimer
   Clientschlüssel**, **Postfachadresse**.

## Konfiguration

```env
MS_CLIENT_ID=<Client-ID>
MS_CLIENT_SECRET=<geheimer Clientschlüssel>
MS_AUTHORITY=https://login.microsoftonline.com/<Tenant-ID>
MS_MAILBOX=anfragen@estaro.de
MS_FETCH_ENABLED=true
MS_FETCH_INTERVAL_SECONDS=300
```

Mit gesetztem `MS_MAILBOX` zeigt die Seite *Einstellungen* das Postfach an; die
Schaltflächen zum Verbinden entfallen.

## Test

Getestet am 23.11.2026 gegen nachgebildete Microsoft-Dienste: Token per
Client Credentials, alle Abrufe auf `/users/<Postfach>`, Delta-Link gespeichert,
gelöschte Nachrichten übersprungen, Wechsel des Postfachs startet eine neue
Synchronisation. Ein Test gegen ein echtes Microsoft-365-Postfach steht aus.
