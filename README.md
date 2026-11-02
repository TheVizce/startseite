# Startseite

Übersicht über alle meine GitHub-Pages-Tools unter `thevizce.github.io` – mit Speicheranzeige.

Adresse: https://thevizce.github.io/startseite/

## Was die Seite zeigt
- Kacheln zu allen Tools, mit Hinweis „nur lokal“, „GitHub-Sync“ oder „Browserskript“ und der belegten Größe.
- **Speicher:** Belegung gesamt, localStorage (gemeinsam, ca. 5 MB) mit Warnung ab 70 %, Größe pro Tool (IndexedDB geschätzt + localStorage nach Präfix), nicht zugeordnete Schlüssel und weitere Datenbanken.
- Ob „dauerhafter Speicher“ (`navigator.storage.persist()`) aktiv ist, mit Knopf zum Anfragen.

Die Daten der Tools werden **nur gelesen**: Die Seite öffnet nur Datenbanken, die schon existieren, und gibt sie sofort frei, wenn ein Tool sie upgraden will. Schreiben tut sie nur ihre eigenen Sync-Einstellungen (`toolsync.config`).

## GitHub-Sync (`sync-v1.js`)
Gemeinsamer Abgleich für die Tools mit dem privaten Repo `TheVizce/tool-daten`.

| Tool | Ablage im Daten-Repo |
|---|---|
| GO Organizer | `pokemon-go.json` |
| Pokémon-Boxen | `pokemon-home.json` |
| Babe Organizer | Ordner `b-organizer/` (main.json + 32 Teildateien) – eigene Bilder bleiben lokal |
| Favoriten-Archiv | Ordner `nh-favoriten/` (main.json + 32 Teildateien) – Cover und API-Key bleiben lokal |

Kartenbinder und Videothek haben ihren eigenen Sync.

- **Einrichten:** einmal pro Gerät/Browser auf der Startseite unter „GitHub-Sync“ Repo und Token eintragen (am iPhone auch in der Home-Bildschirm-App). Gespeichert in `localStorage["toolsync.config"]`.
- **Token:** Fine-grained, nur `tool-daten`, Contents: Read and write.
- **Ablauf:** Holen beim Öffnen und beim Zurückkehren in den Tab, Hochladen ein paar Sekunden nach einer Änderung und beim Verlassen. Ohne Netz wird es nachgeholt.
- **Zusammenführen:** pro Eintrag gewinnt die jüngste Änderung, Löschungen werden gemerkt (1 Jahr). Beim allerersten Abgleich eines Geräts gewinnt bei gleichen Einträgen der Cloud-Stand, eigene zusätzliche Einträge kommen dazu.
- **Schutz:** Würden auf einen Schlag mehr als 10 Einträge und über 30 % gelöscht, fragt das Tool nach (Abbrechen = behalten/wiederherstellen). Vor dem ersten Abgleich und vor jedem Massenlöschen wird eine Sicherheitskopie angelegt (Startseite → GitHub-Sync → Sicherheitskopien).
- **Anzeige:** kleines ☁︎-Feld unten links in jedem angebundenen Tool; antippen für Details und „Jetzt abgleichen“.
- Abgleich-Stand und Sicherheitskopien liegen in der IndexedDB `toolsync`.

Tool anbinden: `<script src="/startseite/sync-v1.js"></script>` einbinden, dann `ToolSync.create({ tool, collections, fields, get, apply })`, nach dem Laden `start()` und nach jedem erfolgreichen Speichern `changed()` aufrufen (Details oben in `sync-v1.js`). Bei inkompatiblen Änderungen eine neue Datei `sync-v2.js` anlegen statt v1 zu ändern.

## Neues Tool eintragen
In `index.html` oben in der Liste `TOOLS` einen Eintrag ergänzen: Pfad, Name, Emoji, Datenbankname(n) und localStorage-Präfix(e). Tag `sync` für Tools mit GitHub-Sync, `script` für Tools mit Tampermonkey-Skript.

## iPhone
Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Tools aus der Startseite heraus öffnen, dann bleiben sie im selben App-Fenster. Die App hat eigenen Speicher, getrennt von Safari, deshalb Daten einmal per Backup umziehen. Tools mit Browserskript in Safari nutzen.
