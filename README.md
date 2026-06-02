# ADMM Team Planner Complete

Diese Version ist für echten Teamzugriff gedacht.

## Enthalten

- E-Mail/Passwort Login über Supabase
- Mitgliederprofile
- Eigener Bereich je Mitglied
- Gemeinsames Kanban-Board
- Regeln für Statuswechsel
- Gemeinsame Bestellungen
- Gemeinsame Fragen & Blocker
- PM-Übersicht
- Team-Level-System
- Realtime-Updates über Supabase

## 1. Installation auf Windows / VS Code

ZIP entpacken, Ordner in VS Code öffnen, Terminal starten:

```bash
npm install
```

## 2. Supabase-Projekt erstellen

1. Auf supabase.com anmelden
2. New Project erstellen
3. Project URL und anon public key kopieren
4. Datei `.env` im Projektordner erstellen:

```env
VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=DEIN_SUPABASE_ANON_KEY
```

## 3. Datenbank anlegen

In Supabase:

SQL Editor -> New Query

Dann Inhalt aus `supabase_schema.sql` einfügen und ausführen.

## 4. App starten

```bash
npm run dev
```

Dann öffnen:

```text
http://localhost:5173
```

## 5. Teammitglieder registrieren

Jedes Teammitglied erstellt in der App einen Account.

## 6. PM aktivieren

Nach Kassys Registrierung im Supabase SQL Editor ausführen:

```sql
update public.profiles
set is_pm = true, role = 'PM / Product Owner', area = 'PM'
where display_name = 'Kassy';
```

## 7. Online stellen

Empfohlen:

1. GitHub Repository erstellen
2. Code pushen
3. Vercel mit GitHub verbinden
4. In Vercel Environment Variables setzen:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
5. Deploy

Dann haben alle im Team einen Link.
