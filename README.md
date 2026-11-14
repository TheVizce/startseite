# Startseite

Übersicht über alle meine GitHub-Pages-Tools unter `thevizce.github.io` – mit Speicheranzeige.

Adresse: https://thevizce.github.io/startseite/

## Was die Seite zeigt
- **Startansicht:** Kacheln in Gruppen (Pokémon, Medien & Spiele, Sammlungen) mit Anzahl der Einträge und Zeit des letzten Abgleichs auf diesem Gerät. Die Zahlen kommen aus dem Abgleich-Stand (`toolsync`), die Datenbanken der Tools werden dafür nicht durchlaufen.
- **Statuszeile:** „Alles in Ordnung“ oder Hinweise (Sync nicht eingerichtet, localStorage fast voll, Tool über 2 Wochen nicht abgeglichen, dauerhafter Speicher nicht aktiv).
- **Diskret:** blendet die Gruppe „Sammlungen“ aus; gemerkt pro Gerät in `localStorage["startseite.diskret"]`.
- **Verwaltung** (`#verwaltung`, `#speicher`, `#sync`): Speicher pro Tool (IndexedDB geschätzt + localStorage nach Präfix), dauerhafter Speicher, GitHub-Sync-Einstellungen, letzter Abgleich, Sicherheitskopien, iPhone-Hinweise. Die Messung läuft erst, wenn die Verwaltung geöffnet wird.

Die Daten der Tools werden **nur gelesen**: Die Seite öffnet nur Datenbanken, die schon existieren, und gibt sie sofort frei, wenn ein Tool sie upgraden will. Schreiben tut sie nur `toolsync.config` und `startseite.diskret`.

Neues Tool: in `TOOLS` auch `group`, `color` und `count` (Sammlungen aus dem Sync mit Beschriftung) angeben.

## GitHub-Sync (`sync-v1.js`)
Gemeinsamer Abgleich für die Tools mit dem privaten Repo `TheVizce/tool-daten`.

| Tool | Ablage im Daten-Repo |
|---|---|
| GO Organizer | Ordner `pokemon-go/` (main.json + 16 Teildateien, seit 11.11.2026; die alte `pokemon-go.json` wird nicht mehr benutzt) |
| Pokémon-Boxen | Ordner `pokemon-home/` (main.json + 16 Teildateien, seit 11.11.2026; die alte `pokemon-home.json` wird nicht mehr benutzt) |
| Organizer · Personen | Ordner `b-organizer/` (main.json + 32 Teildateien) – eigene Bilder bleiben lokal |
| Organizer · Charaktere | Ordner `b-organizer-chars/` (main.json + 8 Teildateien), gleiche Datenbank `bp-organizer` (Schlüssel mit Präfix `chars:`) |
| Favoriten-Archiv | Ordner `nh-favoriten/` (main.json + 32 Teildateien) – Cover und API-Key bleiben lokal |
| Image Ranker | Ordner `image-ranker/` (main.json + 64 Teildateien); Bilddateien in Paketen (ca. 10 MB) im privaten Repo `ranker-bilder` – nicht am Handy |
| Kartenbinder | Ordner `kartenbinder/` (main.json + 16 Teildateien); beim ersten Abgleich eines Geräts gilt der Cloud-Stand |
| Videothek | Ordner `videothek/` (main.json + 16 Teildateien); YouTube-Schlüssel bleibt pro Gerät |
| FH6 Garage | `fh6-garage.json` (Garage-Einträge, Promo-Häkchen); Fahrzeugliste kommt aus dem Repo |
| Lesestand | Ordner `lesestand/` (main.json + 16 Teildateien); MangaDex/MAL-Abfragen über Tampermonkey-Skript |

Alle Tools nutzen diesen gemeinsamen Sync.

- **Einrichten:** einmal pro Gerät/Browser auf der Startseite unter „GitHub-Sync“ Repo und Token eintragen (am iPhone auch in der Home-Bildschirm-App). Gespeichert in `localStorage["toolsync.config"]`.
- **Token:** Fine-grained, nur `tool-daten`, Contents: Read and write.
- **Ablauf:** Holen beim Öffnen und beim Zurückkehren in den Tab, Hochladen ein paar Sekunden nach einer Änderung und beim Verlassen. Ohne Netz wird es nachgeholt.
- **Zusammenführen:** pro Eintrag gewinnt die jüngste Änderung, Löschungen werden gemerkt (1 Jahr). Beim allerersten Abgleich eines Geräts gewinnt bei gleichen Einträgen der Cloud-Stand, eigene zusätzliche Einträge kommen dazu.
- **Schutz:** Würden auf einen Schlag mehr als 10 Einträge und über 30 % gelöscht, fragt das Tool nach (Abbrechen = behalten/wiederherstellen). Vor dem ersten Abgleich und vor jedem Massenlöschen wird eine Sicherheitskopie angelegt (Startseite → GitHub-Sync → Sicherheitskopien).
- **Anzeige:** kleines ☁︎-Feld unten links in jedem angebundenen Tool; antippen für Details und „Jetzt abgleichen“.
- Abgleich-Stand und Sicherheitskopien liegen in der IndexedDB `toolsync`.

Tool anbinden: `<script src="/startseite/sync-v1.js"></script>` einbinden, dann `ToolSync.create({ tool, collections, fields, get, apply })`, nach dem Laden `start()` und nach jedem erfolgreichen Speichern `changed()` aufrufen (Details oben in `sync-v1.js`). Bei inkompatiblen Änderungen eine neue Datei `sync-v2.js` anlegen statt v1 zu ändern.

## Neues Tool eintragen
In `index.html` oben in der Liste `TOOLS` einen Eintrag ergänzen: Pfad, Name, Emoji, Gruppe, Farbe, Zähler (`count`), Datenbankname(n) und localStorage-Präfix(e). Tag `sync` für Tools mit GitHub-Sync, `script` für Tools mit Tampermonkey-Skript.

## iPhone
Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Tools aus der Startseite heraus öffnen, dann bleiben sie im selben App-Fenster. Die App hat eigenen Speicher, getrennt von Safari, deshalb Daten einmal per Backup umziehen. Tools mit Browserskript in Safari nutzen.
