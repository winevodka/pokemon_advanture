# Pokémon Learning Adventure

A local-server educational webgame: guide a mascot character from **START** to **END**
across a branching map, answering multiple-choice questions to keep routes open.

## Run it

```powershell
npm install
npm start
```

Then open http://localhost:3000 in a browser.

- Main menu: http://localhost:3000/
- Game: http://localhost:3000/game.html
- Question bank admin: http://localhost:3000/admin.html

## Project structure

```
server/
  server.js          Express app: serves public/ and the questions REST API
  data/questions.json  Question bank storage (read/written by the server)
public/
  index.html         Main menu (Start / Settings / Exit)
  game.html          Gameplay screen (map, HUD, quiz/win/stuck modals)
  admin.html         Question bank management (add/edit/delete/import)
  css/style.css      Cartoon-style theme, layout and animations
  js/mapData.js      Graph definition: nodes, edges, items, question links
  js/game.js         Game engine: rendering, movement, quiz flow, route locking
  js/storage.js      localStorage persistence (progress + settings)
  js/api.js          fetch wrapper for the questions REST API
  js/audio.js        Web Audio API sound effects/music (no external files needed)
  js/menu.js         Main menu logic
  js/admin.js        Admin CRUD + JSON import UI
```

## Question Bank API

| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| GET    | /api/questions          | List all questions                   |
| GET    | /api/questions/:id      | Get one question                     |
| POST   | /api/questions          | Add a question                       |
| PUT    | /api/questions/:id      | Edit a question                      |
| DELETE | /api/questions/:id      | Delete a question                    |
| POST   | /api/questions/import   | Bulk import a JSON array (appends)   |

Question shape:

```json
{ "id": 1, "question": "2 + 2 = ?", "options": ["2", "3", "4", "5"], "correctAnswer": 2 }
```

## Game rules implemented

- Map is a directed graph (`public/js/mapData.js`) with multiple converging routes from
  START to END (FR-02). Six edges carry a fruit item (🍇🍌🍍) tied to a question.
- Reaching an item-bearing edge pauses movement and opens a quiz popup; you can submit once (FR-05/FR-06).
- Correct answer: item clears, +10 score, path stays usable, Pikachu continues (FR-07).
- Wrong answer: that path is permanently **Locked** (red) — find another route (FR-08).
- Route colors: Normal = green, Locked = red, Completed = gray (FR-09).
- Reaching END shows a crown + victory popup and plays a victory jingle (FR-10).
- Restart resets score, question progress, path status and position (FR-11), but does
  not touch the admin question bank.
- Progress (score, completed questions, locked paths, position) is saved to
  `localStorage` and restored on page reload (Data Persistence section).

## Notes on assets

This project ships with **no bundled Pokémon artwork or audio files** to avoid using
copyrighted Nintendo/Game Freak assets. The character is a small generic yellow mascot
drawn in SVG, and sound effects/background music are synthesized at runtime with the
Web Audio API. If you own appropriate assets, you can drop image/audio files into
`public/assets/` and wire them into `game.js`/`audio.js`.
