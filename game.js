'use strict';
// ===== SUPER HERO RUN — マリオ風横スクロールアクション =====
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const T = 40;            // タイルサイズ
const ROWS = 15;
const GY = 13;           // 地面の一番上の行

// ---------- キャラクター ----------
const CHARS = [
  { id: 'AKARI',  color: '#a24bff', spd: 1.08, jmp: 1.00, ability: 'double', desc: '二段ジャンプ' },
  { id: 'JACK',   color: '#ff7a2f', spd: 1.00, jmp: 1.00, ability: 'none',   desc: 'バランス型' },
  { id: 'KAI',    color: '#2fb5ff', spd: 1.18, jmp: 0.96, ability: 'dash',   desc: '超ダッシュ' },
  { id: 'LUNA',   color: '#ffd23f', spd: 0.98, jmp: 1.12, ability: 'high',   desc: 'ハイジャンプ' },
  { id: 'MEILIN', color: '#ff4f8b', spd: 1.05, jmp: 1.05, ability: 'double', desc: '二段ジャンプ' },
  { id: 'NOIR',   color: '#6c7bff', spd: 1.00, jmp: 1.02, ability: 'float',  desc: 'ふんわり落下' },
  { id: 'RYUJI',  color: '#ff3b3b', spd: 1.12, jmp: 1.00, ability: 'dash',   desc: '超ダッシュ' },
  { id: 'VIKTOR', color: '#3fd07a', spd: 0.95, jmp: 0.98, ability: 'tough',  desc: '最初からパワーアップ' },
];
const IMG = {};
for (const c of CHARS) {
  const im = new Image();
  im.src = (window.SPRITES && window.SPRITES[c.id]) || (c.id + '.png');
  IMG[c.id] = im;
}

// ---------- アクション用ポーズ画像 ----------
// POSES[id][pose] = { x, y, w, h, fw, src }（x,y,w,h は元フレーム内の切り抜き位置）
const PIMG = {};
if (window.POSES) {
  for (const id in POSES) {
    PIMG[id] = {};
    for (const pose in POSES[id]) {
      const d = POSES[id][pose], im = new Image();
      im.src = d.src;
      PIMG[id][pose] = { img: im, x: d.x, y: d.y, w: d.w, h: d.h, fw: d.fw };
    }
  }
}

// ---------- 敵・ボス・背景アセット ----------
// グリーンバックを外周から塗りつぶして透過し、余白を切り抜いたcanvasを作る
const ART = {};
function keyOut(src, maxH, done) {
  const im = new Image();
  im.onload = () => {
    const s = Math.min(1, maxH / im.height);
    const w = Math.round(im.width * s), h = Math.round(im.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), px = d.data;
    const kr = px[0], kg = px[1], kb = px[2];
    const dist = i => Math.abs(px[i] - kr) + Math.abs(px[i + 1] - kg) + Math.abs(px[i + 2] - kb);
    const seen = new Uint8Array(w * h), stack = [];
    for (let i = 0; i < w; i++) stack.push(i, (h - 1) * w + i);
    for (let j = 0; j < h; j++) stack.push(j * w, j * w + w - 1);
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      const dd = dist(p * 4);
      if (dd > 90) continue;
      seen[p] = 1;
      px[p * 4 + 3] = dd < 45 ? 0 : Math.round(255 * (dd - 45) / 45);
      const px0 = p % w;
      if (px0 > 0) stack.push(p - 1);
      if (px0 < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (px[(j * w + i) * 4 + 3] > 60) {
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
    }
    x.putImageData(d, 0, 0);
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    done(out);
  };
  im.src = src;
}
function tinted(base, color) {
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
  const x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
if (window.ASSETS) {
  keyOut(ASSETS.zombie, 300, c => {
    ART.zombie = c;
    ART.zombieRage = tinted(c, 'rgba(255,20,20,0.5)');
    ART.zombieJump = tinted(c, 'rgba(120,60,255,0.45)');
  });
  keyOut(ASSETS.boss, 500, c => { ART.boss = c; ART.bossHit = tinted(c, 'rgba(255,255,255,0.7)'); });
  const bg = new Image();
  bg.onload = () => {
    const c = document.createElement('canvas');
    c.height = H; c.width = Math.round(bg.width * H / bg.height);
    c.getContext('2d').drawImage(bg, 0, 0, c.width, c.height);
    ART.city = c;
  };
  bg.src = ASSETS.city;
}

// ---------- 入力 ----------
const keys = {}, pressed = {};
const JUMP_KEYS = ['Space', 'KeyZ', 'ArrowUp', 'KeyW'];
const RUN_KEYS = ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyJ'];
const ATK_KEYS = ['KeyC', 'KeyK'];
const DOWN_KEYS = ['ArrowDown', 'KeyS'];
function down(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; initAudio(); }
function up(k) { keys[k] = false; }
addEventListener('keydown', e => { down(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => up(e.code));
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); down(k); if (k === 'Space') down('Enter'); });
  b.addEventListener('pointerup', () => { up(k); up('Enter'); });
  b.addEventListener('pointerleave', () => { up(k); up('Enter'); });
});
const any = list => list.some(k => keys[k]);
const hit = list => list.some(k => pressed[k]);

function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointermove', e => { if (state === 'select') { const i = cardAt(canvasPos(e)); if (i >= 0) selIdx = i; } });
// スマホ: タイトルをタップしたら全画面＋横向き固定（対応ブラウザのみ）
function goFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  } catch (e) { /* 非対応端末は何もしない */ }
}
addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  initAudio();
  const p = canvasPos(e);
  if (state === 'title') { state = 'select'; sfx('coin'); goFullscreen(); }
  else if (state === 'select') { const i = cardAt(p); if (i >= 0) { selIdx = i; startGame(); } }
  else if (state === 'gameover' || state === 'ending') { state = 'select'; }
});

// ---------- サウンド ----------
let AC = null, bgmOn = true, bgmTimer = null;
function initAudio() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}
function tone(f, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function sfx(n) {
  switch (n) {
    case 'jump': tone(330, 0.18, 'square', 0.05, 380); break;
    case 'coin': tone(988, 0.07, 'square', 0.05); tone(1319, 0.2, 'square', 0.05, 0, 0.07); break;
    case 'stomp': tone(200, 0.12, 'triangle', 0.12, -120); break;
    case 'bump': tone(120, 0.1, 'square', 0.06); break;
    case 'break': tone(90, 0.15, 'sawtooth', 0.07, -40); break;
    case 'power': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.09, 'square', 0.05, 0, i * 0.06)); break;
    case 'item': tone(400, 0.3, 'triangle', 0.08, 400); break;
    case 'hurt': tone(600, 0.35, 'square', 0.06, -450); break;
    case 'punch': tone(160, 0.09, 'sawtooth', 0.06, -90); tone(700, 0.05, 'square', 0.025, -500); break;
    case 'smash': tone(110, 0.14, 'square', 0.09, -60); tone(60, 0.2, 'triangle', 0.12); break;
    case 'fire': tone(900, 0.08, 'square', 0.04, -500); break;
    case 'die': [659, 587, 523, 392, 330, 262].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.14)); break;
    case '1up': [660, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.05, 0, i * 0.08)); break;
    case 'clear': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.13)); break;
  }
}
// オリジナルの簡易BGM
const MEL = [72, 0, 76, 79, 81, 79, 76, 0, 74, 0, 77, 81, 79, 77, 74, 0, 72, 0, 76, 79, 84, 81, 79, 76, 77, 76, 74, 71, 72, 0, 0, 0];
const BAS = [48, 48, 55, 55, 53, 53, 55, 55, 50, 50, 57, 57, 55, 55, 50, 50, 48, 48, 55, 55, 53, 53, 57, 57, 53, 53, 55, 55, 48, 48, 55, 55];
let bgmStep = 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
function startBgm() {
  stopBgm();
  bgmStep = 0;
  bgmTimer = setInterval(() => {
    if (!AC || !bgmOn || state !== 'play') return;
    const m = MEL[bgmStep % 32], b = BAS[bgmStep % 32];
    if (m) tone(midi(m), 0.16, 'square', 0.022);
    if (bgmStep % 2 === 0) tone(midi(b), 0.25, 'triangle', 0.05);
    bgmStep++;
  }, 170);
}
function stopBgm() { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; }

// ---------- ステージ生成 ----------
const THEMES = [
  { name: 'ネオン廃墟街', tint: 'rgba(20,10,70,0.18)', ground: '#5f5d78', groundDark: '#2a2938', grass: '#b36bff', brick: '#6e2f36', fx: 'rain' },
  { name: '炎上ハイウェイ', tint: 'rgba(255,80,0,0.22)', ground: '#6e5a50', groundDark: '#2e211c', grass: '#ff7a2f', brick: '#7a3322', fx: 'ember' },
  { name: '血の月タワー', tint: 'rgba(170,0,40,0.3)', ground: '#634a58', groundDark: '#2a1822', grass: '#ff2d6f', brick: '#5a1f3a', fx: 'rain' },
];
const ARENA_W = 24;
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function buildLevel(n) {
  const r = rng(1234 + n * 777);
  const cols = 190 + n * 25;
  const g = [];
  for (let y = 0; y < ROWS; y++) g.push(new Array(cols).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && x < cols && y >= 0 && y < ROWS) g[y][x] = c; };
  for (let x = 0; x < cols; x++) { set(x, GY, '#'); set(x, GY + 1, '#'); }
  const spawns = [], pipes = [];
  const enemy = (type, x, y) => spawns.push({ type, x: x * T, y: y * T });
  const d = n;
  let x = 16;
  const endStart = cols - 50;
  const kinds = ['blocks', 'gap', 'pipe', 'stairs', 'coins', 'platforms', 'enemies'];
  while (x < endStart - 12) {
    const k = kinds[Math.floor(r() * kinds.length)];
    let w = 0;
    if (k === 'blocks') {
      const pat = r() < 0.5 ? ['B', '?', 'B', 'M', 'B'] : ['?', 'B', '?', 'B', '?'];
      pat.forEach((c, i) => set(x + i, 9, c));
      if (r() < 0.5) set(x + 2, 5, r() < 0.5 ? '?' : 'M');
      enemy('walker', x + 3, GY - 1);
      if (d > 0 && r() < 0.5) enemy('walker', x + 5, GY - 1);
      w = 7;
    } else if (k === 'gap') {
      const gw = 2 + (r() < 0.3 + d * 0.2 ? 1 : 0);
      for (let i = 1; i <= gw; i++) { set(x + i, GY, '.'); set(x + i, GY + 1, '.'); }
      for (let i = 0; i < gw; i++) set(x + 1 + i, 9, 'o');
      w = gw + 3;
    } else if (k === 'pipe') {
      const h = 2 + Math.floor(r() * 3);
      for (let yy = GY - h; yy < GY; yy++) { set(x, yy, 'P'); set(x + 1, yy, 'P'); }
      pipes.push({ x, y: GY - h, h });
      set(x, GY - h - 2, 'o'); set(x + 1, GY - h - 2, 'o');
      enemy(d > 0 && r() < 0.4 ? 'spiky' : 'walker', x + 4, GY - 1);
      w = 7;
    } else if (k === 'stairs') {
      const s = 4;
      const gap = r() < 0.5 ? 2 : 0;
      for (let i = 0; i < s; i++) for (let j = 0; j <= i; j++) set(x + i, GY - 1 - j, 'X');
      for (let i = 1; i <= gap; i++) { set(x + s - 1 + i, GY, '.'); set(x + s - 1 + i, GY + 1, '.'); }
      for (let i = 0; i < s; i++) for (let j = 0; j < s - i; j++) set(x + s + gap + i, GY - 1 - j, 'X');
      w = s * 2 + gap + 2;
    } else if (k === 'coins') {
      for (let i = 0; i < 5; i++) set(x + 1 + i, i === 0 || i === 4 ? 10 : 9, 'o');
      enemy('walker', x + 2, GY - 1); enemy('walker', x + 4, GY - 1);
      if (d > 0) enemy('spiky', x + 6, GY - 1);
      w = 8;
    } else if (k === 'platforms') {
      for (let i = 1; i <= 7; i++) { set(x + i, GY, '.'); set(x + i, GY + 1, '.'); }
      set(x + 2, 10, 'X'); set(x + 3, 10, 'X');
      set(x + 5, 9, 'B'); set(x + 6, 9, '?');
      set(x + 2, 8, 'o'); set(x + 3, 8, 'o');
      if (d > 0) enemy('jumper', x + 9, GY - 1);
      w = 10;
    } else if (k === 'enemies') {
      enemy('walker', x + 1, GY - 1); enemy('walker', x + 3, GY - 1); enemy('walker', x + 5, GY - 1);
      if (d > 0) enemy('jumper', x + 4, GY - 1);
      if (d > 1) enemy('spiky', x + 7, GY - 1);
      for (let i = 0; i < 4; i++) set(x + 2 + i, 8, 'o');
      w = 9;
    }
    x += w + 2 + Math.floor(r() * 3);
  }
  // ボスアリーナ（右端はボスを倒すまで開かないバリケード）
  const arenaX = endStart;
  set(arenaX + 4, 9, 'X'); set(arenaX + 5, 9, 'X');
  set(arenaX + ARENA_W - 6, 9, 'X'); set(arenaX + ARENA_W - 5, 9, 'X');
  for (let yy = 0; yy < GY; yy++) set(arenaX + ARENA_W - 1, yy, 'W');
  const flagX = arenaX + ARENA_W + 6;
  set(flagX, GY - 1, 'X');
  // チェックポイント
  let cp = Math.floor(cols / 2);
  while (cp > 5 && !(g[GY][cp] === '#' && g[GY - 1][cp] === '.' && g[GY - 2][cp] === '.' && g[GY][cp + 1] === '#')) cp--;
  return { g, cols, spawns, pipes, flagX, arenaX, castleX: flagX + 5, checkpoint: cp, theme: THEMES[n % THEMES.length] };
}

// ---------- ゲーム状態 ----------
let state = 'title', selIdx = 0, frame = 0;
let level, levelNo = 0, cam = 0, score = 0, coins = 0, lives = 3, time = 300, timeAcc = 0;
let player, enemies, items, fireballs, parts, popups, bumps, reachedCp, stateTimer = 0;
let boss, bossShots, shake = 0;
const SOLID = new Set(['#', 'X', 'B', '?', 'M', 'U', 'P', 'W']);
const tile = (cx, cy) => (cy < 0 ? '.' : cy >= ROWS ? '.' : cx < 0 || cx >= level.cols ? '#' : level.g[cy][cx]);
const solidAt = (cx, cy) => SOLID.has(tile(cx, cy));

function startGame() {
  score = 0; coins = 0; lives = 3; levelNo = 0;
  sfx('power');
  loadLevel(true);
}
function loadLevel(fresh) {
  level = buildLevel(levelNo);
  if (fresh) reachedCp = false;
  const ch = CHARS[selIdx];
  const startCol = reachedCp ? level.checkpoint : 3;
  player = {
    x: startCol * T + 6, y: 0, w: 28, h: 58, vx: 0, vy: 0, dir: 1, onGround: false,
    power: ch.ability === 'tough' ? 1 : 0, inv: 0, jumps: 0, anim: 0, dead: false, star: 0,
    crouch: false, atk: 0, atkCd: 0, atkAir: false, hurtT: 0, landT: 0,
  };
  setPower(player, player.power);
  player.y = GY * T - player.h;
  enemies = level.spawns.map(s => makeEnemy(s));
  items = []; fireballs = []; parts = []; popups = []; bumps = {};
  boss = makeBoss(levelNo); bossShots = []; shake = 0;
  cam = Math.max(0, player.x - 300);
  time = 400; timeAcc = 0;
  state = 'intro'; stateTimer = 110;
  startBgm();
}
function setPower(p, pw) {
  const bottom = p.y + p.h;
  p.power = pw;
  p.h = fullH(p) * (p.crouch ? 0.62 : 1);
  p.y = bottom - p.h;
}
const fullH = p => (p.power > 0 ? 80 : 58);
// しゃがみ解除できるか（頭上にブロックがないか）
function canStand(p) {
  const top = p.y + p.h - fullH(p);
  const l = Math.floor((p.x + 2) / T), r = Math.floor((p.x + p.w - 3) / T);
  for (let cy = Math.floor(top / T); cy <= Math.floor((p.y - 1) / T); cy++)
    for (let cx = l; cx <= r; cx++) if (solidAt(cx, cy)) return false;
  return true;
}
function setCrouch(p, on) {
  if (p.crouch === on) return;
  if (!on && !canStand(p)) return;
  p.crouch = on; setPower(p, p.power);
}
// 攻撃の当たり判定（体の前方）
function attackBox(p) {
  const reach = p.atkAir ? 58 : 50;
  return {
    x: p.dir > 0 ? p.x + p.w - 6 : p.x - reach + 6,
    y: p.atkAir ? p.y + p.h * 0.3 : p.y + p.h * 0.08,
    w: reach, h: p.h * 0.6,
  };
}
const attacking = p => p.atk >= 4 && p.atk <= 13;
function makeEnemy(s) {
  const e = { type: s.type, x: s.x + 3, y: s.y, w: 34, h: 38, vx: -1, vy: 0, alive: true, active: false, dead: 0, t: Math.random() * 6, hop: 60 };
  e.y = s.y + T - e.h;
  if (s.type === 'spiky') e.vx = -1.3;   // 赤い凶暴ゾンビ（踏めない）
  if (s.type === 'jumper') e.vx = -1.2;  // 紫のジャンプゾンビ
  return e;
}
function makeBoss(n) {
  const hp = 3 + n;
  return {
    x: (level.arenaX + ARENA_W - 7) * T, y: GY * T - 130, w: 96, h: 130, vx: 0, vy: 0,
    hp, maxHp: hp, lvl: n, dir: -1, mode: 'idle', timer: 90, inv: 0, dead: 0,
    active: false, alive: true, onGround: true, t: 0,
  };
}

// ---------- 物理 ----------
function moveBody(b, onBump) {
  // X軸
  b.x += b.vx;
  let top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 1) / T);
  if (b.vx > 0) {
    const cx = Math.floor((b.x + b.w) / T);
    for (let cy = top; cy <= bot; cy++) if (solidAt(cx, cy)) { b.x = cx * T - b.w; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const cx = Math.floor(b.x / T);
    for (let cy = top; cy <= bot; cy++) if (solidAt(cx, cy)) { b.x = (cx + 1) * T; b.hitWall = true; break; }
  }
  // Y軸
  b.y += b.vy;
  b.onGround = false;
  const l = Math.floor((b.x + 2) / T), rr = Math.floor((b.x + b.w - 3) / T);
  if (b.vy > 0) {
    const cy = Math.floor((b.y + b.h) / T);
    for (let cx = l; cx <= rr; cx++) if (solidAt(cx, cy)) { b.y = cy * T - b.h; b.vy = 0; b.onGround = true; break; }
  } else if (b.vy < 0) {
    const cy = Math.floor(b.y / T);
    let hitCols = [];
    for (let cx = l; cx <= rr; cx++) if (solidAt(cx, cy)) hitCols.push(cx);
    if (hitCols.length) {
      b.y = (cy + 1) * T; b.vy = 0;
      if (onBump) {
        const mid = (b.x + b.w / 2) / T;
        hitCols.sort((a, c) => Math.abs(a + 0.5 - mid) - Math.abs(c + 0.5 - mid));
        onBump(hitCols[0], cy);
      }
    }
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function bumpBlock(cx, cy) {
  const t = tile(cx, cy);
  const key = cx + ',' + cy;
  if (t === '?') {
    level.g[cy][cx] = 'U'; bumps[key] = 10;
    coins++; addScore(200, cx * T + 20, cy * T - 10); sfx('coin'); checkCoins();
    parts.push({ kind: 'coin', x: cx * T + 20, y: cy * T - 10, vy: -9, life: 30 });
  } else if (t === 'M') {
    level.g[cy][cx] = 'U'; bumps[key] = 10; sfx('item');
    items.push({ kind: player.power === 0 ? 'mush' : 'flower', x: cx * T + 4, y: cy * T, w: 32, h: 32, vx: 0, vy: 0, rise: 40, dir: 1 });
  } else if (t === 'B') {
    if (player.power > 0) {
      level.g[cy][cx] = '.'; sfx('break'); addScore(50);
      for (let i = 0; i < 4; i++) parts.push({ kind: 'brick', x: cx * T + 10 + (i % 2) * 20, y: cy * T + 10 + (i > 1 ? 20 : 0), vx: (i % 2 ? 3 : -3), vy: i > 1 ? -6 : -10, life: 60 });
    } else { bumps[key] = 10; sfx('bump'); }
  } else sfx('bump');
  // 上に乗っている敵を倒す
  for (const e of enemies) if (e.alive && e.active && !e.dead && overlap(e, { x: cx * T, y: cy * T - 8, w: T, h: 10 })) killEnemy(e, true);
}
function addScore(v, x, y) { score += v; if (x !== undefined) popups.push({ text: String(v), x, y, life: 45 }); }
function checkCoins() { if (coins >= 100) { coins -= 100; lives++; sfx('1up'); popups.push({ text: '1UP', x: player.x, y: player.y - 10, life: 60 }); } }
function killEnemy(e, flip) {
  e.dead = flip ? 90 : 30; e.flip = flip; e.vy = flip ? -7 : 0;
  addScore(e.type === 'spiky' ? 200 : 100, e.x, e.y); sfx('stomp');
}
function hurtPlayer() {
  if (player.inv > 0 || player.star > 0) return;
  if (player.power > 0) { setPower(player, 0); player.inv = 120; player.hurtT = 30; sfx('hurt'); }
  else die();
}
function die() {
  if (player.dead) return;
  player.dead = true; player.vy = -13; player.vx = 0;
  stopBgm(); sfx('die');
  state = 'dying'; stateTimer = 150;
}

// ---------- 更新 ----------
function updatePlayer() {
  const p = player, ch = CHARS[selIdx];
  const left = any(['ArrowLeft', 'KeyA']), right = any(['ArrowRight', 'KeyD']);
  const run = any(RUN_KEYS);
  const dashMul = ch.ability === 'dash' ? 1.25 : 1;
  const maxV = (run ? 6.2 * dashMul : 4.0) * ch.spd;
  const acc = p.onGround ? 0.45 : 0.3;
  setCrouch(p, any(DOWN_KEYS) && p.onGround && p.atk === 0);
  const busy = p.crouch || (p.atk > 0 && p.onGround);
  if (busy) { p.vx *= 0.85; if (left !== right) p.dir = left ? -1 : 1; }
  else if (left && !right) { p.vx = Math.max(p.vx - acc, -maxV); p.dir = -1; }
  else if (right && !left) { p.vx = Math.min(p.vx + acc, maxV); p.dir = 1; }
  else { p.vx *= p.onGround ? 0.8 : 0.95; if (Math.abs(p.vx) < 0.1) p.vx = 0; }
  if (Math.abs(p.vx) > maxV) p.vx *= 0.94;

  // パンチ（地上）／飛び蹴り（空中）
  if (p.atkCd > 0) p.atkCd--;
  if (p.atk > 0) p.atk--;
  if (hit(ATK_KEYS) && p.atkCd === 0) {
    setCrouch(p, false);
    p.atk = 16; p.atkCd = 22; p.atkAir = !p.onGround; sfx('punch');
    if (p.atkAir && p.vy > 0) p.vy *= 0.5;
  }
  const jumpHeld = any(JUMP_KEYS);
  if (hit(JUMP_KEYS)) {
    setCrouch(p, false);
    const jv = -13.2 * ch.jmp * (ch.ability === 'high' ? 1.08 : 1) - Math.abs(p.vx) * 0.25;
    if (p.onGround) { p.vy = jv; p.jumps = 1; sfx('jump'); }
    else if (ch.ability === 'double' && p.jumps < 2) {
      p.vy = jv * 0.85; p.jumps = 2; sfx('jump');
      for (let i = 0; i < 8; i++) parts.push({ kind: 'spark', x: p.x + p.w / 2, y: p.y + p.h, vx: Math.cos(i) * 3, vy: Math.sin(i) * 2, life: 20, color: ch.color });
    }
  }
  // 火の玉
  if (p.power === 2 && hit(RUN_KEYS) && fireballs.length < 2) {
    fireballs.push({ x: p.x + p.w / 2 + p.dir * 14, y: p.y + 20, w: 14, h: 14, vx: 8 * p.dir, vy: 2, life: 120 });
    sfx('fire');
  }
  let grav = jumpHeld && p.vy < 0 ? 0.5 : 0.95;
  let maxFall = 14;
  if (ch.ability === 'float' && jumpHeld && p.vy > 0) { grav = 0.25; maxFall = 2.6; }
  p.vy = Math.min(p.vy + grav, maxFall);

  const fallV = p.vy, wasAir = !p.onGround;
  moveBody(p, bumpBlock);
  if (p.onGround) p.jumps = 0;
  if (wasAir && p.onGround && fallV > 7) p.landT = 7;
  if (p.landT > 0) p.landT--;
  if (p.hurtT > 0) p.hurtT--;
  if (!p.onGround && p.crouch) setCrouch(p, false);
  // 攻撃でブロックを叩く
  if (attacking(player) && p.atk === 12) {
    const b = attackBox(p), cy0 = Math.floor(b.y / T), cy1 = Math.floor((b.y + b.h) / T);
    const cx = Math.floor((p.dir > 0 ? b.x + b.w : b.x) / T);
    for (let cy = cy0; cy <= cy1; cy++) if (tile(cx, cy) === 'B' || tile(cx, cy) === '?' || tile(cx, cy) === 'M') { bumpBlock(cx, cy); break; }
  }
  if (p.x < cam) { p.x = cam; if (p.vx < 0) p.vx = 0; }

  // コイン回収
  const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w) / T), r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h) / T);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (tile(cx, cy) === 'o') {
    level.g[cy][cx] = '.'; coins++; addScore(100); sfx('coin'); checkCoins();
  }
  if (p.inv > 0) p.inv--;
  if (p.star > 0) p.star--;
  p.anim += Math.abs(p.vx) * 0.12;

  // チェックポイント
  if (!reachedCp && p.x > level.checkpoint * T) { reachedCp = true; popups.push({ text: 'CHECKPOINT!', x: p.x - 30, y: p.y - 20, life: 80 }); sfx('coin'); }
  // 落下
  if (p.y > H + 40) die();
  // ゴール
  if (p.x + p.w >= level.flagX * T + 18) {
    const h = Math.max(0, Math.min(1, ((GY - 1) * T - (p.y + p.h)) / (9 * T)));
    const bonus = h > 0.9 ? 5000 : h > 0.6 ? 2000 : h > 0.3 ? 800 : 400;
    addScore(bonus, p.x, p.y);
    p.x = level.flagX * T + 20 - p.w; p.vx = 0; p.vy = 0;
    stopBgm(); sfx('clear');
    state = 'clear'; stateTimer = 0;
  }
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!e.active) { if (e.x < cam + W + 60) e.active = true; else continue; }
    e.t += 0.1;
    if (e.dead) {
      e.dead--;
      if (e.flip) { e.vy += 0.6; e.y += e.vy; e.x += 1; }
      if (e.dead <= 0) e.alive = false;
      continue;
    }
    e.vy = Math.min(e.vy + 0.8, 12);
    e.hitWall = false;
    moveBody(e);
    if (e.hitWall) e.vx = -e.vx;
    if (e.type === 'jumper' && e.onGround && --e.hop <= 0) { e.vy = -11; e.hop = 70 + Math.random() * 50; }
    if (e.y > H + 50) e.alive = false;
    if (e.x < cam - 200) e.alive = false;
    // 火の玉
    for (const f of fireballs) if (f.life > 0 && overlap(f, e)) { f.life = 0; killEnemy(e, true); }
    if (!e.dead && !player.dead && attacking(player) && overlap(attackBox(player), e)) {
      killEnemy(e, true); sfx('smash'); e.vy = -9; e.x += player.dir * 4;
      for (let i = 0; i < 8; i++) parts.push({ kind: 'spark', x: e.x + e.w / 2, y: e.y + 10, vx: player.dir * (2 + Math.random() * 4), vy: -Math.random() * 5, life: 18, color: '#ffffff' });
    }
    if (e.dead) continue;
    // プレイヤーとの接触
    if (!player.dead && overlap(player, e)) {
      if (player.star > 0) { killEnemy(e, true); continue; }
      const stomp = player.vy > 0 && player.y + player.h - player.vy <= e.y + 12;
      if (stomp && e.type !== 'spiky') {
        killEnemy(e, false);
        player.vy = any(JUMP_KEYS) ? -12 : -8; player.jumps = 1;
      } else hurtPlayer();
    }
  }
}

// ---------- ボス ----------
const bossActive = () => boss && boss.active && boss.alive && !boss.dead;
function roar() { tone(90, 0.6, 'sawtooth', 0.12, -40); tone(140, 0.5, 'square', 0.05, -60, 0.05); }
function nextBossMode(b) {
  const r = Math.random();
  if (r < 0.4) { b.mode = 'walk'; b.timer = 80 + Math.random() * 70; }
  else if (r < 0.7) {
    b.mode = 'leap'; b.timer = 200; b.vy = -15;
    b.vx = Math.sign(player.x - b.x) * (3 + b.lvl);
  } else { b.mode = 'throw'; b.timer = 50; b.vx = 0; }
}
function updateBoss() {
  const b = boss;
  if (!b || !b.alive) return;
  if (!b.active) {
    if (player.x > (level.arenaX + 2) * T) {
      b.active = true; roar(); shake = 30;
      popups.push({ text: 'BOSS 出現!', x: player.x - 20, y: player.y - 30, life: 90 });
    } else return;
  }
  b.t++;
  if (b.dead) {
    b.dead--; b.vy += 0.4; b.y += b.vy;
    if (b.dead <= 0) b.alive = false;
    return;
  }
  if (b.inv > 0) b.inv--;
  const toP = Math.sign(player.x + player.w / 2 - (b.x + b.w / 2)) || 1;
  const spd = 1.2 + b.lvl * 0.35 + (b.maxHp - b.hp) * 0.25;
  b.timer--;
  if (b.mode === 'idle') { b.vx *= 0.8; if (b.timer <= 0) nextBossMode(b); }
  else if (b.mode === 'walk') { b.dir = toP; b.vx = toP * spd; if (b.timer <= 0) nextBossMode(b); }
  else if (b.mode === 'throw') {
    b.dir = toP;
    if (b.timer === 20) {
      const n = 1 + b.lvl;
      for (let i = 0; i < n; i++) {
        const dx = player.x - (b.x + b.w / 2);
        bossShots.push({ x: b.x + b.w / 2, y: b.y + 20, w: 18, h: 18, vx: dx / 55 + (i - (n - 1) / 2) * 1.5, vy: -10 - i, spin: 0 });
      }
      tone(200, 0.2, 'sawtooth', 0.08, 200);
    }
    if (b.timer <= 0) { b.mode = 'idle'; b.timer = 40; }
  }
  b.vy = Math.min(b.vy + 0.8, 16);
  b.x += b.vx; b.y += b.vy;
  const floor = GY * T - b.h;
  const wasAir = !b.onGround;
  b.onGround = false;
  if (b.y >= floor) { b.y = floor; b.vy = 0; b.onGround = true; }
  const minX = level.arenaX * T, maxX = (level.arenaX + ARENA_W - 1) * T - b.w;
  if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx); }
  if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }
  if (b.mode === 'leap' && b.onGround && wasAir) {
    shake = 18; sfx('break'); b.vx = 0; b.mode = 'idle'; b.timer = 45;
    for (let i = 0; i < 12; i++) parts.push({ kind: 'spark', x: b.x + b.w / 2 + (i - 6) * 8, y: GY * T - 4, vx: (i - 6) * 0.6, vy: -3 - Math.random() * 3, life: 25, color: '#8a7f70' });
    // 着地の衝撃で地上のプレイヤーは少しよろける
    if (player.onGround && player.inv === 0) player.vy = -5;
  }
  // 火の玉
  for (const f of fireballs) if (f.life > 0 && overlap(f, b)) {
    f.life = 0;
    if (b.inv === 0) { damageBoss(1 / 3); b.inv = 12; }
  }
  if (!b.dead && attacking(player) && b.inv === 0 && overlap(attackBox(player), b)) {
    damageBoss(0.5); b.inv = 25; sfx('smash'); shake = Math.max(shake, 8);
    player.vx = -player.dir * 5;
  }
  if (b.dead) return;
  // プレイヤーとの接触
  if (!player.dead && !b.dead && overlap(player, b)) {
    const stomp = player.vy > 0 && player.y + player.h - player.vy <= b.y + 26;
    if (stomp) {
      player.vy = -14; player.jumps = 1;
      if (b.inv === 0) { damageBoss(1); b.inv = 60; sfx('stomp'); }
    } else if (b.inv === 0 || b.inv > 20) hurtPlayer();
  }
  for (const s of bossShots) {
    s.vy += 0.45; s.x += s.vx; s.y += s.vy; s.spin += 0.3;
    if (!player.dead && overlap(player, s)) { s.gone = true; hurtPlayer(); }
    if (s.y > H) s.gone = true;
  }
  bossShots = bossShots.filter(s => !s.gone);
}
function damageBoss(v) {
  const b = boss;
  b.hp = Math.max(0, b.hp - v);
  addScore(v >= 1 ? 500 : 100, b.x + b.w / 2, b.y);
  if (b.hp <= 0.01) {
    b.dead = 150; b.vy = -8; b.vx = 0; shake = 40; roar();
    addScore(5000, b.x + b.w / 2, b.y - 30);
    bossShots = [];
    for (let yy = 0; yy < GY; yy++) level.g[yy][level.arenaX + ARENA_W - 1] = '.';
    for (let i = 0; i < 12; i++) parts.push({ kind: 'coin', x: b.x + b.w / 2, y: b.y, vy: -8 - Math.random() * 6, life: 40 });
    coins += 10; checkCoins();
    popups.push({ text: 'BOSS 撃破!!', x: b.x, y: b.y - 40, life: 120 });
  } else if (v >= 1) { roar(); b.mode = 'idle'; b.timer = 30; }
}

function updateItems() {
  for (const it of items) {
    if (it.rise > 0) { it.y -= 1; it.rise--; if (it.rise === 0 && it.kind === 'mush') it.vx = 2; continue; }
    if (it.kind === 'mush') {
      it.vy = Math.min(it.vy + 0.8, 12); it.hitWall = false;
      moveBody(it); if (it.hitWall) it.vx = -it.vx;
    }
    if (overlap(player, it)) {
      it.gone = true; sfx('power'); addScore(1000, it.x, it.y);
      setPower(player, Math.min(2, player.power + 1));
    }
    if (it.y > H + 50) it.gone = true;
  }
  items = items.filter(i => !i.gone);
  for (const f of fireballs) {
    f.vy = Math.min(f.vy + 0.6, 10); f.hitWall = false;
    const prevVy = f.vy;
    moveBody(f);
    if (f.onGround) f.vy = -6; else if (prevVy < 0 && f.vy === 0) f.vy = 2;
    if (f.hitWall) { f.life = 0; parts.push({ kind: 'spark', x: f.x, y: f.y, vx: 0, vy: -1, life: 12, color: '#ffae00' }); }
    f.life--;
    if (f.x < cam - 20 || f.x > cam + W + 20) f.life = 0;
  }
  fireballs = fireballs.filter(f => f.life > 0);
  for (const p of parts) {
    if (p.kind === 'coin') { p.vy += 0.6; p.y += p.vy; }
    else { p.vy += 0.5; p.x += p.vx; p.y += p.vy; }
    p.life--;
  }
  parts = parts.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 0.8; p.life--; }
  popups = popups.filter(p => p.life > 0);
  for (const k in bumps) if (--bumps[k] <= 0) delete bumps[k];
}

function update() {
  frame++;
  if (state === 'title') {
    if (hit(['Enter', 'Space'])) { state = 'select'; sfx('coin'); }
  } else if (state === 'select') {
    if (hit(['ArrowRight', 'KeyD'])) { selIdx = (selIdx + 1) % 8; sfx('bump'); }
    if (hit(['ArrowLeft', 'KeyA'])) { selIdx = (selIdx + 7) % 8; sfx('bump'); }
    if (hit(['ArrowDown', 'KeyS', 'ArrowUp', 'KeyW'])) { selIdx = (selIdx + 4) % 8; sfx('bump'); }
    if (hit(['Enter', 'Space', 'KeyZ'])) startGame();
  } else if (state === 'intro') {
    if (--stateTimer <= 0) state = 'play';
  } else if (state === 'play') {
    if (hit(['KeyM'])) bgmOn = !bgmOn;
    if (hit(['KeyP', 'Escape'])) state = 'pause';
    else {
      updatePlayer();
      updateEnemies();
      updateBoss();
      updateItems();
      if (bossActive()) cam += (level.arenaX * T - cam) * 0.08;
      else {
        const target = player.x - W * 0.4;
        cam = Math.max(cam, Math.min(target, level.cols * T - W));
      }
      if (shake > 0) shake--;
      timeAcc++;
      if (timeAcc >= 24 && state === 'play') { timeAcc = 0; time--; if (time <= 0) die(); }
    }
  } else if (state === 'pause') {
    if (hit(['KeyP', 'Escape', 'Enter'])) state = 'play';
  } else if (state === 'dying') {
    player.vy += 0.6; player.y += player.vy;
    updateItems();
    if (--stateTimer <= 0) {
      lives--;
      if (lives <= 0) { state = 'gameover'; stateTimer = 0; }
      else loadLevel(false);
    }
  } else if (state === 'clear') {
    stateTimer++;
    const p = player, bottom = (GY - 1) * T;
    if (p.y + p.h < bottom) p.y = Math.min(p.y + 5, bottom - p.h);
    else if (stateTimer > 40) {
      p.dir = 1; p.x += 2.5; p.anim += 0.3; p.vy = Math.min(p.vy + 0.9, 12);
      moveBody(p);
    }
    if (time > 0 && stateTimer > 40 && stateTimer % 2 === 0) { time = Math.max(0, time - 3); score += 30; if (stateTimer % 8 === 0) tone(1400, 0.03, 'square', 0.03); }
    updateItems();
    if (p.x > level.castleX * T + 40 && time === 0 && stateTimer > 200) {
      levelNo++;
      if (levelNo >= THEMES.length) { state = 'ending'; stateTimer = 0; stopBgm(); sfx('1up'); }
      else loadLevel(true);
    }
  } else if (state === 'gameover' || state === 'ending') {
    stateTimer++;
    if (stateTimer > 60 && hit(['Enter', 'Space'])) state = 'select';
  }
  for (const k in pressed) delete pressed[k];
}

// ---------- 描画 ----------
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(s, x, y, size = 20, color = '#fff', align = 'center', stroke = true) {
  ctx.font = `900 ${size}px "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function drawChar(id, cx, bottom, h, dir = 1, rot = 0, sx = 1, sy = 1, alpha = 1) {
  const im = IMG[id];
  if (!im.complete || !im.naturalWidth) return;
  let w = h * im.naturalWidth / im.naturalHeight;
  const maxW = h * 1.05;
  let dh = h;
  if (w > maxW) { dh = h * maxW / w; w = maxW; }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, bottom);
  ctx.rotate(rot);
  ctx.scale(dir * sx, sy);
  ctx.drawImage(im, -w / 2, -dh, w, dh);
  ctx.restore();
}

function drawCity(par) {
  ctx.fillStyle = '#07071a'; ctx.fillRect(0, 0, W, H);
  const c = ART.city;
  if (!c) return;
  // 左右反転コピーを交互に並べて継ぎ目なくループ
  const bw = c.width, span = bw * 2;
  const off = -(((cam * par) % span) + span) % span;
  for (let i = 0, x = off; x < W; i++, x += bw) {
    if (i % 2 === 0) ctx.drawImage(c, x, 0);
    else { ctx.save(); ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore(); }
  }
}
// ポーズ画像を描く。idle の高さを基準に全ポーズ同じ縮尺で、足元を揃える
function drawPose(id, pose, cx, bottom, dh, dir = 1, rot = 0, sx = 1, sy = 1) {
  const set = PIMG[id], P = set && (set[pose] || set.idle);
  if (!P || !P.img.complete || !P.img.naturalWidth) return drawChar(id, cx, bottom, dh, dir, rot, sx, sy);
  const s = dh / set.idle.h, w = P.w * s, h = P.h * s;
  const ox = (P.x + P.w / 2 - P.fw / 2) * s * 0.6;
  ctx.save();
  ctx.translate(cx, bottom); ctx.rotate(rot); ctx.scale(dir * sx, sy);
  ctx.drawImage(P.img, ox - w / 2, -h, w, h);
  ctx.restore();
}
function drawBackground(th) {
  drawCity(0.18);
  ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, H);
  // 地面付近の霧
  const fog = ctx.createLinearGradient(0, 300, 0, H);
  fog.addColorStop(0, 'rgba(10,8,25,0)'); fog.addColorStop(1, 'rgba(10,8,25,0.65)');
  ctx.fillStyle = fog; ctx.fillRect(0, 300, W, H - 300);
  const pit = ctx.createLinearGradient(0, GY * T - 10, 0, H);
  pit.addColorStop(0, 'rgba(0,0,0,0.6)'); pit.addColorStop(1, '#000');
  ctx.fillStyle = pit; ctx.fillRect(0, GY * T - 10, W, H);
  ctx.save();
  if (th.fx === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = (i * 97 + frame * 3 - cam * 0.5) % (W + 40), y = (i * 61 + frame * 14) % (H + 40) - 40;
      const xx = ((x % (W + 40)) + W + 40) % (W + 40) - 20;
      ctx.moveTo(xx, y); ctx.lineTo(xx - 4, y + 16);
    }
    ctx.stroke();
  } else {
    for (let i = 0; i < 40; i++) {
      const x = ((i * 131 - cam * 0.4 + Math.sin(frame * 0.02 + i) * 30) % W + W) % W;
      const y = H - ((i * 53 + frame * (1 + i % 3)) % H);
      ctx.fillStyle = i % 2 ? 'rgba(255,140,40,0.8)' : 'rgba(255,220,90,0.7)';
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.restore();
}

function hazard(x, y, w, h, c1, c2) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  for (let i = -h; i < w; i += 16) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + 8, y + h); ctx.lineTo(x + i + 8 + h, y); ctx.lineTo(x + i + h, y); ctx.fill(); }
  ctx.restore();
}
function drawTile(t, x, y, cx, cy, th) {
  const b = bumps[cx + ',' + cy];
  if (b) y -= Math.sin((10 - b) / 10 * Math.PI) * 10;
  if (t === '#') {
    // ひび割れたアスファルト
    ctx.fillStyle = th.ground; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = th.groundDark; ctx.fillRect(x, y + T - 3, T, 3); ctx.fillRect(x + T - 3, y, 3, T);
    ctx.strokeStyle = th.groundDark; ctx.lineWidth = 2;
    ctx.beginPath(); const k = (cx * 7 + cy * 3) % 5;
    ctx.moveTo(x + 6 + k * 4, y + 12); ctx.lineTo(x + 14 + k * 2, y + 22); ctx.lineTo(x + 10 + k * 3, y + 34); ctx.stroke();
    if (tile(cx, cy - 1) === '.' || tile(cx, cy - 1) === 'o') {
      ctx.fillStyle = th.groundDark; ctx.fillRect(x, y + 4, T, 5);
      ctx.save(); ctx.shadowColor = th.grass; ctx.shadowBlur = 10;
      ctx.fillStyle = th.grass; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(frame * 0.05 + cx * 0.7); ctx.fillRect(x, y, T, 4); ctx.restore();
      if ((cx * 13) % 7 === 0) { ctx.fillStyle = 'rgba(160,20,30,0.7)'; ctx.beginPath(); ctx.ellipse(x + 20, y + 5, 12, 3, 0, 0, 7); ctx.fill(); }
    }
  } else if (t === 'X') {
    // コンクリートのバリケード
    ctx.fillStyle = '#44464f'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#5b5e69'; ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
    hazard(x + 3, y + 3, T - 6, 9, '#f2c200', '#1a1a1a');
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 8, y + 22, 10, 3); ctx.fillRect(x + 22, y + 30, 8, 3);
  } else if (t === 'W') {
    hazard(x, y, T, T, '#e8e8e8', '#c4161c');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  } else if (t === 'B') {
    ctx.fillStyle = th.brick; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(x, y + i * 10 + 10); ctx.lineTo(x + T, y + i * 10 + 10); const o = i % 2 ? 10 : 30; ctx.moveTo(x + o, y + i * 10); ctx.lineTo(x + o, y + i * 10 + 10); }
    ctx.stroke(); ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    ctx.fillStyle = 'rgba(40,60,30,0.5)'; ctx.fillRect(x + 4, y + 26, 8, 12);
  } else if (t === '?' || t === 'M') {
    const glow = 0.75 + 0.25 * Math.sin(frame * 0.1);
    ctx.save(); ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14 * glow;
    ctx.fillStyle = '#6a3f00'; ctx.fillRect(x, y, T, T);
    ctx.restore();
    ctx.fillStyle = `rgb(${255 * glow | 0},${185 * glow | 0},20)`; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    ctx.fillStyle = '#6a3f00'; [[5, 5], [31, 5], [5, 31], [31, 31]].forEach(([a, c]) => ctx.fillRect(x + a, y + c, 4, 4));
    text('?', x + T / 2, y + T / 2 + 1, 26, '#fff', 'center', true);
  } else if (t === 'U') {
    ctx.fillStyle = '#3d3029'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#5e4a3c'; ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
  } else if (t === 'o') {
    const s = Math.abs(Math.cos(frame * 0.08 + cx));
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.ellipse(x + 20, y + 20, 11 * s + 2, 14, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b07a00'; ctx.lineWidth = 2; ctx.stroke();
  }
}
function drawPipe(pp) {
  // 錆びた排水管
  const x = pp.x * T - cam, y = pp.y * T, h = pp.h * T;
  const g = ctx.createLinearGradient(x, 0, x + 2 * T, 0);
  g.addColorStop(0, '#26322c'); g.addColorStop(0.35, '#6f8076'); g.addColorStop(1, '#1b2420');
  ctx.fillStyle = g; ctx.fillRect(x + 4, y + 18, 2 * T - 8, h - 18);
  ctx.fillRect(x, y, 2 * T, 20);
  ctx.fillStyle = 'rgba(150,70,30,0.55)';
  ctx.fillRect(x + 12, y + 30, 14, 10); ctx.fillRect(x + 48, y + 55, 10, 18); ctx.fillRect(x + 6, y + 6, 20, 6);
  ctx.fillStyle = 'rgba(90,255,120,0.35)'; ctx.fillRect(x + 6, y + 2, 2 * T - 12, 4);
  ctx.strokeStyle = '#0d1411'; ctx.lineWidth = 3; ctx.strokeRect(x + 4, y + 18, 2 * T - 8, h - 18); ctx.strokeRect(x, y, 2 * T, 20);
}
function drawEnemy(e) {
  const art = e.type === 'spiky' ? ART.zombieRage : e.type === 'jumper' ? ART.zombieJump : ART.zombie;
  if (!art) return;
  const dh = 48, dw = dh * art.width / art.height;
  ctx.save();
  ctx.translate(e.x - cam + e.w / 2, e.y + e.h + 2);
  if (e.dead && !e.flip) ctx.scale(1.2, 0.3);
  else if (e.dead && e.flip) { ctx.translate(0, -e.h / 2); ctx.rotate(Math.PI); ctx.translate(0, e.h / 2); }
  else {
    const squash = e.type === 'jumper' && !e.onGround ? 1.12 : 1 + Math.sin(e.t * 3) * 0.04;
    ctx.rotate(Math.sin(e.t * 2) * 0.1);
    ctx.scale((e.vx > 0 ? -1 : 1) / squash, squash);
  }
  if (e.type === 'spiky') { ctx.shadowColor = '#ff1a1a'; ctx.shadowBlur = 14; }
  ctx.drawImage(art, -dw / 2, -dh, dw, dh);
  ctx.restore();
}
function drawBoss() {
  const b = boss;
  if (!b || !b.alive || !ART.boss) return;
  if (!b.active && (b.x - cam > W + 100)) return;
  const art = b.inv > 0 && Math.floor(b.inv / 3) % 2 === 0 ? ART.bossHit : ART.boss;
  const dh = 175, dw = dh * art.width / art.height;
  ctx.save();
  ctx.translate(b.x - cam + b.w / 2, b.y + b.h + 4);
  if (b.dead) { ctx.rotate(Math.min(Math.PI / 2, (150 - b.dead) * 0.03) * -b.dir); ctx.globalAlpha = Math.min(1, b.dead / 60); }
  else {
    const step = b.mode === 'walk' ? Math.sin(b.t * 0.25) * 0.05 : 0;
    const breathe = 1 + Math.sin(b.t * 0.08) * 0.02;
    ctx.rotate(step);
    ctx.scale(b.dir, breathe);
    if (!b.active) ctx.globalAlpha = 0.9;
  }
  ctx.shadowColor = 'rgba(255,0,40,0.8)'; ctx.shadowBlur = b.active && !b.dead ? 20 : 0;
  ctx.drawImage(art, -dw / 2, -dh, dw, dh);
  ctx.restore();
  for (const s of bossShots) {
    ctx.save(); ctx.translate(s.x - cam + 9, s.y + 9); ctx.rotate(s.spin);
    ctx.fillStyle = '#8b1a1a'; ctx.fillRect(-9, -7, 18, 14);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-12, -2, 24, 4);
    ctx.restore();
  }
}
function drawPlayer() {
  const p = player, ch = CHARS[selIdx];
  if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0) return;
  const cx = p.x + p.w / 2 - cam;
  const dh = p.power > 0 ? 104 : 80;
  let pose = 'idle', rot = 0, sx = 1, sy = 1, bob = 0;
  if (p.dead || p.hurtT > 0) { pose = 'hit'; if (p.dead) rot = -p.dir * Math.min(0.5, frame % 1000 * 0.004); }
  else if (p.atk > 0) { pose = p.atkAir ? 'kick' : 'punch'; if (!p.atkAir) sx = 1 + (p.atk > 8 ? 0.06 : 0); }
  else if (p.crouch || p.landT > 0) { pose = 'crouch'; if (p.landT > 0) { sy = 0.94; sx = 1.05; } }
  else if (!p.onGround && state !== 'clear') { pose = 'kick'; rot = p.dir * (p.vy < 0 ? -0.1 : 0.05); }
  else if (Math.abs(p.vx) > 0.3) { bob = Math.abs(Math.sin(p.anim)) * 4; rot = p.dir * (0.07 + Math.sin(p.anim * 2) * 0.03); sy = 1 - Math.abs(Math.sin(p.anim)) * 0.03; }
  else { sy = 1 + Math.sin(frame * 0.08) * 0.015; }
  // 影
  if (p.onGround) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, p.y + p.h, 18, 5, 0, 0, 7); ctx.fill(); }
  // パワーアップ中のオーラ
  if (p.power === 2) {
    ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(frame * 0.2);
    const g = ctx.createRadialGradient(cx, p.y + p.h / 2, 5, cx, p.y + p.h / 2, 60);
    g.addColorStop(0, '#ffb300'); g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 60, p.y - 20, 120, p.h + 40); ctx.restore();
  }
  drawPose(ch.id, pose, cx, p.y + p.h + 2 - bob, dh, p.dir, rot, sx, sy);
  // 攻撃エフェクト
  if (attacking(p)) {
    const b = attackBox(p), ex = b.x + b.w / 2 - cam, ey = b.y + b.h / 2;
    const t = (13 - p.atk) / 9;
    ctx.save(); ctx.globalAlpha = 0.85 * (1 - t);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * (1 - t) + 2; ctx.shadowColor = ch.color; ctx.shadowBlur = 16;
    ctx.beginPath();
    if (p.dir > 0) ctx.arc(ex - 18, ey, 26 + t * 12, -1.1, 1.1); else ctx.arc(ex + 18, ey, 26 + t * 12, Math.PI - 1.1, Math.PI + 1.1);
    ctx.stroke(); ctx.restore();
  }
}
function drawFlag() {
  const fx = level.flagX * T + 20 - cam;
  if (fx < -100 || fx > W + 300) return;
  ctx.fillStyle = '#ddd'; ctx.fillRect(fx - 3, 3 * T, 6, (GY - 4) * T);
  ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(fx, 3 * T - 6, 9, 0, 7); ctx.fill();
  let fy = 3 * T + 6;
  if (state === 'clear') fy = Math.min(player.y, (GY - 2) * T);
  ctx.fillStyle = CHARS[selIdx].color; ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.lineTo(fx - 56, fy + 18); ctx.lineTo(fx - 3, fy + 36); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', fx - 20, fy + 19);
  // 避難シェルター
  const cx = level.castleX * T - cam, by = GY * T;
  ctx.fillStyle = '#23242e'; ctx.fillRect(cx, by - 200, 200, 200);
  ctx.fillStyle = '#2e303c'; ctx.fillRect(cx + 10, by - 190, 180, 100);
  for (let i = 0; i < 4; i++) {
    const on = Math.sin(frame * 0.07 + i * 2) > -0.6;
    ctx.fillStyle = on ? '#ffd27a' : '#3a3322'; ctx.fillRect(cx + 22 + i * 44, by - 175, 26, 30);
  }
  hazard(cx, by - 212, 200, 12, '#f2c200', '#1a1a1a');
  ctx.fillStyle = '#111'; ctx.fillRect(cx + 65, by - 85, 70, 85);
  ctx.fillStyle = '#555a66'; for (let yy = by - 80; yy < by; yy += 8) ctx.fillRect(cx + 68, yy, 64, 4);
  ctx.save(); ctx.shadowColor = '#3dff7a'; ctx.shadowBlur = 16;
  text('SAFE ZONE', cx + 100, by - 108, 22, '#3dff7a', 'center', false);
  ctx.restore();
}
function drawHUD() {
  const ch = CHARS[selIdx];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 46);
  drawChar(ch.id, 30, 44, 42);
  text('×' + lives, 70, 24, 20, '#fff', 'left');
  text('SCORE ' + String(score).padStart(7, '0'), 140, 24, 20, '#fff', 'left');
  text('● ×' + String(coins).padStart(2, '0'), 400, 24, 20, '#ffd400', 'left');
  text('WORLD 1-' + (levelNo + 1), 560, 24, 20, '#fff', 'left');
  text('TIME ' + time, 760, 24, 20, time < 60 ? '#ff5555' : '#fff', 'left');
  if (boss && boss.active && boss.alive) {
    const bw = 420, bx = (W - bw) / 2, by = 64;
    text('BOSS  ZOMBIE KING', W / 2, by, 18, '#ff4d5e');
    ctx.fillStyle = '#000a'; ctx.fillRect(bx - 3, by + 13, bw + 6, 18);
    ctx.fillStyle = '#4a0d14'; ctx.fillRect(bx, by + 16, bw, 12);
    ctx.fillStyle = '#ff2d45'; ctx.fillRect(bx, by + 16, bw * boss.hp / boss.maxHp, 12);
  }
}
function drawWorld() {
  const th = level.theme;
  drawBackground(th);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 0.8, (Math.random() - 0.5) * shake * 0.8);
  const c0 = Math.floor(cam / T), c1 = Math.min(level.cols - 1, c0 + Math.ceil(W / T) + 1);
  for (const pp of level.pipes) if (pp.x * T - cam > -2 * T && pp.x * T - cam < W) drawPipe(pp);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = c0; cx <= c1; cx++) {
    const t = level.g[cy][cx];
    if (t !== '.' && t !== 'P') drawTile(t, cx * T - cam, cy * T, cx, cy, th);
  }
  // チェックポイント旗
  const cpx = level.checkpoint * T + 20 - cam;
  if (cpx > -40 && cpx < W + 40) {
    ctx.fillStyle = '#eee'; ctx.fillRect(cpx - 2, GY * T - 80, 4, 80);
    ctx.fillStyle = reachedCp ? CHARS[selIdx].color : '#999';
    ctx.beginPath(); ctx.moveTo(cpx + 2, GY * T - 80); ctx.lineTo(cpx + 32, GY * T - 68); ctx.lineTo(cpx + 2, GY * T - 56); ctx.fill();
  }
  drawFlag();
  for (const it of items) {
    const x = it.x - cam, y = it.y;
    if (it.kind === 'mush') {
      ctx.fillStyle = '#f4e0c0'; ctx.fillRect(x + 8, y + 16, 16, 16);
      ctx.fillStyle = '#e8322a'; ctx.beginPath(); ctx.arc(x + 16, y + 18, 16, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 9, y + 10, 4, 0, 7); ctx.arc(x + 22, y + 9, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(x + 11, y + 21, 3, 6); ctx.fillRect(x + 18, y + 21, 3, 6);
    } else {
      ctx.fillStyle = '#2aa84a'; ctx.fillRect(x + 14, y + 16, 4, 16);
      const c = ['#ff5a1f', '#ffd400', '#ff5a1f'][Math.floor(frame / 6) % 3];
      ctx.fillStyle = c; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 16 + Math.cos(i) * 8, y + 12 + Math.sin(i) * 8, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(x + 16, y + 12, 6, 0, 7); ctx.fill();
    }
  }
  for (const e of enemies) if (e.alive && e.active) drawEnemy(e);
  drawBoss();
  for (const f of fireballs) {
    ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.arc(f.x - cam + 7, f.y + 7, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(f.x - cam + 7, f.y + 7, 4, 0, 7); ctx.fill();
  }
  drawPlayer();
  for (const p of parts) {
    if (p.kind === 'coin') { ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.ellipse(p.x - cam, p.y, 8, 12, 0, 0, 7); ctx.fill(); }
    else if (p.kind === 'brick') { ctx.fillStyle = level.theme.brick; ctx.fillRect(p.x - cam - 6, p.y - 6, 12, 12); }
    else { ctx.globalAlpha = p.life / 20; ctx.fillStyle = p.color; ctx.fillRect(p.x - cam - 3, p.y - 3, 6, 6); ctx.globalAlpha = 1; }
  }
  for (const p of popups) text(p.text, p.x - cam + 12, p.y, 16, '#fff');
  ctx.restore();
  drawHUD();
}

function drawTitle() {
  const saveCam = cam; cam = frame * 0.8;
  drawCity(0.5); cam = saveCam;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,5,30,0.55)'); g.addColorStop(1, 'rgba(60,0,20,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  CHARS.forEach((c, i) => {
    const x = 70 + i * 117, bob = Math.sin(frame * 0.05 + i) * 6;
    drawChar(c.id, x, 560 + bob, 230, 1);
  });
  ctx.save(); ctx.translate(W / 2, 140); ctx.rotate(-0.03);
  text('SUPER HERO RUN', 0, 0, 84, '#ffd400');
  ctx.restore();
  text('〜 ゾンビだらけの街を駆け抜けろ！ 〜', W / 2, 225, 24, '#fff');
  if (Math.floor(frame / 30) % 2 === 0) text('PRESS ENTER / タップでスタート', W / 2, 290, 26, '#fff');
}
const CARD = { w: 205, h: 228, gap: 17, x0: 0, y0: [92, 336] };
CARD.x0 = (W - (CARD.w * 4 + CARD.gap * 3)) / 2;
function cardRect(i) { return { x: CARD.x0 + (i % 4) * (CARD.w + CARD.gap), y: CARD.y0[Math.floor(i / 4)], w: CARD.w, h: CARD.h }; }
function cardAt(p) { for (let i = 0; i < 8; i++) { const r = cardRect(i); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i; } return -1; }
function drawSelect() {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#14213d'); g.addColorStop(1, '#3a0f5c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  text('キャラクターをえらんでね', W / 2, 46, 34, '#ffd400');
  CHARS.forEach((c, i) => {
    const r = cardRect(i), sel = i === selIdx;
    const lift = sel ? -6 : 0;
    ctx.save();
    if (sel) { ctx.shadowColor = c.color; ctx.shadowBlur = 25; }
    rrect(r.x, r.y + lift, r.w, r.h, 16);
    const cg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    cg.addColorStop(0, sel ? c.color : '#2a2f55'); cg.addColorStop(1, '#10132a');
    ctx.fillStyle = cg; ctx.fill();
    ctx.restore();
    ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#fff' : c.color;
    rrect(r.x, r.y + lift, r.w, r.h, 16); ctx.stroke();
    ctx.save(); rrect(r.x, r.y + lift, r.w, r.h, 16); ctx.clip();
    drawChar(c.id, r.x + r.w / 2, r.y + lift + 150, sel ? 150 + Math.sin(frame * 0.1) * 3 : 140, 1);
    ctx.restore();
    text(c.id, r.x + r.w / 2, r.y + lift + 166, 22, '#fff');
    text(c.desc, r.x + r.w / 2, r.y + lift + 189, 14, c.color);
    const bar = (label, v, yy) => {
      text(label, r.x + 16, r.y + lift + yy, 11, '#ccc', 'left', false);
      ctx.fillStyle = '#0006'; ctx.fillRect(r.x + 60, r.y + lift + yy - 4, 125, 8);
      ctx.fillStyle = c.color; ctx.fillRect(r.x + 60, r.y + lift + yy - 4, 125 * Math.min(1, (v - 0.85) / 0.35), 8);
    };
    bar('SPEED', c.spd, 207); bar('JUMP', c.jmp * (c.ability === 'high' ? 1.08 : 1), 219);
  });
  text('←→↑↓ でえらぶ ／ ENTER・タップで決定', W / 2, 584, 18, '#fff');
}
function drawHelpLine() {
  text('←→移動  ↓しゃがみ  SPACE/Z ジャンプ  C パンチ/空中キック  X ダッシュ(ファイア時は火の玉)  P ポーズ', W / 2, H - 16, 14, '#fff');
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (state === 'title') return drawTitle();
  if (state === 'select') return drawSelect();
  drawWorld();
  if (state === 'intro') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    text('WORLD 1-' + (levelNo + 1), W / 2, 200, 48, '#fff');
    text(level.theme.name, W / 2, 255, 28, '#ffd400');
    drawChar(CHARS[selIdx].id, W / 2 - 40, 430, 130);
    text('× ' + lives, W / 2 + 60, 380, 36, '#fff');
    text('赤いゾンビは踏めない！ Cキーのパンチ・キックで倒せ！ 最後にボスが待ち構えているぞ', W / 2, 500, 18, '#ff6b6b');
    drawHelpLine();
  }
  if (state === 'pause') { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); text('PAUSE', W / 2, H / 2, 60); drawHelpLine(); }
  if (state === 'clear' && stateTimer > 20) text('COURSE CLEAR!', W / 2, 180, 56, '#ffd400');
  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
    text('GAME OVER', W / 2, 220, 70, '#ff4455');
    text('SCORE ' + score, W / 2, 300, 30);
    if (stateTimer > 60) text('ENTERでキャラ選択へ', W / 2, 380, 24);
  }
  if (state === 'ending') {
    const ch = CHARS[selIdx];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12103a'); g.addColorStop(1, ch.color);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = ['#ffd400', '#fff', ch.color][i % 3]; ctx.fillRect((i * 97 + frame * (1 + i % 3)) % W, (i * 57 + frame * 2) % H, 6, 10); }
    drawChar(ch.id, W / 2, 560, 380 + Math.sin(frame * 0.05) * 6);
    text('CONGRATULATIONS!', W / 2, 90, 56, '#ffd400');
    text(ch.id + ' が全ステージをクリア！', W / 2, 150, 28);
    text('FINAL SCORE ' + score, W / 2, 195, 30);
    if (stateTimer > 60) text('ENTERでもう一度あそぶ', W / 2, 580, 20);
  }
}

// ---------- メインループ ----------
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
