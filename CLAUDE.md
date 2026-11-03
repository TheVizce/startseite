# Startseite – Hinweise für Claude

Dieses Repo enthält die Übersicht aller Tools (`index.html`), den gemeinsamen GitHub-Sync `sync-v1.js`, die Navigation `nav-v1.js` und das App-Manifest. Details stehen in `README.md`.

## Wichtig
- `sync-v1.js` wird von **allen acht Tools** live eingebunden. Jede Änderung wirkt sofort überall. Nur abwärtskompatibel ändern; Inkompatibles als `sync-v2.js` anlegen und die Tools einzeln umstellen.
- Vor dem Push testen: Abgleich, Zusammenführen (jüngste Änderung gewinnt, Löschungen per Tombstone), Teildateien (Sharding), Massenlösch-Schutz und Sicherheitskopien.
- Die Startseite liest die Datenbanken der Tools nur. Schreiben darf sie nur `toolsync.config` und die eigene Datenbank `toolsync`.
- Neue Tools in der Liste `TOOLS` in `index.html` eintragen (Datenbanknamen, localStorage-Präfixe, Tags).
- Token gibt der Nutzer nur selbst auf der Startseite ein. Nie nach Tokens fragen oder sie in Code/Dateien schreiben. Ein fine-grained Token für `tool-daten` und `ranker-bilder` genügt.
- Direkte Pushes auf `main` sind erlaubt.
- Speicherregeln: localStorage (~5 MB) ist für alle Tools gemeinsam; nie `localStorage.clear()`. Vor Speicheränderungen kurz Befund und Variante nennen, danach Umstiegs-Anleitung.
