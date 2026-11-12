# Rumble Lane

An original 2.5D arena brawler for the browser, in the spirit of classic
freeware beat-'em-ups: fighters move left/right **and** in depth, chain
combos, block, and spend energy on special moves.

Everything — fighters, arenas, effects, sound and music — is generated in
code. There are no image or audio assets and no build step.

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Modes

- **Versus** – up to 4 fighters, any mix of Player 1, Player 2 and computer
  opponents, free-for-all or teams, 5 arenas, 3 difficulty levels.
- **Campaign** – 5 scrolling stages with enemy waves and boss fights, solo or
  2-player co-op.
- **Survival** – endless waves; your best wave is saved locally.

## Controls

|         | Player 1  | Player 2            |
|---------|-----------|---------------------|
| Move    | `W A S D` | arrow keys          |
| Attack  | `F`       | `,` or Numpad 1     |
| Jump    | `G`       | `.` or Numpad 2     |
| Defend  | `H`       | `/` or Numpad 3     |

`Esc`/`P` pauses, `M` mutes. Touch devices get on-screen buttons for Player 1.

- Tap Attack three times for a combo ending in a knock-down.
- Double-tap left/right to run; attack while running for a flying kick.
- Hold Defend to block hits from the front.
- Specials: hold **Defend**, hold a direction, then press **Attack** or
  **Jump**. Each fighter's list is under *How to Play* and in the pause menu.

## Fighters

| Fighter | Style |
|---------|-------|
| Kai     | All-rounder: energy shot, rising uppercut, rushing combo |
| Ember   | Fire: fireball, flaming dash, area eruption |
| Glacia  | Ice: freezing dart, ground spikes, freezing burst |
| Torque  | Heavy: boulder toss, armoured charge, ground slam |
| Zephyr  | Speed: piercing wind blade, teleport slash, spinning kick |
| Nyx     | Shadow: homing orbs, teleport ambush, life-steal grab |

## Code layout

| File | Contents |
|------|----------|
| `js/core.js` | constants, helpers, WebAudio sound/music, keyboard input |
| `js/data.js` | moves, fighters, campaign stages, difficulty tuning |
| `js/draw.js` | procedural fighter, projectile and arena rendering |
| `js/game.js` | fighter state machine, AI, combat, game modes, HUD |
| `js/ui.js`   | menus, scaling, touch controls, main loop |
