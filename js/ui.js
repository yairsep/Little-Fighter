'use strict';
/* ---------- canvas & scaling ---------- */
const stageEl = document.getElementById('stage'), canvas = document.getElementById('game'), ui = document.getElementById('ui');
const touchEl = document.getElementById('touch');
const DPR = Math.min(2, Math.ceil(window.devicePixelRatio || 1));
canvas.width = W * DPR; canvas.height = H * DPR;
const ctx = canvas.getContext('2d');
function fit() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  stageEl.style.transform = `scale(${k}) translate(-50%, -50%)`;
}
addEventListener('resize', fit); fit();

/* ---------- app state ---------- */
let game = null, bg = null, paused = false, resultShown = false, lastCfg = null;
const isTouch = matchMedia('(pointer: coarse)').matches;
const vsSetup = {
  slots: [{ ctrl: 'p1', char: 'kai', team: 0 }, { ctrl: 'cpu', char: 'ember', team: 1 }, { ctrl: 'off', char: 'random', team: 2 }, { ctrl: 'off', char: 'random', team: 3 }],
  theme: 'random', difficulty: 'normal',
};
const coopSetup = { p1: 'kai', p2: 'off', difficulty: 'normal', theme: 'random' };
const CHOICES = ROSTER.concat(['random']);
const cycle = (arr, cur, d = 1) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
const resolve = c => (c === 'random' ? pick(ROSTER) : c);

function newAttract() {
  const ids = ROSTER.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  bg = new Game({ mode: 'vs', attract: true, theme: pick(THEMES), difficulty: 'hard', slots: ids.map((c, i) => ({ ctrl: 'cpu', char: c, team: i })) });
}

/* ---------- tiny DOM helpers ---------- */
function show(html, cls = '') {
  ui.innerHTML = html ? `<div class="screen ${cls}">${html}</div>` : '';
  if (html) ui.insertAdjacentHTML('beforeend', `<button id="mute" class="ghost">${Sfx.muted ? 'Sound: off' : 'Sound: on'} (M)</button>`);
  const first = ui.querySelector('.screen button');
  if (first && !isTouch) first.focus();
}
ui.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  Sfx.unlock(); Sfx.play('ui');
  if (b.id === 'mute') { Sfx.toggleMute(); b.textContent = `${Sfx.muted ? 'Sound: off' : 'Sound: on'} (M)`; b.blur(); return; }
  const a = b.dataset.a;
  if (a && actions[a]) actions[a](b.dataset);
});
function portraitTag(id) { return `<canvas width="168" height="168" data-portrait="${id}"></canvas>`; }
function paintPortraits() {
  ui.querySelectorAll('canvas[data-portrait]').forEach(c => {
    const id = c.dataset.portrait, x = c.getContext('2d');
    if (id === 'random') {
      x.fillStyle = '#232842'; x.fillRect(0, 0, 168, 168);
      x.fillStyle = '#ffe27a'; x.font = '900 110px Impact, sans-serif'; x.textAlign = 'center'; x.fillText('?', 84, 124);
    } else x.drawImage(getPortrait(id, 84), 0, 0, 168, 168);
  });
}
function charInfo(id) {
  if (id === 'random') return { name: 'Random', title: 'Surprise me', desc: 'Picks a fighter when the match starts.', bars: '' };
  const c = CHARS[id];
  const bar = (label, v) => `<div>${label}<i><b style="width:${Math.round(v * 100)}%"></b></i></div>`;
  return { name: c.name, title: c.title, desc: c.desc, bars: `<div class="stats">${bar('Health', c.hp / 640)}${bar('Power', (c.power - 0.7) / 0.5)}${bar('Speed', (c.speed - 0.7) / 0.52)}</div>` };
}

/* ---------- screens ---------- */
function titleScreen() {
  game = null; paused = false; touchEl.hidden = true;
  if (!bg) newAttract();
  show(`
    <h1 class="logo">RUMBLE <span>LANE</span></h1>
    <p class="tag">An original arena brawler</p>
    <div class="menu">
      <button class="big go" data-a="vs">Versus</button>
      <button class="big" data-a="campaign">Campaign</button>
      <button class="big" data-a="survival">Survival</button>
      <button class="big ghost" data-a="help">How to Play</button>
    </div>
    <p class="hint">1–2 players on one keyboard · up to 4 fighters · touch controls on phones</p>`, 'light');
}

function vsScreen(msg = '') {
  const cards = vsSetup.slots.map((s, i) => {
    const info = charInfo(s.char), off = s.ctrl === 'off';
    const cname = { off: 'Empty', p1: 'Player 1', p2: 'Player 2', cpu: 'Computer' }[s.ctrl];
    return `<div class="slot ${off ? 'off' : ''}" style="border-color:${off ? '#39406e' : TEAM_COLORS[s.team]}">
      <button class="ctrl" data-a="slotCtrl" data-i="${i}">${cname}</button>
      ${portraitTag(s.char)}
      <div class="name">${info.name}</div><div class="title">${info.title}</div>
      <div class="row"><button data-a="slotChar" data-i="${i}" data-d="-1">◀</button><button data-a="slotChar" data-i="${i}" data-d="1">▶</button>
      <button data-a="slotTeam" data-i="${i}" style="background:${TEAM_COLORS[s.team]};color:#141428">Team ${s.team + 1}</button></div>
      ${info.bars}<p class="desc">${info.desc}</p></div>`;
  }).join('');
  show(`<h2>VERSUS</h2><div class="slots">${cards}</div>
    <div class="row">
      <button data-a="vsTheme">Arena: ${vsSetup.theme === 'random' ? 'Random' : THEME_NAMES[vsSetup.theme]}</button>
      <button data-a="vsDiff">Computer: ${vsSetup.difficulty}</button>
    </div>
    <p class="warn">${msg}</p>
    <div class="row"><button class="ghost" data-a="title">Back</button><button class="big go" data-a="vsStart">Fight!</button></div>`);
  paintPortraits();
}

function coopScreen(mode) {
  coopSetup.mode = mode;
  const card = (who, val) => {
    const off = val === 'off', info = off ? { name: '—', title: 'Not playing', desc: 'Press ▶ to add a second player.', bars: '' } : charInfo(val);
    return `<div class="slot ${off ? 'off' : ''}" style="border-color:${TEAM_COLORS[0]}">
      <div class="name" style="color:${TEAM_COLORS[0]}">${who === 'p1' ? 'Player 1' : 'Player 2'}</div>
      ${portraitTag(off ? 'random' : val)}
      <div class="name">${info.name}</div><div class="title">${info.title}</div>
      <div class="row"><button data-a="coopChar" data-w="${who}" data-d="-1">◀</button><button data-a="coopChar" data-w="${who}" data-d="1">▶</button></div>
      ${info.bars}<p class="desc">${info.desc}</p></div>`;
  };
  let best = 0;
  try { best = +localStorage.getItem('rumble-best') || 0; } catch (e) { /* ignore */ }
  show(`<h2>${mode === 'campaign' ? 'CAMPAIGN' : 'SURVIVAL'}</h2>
    <p class="hint">${mode === 'campaign' ? `Fight through ${STAGES.length} stages and their bosses. Walk right when you see GO.` : `Hold out against endless waves.${best ? ` Best so far: wave ${best}.` : ''}`}</p>
    <div class="slots">${card('p1', coopSetup.p1)}${card('p2', coopSetup.p2)}</div>
    <div class="row"><button data-a="coopDiff">Difficulty: ${coopSetup.difficulty}</button>
    ${mode === 'survival' ? `<button data-a="coopTheme">Arena: ${coopSetup.theme === 'random' ? 'Random' : THEME_NAMES[coopSetup.theme]}</button>` : ''}</div>
    <div class="row"><button class="ghost" data-a="title">Back</button><button class="big go" data-a="coopStart">Start</button></div>`);
  paintPortraits();
}

function movesHtml() {
  const combo = { FA: 'Defend + ◀/▶ + Attack', UA: 'Defend + ▲/▼ + Attack', FJ: 'Defend + ◀/▶ + Jump', UJ: 'Defend + ▲/▼ + Jump' };
  return ROSTER.map(id => {
    const c = CHARS[id];
    return `<div class="card"><h3>${c.name} <span style="color:#aeb6de;font-weight:400">· ${c.title}</span></h3>${Object.entries(c.specials).map(([k, m]) => `<div><b>${MOVES[m].name}</b> <small>${MOVES[m].mp} EN</small><br>${combo[k]}</div>`).join('')}</div>`;
  }).join('');
}
function helpScreen(back = 'title') {
  const k = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ');
  show(`<h2>HOW TO PLAY</h2>
    <div class="help">
      <div>
        <div class="card"><h3>Controls</h3><table>
          <tr><th></th><th>Player 1</th><th>Player 2</th></tr>
          <tr><td>Move</td><td>${k('W A S D')}</td><td>${k('↑ ← ↓ →')}</td></tr>
          <tr><td>Attack</td><td>${k('F')}</td><td>${k(',')} / Num1</td></tr>
          <tr><td>Jump</td><td>${k('G')}</td><td>${k('.')} / Num2</td></tr>
          <tr><td>Defend</td><td>${k('H')}</td><td>${k('/')} / Num3</td></tr>
          <tr><td>Pause</td><td colspan="2">${k('Esc')} or ${k('P')}</td></tr>
        </table></div>
        <div class="card" style="margin-top:10px"><h3>Basics</h3>
          Tap Attack three times for a combo that ends in a knock-down.<br>
          Double-tap ◀ or ▶ to run; attack while running for a flying kick.<br>
          Hold Defend to block hits from the front.<br>
          Line up on the same depth as your target — attacks only connect in your lane.<br>
          Specials spend energy (blue bar). It refills over time and when you land hits.<br>
          Apples restore health, crystals restore energy.</div>
      </div>
      <div><div class="moves">${movesHtml()}</div></div>
    </div>
    <button class="ghost" data-a="${back}">Back</button>`);
}

function pauseScreen() {
  show(`<h2>PAUSED</h2><div class="menu">
    <button class="big go" data-a="resume">Resume</button>
    <button class="big" data-a="pauseHelp">Moves &amp; Controls</button>
    <button class="big" data-a="restart">Restart</button>
    <button class="big ghost" data-a="title">Quit to Menu</button></div>`);
}

function resultScreen(r) {
  const rows = game.players.map(f => `<tr><td style="color:${TEAM_COLORS[f.team]}">${f.label}</td><td>${f.char.name}</td><td>${Math.round(f.stats.dmg)}</td><td>${f.stats.kos}</td></tr>`).join('');
  let extra = '';
  if (game.mode === 'survival') extra = `<p class="hint">You reached wave ${game.wave + 1} with ${game.kos} KOs. Best: wave ${r.best}.</p>`;
  if (game.mode === 'campaign' && !r.win) extra = `<p class="hint">Stage ${game.stageIdx + 1} · ${game.stage.name}</p>`;
  show(`<h2>${r.title}</h2>${extra}
    <div class="result"><table><tr><th></th><th>Fighter</th><th>Damage</th><th>KOs</th></tr>${rows}</table></div>
    <div class="row">
      <button class="ghost" data-a="title">Main Menu</button>
      ${game.mode === 'vs' ? '<button data-a="vs">Change Fighters</button>' : ''}
      ${r.campaignDone ? '' : `<button class="big go" data-a="restart">${game.mode === 'campaign' ? 'Retry Stage' : game.mode === 'vs' ? 'Rematch' : 'Try Again'}</button>`}
    </div>`);
}

/* ---------- starting games ---------- */
function start(cfg) {
  lastCfg = cfg;
  game = new Game(cfg); bg = null; paused = false; resultShown = false;
  show('');
  touchEl.hidden = !isTouch;
  Sfx.unlock();
}
const actions = {
  title: titleScreen,
  vs: () => vsScreen(),
  campaign: () => coopScreen('campaign'),
  survival: () => coopScreen('survival'),
  help: () => helpScreen('title'),
  pauseHelp: () => helpScreen('backToPause'),
  backToPause: pauseScreen,
  resume: () => { paused = false; show(''); },
  restart: () => {
    const cfg = Object.assign({}, lastCfg);
    if (game && game.mode === 'campaign') cfg.stage = game.stageIdx;
    start(cfg);
  },
  slotCtrl: d => {
    const s = vsSetup.slots[d.i], taken = c => c !== 'off' && c !== 'cpu' && vsSetup.slots.some(o => o !== s && o.ctrl === c);
    let c = s.ctrl;
    do c = cycle(['off', 'p1', 'p2', 'cpu'], c); while (taken(c));
    s.ctrl = c; vsScreen();
  },
  slotChar: d => { const s = vsSetup.slots[d.i]; s.char = cycle(CHOICES, s.char, +d.d); if (s.ctrl === 'off') s.ctrl = 'cpu'; vsScreen(); },
  slotTeam: d => { const s = vsSetup.slots[d.i]; s.team = (s.team + 1) % 4; vsScreen(); },
  vsTheme: () => { vsSetup.theme = cycle(THEMES.concat(['random']), vsSetup.theme); vsScreen(); },
  vsDiff: () => { vsSetup.difficulty = cycle(['easy', 'normal', 'hard'], vsSetup.difficulty); vsScreen(); },
  vsStart: () => {
    const on = vsSetup.slots.filter(s => s.ctrl !== 'off');
    if (on.length < 2) return vsScreen('Add at least two fighters.');
    if (new Set(on.map(s => s.team)).size < 2) return vsScreen('Fighters must be on at least two different teams.');
    start({ mode: 'vs', theme: vsSetup.theme === 'random' ? pick(THEMES) : vsSetup.theme, difficulty: vsSetup.difficulty, slots: on.map(s => ({ ctrl: s.ctrl, team: s.team, char: resolve(s.char) })) });
  },
  coopChar: d => { const opts = d.w === 'p2' ? ['off'].concat(CHOICES) : CHOICES; coopSetup[d.w] = cycle(opts, coopSetup[d.w], +d.d); coopScreen(coopSetup.mode); },
  coopDiff: () => { coopSetup.difficulty = cycle(['easy', 'normal', 'hard'], coopSetup.difficulty); coopScreen(coopSetup.mode); },
  coopTheme: () => { coopSetup.theme = cycle(THEMES.concat(['random']), coopSetup.theme); coopScreen(coopSetup.mode); },
  coopStart: () => {
    const slots = [{ ctrl: 'p1', char: resolve(coopSetup.p1) }];
    if (coopSetup.p2 !== 'off') slots.push({ ctrl: 'p2', char: resolve(coopSetup.p2) });
    start({ mode: coopSetup.mode, difficulty: coopSetup.difficulty, theme: coopSetup.theme === 'random' ? pick(THEMES) : coopSetup.theme, slots, stage: 0 });
  },
};

function togglePause() {
  if (!game || game.result) return;
  paused = !paused;
  if (paused) pauseScreen(); else show('');
}
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') { Sfx.toggleMute(); const b = document.getElementById('mute'); if (b) b.textContent = `${Sfx.muted ? 'Sound: off' : 'Sound: on'} (M)`; }
});
addEventListener('pointerdown', () => Sfx.unlock(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !paused && !game.result) togglePause(); });

/* ---------- touch controls (drive Player 1's keys) ---------- */
touchEl.querySelectorAll('button[data-k]').forEach(b => {
  const code = b.dataset.k;
  const on = e => { e.preventDefault(); if (!Keys.down.has(code)) Keys.pressed.add(code); Keys.down.add(code); b.classList.add('on'); };
  const off = e => { e.preventDefault(); Keys.down.delete(code); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
document.getElementById('tpause').addEventListener('click', togglePause);

/* ---------- main loop (fixed 60 Hz simulation) ---------- */
let lastT = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - lastT); lastT = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    const g = game || bg;
    if (g && !paused) g.update();
    Keys.pressed.clear();
    if (game && game.result && !resultShown) { resultShown = true; touchEl.hidden = true; resultScreen(game.result); }
    if (!game && bg && (bg.result || bg.time > 60 * 80)) newAttract();
  }
  const g = game || bg;
  if (g) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); g.draw(ctx); }
  requestAnimationFrame(frame);
}
titleScreen();
requestAnimationFrame(frame);
