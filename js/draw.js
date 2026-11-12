'use strict';
/* ---------- fighter poses ----------
 * Limb angles: 0 points straight down, positive swings toward the facing
 * direction. Each limb is [upper angle, extra bend of the lower segment].
 * fa/ba = front/back arm, fl/bl = front/back leg.
 */
function getPose(f, time) {
  const t = f.t, s = Math.sin, P = { fa: [0.5, 1.5], ba: [0.2, 1.6], fl: [0.25, -0.3], bl: [-0.25, -0.1], lean: 0.05, dy: 0, rot: 0, lift: 0, flip: 1 };
  const active = m => { const h = m.hits && m.hits[0]; return h ? t >= h.t[0] - 1 && t <= h.t[1] + 3 : false; };
  switch (f.state) {
    case 'idle': P.dy = s(time * 0.08 + f.id) * 1.2; break;
    case 'walk': case 'run': {
      const run = f.state === 'run', ph = f.animT * (run ? 0.42 : 0.26), a = run ? 1.0 : 0.6, w = s(ph), c = Math.cos(ph);
      P.fl = [a * w, -0.7 * Math.max(0, c) * a]; P.bl = [-a * w, -0.7 * Math.max(0, -c) * a];
      P.fa = [-a * w * 0.8 + 0.2, run ? 1.5 : 1.0]; P.ba = [a * w * 0.8, run ? 1.5 : 1.0];
      P.lean = run ? 0.32 : 0.08; P.dy = Math.abs(c) * 2;
      break;
    }
    case 'jump':
      if (f.vy > 0) { P.fl = [0.7, -1.3]; P.bl = [0.1, -1.0]; P.fa = [2.4, 0.3]; P.ba = [-0.8, 0.6]; }
      else { P.fl = [0.4, -0.5]; P.bl = [-0.3, -0.6]; P.fa = [1.9, 0.4]; P.ba = [-1.4, 0.3]; }
      break;
    case 'defend': P.fa = [1.0, 1.9]; P.ba = [0.8, 2.0]; P.lean = -0.06; P.fl = [0.4, -0.5]; P.bl = [-0.4, -0.3]; P.dy = -2; break;
    case 'hurt': P.lean = -0.38; P.fa = [-0.6, 0.3]; P.ba = [-1.0, 0.4]; P.fl = [0.3, -0.2]; P.bl = [-0.4, -0.5]; break;
    case 'frozen': P.fa = [0.9, 1.2]; P.ba = [-0.5, 0.8]; break;
    case 'fall': {
      P.rot = -Math.min(1.5, t * 0.12); P.lift = 8;
      P.fa = [1.2, 0.3]; P.ba = [0.6, 0.5]; P.fl = [0.9, -0.5]; P.bl = [0.3, -0.7];
      break;
    }
    case 'lying': case 'dead': P.rot = -Math.PI / 2; P.lift = 9; P.fa = [0.2, 0.2]; P.ba = [-0.2, 0.3]; P.fl = [0.15, -0.1]; P.bl = [-0.1, -0.2]; break;
    case 'getup': {
      const u = clamp(t / 18, 0, 1);
      P.rot = -Math.PI / 2 * (1 - u); P.lift = 9 * (1 - u); P.fl = [0.9 * (1 - u), -1.2 * (1 - u)]; P.bl = [0.3, -0.8 * (1 - u)];
      break;
    }
    case 'attack': {
      const m = f.move, on = active(m);
      switch (m.pose) {
        case 'jab1': P.fa = on ? [1.55, 0.05] : [0.3, 1.9]; P.lean = on ? 0.2 : 0; P.fl = [0.45, -0.3]; P.bl = [-0.4, -0.2]; break;
        case 'jab2': P.ba = on ? [1.55, 0.05] : [0.2, 1.9]; P.fa = [0.9, 1.7]; P.lean = on ? 0.24 : 0; P.fl = [0.5, -0.3]; P.bl = [-0.45, -0.2]; break;
        case 'kick': P.fl = on ? [1.65, 0] : [0.9, -1.4]; P.bl = [-0.15, -0.1]; P.lean = on ? -0.3 : -0.1; P.fa = [-0.5, 0.8]; P.ba = [0.8, 1.2]; break;
        case 'flykick': P.fl = [1.5, 0]; P.bl = [-0.5, -1.0]; P.lean = -0.15; P.fa = [-0.9, 0.5]; P.ba = [0.9, 1.0]; P.dy = 6; break;
        case 'airkick': P.fl = [1.2, 0]; P.bl = [0.4, -1.5]; P.lean = 0.1; P.fa = [-1.0, 0.5]; P.ba = [1.2, 0.8]; break;
        case 'cast': { const c = t > 6; P.fa = c ? [1.5, 0.05] : [-0.4, 1.4]; P.ba = c ? [1.35, 0.15] : [-0.6, 1.2]; P.lean = c ? 0.18 : -0.12; P.fl = [0.5, -0.3]; P.bl = [-0.5, -0.2]; break; }
        case 'cast2': { const u = s(t * 0.3) * 0.15; P.fa = [2.4 + u, 0.2]; P.ba = [1.2, 0.3]; P.lean = 0.1; P.fl = [0.5, -0.4]; P.bl = [-0.5, -0.2]; break; }
        case 'throw': { const c = t > 12; P.fa = c ? [1.3, 0.1] : [3.4, 0.6]; P.ba = [0.9, 1.0]; P.lean = c ? 0.3 : -0.25; P.fl = [0.5, -0.3]; P.bl = [-0.5, -0.2]; break; }
        case 'upper': P.fa = [2.95, 0.05]; P.ba = [-0.4, 1.2]; P.fl = [0.5, -1.1]; P.bl = [-0.1, -0.2]; P.lean = -0.12; break;
        case 'flurry': { const k = (t >> 2) & 1; P.fa = k ? [1.55, 0] : [0.4, 1.9]; P.ba = k ? [0.3, 1.9] : [1.55, 0]; P.lean = 0.3; const w = s(t * 0.6); P.fl = [w, -0.4]; P.bl = [-w, -0.4]; if (t >= 28) { P.fl = [1.6, 0]; P.lean = -0.2; } break; }
        case 'dash': { const w = s(t * 0.7); P.lean = 0.55; P.fa = [1.2, 1.4]; P.ba = [-0.9, 0.6]; P.fl = [w, -0.5]; P.bl = [-w, -0.5]; break; }
        case 'aoe': { const c = t > 14; P.fa = c ? [2.5, 0.1] : [0.6, 2.2]; P.ba = c ? [-2.5, -0.1] : [0.4, 2.2]; P.dy = c ? 2 : -6; P.fl = [0.6, -0.8]; P.bl = [-0.6, -0.5]; P.lean = c ? -0.1 : 0.25; break; }
        case 'slam': { const up = f.y > 0; P.fa = up ? [3.0, 0.1] : [0.9, 0.2]; P.ba = up ? [2.8, 0.1] : [0.7, 0.2]; P.lean = up ? -0.2 : 0.5; P.fl = up ? [0.7, -1.3] : [0.7, -0.9]; P.bl = up ? [0, -1.0] : [-0.6, -0.4]; if (!up && t > 4) P.dy = -6; break; }
        case 'spin': P.fa = [1.57, 0]; P.ba = [-1.57, 0]; P.fl = [1.3, 0]; P.bl = [-0.3, -1.2]; P.flip = Math.cos(t * 0.7) >= 0 ? 1 : -1; break;
        case 'blink': case 'blinkstab': P.hidden = t < 8; P.fa = [1.55, 0]; P.ba = [-0.8, 0.6]; P.lean = 0.3; P.fl = [0.8, -0.4]; P.bl = [-0.7, -0.2]; break;
        case 'grab': { const c = t > 6; P.fa = c ? [1.5, 0.3] : [0.4, 1.6]; P.ba = c ? [1.3, 0.5] : [0.3, 1.6]; P.lean = c ? 0.3 : 0; P.fl = [0.6, -0.4]; P.bl = [-0.5, -0.2]; break; }
      }
    }
  }
  return P;
}

/* ---------- fighter drawing (procedural, no image assets) ---------- */
const OUTLINE = '#1a1a28';
function limb(ctx, x, y, a, b, l1, l2, w, col, endCol, endR, shoe) {
  const x1 = x + Math.sin(a) * l1, y1 = y + Math.cos(a) * l1;
  const x2 = x1 + Math.sin(a + b) * l2, y2 = y1 + Math.cos(a + b) * l2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 3; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  ctx.fillStyle = endCol; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (shoe) ctx.ellipse(x2 + 2.5, y2 + 1, endR + 2.5, endR, 0, 0, TAU); else ctx.arc(x2, y2, endR, 0, TAU);
  ctx.fill(); ctx.stroke();
}

function drawHair(ctx, L, hx, hy, R, time, col) {
  const hair = col(L.hair), acc = col(L.accent);
  ctx.fillStyle = hair; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  const cap = (from, to) => { ctx.beginPath(); ctx.arc(hx, hy, R + 1, from, to); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  switch (L.style) {
    case 'spiky': case 'flame': {
      const tall = L.style === 'flame', n = 5;
      ctx.beginPath(); ctx.moveTo(hx - R - 1, hy + 2);
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI * 0.95, a1 = Math.PI + ((i + 0.5) / n) * Math.PI * 0.95;
        const flick = tall ? Math.sin(time * 0.3 + i * 1.7) * 3 : 0, len = R + (tall ? 13 : 8) + (i % 2) * 3 + flick;
        ctx.lineTo(hx + Math.cos(a1) * len - (tall ? 3 : 2), hy + Math.sin(a1) * len);
        ctx.lineTo(hx + Math.cos(a0 + Math.PI * 0.95 / n) * (R + 1), hy + Math.sin(a0 + Math.PI * 0.95 / n) * (R + 1));
      }
      ctx.lineTo(hx + R * 0.7, hy - R * 0.5); ctx.lineTo(hx + 2, hy - R * 0.45); ctx.lineTo(hx - R * 0.5, hy + 1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (tall) { ctx.fillStyle = col('#ffd35a'); ctx.beginPath(); ctx.arc(hx - 2, hy - R - 3, 4, 0, TAU); ctx.fill(); }
      break;
    }
    case 'long': {
      const sway = Math.sin(time * 0.07) * 2;
      ctx.beginPath(); ctx.moveTo(hx + R * 0.6, hy - R * 0.75);
      ctx.quadraticCurveTo(hx - 2, hy - R - 6, hx - R - 2, hy - 2);
      ctx.quadraticCurveTo(hx - R - 9 + sway, hy + 16, hx - R - 4 + sway, hy + 34);
      ctx.lineTo(hx - R + 6 + sway, hy + 30);
      ctx.quadraticCurveTo(hx - R + 4, hy + 10, hx - R * 0.3, hy + 2);
      ctx.quadraticCurveTo(hx + 2, hy - R * 0.3, hx + R * 0.6, hy - R * 0.75);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'ponytail': {
      const sway = Math.sin(time * 0.1) * 3;
      cap(Math.PI * 0.95, Math.PI * 1.85);
      ctx.beginPath(); ctx.moveTo(hx - R, hy - 5);
      ctx.quadraticCurveTo(hx - R - 16, hy - 8 + sway, hx - R - 14, hy + 16 + sway);
      ctx.quadraticCurveTo(hx - R - 8, hy + 2, hx - R + 1, hy + 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'mohawk': {
      ctx.beginPath(); ctx.moveTo(hx - R + 1, hy - 4);
      for (let i = 0; i <= 4; i++) {
        const a = Math.PI * 1.1 + i * 0.32;
        ctx.lineTo(hx + Math.cos(a) * (R + 9), hy + Math.sin(a) * (R + 9));
        ctx.lineTo(hx + Math.cos(a + 0.16) * (R + 1), hy + Math.sin(a + 0.16) * (R + 1));
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'cap':
      cap(Math.PI, TAU);
      ctx.fillRect(hx + R - 3, hy - 3, 11, 3.5); ctx.strokeRect(hx + R - 3, hy - 3, 11, 3.5);
      break;
    case 'hood': {
      ctx.beginPath(); ctx.moveTo(hx + R * 0.75, hy - R * 0.8);
      ctx.quadraticCurveTo(hx - 4, hy - R - 9, hx - R - 5, hy - 2);
      ctx.quadraticCurveTo(hx - R - 6, hy + R + 2, hx - 2, hy + R + 4);
      ctx.quadraticCurveTo(hx - R * 0.5, hy + 3, hx + 1, hy - R * 0.35);
      ctx.quadraticCurveTo(hx + R * 0.5, hy - R * 0.5, hx + R * 0.75, hy - R * 0.8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'bald':
      ctx.beginPath(); ctx.arc(hx + 3, hy + 3, R - 1, 0.25, Math.PI * 0.8); ctx.lineTo(hx - 2, hy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
  }
  if (L.extra === 'headband') {
    ctx.strokeStyle = acc; ctx.lineWidth = 3.5; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(hx, hy, R, Math.PI * 1.08, Math.PI * 1.82); ctx.stroke();
    const sw = Math.sin(time * 0.15) * 3;
    ctx.beginPath(); ctx.moveTo(hx - R + 1, hy - 4); ctx.quadraticCurveTo(hx - R - 9, hy - 2 + sw, hx - R - 15, hy + 4 + sw); ctx.stroke();
  }
}

function drawFighter(ctx, f, sx, sy, time) {
  const P = getPose(f, time);
  if (P.hidden) return;
  const L = f.char.look, bulk = L.bulk || 1, flash = f.flash > 0;
  const col = c => (flash ? '#ffffff' : c);
  ctx.save();
  ctx.translate(sx, sy - P.lift);
  ctx.scale(f.facing * f.scale * P.flip, f.scale);
  if (P.rot) ctx.rotate(P.rot);
  const hipY = -30 - P.dy, hipX = 0;
  const shX = hipX + Math.sin(P.lean) * 24, shY = hipY - Math.cos(P.lean) * 24;
  const hx = shX + Math.sin(P.lean) * 15 + 1.5, hy = shY - Math.cos(P.lean) * 15, R = 13.5;
  const skin = col(L.skin), top = col(L.top), pants = col(L.pants), acc = col(L.accent);
  const dark = c => (flash ? '#ffffff' : shade(c, -28));

  // far-side limbs first
  limb(ctx, shX - 2, shY + 4, P.ba[0], P.ba[1], 12, 12, 6.5 * bulk, dark(L.top), dark(L.skin), 4 * bulk);
  limb(ctx, hipX - 2, hipY, P.bl[0], P.bl[1], 15, 15, 7.5 * bulk, dark(L.pants), dark(L.accent), 4, true);
  // scarf tail
  if (L.extra === 'scarf') {
    const sw = Math.sin(time * 0.18 + f.id) * 4;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shX - 3, shY - 3); ctx.quadraticCurveTo(shX - 16, shY - 2 + sw, shX - 26, shY + 6 + sw); ctx.stroke();
    ctx.strokeStyle = acc; ctx.lineWidth = 5; ctx.stroke();
  }
  // torso
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hipX, hipY - 2); ctx.lineTo(shX, shY + 3);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 19 * bulk + 3; ctx.stroke();
  ctx.strokeStyle = top; ctx.lineWidth = 19 * bulk; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX - 6 * bulk, hipY + 1); ctx.lineTo(hipX + 6 * bulk, hipY + 1);
  ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.stroke();
  if (L.extra === 'scarf') { ctx.beginPath(); ctx.moveTo(shX - 6, shY - 2); ctx.lineTo(shX + 7, shY - 1); ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.stroke(); }
  // near leg
  limb(ctx, hipX + 2, hipY, P.fl[0], P.fl[1], 15, 15, 7.5 * bulk, pants, acc, 4, true);
  // head
  ctx.fillStyle = skin; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.style === 'hood' && !flash ? '#f3e6ff' : OUTLINE;
  const out = f.state === 'fall' || f.state === 'lying' || f.state === 'dead' || f.state === 'hurt';
  if (out) {
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx + 3, hy - 3); ctx.lineTo(hx + 9, hy + 1); ctx.moveTo(hx + 9, hy - 3); ctx.lineTo(hx + 3, hy + 1); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(hx + 6.5, hy - 0.5, 2, 3.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 0.5, hy - 0.5, 1.6, 2.8, 0, 0, TAU); ctx.fill();
  }
  drawHair(ctx, L, hx, hy, R, time, col);
  // near arm (over the head so punches read clearly)
  limb(ctx, shX + 2, shY + 4, P.fa[0], P.fa[1], 12, 12, 6.5 * bulk, top, skin, 4.2 * bulk);
  if (L.extra === 'pads') {
    ctx.fillStyle = acc; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(shX + 2, shY + 2, 7 * bulk, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  if (f.state === 'frozen') {              // ice block overlay
    const w = 46 * f.scale, h = 88 * f.scale;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(150,220,255,0.5)'; ctx.strokeStyle = 'rgba(235,250,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 - 3, -h * 0.6); ctx.lineTo(-w / 4, -h); ctx.lineTo(w / 3, -h + 5); ctx.lineTo(w / 2 + 3, -h * 0.5); ctx.lineTo(w / 2, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(-w / 4, -h * 0.85); ctx.lineTo(-w / 3, -h * 0.4); ctx.stroke();
    ctx.restore();
  }
}

const shadeCache = {};
function shade(hex, amt) {
  const k = hex + amt;
  if (shadeCache[k]) return shadeCache[k];
  const n = parseInt(hex.slice(1), 16);
  const c = v => clamp(v + amt, 0, 255);
  return (shadeCache[k] = `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`);
}

/* portrait used by the HUD and the menus */
const portraitCache = {};
function getPortrait(id, size = 56) {
  const key = id + ':' + size;
  if (portraitCache[key]) return portraitCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  const ch = CHARS[id];
  x.fillStyle = shade(ch.look.top, -60); x.fillRect(0, 0, size, size);
  const k = size / 40;                       // frame the head and shoulders
  x.translate(size / 2 - 2 * k, size * 0.55 + 69 * k); x.scale(k, k);
  drawFighter(x, { char: ch, state: 'idle', t: 0, animT: 0, id: 0, flash: 0, facing: 1, scale: 1, vy: 0, y: 0 }, 0, 0, 0);
  return (portraitCache[key] = c);
}

/* ---------- projectiles ---------- */
function drawProj(ctx, p, sx, sy, time) {
  ctx.save(); ctx.translate(sx, sy);
  const dir = sign(p.vx) || p.facing;
  const glow = (r, c0, c1) => {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };
  switch (p.type) {
    case 'pulse':
      glow(24, 'rgba(120,200,255,0.9)', 'rgba(60,120,255,0)');
      ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,190,255,0.6)'; ctx.beginPath(); ctx.moveTo(-dir * 6, -7); ctx.lineTo(-dir * 34, 0); ctx.lineTo(-dir * 6, 7); ctx.fill();
      break;
    case 'fire': {
      glow(28, 'rgba(255,170,60,0.9)', 'rgba(255,60,0,0)');
      const w = Math.sin(time * 0.6) * 2;
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(dir * 12, 0); ctx.quadraticCurveTo(0, -13 - w, -dir * 30, w); ctx.quadraticCurveTo(0, 13 + w, dir * 12, 0); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(dir * 2, 0, 8, 6, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'ice':
      glow(18, 'rgba(180,235,255,0.7)', 'rgba(120,200,255,0)');
      ctx.fillStyle = '#d8f4ff'; ctx.strokeStyle = '#5fb8d9'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dir * 18, 0); ctx.lineTo(0, -6); ctx.lineTo(-dir * 14, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'wind':
      ctx.strokeStyle = 'rgba(210,255,230,0.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-dir * 14, 0, 22, dir > 0 ? -1.0 : Math.PI - 1.0, dir > 0 ? 1.0 : Math.PI + 1.0); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,235,190,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-dir * 24, 0, 22, dir > 0 ? -0.8 : Math.PI - 0.8, dir > 0 ? 0.8 : Math.PI + 0.8); ctx.stroke();
      break;
    case 'rock': {
      ctx.rotate(time * 0.2 * dir);
      ctx.fillStyle = '#8d8778'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, r = p.r * (0.8 + hash(i, 3) * 0.35); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'orb':
      glow(18, 'rgba(200,120,255,0.9)', 'rgba(90,30,160,0)');
      ctx.fillStyle = '#2a1640'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      break;
    case 'spike': {
      const u = p.age < 6 ? p.age / 6 : p.life < 8 ? p.life / 8 : 1, h = p.h * u;
      ctx.fillStyle = 'rgba(190,235,255,0.85)'; ctx.strokeStyle = '#eafaff'; ctx.lineWidth = 2;
      for (const [ox, k] of [[-12, 0.6], [0, 1], [12, 0.7]]) {
        ctx.beginPath(); ctx.moveTo(ox - 9, 0); ctx.lineTo(ox + (ox * 0.3), -h * k); ctx.lineTo(ox + 9, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function drawItem(ctx, it, sx, sy, time) {
  ctx.save(); ctx.translate(sx, sy - 9 - (it.y === 0 ? Math.sin(time * 0.1) * 2 + 2 : 0));
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  if (it.type === 'apple') {
    ctx.fillStyle = '#e8413c'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff9d96'; ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3d7a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(3, -14, 8, -13); ctx.stroke();
  } else {
    ctx.fillStyle = '#4cc9ff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, -2); ctx.lineTo(0, 10); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d6f4ff'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, -2); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ---------- stage backdrops (all generated from maths, tiled by hash) ---------- */
function ridge(ctx, off, baseY, amp, freq, seed, color, jag) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) {
    const u = (x + off) * freq;
    let y = Math.sin(u + seed) * 0.6 + Math.sin(u * 2.3 + seed * 2) * 0.3 + Math.sin(u * 5.1 + seed * 3) * 0.1;
    if (jag) y = Math.abs(y) * 1.6 - 0.6;
    ctx.lineTo(x, baseY - y * amp);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, GY);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
}
function floor(ctx, c0, c1) {
  const g = ctx.createLinearGradient(0, GY - 14, 0, H);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, GY - 14, W, H - GY + 14);
}
/* iterate scenery slots visible at a given parallax */
function tiles(cam, par, period, fn) {
  const off = cam * par, i0 = Math.floor(off / period) - 1, i1 = Math.floor((off + W) / period) + 1;
  for (let i = i0; i <= i1; i++) fn(i, i * period - off);
}
function motes(ctx, time, n, color, vy, vx, size) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = ((hash(i, 1) * W + time * vx * (0.5 + hash(i, 2))) % W + W) % W;
    const y = ((hash(i, 3) * H + time * vy * (0.5 + hash(i, 4))) % H + H) % H;
    const s = size * (0.5 + hash(i, 5));
    ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(time * 0.03 + i));
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawStage(ctx, theme, cam, time) {
  switch (theme) {
    case 'meadow': {
      sky(ctx, ['#6ec3ff', '#bfe8ff', '#f4fbe8']);
      ctx.fillStyle = '#fff8d6'; ctx.beginPath(); ctx.arc(760, 80, 38, 0, TAU); ctx.fill();
      tiles(cam + time * 2, 0.05, 330, (i, x) => {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; const y = 50 + hash(i, 7) * 90;
        ctx.beginPath(); ctx.ellipse(x, y, 60, 16, 0, 0, TAU); ctx.ellipse(x + 34, y - 10, 36, 16, 0, 0, TAU); ctx.fill();
      });
      ridge(ctx, cam * 0.1, 262, 46, 0.004, 1, '#9fd4a8');
      ridge(ctx, cam * 0.25, 296, 34, 0.007, 4, '#6fbf78');
      tiles(cam, 0.55, 170, (i, x) => {
        const tx = x + hash(i, 2) * 90, th = 70 + hash(i, 3) * 50;
        ctx.fillStyle = '#6b4a2f'; ctx.fillRect(tx - 5, GY - 14 - th * 0.5, 10, th * 0.5);
        ctx.fillStyle = '#2f8a45'; ctx.beginPath(); ctx.arc(tx, GY - 14 - th * 0.6, 34, 0, TAU); ctx.arc(tx - 22, GY - 14 - th * 0.45, 24, 0, TAU); ctx.arc(tx + 22, GY - 14 - th * 0.45, 24, 0, TAU); ctx.fill();
        ctx.fillStyle = '#48a85c'; ctx.beginPath(); ctx.arc(tx - 8, GY - 22 - th * 0.65, 18, 0, TAU); ctx.fill();
      });
      floor(ctx, '#7fcf6a', '#4f9a48');
      ctx.fillStyle = '#d8c090'; ctx.fillRect(0, GY + 50, W, 78);
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, GY + 122, W, 6);
      tiles(cam, 1, 46, (i, x) => {
        const y = GY + hash(i, 9) * (ZMAX + 20), on = y > GY + 44 && y < GY + 132;
        ctx.fillStyle = on ? '#b89f70' : '#3f8a3c';
        if (on) ctx.fillRect(x, y, 8, 3); else { ctx.fillRect(x, y, 2, -7); ctx.fillRect(x + 4, y, 2, -10); ctx.fillRect(x + 8, y, 2, -6); }
        if (!on && hash(i, 11) > 0.75) { ctx.fillStyle = hash(i, 12) > 0.5 ? '#fff1a8' : '#ffb3d1'; ctx.beginPath(); ctx.arc(x + 5, y - 11, 3, 0, TAU); ctx.fill(); }
      });
      break;
    }
    case 'dojo': {
      sky(ctx, ['#2b2350', '#8a4a78', '#f09a6a']);
      ridge(ctx, cam * 0.08, 250, 60, 0.005, 2, '#4a3566', true);
      ctx.fillStyle = '#5a2f38'; ctx.fillRect(0, 150, W, GY - 164);
      ctx.fillStyle = '#3d1f28'; ctx.fillRect(0, 138, W, 16);
      tiles(cam, 0.8, 240, (i, x) => {
        ctx.fillStyle = '#e9d8b4'; ctx.fillRect(x + 30, 172, 180, GY - 200);
        ctx.strokeStyle = '#5a2f38'; ctx.lineWidth = 3;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 30 + k * 45, 172); ctx.lineTo(x + 30 + k * 45, GY - 28); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x + 30, 232); ctx.lineTo(x + 210, 232); ctx.stroke();
        ctx.fillStyle = '#8a2f2f'; ctx.fillRect(x - 12, 130, 24, GY - 144);
        ctx.fillStyle = '#6b2020'; ctx.fillRect(x - 16, 130, 32, 10);
        const gl = 0.75 + Math.sin(time * 0.05 + i) * 0.2;
        ctx.fillStyle = `rgba(255,190,90,${gl * 0.25})`; ctx.beginPath(); ctx.arc(x + 120, 120, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.ellipse(x + 120, 120, 11, 15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a2a1a'; ctx.fillRect(x + 113, 103, 14, 4); ctx.fillRect(x + 113, 133, 14, 4);
      });
      floor(ctx, '#8d8a96', '#5d5a68');
      ctx.strokeStyle = 'rgba(30,25,40,0.28)'; ctx.lineWidth = 2;
      for (let r = 0; r <= 4; r++) { const y = GY - 14 + r * 56; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      tiles(cam, 1, 110, (i, x) => { for (let r = 0; r < 4; r++) { const y = GY - 14 + r * 56, xx = x + (r % 2) * 55; ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + 56); ctx.stroke(); } });
      break;
    }
    case 'glacier': {
      sky(ctx, ['#1f3a6b', '#5f9ad1', '#d8f0ff']);
      ridge(ctx, cam * 0.06, 240, 110, 0.004, 5, '#9cc4e6', true);
      ridge(ctx, cam * 0.15, 280, 80, 0.007, 8, '#c6e2f5', true);
      ridge(ctx, cam * 0.35, 312, 30, 0.012, 3, '#e8f6ff');
      tiles(cam, 0.6, 210, (i, x) => {
        const tx = x + hash(i, 4) * 100, th = 60 + hash(i, 5) * 40;
        ctx.fillStyle = '#2f5a66';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(tx - 26 + k * 5, GY - 14 - k * th * 0.28); ctx.lineTo(tx, GY - 14 - th * 0.5 - k * th * 0.28); ctx.lineTo(tx + 26 - k * 5, GY - 14 - k * th * 0.28); ctx.fill(); }
        ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.moveTo(tx - 9, GY - 14 - th * 0.9); ctx.lineTo(tx, GY - 14 - th * 1.06); ctx.lineTo(tx + 9, GY - 14 - th * 0.9); ctx.fill();
      });
      floor(ctx, '#f2fbff', '#a9cfe8');
      tiles(cam, 1, 90, (i, x) => {
        const y = GY + hash(i, 6) * ZMAX;
        ctx.fillStyle = 'rgba(120,180,220,0.35)'; ctx.beginPath(); ctx.ellipse(x + 20, y, 30 + hash(i, 7) * 30, 5, 0, 0, TAU); ctx.fill();
      });
      motes(ctx, time, 60, '#ffffff', 1.4, -0.6, 4);
      break;
    }
    case 'volcano': {
      sky(ctx, ['#16090d', '#4a1414', '#c2461a']);
      ctx.fillStyle = '#2a1114'; ctx.beginPath();
      const vx = 520 - cam * 0.05; ctx.moveTo(vx - 300, GY); ctx.lineTo(vx - 50, 110); ctx.lineTo(vx + 50, 110); ctx.lineTo(vx + 320, GY); ctx.fill();
      const gl = 0.6 + Math.sin(time * 0.04) * 0.2;
      ctx.fillStyle = `rgba(255,140,40,${gl})`; ctx.beginPath(); ctx.ellipse(vx, 110, 50, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,120,40,${gl * 0.2})`; ctx.beginPath(); ctx.arc(vx, 100, 110, 0, TAU); ctx.fill();
      ridge(ctx, cam * 0.2, 290, 50, 0.008, 6, '#3a1a1a', true);
      ridge(ctx, cam * 0.45, 316, 26, 0.013, 2, '#22100f', true);
      floor(ctx, '#4d2f2a', '#241312');
      tiles(cam, 1, 130, (i, x) => {
        const y = GY + 8 + hash(i, 8) * (ZMAX - 10), len = 30 + hash(i, 9) * 50, p = 0.5 + Math.sin(time * 0.05 + i) * 0.3;
        ctx.strokeStyle = `rgba(255,${120 + p * 80},40,${0.5 + p * 0.4})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * 0.5, y + 6); ctx.lineTo(x + len, y - 2); ctx.stroke();
      });
      motes(ctx, time, 40, '#ffb347', -1.1, 0.4, 3);
      break;
    }
    case 'rooftop': {
      sky(ctx, ['#070b1e', '#16224a', '#3a3f78']);
      for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * Math.abs(Math.sin(time * 0.02 + i))})`; ctx.fillRect(hash(i, 1) * W, hash(i, 2) * 220, 2, 2); }
      ctx.fillStyle = '#f6f1d0'; ctx.beginPath(); ctx.arc(170, 86, 42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16224a'; ctx.beginPath(); ctx.arc(188, 76, 38, 0, TAU); ctx.fill();
      for (const [par, base, colr, seed, lit] of [[0.12, 150, '#1a2247', 1, 0.25], [0.3, 110, '#101632', 2, 0.4]]) {
        tiles(cam, par, 84, (i, x) => {
          const h = base * (0.45 + hash(i, seed) * 0.75), w = 60 + hash(i, seed + 5) * 22;
          ctx.fillStyle = colr; ctx.fillRect(x, GY - 14 - h, w, h);
          for (let r = 0; r < h / 16 - 1; r++) for (let c = 0; c < 4; c++) {
            if (hash(i * 31 + r * 7 + c, seed + 9) < lit) { ctx.fillStyle = hash(i + r + c, 4) > 0.5 ? '#ffe9a0' : '#9fd8ff'; ctx.fillRect(x + 8 + c * 13, GY - 8 - h + r * 16, 6, 8); }
          }
        });
      }
      floor(ctx, '#4b4f66', '#2b2e40');
      ctx.fillStyle = '#62667f'; ctx.fillRect(0, GY - 22, W, 10);
      tiles(cam, 1, 300, (i, x) => {
        ctx.fillStyle = '#3a3d52'; ctx.fillRect(x + 40, GY - 52, 46, 36); ctx.fillStyle = '#2a2c3d'; ctx.fillRect(x + 36, GY - 58, 54, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, GY - 12); ctx.lineTo(x - 40, H); ctx.stroke();
      });
      break;
    }
  }
}
