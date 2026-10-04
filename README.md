# Turret vs Zombies

Turret vs Zombies is a browser-based arcade defense game. Move a turret across the lanes, shoot incoming zombies, survive increasingly difficult waves, and spend collected resources on upgrades. The game includes Standard Battle, class raids, an endless mode, and persistent progression.

## Play

There is no build step or package installation. Serve the project directory over HTTP, then open the game in a modern browser:

```powershell
py -m http.server 8000
```

Go to <http://localhost:8000/TvZ2.html>. You can also use a static-file server such as the VS Code Live Server extension.

> The game loads its fonts from Google Fonts, so an internet connection is needed for those fonts. Gameplay itself is implemented locally in the project.

## Controls

| Action | Keyboard | On-screen controls |
| --- | --- | --- |
| Move left / right | `←` / `A`, `→` / `D` | Arrow buttons |
| Shoot | `Space` / `Enter` | **FIRE** button |
| Reload | `R` | Reload button |
| Switch utility | `Q` | Utility button |
| Deploy utility | `E` | Deploy button |
| Open weapon shop | `B` / `P` | Use the in-game menu |

Touch controls are available on mobile devices. The input mode can also be changed in Settings.

## Progress and settings

Game progress and settings are stored in this browser's `localStorage`; they are not synced between browsers or devices. Use **Wipe All Save Data** in Settings to reset saved progress.

## Project structure

```text
TvZ2.html       Game interface and styles
js/
  config.js     Game and upgrade configuration
  audio.js      Sound effects and music
  particles.js  Canvas particle effects
  game.js       Game state, controls, and gameplay
```
