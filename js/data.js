'use strict';
/* ---------- moves ----------
 * A move is a timed state. `hits` are active windows (frames) with a box in
 * front of the fighter: x = forward range, y = height range above the feet.
 * `tick(f, t, g)` runs every frame for custom behaviour (projectiles, dashes).
 */
const shoot = (at, opts, sfx = 'shot') => (f, t, g) => {
  if (t === at) { g.spawnProj(f, opts); g.sfx(sfx); }
};

const MOVES = {
  /* --- basics, shared by everyone --- */
  jab1: { dur: 15, pose: 'jab1', hits: [{ t: [4, 8], x: [6, 50], y: [28, 66], dmg: 18, kx: 1.6, stun: 17 }] },
  jab2: { dur: 15, pose: 'jab2', hits: [{ t: [4, 8], x: [6, 52], y: [28, 66], dmg: 20, kx: 1.8, stun: 17 }] },
  finisher: {
    dur: 26, pose: 'kick', start: f => { f.vx = f.facing * 2.5; },
    hits: [{ t: [7, 13], x: [6, 60], y: [20, 70], dmg: 34, kx: 5.5, ky: 6.5, down: true, heavy: true }],
  },
  runAtk: {
    dur: 26, pose: 'flykick', keepVel: true,
    start: f => { f.vx = f.facing * 6; }, tick: f => { f.vx *= 0.95; },
    hits: [{ t: [3, 16], x: [6, 56], y: [10, 60], dmg: 38, kx: 6.5, ky: 5.5, down: true, heavy: true }],
  },
  jumpAtk: { dur: 999, air: true, pose: 'airkick', hits: [{ t: [3, 24], x: [4, 52], y: [-6, 44], dmg: 30, kx: 4, ky: 4.5, down: true }] },

  /* --- Kai --- */
  pulse: {
    name: 'Pulse Shot', mp: 40, dur: 30, pose: 'cast',
    tick: shoot(10, { type: 'pulse', vx: 7.5, dmg: 45, kx: 4.5, ky: 4.5, down: true, y: 42 }),
  },
  riser: {
    name: 'Sky Riser', mp: 50, dur: 999, air: true, pose: 'upper', inv: [0, 12],
    start: f => { f.vy = 10.5; f.vx = f.facing * 2.2; },
    hits: [{ t: [2, 16], x: [-6, 48], y: [0, 95], dmg: 58, kx: 3, ky: 11, down: true, heavy: true }],
  },
  rushdown: {
    name: 'Rush Combo', mp: 65, dur: 46, pose: 'flurry', keepVel: true,
    tick: (f, t) => { f.vx = f.facing * (t < 34 ? 5.2 : 1); },
    hits: [4, 10, 16, 22].map(t => ({ t: [t, t + 3], x: [0, 50], y: [20, 68], dmg: 13, kx: 5.4, stun: 14 }))
      .concat([{ t: [30, 36], x: [0, 56], y: [10, 70], dmg: 30, kx: 7, ky: 6, down: true, heavy: true }]),
  },

  /* --- Ember --- */
  fireball: {
    name: 'Cinder Ball', mp: 45, dur: 30, pose: 'cast',
    tick: shoot(10, { type: 'fire', vx: 6.5, dmg: 50, effect: 'fire', down: true, kx: 5, ky: 5.5, y: 42 }, 'fire'),
  },
  blazerush: {
    name: 'Blaze Rush', mp: 60, dur: 36, pose: 'dash', keepVel: true,
    start: (f, g) => g.sfx('fire'),
    tick: (f, t, g) => {
      f.vx = f.facing * (t < 28 ? 7.5 : 1.5);
      if (t < 28) g.burst(f.x, f.y + rand(10, 60), f.z, 2, 'fire');
    },
    hits: [{ t: [2, 28], x: [0, 50], y: [5, 70], dmg: 52, effect: 'fire', down: true, kx: 7, ky: 6, heavy: true }],
  },
  eruption: {
    name: 'Eruption', mp: 90, dur: 54, pose: 'aoe', inv: [12, 30],
    tick: (f, t, g) => {
      if (t === 18) {
        g.blast(f, { rx: 125, rz: 52, dmg: 80, kx: 5, ky: 11, effect: 'fire', down: true, heavy: true });
        g.sfx('boom'); g.shake = 14;
        for (let i = -3; i <= 3; i++) g.burst(f.x + i * 36, 10, f.z + rand(-30, 30), 9, 'fire');
        g.ring(f.x, f.z, '#ff9a3c', 125);
      }
    },
  },

  /* --- Glacia --- */
  iceshard: {
    name: 'Frost Dart', mp: 40, dur: 28, pose: 'cast',
    tick: shoot(9, { type: 'ice', vx: 8, dmg: 28, effect: 'ice', stun: 20, kx: 1, y: 42 }, 'ice'),
  },
  pillar: {
    name: 'Glacier Spikes', mp: 70, dur: 44, pose: 'cast2',
    tick: (f, t, g) => {
      const i = [10, 18, 26].indexOf(t);
      if (i >= 0) {
        g.spawnProj(f, { type: 'spike', dx: 70 + i * 62, vx: 0, y: 0, life: 36, dmg: 36, effect: 'ice', r: 20, h: 95, pierce: true, fixed: true });
        g.sfx('ice');
      }
    },
  },
  nova: {
    name: 'Whiteout', mp: 60, dur: 40, pose: 'aoe', inv: [8, 18],
    tick: (f, t, g) => {
      if (t === 12) {
        g.blast(f, { rx: 100, rz: 46, dmg: 22, effect: 'ice', kx: 1, stun: 20 });
        g.sfx('shatter'); g.ring(f.x, f.z, '#bfeaff', 100);
        g.burst(f.x, f.y + 40, f.z, 26, 'ice');
      }
    },
  },

  /* --- Torque --- */
  rocktoss: {
    name: 'Boulder Toss', mp: 45, dur: 34, pose: 'throw',
    tick: shoot(14, { type: 'rock', vx: 6.5, vy: 5, grav: 0.32, y: 62, dmg: 62, down: true, kx: 6, ky: 5, r: 14, heavy: true }, 'swing'),
  },
  charge: {
    name: 'Bull Charge', mp: 50, dur: 40, pose: 'dash', keepVel: true, armor: true,
    tick: (f, t, g) => { f.vx = f.facing * (t < 32 ? 6.5 : 1.5); if (t % 4 === 0 && t < 32) g.burst(f.x, 2, f.z, 1, 'dust'); },
    hits: [{ t: [3, 32], x: [0, 46], y: [5, 70], dmg: 58, kx: 9, ky: 6, down: true, heavy: true }],
  },
  slam: {
    name: 'Quake Slam', mp: 75, dur: 54, pose: 'slam', armor: true,
    start: f => { f.slammed = false; },
    tick: (f, t, g) => {
      if (t === 1) f.vy = 8.5;
      if (t > 4 && f.y === 0 && !f.slammed) {
        f.slammed = true;
        g.blast(f, { rx: 135, rz: 48, dmg: 70, kx: 4, ky: 9.5, down: true, heavy: true, groundOnly: true });
        g.sfx('boom'); g.shake = 16; g.ring(f.x, f.z, '#d8c8a0', 135);
        for (let i = -3; i <= 3; i++) g.burst(f.x + i * 40, 2, f.z + rand(-25, 25), 4, 'dust');
      }
    },
  },

  /* --- Zephyr --- */
  windblade: {
    name: 'Gale Edge', mp: 30, dur: 22, pose: 'cast',
    tick: shoot(7, { type: 'wind', vx: 12, dmg: 26, kx: 3, stun: 20, pierce: true, life: 60, y: 40 }, 'wind'),
  },
  cyclone: {
    name: 'Cyclone Kick', mp: 60, dur: 999, air: true, pose: 'spin', inv: [0, 6],
    start: (f, g) => { f.vy = 9; f.vx = f.facing * 1.5; g.sfx('wind'); },
    hits: [2, 8, 14, 20].map(t => ({ t: [t, t + 4], x: [-48, 48], y: [-5, 80], dmg: 13, kx: 0.5, ky: 4.5, down: true, radial: true }))
      .concat([{ t: [26, 32], x: [-50, 50], y: [-5, 80], dmg: 25, kx: 7, ky: 7, down: true, radial: true, heavy: true }]),
  },
  blink: {
    name: 'Blink Slash', mp: 35, dur: 30, pose: 'blink', inv: [0, 16],
    tick: (f, t, g) => {
      if (t === 6) {
        g.burst(f.x, f.y + 40, f.z, 12, 'wind'); g.sfx('tele');
        f.x = clamp(f.x + f.facing * 190, g.minX + 20, g.maxX - 20);
        g.burst(f.x, f.y + 40, f.z, 12, 'wind');
      }
    },
    hits: [{ t: [9, 15], x: [-52, 52], y: [0, 70], dmg: 36, kx: 5, ky: 5.5, down: true, radial: true }],
  },

  /* --- Nyx --- */
  darkorbs: {
    name: 'Umbra Swarm', mp: 55, dur: 34, pose: 'cast',
    tick: (f, t, g) => {
      const i = [8, 14, 20].indexOf(t);
      if (i >= 0) {
        g.spawnProj(f, { type: 'orb', vx: 4, vz: (i - 1) * 0.9, y: 34 + i * 10, dmg: 22, stun: 22, kx: 2, homing: 0.22, life: 150, r: 9 });
        g.sfx('dark');
      }
    },
  },
  shadowstep: {
    name: 'Shadow Step', mp: 40, dur: 30, pose: 'blinkstab', inv: [0, 12],
    tick: (f, t, g) => {
      if (t === 6) {
        const tg = g.nearestEnemy(f);
        g.burst(f.x, f.y + 40, f.z, 12, 'dark'); g.sfx('tele');
        if (tg) {
          f.x = clamp(tg.x - tg.facing * 40, g.minX + 20, g.maxX - 20);
          f.z = tg.z; f.facing = sign(tg.x - f.x) || tg.facing;
        }
        g.burst(f.x, f.y + 40, f.z, 12, 'dark');
      }
    },
    hits: [{ t: [10, 15], x: [0, 58], y: [20, 70], dmg: 46, kx: 3, stun: 34 }],
  },
  siphon: {
    name: 'Soul Siphon', mp: 50, dur: 32, pose: 'grab',
    hits: [{
      t: [8, 14], x: [4, 62], y: [10, 70], dmg: 42, kx: 2, stun: 30,
      onHit: (f, tg, res, g) => {
        if (res === 'block') return;
        f.hp = Math.min(f.maxHp, f.hp + 45);
        g.burst(f.x, f.y + 45, f.z, 12, 'heal'); g.sfx('heal');
      },
    }],
  },

  /* --- enemy only --- */
  sling: {
    name: 'Sling', mp: 50, dur: 30, pose: 'throw',
    tick: shoot(12, { type: 'rock', vx: 6, vy: 3.5, grav: 0.25, y: 55, dmg: 24, stun: 20, kx: 3, r: 8 }, 'swing'),
  },
};

/* ---------- fighters ----------
 * specials are keyed by input: Defend + (F)orward / (U)p-or-down + (A)ttack / (J)ump.
 * `ai` tells computer players when each special is worth using.
 */
const CHARS = {
  kai: {
    name: 'Kai', title: 'Wandering Striker', hp: 500, speed: 1, power: 1,
    desc: 'All-rounder with a ranged shot, an anti-air and a rushing combo.',
    look: { skin: '#f2c9a0', hair: '#2b3350', style: 'spiky', top: '#3f7fe0', pants: '#e9eef7', accent: '#ffd23f', extra: 'headband' },
    specials: { FA: 'pulse', UA: 'riser', FJ: 'rushdown' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'UA', kind: 'melee' }, { key: 'FJ', kind: 'gap' }],
  },
  ember: {
    name: 'Ember', title: 'Forge Dancer', hp: 480, speed: 1, power: 1.08,
    desc: 'Hits hard with fire. Burning attacks always knock down.',
    look: { skin: '#e8b48c', hair: '#ff7a1a', style: 'flame', top: '#c8322b', pants: '#3a2a2a', accent: '#ffb347', extra: 'scarf' },
    specials: { FA: 'fireball', FJ: 'blazerush', UA: 'eruption' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'FJ', kind: 'gap' }, { key: 'UA', kind: 'aoe' }],
  },
  glacia: {
    name: 'Glacia', title: 'Tundra Sage', hp: 460, speed: 1, power: 0.95,
    desc: 'Freezes foes solid, then shatters them with a follow-up.',
    look: { skin: '#f5dccb', hair: '#bfeaff', style: 'long', top: '#5fb8d9', pants: '#2f4a73', accent: '#ffffff', extra: 'none' },
    specials: { FA: 'iceshard', UA: 'pillar', UJ: 'nova' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'UA', kind: 'mid' }, { key: 'UJ', kind: 'aoe' }],
  },
  torque: {
    name: 'Torque', title: 'Quarry Giant', hp: 600, speed: 0.84, power: 1.2,
    desc: 'Slow and sturdy. Charges and slams shrug off incoming hits.',
    look: { skin: '#c98f65', hair: '#3a2a20', style: 'bald', top: '#6c7a3a', pants: '#4a3b2a', accent: '#b8b8b8', extra: 'pads', bulk: 1.35 },
    scale: 1.1,
    specials: { FA: 'rocktoss', FJ: 'charge', UA: 'slam' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'FJ', kind: 'gap' }, { key: 'UA', kind: 'aoe' }],
  },
  zephyr: {
    name: 'Zephyr', title: 'Sky Courier', hp: 430, speed: 1.22, power: 0.92,
    desc: 'The fastest fighter. Piercing wind blades and a teleport slash.',
    look: { skin: '#f0d0a8', hair: '#3fbf7f', style: 'ponytail', top: '#f2f2e6', pants: '#2f7d5b', accent: '#9be8c0', extra: 'scarf' },
    specials: { FA: 'windblade', FJ: 'blink', UJ: 'cyclone' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'FJ', kind: 'gap' }, { key: 'UJ', kind: 'melee' }],
  },
  nyx: {
    name: 'Nyx', title: 'Dusk Warden', hp: 460, speed: 1.05, power: 1,
    desc: 'Homing orbs, a teleport ambush and a life-stealing grab.',
    look: { skin: '#cdb8d8', hair: '#3a2a5a', style: 'hood', top: '#4a3470', pants: '#241a38', accent: '#c77dff', extra: 'none' },
    specials: { FA: 'darkorbs', UJ: 'shadowstep', UA: 'siphon' },
    ai: [{ key: 'FA', kind: 'proj' }, { key: 'UJ', kind: 'tele' }, { key: 'UA', kind: 'melee' }],
  },

  /* enemies for campaign & survival */
  thug: {
    name: 'Scrapper', hp: 150, speed: 0.9, power: 0.7, enemy: true,
    look: { skin: '#d9a77c', hair: '#b03a48', style: 'mohawk', top: '#555b6e', pants: '#33363f', accent: '#b03a48', extra: 'none' },
    specials: {}, ai: [],
  },
  slinger: {
    name: 'Slinger', hp: 120, speed: 0.95, power: 0.7, enemy: true, ranged: true, mp: 100,
    look: { skin: '#e3bb92', hair: '#7a5b2e', style: 'cap', top: '#8a6a3a', pants: '#3f3a2f', accent: '#d9c27a', extra: 'none' },
    specials: { FA: 'sling' }, ai: [{ key: 'FA', kind: 'proj' }],
  },
  brute: {
    name: 'Bruiser', hp: 360, speed: 0.72, power: 1.25, enemy: true, scale: 1.24, mp: 120,
    look: { skin: '#b98a6a', hair: '#222', style: 'bald', top: '#7a2f2f', pants: '#2b2b33', accent: '#444', extra: 'pads', bulk: 1.4 },
    specials: { FJ: 'charge' }, ai: [{ key: 'FJ', kind: 'gap' }],
  },
};
const ROSTER = ['kai', 'ember', 'glacia', 'torque', 'zephyr', 'nyx'];

/* ---------- campaign ---------- ('!' marks a boss) */
const STAGES = [
  { name: 'Meadow Road', theme: 'meadow', waves: [['thug', 'thug'], ['thug', 'slinger', 'thug'], ['brute', 'thug']] },
  { name: 'Lantern Courtyard', theme: 'dojo', waves: [['thug', 'slinger', 'thug'], ['brute', 'slinger'], ['!zephyr', 'thug', 'thug']] },
  { name: 'Frostfall Pass', theme: 'glacier', waves: [['slinger', 'slinger', 'thug'], ['brute', 'brute'], ['!glacia', 'slinger', 'thug']] },
  { name: 'Cinder Ridge', theme: 'volcano', waves: [['thug', 'thug', 'brute'], ['slinger', 'brute', 'slinger'], ['!ember', '!torque']] },
  { name: 'Midnight Rooftops', theme: 'rooftop', waves: [['thug', 'thug', 'slinger', 'slinger'], ['brute', 'brute', 'thug'], ['!kai', 'thug'], ['!nyx', 'brute']] },
];
const THEMES = ['meadow', 'dojo', 'glacier', 'volcano', 'rooftop'];
const THEME_NAMES = { meadow: 'Meadow Road', dojo: 'Lantern Courtyard', glacier: 'Frostfall Pass', volcano: 'Cinder Ridge', rooftop: 'Midnight Rooftops' };

const DIFFICULTY = {
  easy: { atkCool: 30, block: 0.02, spec: 0.006, dmg: 0.7 },
  normal: { atkCool: 17, block: 0.07, spec: 0.016, dmg: 1 },
  hard: { atkCool: 9, block: 0.16, spec: 0.03, dmg: 1.1 },
};
