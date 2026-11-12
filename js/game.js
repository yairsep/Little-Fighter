'use strict';
/* ================= Fighter ================= */
let nextId = 1;
class Fighter {
  constructor(game, charId, o) {
    this.game = game; this.id = nextId++;
    this.charId = charId; this.char = CHARS[charId];
    this.team = o.team; this.ctrl = o.ctrl; this.human = !!o.human; this.label = o.label || '';
    this.boss = !!o.boss; this.panel = !!o.panel;
    this.scale = (this.char.scale || 1) * (o.boss ? 1.12 : 1);
    this.maxHp = Math.round(this.char.hp * (o.hpMul || 1)); this.hp = this.maxHp; this.shownHp = this.hp;
    this.maxMp = this.char.mp || 250; this.mp = this.char.enemy ? 0 : this.maxMp * 0.6;
    this.dmgMul = o.dmgMul || 1;
    this.x = o.x; this.z = o.z; this.y = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = o.facing || 1;
    this.state = 'idle'; this.t = 0; this.animT = 0; this.move = null; this.hitSets = [];
    this.combo = 0; this.comboT = 0; this.buf = false; this.airAtk = false;
    this.invuln = 0; this.flash = 0; this.guard = 100; this.stun = 0; this.bounced = false;
    this.entering = !!o.entering; this.stats = { dmg: 0, kos: 0 };
  }
  get alive() { return this.hp > 0; }
  get hittable() {
    if (this.invuln > 0 || this.state === 'lying' || this.state === 'dead' || this.state === 'getup') return false;
    const m = this.move;
    if (this.state === 'attack' && m.inv && this.t >= m.inv[0] && this.t <= m.inv[1]) return false;
    return true;
  }
  get canAct() { return this.state === 'idle' || this.state === 'walk' || this.state === 'run'; }
  set(state) { this.state = state; this.t = 0; }

  startMove(name) {
    const m = MOVES[name];
    this.set('attack'); this.move = m; this.hitSets = []; this.buf = false;
    if (m.start) m.start(this, this.game);
    if (!m.mp) this.game.sfx('swing');
  }
  trySpecial(inp) {
    const dir = inp.mx ? 'F' : inp.mz ? 'U' : '', btn = inp.atk ? 'A' : 'J';
    const name = this.char.specials[dir + btn];
    if (!name) return false;
    const m = MOVES[name];
    if (this.mp < m.mp) { if (this.human) this.game.sfx('nomp'); return true; }
    if (inp.mx) this.facing = inp.mx;
    this.mp -= m.mp;
    this.startMove(name);
    if (this.panel) this.game.text(this.x, this.y + 105 * this.scale, this.z, m.name, '#fff7c2', 13);
    return true;
  }
  groundAttack() {
    if (this.state === 'run') { this.startMove('runAtk'); this.combo = 0; return; }
    this.startMove(['jab1', 'jab2', 'finisher'][this.combo]);
    this.combo = (this.combo + 1) % 3; this.comboT = 36;
  }

  update() {
    const g = this.game, c = this.char;
    this.t++; this.animT++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.comboT > 0) { if (--this.comboT === 0) this.combo = 0; }
    this.shownHp += (this.hp - this.shownHp) * 0.06;
    if (this.alive) { this.mp = Math.min(this.maxMp, this.mp + (c.enemy ? 0.25 : 0.11)); this.guard = Math.min(100, this.guard + 0.4); }
    const inp = this.alive && g.phase !== 'intro' ? this.ctrl.poll(this, g) : NO_INPUT;
    const grounded = this.y <= 0;

    switch (this.state) {
      case 'idle': case 'walk': case 'run': {
        if (inp.def && (inp.atk || inp.jmp) && this.trySpecial(inp)) break;
        if (inp.atk) { this.groundAttack(); break; }
        if (inp.jmp) {
          const sp = (this.state === 'run' ? 4.9 : 2.6) * c.speed;
          this.vy = 10.4; this.vx = inp.mx * sp; this.vz = inp.mz * 1.4; this.airAtk = false;
          this.set('jump'); g.sfx('jump'); break;
        }
        if (inp.def) { this.set('defend'); this.vx = this.vz = 0; break; }
        if (inp.mx || inp.mz) {
          const run = inp.run && inp.mx !== 0, sp = (run ? 4.7 : 2.3) * c.speed;
          this.vx = inp.mx * sp; this.vz = inp.mz * sp * 0.62;
          if (inp.mx) this.facing = inp.mx;
          const st = run ? 'run' : 'walk';
          if (this.state !== st) this.state = st;
          if (run && this.animT % 9 === 0) g.burst(this.x, 2, this.z, 1, 'dust');
        } else { this.vx = this.vz = 0; if (this.state !== 'idle') this.set('idle'); }
        break;
      }
      case 'defend':
        this.vx *= 0.8; this.vz = 0;
        if ((inp.atk || inp.jmp) && this.trySpecial(inp)) break;
        if (inp.atk) { this.groundAttack(); break; }
        if (inp.mx) this.facing = inp.mx;
        if (!inp.def) this.set('idle');
        break;
      case 'jump':
        this.vx = lerp(this.vx, inp.mx * 2.6 * c.speed, 0.04);
        if (inp.atk && !this.airAtk) { this.airAtk = true; if (inp.mx) this.facing = inp.mx; this.startMove('jumpAtk'); }
        else if (grounded && this.vy <= 0 && this.t > 2) { this.set('idle'); g.sfx('land'); g.burst(this.x, 2, this.z, 3, 'dust'); }
        break;
      case 'attack': {
        const m = this.move;
        if (m.tick) m.tick(this, this.t, g);
        if (this.state !== 'attack') break;
        if (m.hits) for (let i = 0; i < m.hits.length; i++) {
          const h = m.hits[i];
          if (this.t >= h.t[0] && this.t <= h.t[1]) g.meleeHit(this, h, i);
        }
        if (inp.atk && this.t > 3) this.buf = true;
        if (grounded && !m.keepVel && !m.air) { this.vx *= 0.8; this.vz = 0; }
        if (m.keepVel) this.vz = 0;
        const done = m.air ? (this.y <= 0 && this.vy <= 0 && this.t > 3) : this.t >= m.dur;
        if (done) {
          if (m.air) { g.sfx('land'); g.burst(this.x, 2, this.z, 3, 'dust'); }
          this.vx = 0; this.set('idle');
          if (this.buf && !m.mp && !m.air && this.combo > 0) this.groundAttack();
        }
        break;
      }
      case 'hurt':
        this.vx *= 0.85; this.vz = 0;
        if (this.t >= this.stun) this.set('idle');
        break;
      case 'frozen':
        this.vx *= 0.9; this.vz = 0;
        if (this.t >= 105) { this.set('idle'); g.burst(this.x, this.y + 40, this.z, 10, 'ice'); g.sfx('shatter'); }
        break;
      case 'fall':
        if (this.y <= 0 && this.vy <= 0 && this.t > 1) {
          g.burst(this.x, 2, this.z, 5, 'dust'); g.sfx('land');
          if (!this.bounced && this.landV < -6) { this.bounced = true; this.vy = 3.6; this.vx *= 0.5; }
          else { this.vx *= 0.4; this.set(this.alive ? 'lying' : 'dead'); if (!this.alive) g.onDeath(this); }
        }
        break;
      case 'lying':
        this.vx *= 0.82; this.vz = 0;
        if (this.t > 38) this.set('getup');
        break;
      case 'getup':
        this.vx = 0;
        if (this.t > 18) { this.set('idle'); this.invuln = 40; }
        break;
      case 'dead': this.vx *= 0.82; this.vz = 0; break;
    }

    /* physics */
    this.x += this.vx; this.z += this.vz;
    this.landV = 0;
    if (this.y > 0 || this.vy > 0) {
      this.y += this.vy; this.vy -= GRAV;
      if (this.y <= 0) { this.landV = this.vy; this.y = 0; this.vy = 0; }
    }
    this.z = clamp(this.z, 0, ZMAX);
    if (this.entering) { if (this.x > g.minX + 30 && this.x < g.maxX - 30) this.entering = false; }
    else this.x = clamp(this.x, g.minX + 16, g.maxX - 16);
  }
}

/* ================= computer players ================= */
class AI {
  constructor(level) { this.lv = DIFFICULTY[level]; this.cool = rand(20, 50); this.defT = 0; this.zBias = rand(-1, 1); this.jumpAtkT = 0; this.wander = 0; }
  poll(f, g) {
    const o = { mx: 0, mz: 0, atk: false, jmp: false, def: false, run: false }, lv = this.lv;
    if (this.cool > 0) this.cool--;
    if (this.jumpAtkT > 0 && --this.jumpAtkT === 0) { o.atk = true; return o; }
    const tg = g.nearestEnemy(f);
    if (!tg) return o;
    let dx = tg.x - f.x, dz = tg.z - f.z;
    const adx = Math.abs(dx), adz = Math.abs(dz), dir = sign(dx) || f.facing;
    const reach = 46 * f.scale + 10 * tg.scale;

    /* go for a snack when hurt */
    if (f.hp < f.maxHp * 0.45 && g.items.length && !f.char.enemy) {
      const it = g.items.find(i => i.type === 'apple' && Math.abs(i.x - f.x) < 400);
      if (it && adx > 90) { o.mx = sign(it.x - f.x); o.mz = Math.abs(it.z - f.z) > 6 ? sign(it.z - f.z) : 0; o.run = true; return o; }
    }
    /* defence: block melee, sidestep projectiles */
    if (this.defT > 0) { this.defT--; o.def = true; o.mx = 0; if (f.facing !== dir) o.mx = dir; return o; }
    if (f.canAct) {
      const meleeThreat = tg.state === 'attack' && adx < 80 && adz < 18 && tg.facing === -dir && tg.t < 8;
      if (meleeThreat && Math.random() < lv.block * 4) { this.defT = 14; o.def = true; return o; }
      for (const p of g.projs) {
        if (p.team === f.team || p.fixed) continue;
        const pdx = f.x - p.x;
        if (sign(pdx) === sign(p.vx) && Math.abs(pdx) < 170 && Math.abs(p.z - f.z) < 18) {
          if (Math.random() < lv.block * 2) {
            if (Math.random() < 0.5) { this.defT = 16; o.def = true; o.mx = -sign(p.vx); return o; }
            this.dodge = { z: f.z > ZMAX / 2 ? -1 : 1, t: 16 };
          }
          break;
        }
      }
    }
    if (this.dodge && this.dodge.t-- > 0) { o.mz = this.dodge.z; return o; }

    /* offence */
    const tgOpen = tg.hittable;
    if (f.canAct && this.cool <= 0 && tgOpen) {
      for (const s of f.char.ai) {
        const m = MOVES[f.char.specials[s.key]];
        if (f.mp < m.mp || Math.random() > lv.spec * (f.boss ? 2 : 1)) continue;
        const ok = s.kind === 'proj' ? adz < 10 && adx > 110 && adx < 440
          : s.kind === 'mid' ? adz < 14 && adx > 50 && adx < 220
          : s.kind === 'melee' ? adz < 12 && adx < 58
          : s.kind === 'aoe' ? adz < 36 && adx < 95
          : s.kind === 'gap' ? adz < 12 && adx > 90 && adx < 250
          : adx > 150;
        if (!ok) continue;
        o.def = true; o.atk = s.key[1] === 'A'; o.jmp = s.key[1] === 'J';
        if (s.key[0] === 'F') o.mx = dir; else { o.mz = 1; f.facing = dir; }
        this.cool = 45 + lv.atkCool;
        return o;
      }
      if (adx < reach && adz < 13) {
        if (f.facing !== dir) { o.mx = dir; return o; }
        o.atk = true; this.cool = lv.atkCool + rand(0, 6);
        return o;
      }
      if (adx > 80 && adx < 150 && adz < 14 && Math.random() < 0.012) { o.jmp = true; o.mx = dir; this.jumpAtkT = 13; return o; }
    }
    if (f.state === 'attack' && !f.move.mp && this.cool <= 0 && adx < reach + 14) { o.atk = true; this.cool = lv.atkCool; }

    /* movement */
    if (!tgOpen && adx < 130) { o.mx = -dir; if (adz < 30) o.mz = dz > 0 ? -1 : 1; return o; }   // give downed foes room
    if (f.char.ranged) {
      if (adx < 170) o.mx = -dir; else if (adx > 380) o.mx = dir; else if (f.facing !== dir) o.mx = dir;
      if (adz > 8) o.mz = sign(dz);
      return o;
    }
    if (adx > reach - 8) { o.mx = dir; o.run = adx > 240; }
    else if (adx < 18) o.mx = -dir;
    const wantZ = adx > 160 ? dz + this.zBias * 30 : dz;
    if (Math.abs(wantZ) > 7) o.mz = sign(wantZ);
    return o;
  }
}

/* ================= Game ================= */
class Game {
  /* cfg: { mode:'vs'|'campaign'|'survival', slots:[{ctrl:'p1'|'p2'|'cpu', char, team}], theme, difficulty, attract } */
  constructor(cfg) {
    this.cfg = cfg; this.mode = cfg.mode; this.silent = !!cfg.attract;
    this.fighters = []; this.projs = []; this.parts = []; this.items = []; this.texts = [];
    this.time = 0; this.hitstop = 0; this.shake = 0; this.camX = 0; this.minX = 0; this.maxX = 1400;
    this.phase = 'intro'; this.phaseT = 0; this.banner = ''; this.sub = '';
    this.wave = 0; this.stageIdx = cfg.stage || 0; this.result = null; this.kos = 0; this.itemT = 500;
    this.players = [];
    if (this.mode === 'vs') this.setupVs(); else this.setupCoop();
  }
  sfx(n) { if (!this.silent) Sfx.play(n); }
  makeCtrl(c) { return c === 'p1' ? new HumanInput(0) : c === 'p2' ? new HumanInput(1) : new AI(this.cfg.difficulty || 'normal'); }

  setupVs() {
    this.theme = this.cfg.theme; this.maxX = 1400;
    const n = this.cfg.slots.length;
    this.cfg.slots.forEach((s, i) => {
      const x = 700 + (i - (n - 1) / 2) * (n > 2 ? 240 : 420);
      const f = new Fighter(this, s.char, {
        team: s.team, ctrl: this.makeCtrl(s.ctrl), human: s.ctrl !== 'cpu', label: s.ctrl === 'cpu' ? 'CPU' : s.ctrl.toUpperCase(),
        x, z: 50 + ((i * 53) % 100), facing: x < 700 ? 1 : -1, panel: true,
        dmgMul: s.ctrl === 'cpu' ? DIFFICULTY[this.cfg.difficulty || 'normal'].dmg : 1,
      });
      this.fighters.push(f); this.players.push(f);
    });
    this.camX = 220; this.banner = 'READY';
  }
  setupCoop() {
    this.cfg.slots.forEach((s, i) => {
      const f = new Fighter(this, s.char, { team: 0, ctrl: this.makeCtrl(s.ctrl), human: true, label: s.ctrl.toUpperCase(), x: 0, z: 0, panel: true });
      this.players.push(f);
    });
    if (this.mode === 'campaign') this.loadStage(this.stageIdx);
    else { this.theme = this.cfg.theme || pick(THEMES); this.maxX = 1200; this.placePlayers(480); this.camX = 120; this.banner = 'SURVIVE'; this.wave = 0; }
  }
  placePlayers(x) {
    this.fighters = this.fighters.filter(f => !this.players.includes(f)).concat(this.players);
    this.players.forEach((p, i) => {
      p.x = x + i * 60; p.z = 70 + i * 50; p.y = 0; p.vx = p.vy = p.vz = 0; p.facing = 1; p.set('idle'); p.invuln = 0;
    });
  }
  loadStage(i) {
    const st = STAGES[i];
    this.stageIdx = i; this.stage = st; this.theme = st.theme;
    this.fighters = []; this.projs = []; this.items = []; this.parts = [];
    this.minX = 0; this.maxX = W; this.camX = 0; this.wave = -1;
    this.stageW = 640 * (st.waves.length - 1) + W;
    for (const p of this.players) {                 // rest between stages
      if (!p.alive) p.hp = p.maxHp * 0.5; else p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - p.hp) * 0.5);
      p.mp = Math.max(p.mp, p.maxMp * 0.6);
    }
    this.placePlayers(130);
    this.phase = 'intro'; this.phaseT = 0; this.banner = `STAGE ${i + 1}`; this.sub = st.name;
  }
  spawnEnemies(list) {
    const lv = DIFFICULTY[this.cfg.difficulty || 'normal'];
    list.forEach((raw, i) => {
      const boss = raw[0] === '!', id = boss ? raw.slice(1) : raw;
      const left = this.mode === 'survival' ? i % 2 === 1 : (this.wave > 0 && i % 3 === 2);
      const f = new Fighter(this, id, {
        team: 1, ctrl: new AI(this.cfg.difficulty || 'normal'), boss, entering: true,
        x: left ? this.minX - 50 - i * 30 : this.maxX + 50 + i * 40, z: 20 + ((i * 67 + this.wave * 31) % (ZMAX - 40)),
        facing: left ? 1 : -1, hpMul: boss ? 1.5 : 1, dmgMul: lv.dmg * (boss ? 0.9 : 1),
      });
      this.fighters.push(f);
    });
  }
  startWave(n) {
    this.wave = n;
    if (this.mode === 'campaign') {
      const list = this.stage.waves[n].slice();
      if (this.players.length > 1) list.push('thug');
      this.spawnEnemies(list);
      if (list.some(e => e[0] === '!')) { this.banner = 'BOSS'; this.sub = ''; this.phaseT = 0; this.bannerT = 80; }
    } else {
      const list = [], count = Math.min(2 + Math.floor(n / 2) + (this.players.length - 1), 7);
      if (n > 0 && n % 5 === 4) list.push('!' + pick(ROSTER));
      while (list.length < count) list.push(Math.random() < 0.15 + n * 0.02 ? 'brute' : Math.random() < 0.3 ? 'slinger' : 'thug');
      this.spawnEnemies(list);
      this.banner = `WAVE ${n + 1}`; this.sub = ''; this.bannerT = 80;
    }
    this.phase = 'play';
  }

  /* ---------- queries & spawners ---------- */
  nearestEnemy(f) {
    let best = null, bd = 1e9;
    for (const o of this.fighters) {
      if (o.team === f.team || !o.alive) continue;
      const d = Math.abs(o.x - f.x) + Math.abs(o.z - f.z) * 1.5 + (o.state === 'lying' ? 150 : 0);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  spawnProj(f, o) {
    this.projs.push(Object.assign({
      x: f.x + f.facing * (o.dx === undefined ? 30 : o.dx) * f.scale, z: f.z, vy: 0, vz: 0, grav: 0, r: 12, life: 130, age: 0,
      team: f.team, owner: f, facing: f.facing, hit: new Set(),
    }, o, { y: f.y + (o.y === undefined ? 40 : o.y) * (o.y ? f.scale : 1), vx: o.vx * f.facing, dmg: o.dmg * f.char.power * f.dmgMul }));
  }
  burst(x, y, z, n, kind) {
    if (this.parts.length > 420) return;
    const K = {
      spark: ['#fff6b0', 3, 5, 14, 0.25], dust: ['rgba(220,210,190,0.7)', 5, 1.4, 22, -0.02], fire: ['#ff8a2a', 5, 2, 22, -0.12],
      ice: ['#d6f4ff', 4, 3.5, 26, 0.2], wind: ['#c8ffe0', 3, 3, 16, 0], dark: ['#b06cff', 4, 2.5, 22, -0.05], heal: ['#8dffb0', 4, 1.5, 30, -0.1], block: ['#bfe0ff', 3, 4, 10, 0.1],
    }[kind];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(0.3, 1) * K[2];
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (kind === 'dust' ? 0.6 : 0), vz: rand(-0.4, 0.4), life: K[3] * rand(0.6, 1), max: K[3], size: K[1] * rand(0.6, 1.2), color: kind === 'fire' && Math.random() < 0.4 ? '#ffd35a' : K[0], grav: K[4], glow: kind !== 'dust' });
    }
  }
  ring(x, z, color, r) { this.parts.push({ ring: true, x, y: 0, z, r, color, life: 18, max: 18 }); }
  text(x, y, z, str, color, size = 14) { this.texts.push({ x, y, z, str, color, size, life: 46 }); }
  dropItem(type, x, z) { this.items.push({ type, x: clamp(x, this.minX + 40, this.maxX - 40), z: clamp(z, 10, ZMAX - 10), y: 260, vy: 0 }); }

  /* ---------- combat ---------- */
  meleeHit(f, h, i) {
    const set = f.hitSets[i] || (f.hitSets[i] = new Set()), s = f.scale;
    const x0 = f.x + (f.facing > 0 ? h.x[0] : -h.x[1]) * s, x1 = f.x + (f.facing > 0 ? h.x[1] : -h.x[0]) * s;
    for (const t of this.fighters) {
      if (t.team === f.team || set.has(t) || !t.hittable) continue;
      if (Math.abs(t.z - f.z) > (h.z || 16)) continue;
      const hw = 14 * t.scale;
      if (t.x + hw < x0 || t.x - hw > x1) continue;
      if (t.y + 72 * t.scale < f.y + h.y[0] * s || t.y > f.y + h.y[1] * s) continue;
      set.add(t);
      const dir = h.radial ? (sign(t.x - f.x) || f.facing) : f.facing;
      const res = this.applyHit(t, f, h, dir, h.dmg * f.char.power * f.dmgMul);
      if (h.onHit) h.onHit(f, t, res, this);
    }
  }
  blast(f, o) {
    for (const t of this.fighters) {
      if (t.team === f.team || !t.hittable) continue;
      if (Math.abs(t.x - f.x) > o.rx || Math.abs(t.z - f.z) > o.rz) continue;
      if (o.groundOnly ? t.y > 12 : t.y > 130) continue;
      this.applyHit(t, f, o, sign(t.x - f.x) || f.facing, o.dmg * f.char.power * f.dmgMul);
    }
  }
  /* returns 'block' | 'hit' */
  applyHit(t, owner, h, dir, dmg) {
    const px = t.x - dir * 8, py = t.y + 45 * t.scale;
    if (t.state === 'defend' && t.facing === -dir) {
      t.hp = Math.max(1, t.hp - dmg * 0.1); t.vx = dir * 2.2; t.guard -= dmg * (h.heavy ? 1.3 : 0.8);
      this.burst(px, py, t.z, 6, 'block'); this.sfx('block');
      if (t.guard <= 0) { t.guard = 60; t.set('hurt'); t.stun = 38; this.text(t.x, t.y + 95, t.z, 'GUARD BREAK', '#ffb3b3', 12); }
      return 'block';
    }
    const wasFrozen = t.state === 'frozen';
    t.hp = Math.max(0, t.hp - dmg); t.flash = 5;
    if (owner) { owner.stats.dmg += dmg; owner.mp = Math.min(owner.maxMp, owner.mp + dmg * 0.14); }
    this.text(t.x + rand(-8, 8), t.y + 88 * t.scale, t.z, String(Math.round(dmg)), h.effect === 'fire' ? '#ffb347' : h.effect === 'ice' ? '#bfeaff' : '#ffffff');
    this.burst(px, py, t.z, h.heavy ? 12 : 7, h.effect === 'fire' ? 'fire' : h.effect === 'ice' ? 'ice' : 'spark');
    this.sfx(h.effect === 'fire' ? 'fire' : h.effect === 'ice' ? 'ice' : h.heavy ? 'heavy' : 'hit');
    this.hitstop = Math.max(this.hitstop, h.heavy ? 6 : 3); this.shake = Math.max(this.shake, h.heavy ? 8 : 3);

    const armored = t.state === 'attack' && t.move.armor && t.hp > 0;
    if (armored) return 'hit';
    t.facing = -dir || t.facing;
    if (wasFrozen) { this.burst(t.x, t.y + 40, t.z, 18, 'ice'); this.sfx('shatter'); }
    if (t.hp <= 0 || h.down || wasFrozen || (t.y > 0 && h.effect !== 'ice')) {
      t.set('fall'); t.bounced = false; t.move = null;
      t.vx = dir * (h.kx || 3) * (t.hp <= 0 ? 1.3 : 1); t.vy = Math.max(h.ky || 5, t.hp <= 0 ? 6 : 0); t.vz = 0;
      if (t.y <= 0) t.y = 0.1;
    } else if (h.effect === 'ice') {
      t.set('frozen'); t.vx = dir * 0.5; t.move = null;
    } else {
      t.set('hurt'); t.stun = h.stun || 16; t.vx = dir * (h.kx || 1.5); t.move = null;
    }
    if (t.hp <= 0 && owner) owner.stats.kos++;
    return 'hit';
  }
  onDeath(f) {
    this.sfx('ko'); this.kos += f.team !== 0 || this.mode === 'vs' ? 1 : 0;
    if (f.char.enemy && Math.random() < 0.16) this.dropItem(Math.random() < 0.6 ? 'apple' : 'crystal', f.x, f.z);
    if (f.boss) { this.dropItem('apple', f.x - 30, f.z); this.dropItem('crystal', f.x + 30, f.z); }
  }

  /* ---------- per-frame update ---------- */
  update() {
    this.time++;
    if (this.shake > 0) this.shake *= 0.85;
    if (this.hitstop > 0) { this.hitstop--; this.updateParts(); return; }
    this.phaseT++;
    for (const f of this.fighters) f.update();
    this.updateProjs(); this.updateItems(); this.updateParts();
    this.fighters = this.fighters.filter(f => !(f.state === 'dead' && !f.panel && f.t > 100));
    this.flow();
    /* camera */
    const focus = this.fighters.filter(f => f.alive && (f.human || this.mode === 'vs'));
    const hum = focus.filter(f => f.human), fs = hum.length ? hum : focus;
    if (fs.length) {
      const cx = fs.reduce((a, f) => a + f.x, 0) / fs.length - W / 2;
      this.camX = lerp(this.camX, clamp(cx, this.minX, this.maxX - W), 0.09);
    }
  }
  flow() {
    const alive = t => this.fighters.some(f => f.team === t && f.alive);
    if (this.phase === 'intro') {
      if (this.phaseT > 90) {
        this.sfx('start');
        if (this.mode === 'vs') { this.phase = 'play'; this.banner = 'FIGHT!'; this.bannerT = 50; }
        else { this.banner = ''; this.sub = ''; this.startWave(0); }
      }
      return;
    }
    if (this.bannerT > 0 && --this.bannerT === 0) this.banner = '';
    if (this.phase === 'over') {
      if (this.phaseT === 110 && !this.result) this.result = this.pending;
      return;
    }
    const end = (res, snd) => { this.phase = 'over'; this.phaseT = 0; this.pending = res; this.hitstop = 22; if (snd) setTimeout(() => this.sfx(snd), 900); };
    if (this.mode === 'vs') {
      const teams = [...new Set(this.fighters.filter(f => f.alive).map(f => f.team))];
      if (teams.length <= 1) {
        const win = this.fighters.filter(f => f.team === teams[0]);
        const humanWon = win.some(f => f.human), anyHuman = this.fighters.some(f => f.human);
        end({ win: !anyHuman || humanWon, title: teams.length ? (win.length > 1 ? `TEAM ${teams[0] + 1} WINS` : `${win[0].char.name.toUpperCase()} WINS`) : 'DRAW', team: teams[0] }, humanWon || !anyHuman ? 'win' : 'lose');
      } else if (--this.itemT <= 0) {
        this.itemT = rand(600, 900);
        if (this.items.length < 2) this.dropItem(Math.random() < 0.55 ? 'apple' : 'crystal', this.camX + rand(150, W - 150), rand(20, ZMAX - 20));
      }
      return;
    }
    if (!alive(0)) {
      const best = this.mode === 'survival' ? saveBest(this.wave) : 0;
      end({ win: false, title: this.mode === 'survival' ? `FELL ON WAVE ${this.wave + 1}` : 'DEFEATED', best }, 'lose');
      return;
    }
    if (this.phase === 'play' && !alive(1)) {
      if (this.mode === 'survival') { this.phase = 'rest'; this.phaseT = 0; this.dropItem(this.wave % 2 ? 'crystal' : 'apple', this.camX + W / 2 + rand(-200, 200), rand(30, ZMAX - 30)); }
      else if (this.wave + 1 < this.stage.waves.length) { this.phase = 'advance'; this.maxX = 640 * (this.wave + 1) + W; this.dropItem('apple', this.maxX - 420, ZMAX / 2); }
      else {
        this.phase = 'clear'; this.phaseT = 0; this.sfx('win');
        this.banner = this.stageIdx + 1 < STAGES.length ? 'STAGE CLEAR' : 'VICTORY'; this.sub = ''; this.bannerT = 0;
      }
    } else if (this.phase === 'rest' && this.phaseT > 110) this.startWave(this.wave + 1);
    else if (this.phase === 'advance') {
      const lead = Math.max(...this.players.filter(p => p.alive).map(p => p.x));
      if (lead > 640 * (this.wave + 1) + 260) { this.minX = 640 * (this.wave + 1); this.startWave(this.wave + 1); }
    } else if (this.phase === 'clear' && this.phaseT > 170) {
      if (this.stageIdx + 1 < STAGES.length) this.loadStage(this.stageIdx + 1);
      else { this.phase = 'over'; this.phaseT = 109; this.pending = { win: true, title: 'YOU SAVED THE LANE!', campaignDone: true }; }
    }
  }
  updateProjs() {
    for (const p of this.projs) {
      p.age++; p.life--;
      if (p.homing) {
        const tg = this.nearestEnemy(p);
        if (tg) { p.vz += clamp((tg.z - p.z) * 0.02, -p.homing, p.homing); p.vz *= 0.92; p.vy = clamp((tg.y + 40 - p.y) * 0.05, -2, 2); if (sign(tg.x - p.x) !== sign(p.vx) && Math.abs(tg.x - p.x) > 60) p.vx *= 0.96; }
      }
      p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vy -= p.grav;
      if (p.type === 'fire' && p.age % 2 === 0) this.burst(p.x, p.y, p.z, 1, 'fire');
      if (p.type === 'orb' && p.age % 4 === 0) this.burst(p.x, p.y, p.z, 1, 'dark');
      if (p.grav && p.y <= 0) { p.life = 0; this.burst(p.x, 2, p.z, 6, 'dust'); this.sfx('land'); continue; }
      if (p.x < this.camX - 200 || p.x > this.camX + W + 200) p.life = 0;
      if (p.fixed && (p.age < 4 || p.age > 20)) continue;
      for (const t of this.fighters) {
        if (t.team === p.team || p.hit.has(t) || !t.hittable) continue;
        if (Math.abs(t.z - p.z) > 15 || Math.abs(t.x - p.x) > p.r + 14 * t.scale) continue;
        const top = p.h ? p.h : p.y + p.r, bot = p.h ? 0 : p.y - p.r;
        if (t.y + 74 * t.scale < bot || t.y > top) continue;
        p.hit.add(t);
        this.applyHit(t, p.owner, p, sign(p.vx) || p.facing, p.dmg);
        if (!p.pierce) { p.life = 0; break; }
      }
    }
    /* opposing shots cancel each other out */
    for (let i = 0; i < this.projs.length; i++) for (let j = i + 1; j < this.projs.length; j++) {
      const a = this.projs[i], b = this.projs[j];
      if (a.team === b.team || a.fixed || b.fixed || a.life <= 0 || b.life <= 0) continue;
      if (Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.z - b.z) < 14 && Math.abs(a.y - b.y) < a.r + b.r + 6) {
        a.life = b.life = 0; this.burst((a.x + b.x) / 2, a.y, a.z, 14, 'spark'); this.sfx('block');
      }
    }
    this.projs = this.projs.filter(p => p.life > 0);
  }
  updateItems() {
    for (const it of this.items) {
      if (it.y > 0) { it.vy -= 0.4; it.y += it.vy; if (it.y <= 0) { it.y = 0; this.burst(it.x, 2, it.z, 4, 'dust'); } continue; }
      for (const f of this.fighters) {
        if (!f.alive || !f.canAct || f.char.enemy || Math.abs(f.x - it.x) > 24 || Math.abs(f.z - it.z) > 14) continue;
        if (it.type === 'apple') { f.hp = Math.min(f.maxHp, f.hp + 120); this.text(f.x, 95, f.z, '+120 HP', '#8dffb0'); }
        else { f.mp = Math.min(f.maxMp, f.mp + 130); this.text(f.x, 95, f.z, '+130 EN', '#7fd4ff'); }
        this.burst(f.x, 45, f.z, 12, 'heal'); this.sfx('pickup'); it.gone = true; break;
      }
    }
    this.items = this.items.filter(i => !i.gone);
  }
  updateParts() {
    for (const p of this.parts) { p.life--; if (p.ring) continue; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vy -= p.grav; if (p.y < 0) { p.y = 0; p.vy *= -0.4; } }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.life--; t.y += 0.8; }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  /* ---------- rendering ---------- */
  draw(ctx) {
    const sh = this.shake > 0.5 ? this.shake : 0, cam = Math.round(this.camX + rand(-sh, sh) * 0.6), oy = rand(-sh, sh) * 0.5;
    drawStage(ctx, this.theme, cam, this.time);
    ctx.save(); ctx.translate(0, oy);
    const SX = x => x - cam, SY = (z, y) => GY + z - y;
    /* shadows */
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const f of this.fighters) {
      if (f.state === 'attack' && f.move.pose.startsWith('blink') && f.t < 8) continue;
      const k = clamp(1 - f.y / 260, 0.4, 1) * f.scale, lying = f.state === 'lying' || f.state === 'dead';
      ctx.beginPath(); ctx.ellipse(SX(f.x) - (lying ? f.facing * 36 : 0), SY(f.z, 0), (lying ? 44 : 22) * k, 7 * k, 0, 0, TAU); ctx.fill();
    }
    for (const p of this.projs) if (!p.fixed) { ctx.beginPath(); ctx.ellipse(SX(p.x), SY(p.z, 0), p.r, 4, 0, 0, TAU); ctx.fill(); }
    for (const it of this.items) { ctx.beginPath(); ctx.ellipse(SX(it.x), SY(it.z, 0), 10, 4, 0, 0, TAU); ctx.fill(); }
    for (const p of this.parts) if (p.ring) {
      const u = 1 - p.life / p.max;
      ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - u; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(SX(p.x), SY(p.z, 0), p.r * u, p.r * u * 0.3, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    /* depth-sorted entities */
    const list = [];
    for (const f of this.fighters) list.push([f.z, 0, f]);
    for (const p of this.projs) list.push([p.z + 0.5, 1, p]);
    for (const it of this.items) list.push([it.z, 2, it]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, kind, e] of list) {
      if (kind === 0) {
        if (e.state === 'dead' && !e.panel) ctx.globalAlpha = clamp(1 - (e.t - 50) / 50, 0, 1);
        else if (e.state === 'dead') ctx.globalAlpha = 0.55;
        else if (e.invuln > 0 && (this.time >> 2) & 1) ctx.globalAlpha = 0.45;
        drawFighter(ctx, e, SX(e.x), SY(e.z, e.y), this.time);
        ctx.globalAlpha = 1;
      } else if (kind === 1) drawProj(ctx, e, SX(e.x), SY(e.z, e.y), this.time);
      else drawItem(ctx, e, SX(e.x), SY(e.z, e.y), this.time);
    }
    /* particles */
    for (const p of this.parts) {
      if (p.ring) continue;
      const a = p.life / p.max;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      const s = p.size * (0.5 + a * 0.5);
      ctx.beginPath(); ctx.arc(SX(p.x), SY(p.z, p.y), s, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    if (!this.cfg.attract) {
      /* overhead tags */
      ctx.textAlign = 'center';
      for (const f of this.fighters) {
        if (!f.alive) continue;
        const x = SX(f.x), y = SY(f.z, f.y) - 96 * f.scale;
        if (f.panel) {
          const c = TEAM_COLORS[f.team];
          ctx.font = 'bold 11px Trebuchet MS, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.label, x, y - 6); ctx.fillStyle = c; ctx.fillText(f.label, x, y - 6);
          ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x + 5, y - 2); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill();
        } else if (!f.boss) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 21, y, 42, 6);
          ctx.fillStyle = '#ff5d5d'; ctx.fillRect(x - 20, y + 1, 40 * f.hp / f.maxHp, 4);
        }
      }
      for (const t of this.texts) {
        ctx.globalAlpha = clamp(t.life / 14, 0, 1);
        ctx.font = `bold ${t.size}px Trebuchet MS, sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(t.str, SX(t.x), SY(t.z, t.y)); ctx.fillStyle = t.color; ctx.fillText(t.str, SX(t.x), SY(t.z, t.y));
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (!this.cfg.attract) this.drawHud(ctx);
  }
  drawHud(ctx) {
    const n = this.players.length, pw = 226, gap = (W - n * pw) / (n + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    this.players.forEach((f, i) => {
      const x = gap + i * (pw + gap), y = 12, c = TEAM_COLORS[f.team];
      ctx.fillStyle = 'rgba(12,14,28,0.78)'; roundRect(ctx, x, y, pw, 58, 10); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2; roundRect(ctx, x, y, pw, 58, 10); ctx.stroke();
      ctx.save(); roundRect(ctx, x + 6, y + 6, 46, 46, 8); ctx.clip();
      ctx.drawImage(getPortrait(f.charId), x + 6, y + 6, 46, 46);
      if (!f.alive) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x + 6, y + 6, 46, 46); }
      ctx.restore();
      ctx.font = 'bold 13px Trebuchet MS, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(f.char.name, x + 60, y + 19);
      ctx.fillStyle = c; ctx.textAlign = 'right'; ctx.fillText(f.label, x + pw - 10, y + 19); ctx.textAlign = 'left';
      const bw = pw - 70;
      ctx.fillStyle = '#2a1418'; ctx.fillRect(x + 60, y + 25, bw, 11);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 60, y + 25, bw * clamp(f.shownHp / f.maxHp, 0, 1), 11);
      ctx.fillStyle = f.hp / f.maxHp > 0.3 ? '#4fd66a' : '#ff5d5d'; ctx.fillRect(x + 60, y + 25, bw * f.hp / f.maxHp, 11);
      ctx.fillStyle = '#101a30'; ctx.fillRect(x + 60, y + 40, bw, 7);
      ctx.fillStyle = '#4cc9ff'; ctx.fillRect(x + 60, y + 40, bw * f.mp / f.maxMp, 7);
    });
    const boss = this.fighters.filter(f => f.boss && f.alive);
    boss.forEach((b, i) => {
      const bw = 420, x = (W - bw) / 2, y = H - 30 - i * 26;
      ctx.fillStyle = 'rgba(12,14,28,0.8)'; ctx.fillRect(x - 4, y - 4, bw + 8, 18);
      ctx.fillStyle = '#b3262f'; ctx.fillRect(x, y, bw * b.hp / b.maxHp, 10);
      ctx.font = 'bold 12px Trebuchet MS, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(`${b.char.name} — ${b.char.title}`, W / 2, y - 8); ctx.fillText(`${b.char.name} — ${b.char.title}`, W / 2, y - 8);
    });
    ctx.textAlign = 'center';
    if (this.mode !== 'vs') {
      ctx.font = 'bold 13px Trebuchet MS, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      const s = this.mode === 'campaign' ? `Stage ${this.stageIdx + 1} · ${this.stage.name}` : `Wave ${this.wave + 1} · KOs ${this.kos}`;
      ctx.strokeText(s, W / 2, 90); ctx.fillText(s, W / 2, 90);
    }
    if (this.phase === 'advance' && (this.time >> 4) & 1) bigText(ctx, 'GO ▶', W - 110, 190, 44, '#ffe27a');
    let b = this.banner, sub = this.sub;
    if (this.phase === 'over' && this.pending) { b = this.pending.win && this.mode !== 'vs' ? this.pending.title : this.mode === 'vs' ? 'K.O.' : this.pending.title; sub = ''; }
    if (b) { bigText(ctx, b, W / 2, 230, 64, '#ffffff'); if (sub) bigText(ctx, sub, W / 2, 272, 24, '#ffe27a'); }
  }
}
function bigText(ctx, s, x, y, size, color) {
  ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; ctx.textAlign = 'center';
  ctx.lineWidth = size / 7; ctx.strokeStyle = '#141428'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function saveBest(wave) {
  let best = wave + 1;
  try { best = Math.max(best, +localStorage.getItem('rumble-best') || 0); localStorage.setItem('rumble-best', best); } catch (e) { /* storage unavailable */ }
  return best;
}
