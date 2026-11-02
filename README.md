# Startseite

Übersicht über alle meine GitHub-Pages-Tools unter `thevizce.github.io` – mit Speicheranzeige.

Adresse: https://thevizce.github.io/startseite/

## Was die Seite zeigt
- Kacheln zu allen Tools, mit Hinweis „nur lokal“, „GitHub-Sync“ oder „Browserskript“ und der belegten Größe.
- **Speicher:** Belegung gesamt, localStorage (gemeinsam, ca. 5 MB) mit Warnung ab 70 %, Größe pro Tool (IndexedDB geschätzt + localStorage nach Präfix), nicht zugeordnete Schlüssel und weitere Datenbanken.
- Ob „dauerhafter Speicher“ (`navigator.storage.persist()`) aktiv ist, mit Knopf zum Anfragen.

Die Seite **liest nur**: Sie schreibt nichts in den localStorage, öffnet nur Datenbanken, die schon existieren, und gibt sie sofort frei, wenn ein Tool sie upgraden will.

## Neues Tool eintragen
In `index.html` oben in der Liste `TOOLS` einen Eintrag ergänzen: Pfad, Name, Emoji, Datenbankname(n) und localStorage-Präfix(e). Tag `sync` für Tools mit GitHub-Sync, `script` für Tools mit Tampermonkey-Skript.

## iPhone
Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Tools aus der Startseite heraus öffnen, dann bleiben sie im selben App-Fenster. Die App hat eigenen Speicher, getrennt von Safari, deshalb Daten einmal per Backup umziehen. Tools mit Browserskript in Safari nutzen.
