/* ═══════════════════════════════════════════════════════════
   ZAP DASH — game.js
   Hyper-casual dodge/gate game for mobile & desktop
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ─── Canvas Setup ───────────────────────────────────────── */
const canvas  = document.getElementById("gameCanvas");
const ctx     = canvas.getContext("2d");

let W, H;
function resize() {
  W = canvas.width  = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}
resize();
window.addEventListener("resize", () => { resize(); });

/* ─── DOM Refs ───────────────────────────────────────────── */
const scoreDisplay  = document.getElementById("score-display");
const bestDisplay   = document.getElementById("best-display");
const finalScore    = document.getElementById("final-score");
const finalBest     = document.getElementById("final-best");
const newBestBadge  = document.getElementById("new-best-badge");
const startScreen   = document.getElementById("start-screen");
const gameoverScreen= document.getElementById("gameover-screen");
const startBtn      = document.getElementById("start-btn");
const restartBtn    = document.getElementById("restart-btn");
const homeBtn       = document.getElementById("home-btn");

/* ─── High Score ─────────────────────────────────────────── */
let bestScore = parseInt(localStorage.getItem("zapDashBest") || "0");
bestDisplay.textContent = bestScore;

/* ─── Audio (Web Audio) ──────────────────────────────────── */
let audioCtx;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.18, ramp = true) {
  try {
    const ac  = getAudio();
    const osc = ac.createOscillator();
    const gn  = ac.createGain();
    osc.connect(gn); gn.connect(ac.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (ramp) osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ac.currentTime + duration);
    gn.gain.setValueAtTime(vol, ac.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch(e){}
}
const sfx = {
  score:  () => { playTone(520, "sine",   .12, .15); playTone(780, "sine", .08, .12); },
  die:    () => { playTone(220, "sawtooth", .4, .2, false); },
  jump:   () => { playTone(400, "sine",   .08, .1);  },
  start:  () => { playTone(440, "sine",   .08, .12); playTone(660,"sine",.12,.12); },
};

/* ─── Game State ─────────────────────────────────────────── */
const STATE = { IDLE: 0, RUNNING: 1, DEAD: 2 };
let state     = STATE.IDLE;
let score     = 0;
let frame     = 0;
let speed     = 4.5;
let gateTimer = 0;
let gateInterval = 90;   // frames between gate spawns
let particles = [];
let gates     = [];
let stars     = [];
let trails    = [];
let flashAlpha = 0;
let flashColor = "#fff";
let shakeX = 0, shakeY = 0, shakeTtl = 0;

/* ─── Player ─────────────────────────────────────────────── */
const player = {
  x: 0, y: 0, vy: 0,
  r: 22,
  lane: 1,        // 0=left, 1=center, 2=right
  targetX: 0,
  color: "#a78bfa",
  glowColor: "rgba(167,139,250,0.6)",
  jumping: false,
  jumpFrames: 0,
  invincible: 0,
  init() {
    this.lane    = 1;
    this.y       = H * 0.72;
    this.vy      = 0;
    this.jumping = false;
    this.invincible = 0;
    this.updateTarget();
    this.x = this.targetX;
  },
  laneX(l) { return W * (0.22 + l * 0.28); },
  updateTarget() { this.targetX = this.laneX(this.lane); },
  switchLeft()  { if(this.lane > 0) { this.lane--; this.updateTarget(); sfx.jump(); } },
  switchRight() { if(this.lane < 2) { this.lane++; this.updateTarget(); sfx.jump(); } },
  update() {
    // Slide toward target lane
    this.x += (this.targetX - this.x) * 0.18;
    // Jump arc
    if(this.jumping) {
      this.vy += 1.1;
      this.y  += this.vy;
      if(this.y >= H * 0.72) {
        this.y = H * 0.72;
        this.vy = 0;
        this.jumping = false;
      }
    }
    if(this.invincible > 0) this.invincible--;
  },
  jump() {
    if(!this.jumping) {
      this.vy     = -18;
      this.jumping = true;
      sfx.jump();
    }
  },
  draw() {
    const t = frame * 0.06;
    const bY = this.jumping ? 0 : Math.sin(t) * 3;
    const x  = this.x, y = this.y + bY;
    const blinking = this.invincible > 0 && Math.floor(this.invincible/4) % 2 === 0;
    if(blinking) return;
    // Glow
    const grd = ctx.createRadialGradient(x, y, this.r * 0.2, x, y, this.r * 2.2);
    grd.addColorStop(0, "rgba(167,139,250,0.35)");
    grd.addColorStop(1, "rgba(167,139,250,0)");
    ctx.beginPath();
    ctx.arc(x, y, this.r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    // Body
    ctx.beginPath();
    ctx.arc(x, y, this.r, 0, Math.PI * 2);
    const bodyGrd = ctx.createRadialGradient(x - this.r*.3, y - this.r*.3, 2, x, y, this.r);
    bodyGrd.addColorStop(0, "#c4b5fd");
    bodyGrd.addColorStop(1, "#7c3aed");
    ctx.fillStyle = bodyGrd;
    ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 20;
    ctx.fill(); ctx.shadowBlur = 0;
    // Eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x - 7, y - 5, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y - 5, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#1a1a3e";
    ctx.beginPath(); ctx.arc(x - 6, y - 5, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 8, y - 5, 2.5, 0, Math.PI*2); ctx.fill();
    // Trail record
    if(frame % 2 === 0) {
      trails.push({ x, y, r: this.r, alpha: 0.35, life: 8 });
    }
  }
};

/* ─── Gate ───────────────────────────────────────────────── */
const GATE_H = 80;
const GATE_W = W * 0.26;

class Gate {
  constructor() {
    this.y    = -GATE_H - 20;
    this.lane = Math.floor(Math.random() * 3);
    this.safe = Math.random() > 0.38; // safe = green = pass through
    this.passed = false;
    this.w    = 0; // computed on draw
    this.pulse = Math.random() * Math.PI * 2;
  }
  update() {
    this.y += speed;
    this.pulse += 0.06;
  }
  laneX() { return player.laneX(this.lane); }
  draw() {
    const cx = this.laneX();
    const gw  = W * 0.22;
    const gh  = GATE_H;
    const x   = cx - gw / 2;
    const y   = this.y;
    this.w    = gw;
    const col  = this.safe ? "#22d3a5" : "#f43f5e";
    const dark = this.safe ? "#065f46" : "#7f1d1d";
    const glow = this.safe ? "rgba(34,211,165,0.45)" : "rgba(244,63,94,0.45)";
    const pulse = 0.7 + Math.sin(this.pulse) * 0.3;
    // Outer glow
    ctx.shadowColor = col; ctx.shadowBlur = 18 * pulse;
    // Gate frame
    ctx.strokeStyle = col;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    roundRect(ctx, x, y, gw, gh, 14);
    ctx.stroke();
    // Fill
    const grd = ctx.createLinearGradient(x, y, x, y + gh);
    grd.addColorStop(0, dark + "cc");
    grd.addColorStop(1, dark + "66");
    ctx.fillStyle = grd;
    ctx.beginPath(); roundRect(ctx, x, y, gw, gh, 14); ctx.fill();
    ctx.shadowBlur = 0;
    // Icon
    ctx.font = "bold 28px 'Segoe UI'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(this.safe ? "✅" : "❌", cx, y + gh / 2);
  }
}

/* ─── Stars (background) ─────────────────────────────────── */
function initStars() {
  stars = [];
  for(let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.3,
      alpha: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 0.5 + 0.1,
    });
  }
}
initStars();
function updateStars() {
  for(const s of stars) {
    s.y += s.speed;
    if(s.y > H) { s.y = 0; s.x = Math.random() * W; }
  }
}
function drawStars() {
  for(const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,190,255,${s.alpha})`;
    ctx.fill();
  }
}

/* ─── Particles ──────────────────────────────────────────── */
function spawnParticles(x, y, color, count = 18) {
  for(let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const spd   = Math.random() * 5 + 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r:  Math.random() * 6 + 3,
      color,
      alpha: 1,
      life: Math.random() * 20 + 20,
      maxLife: 0,
    });
    particles[particles.length-1].maxLife = particles[particles.length-1].life;
  }
}
function updateParticles() {
  for(let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.25;
    p.vx *= 0.95;
    p.life--;
    p.alpha = p.life / p.maxLife;
    if(p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for(const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ─── Trails ──────────────────────────────────────────────── */
function updateTrails() {
  for(let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i];
    t.life--; t.alpha = Math.max(0, t.life / 8 * 0.35);
    if(t.life <= 0) trails.splice(i, 1);
  }
}
function drawTrails() {
  for(const t of trails) {
    ctx.globalAlpha = t.alpha;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ─── Utility ────────────────────────────────────────────── */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function popHud() {
  scoreDisplay.textContent = score;
  scoreDisplay.classList.remove("pop");
  void scoreDisplay.offsetWidth;
  scoreDisplay.classList.add("pop");
  setTimeout(() => scoreDisplay.classList.remove("pop"), 200);
}

function triggerShake(intensity = 8) {
  shakeTtl = 14;
  shakeX = intensity; shakeY = intensity;
}

/* ─── Lane Guides ─────────────────────────────────────────── */
function drawLaneGuides() {
  for(let l = 0; l < 3; l++) {
    const cx = player.laneX(l);
    ctx.beginPath();
    ctx.setLineDash([12, 18]);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ─── Ground ─────────────────────────────────────────────── */
function drawGround() {
  const y = H * 0.80;
  const grd = ctx.createLinearGradient(0, y - 2, 0, y + 14);
  grd.addColorStop(0, "rgba(167,139,250,0.5)");
  grd.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, y - 2, W, 16);
}

/* ─── Score Ring ─────────────────────────────────────────── */
function drawScorePulse() {
  if(flashAlpha <= 0) return;
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  flashAlpha -= 0.08;
}

/* ─── Difficulty ─────────────────────────────────────────── */
function updateDifficulty() {
  speed        = 4.5 + score * 0.08;
  gateInterval = Math.max(45, 90 - score * 0.6);
}

/* ─── Collision ──────────────────────────────────────────── */
function checkCollisions() {
  for(const g of gates) {
    if(g.passed) continue;
    // Within vertical range of player
    const pY = player.y;
    const gBot = g.y + GATE_H;
    const gTop = g.y;
    if(pY + player.r > gTop && pY - player.r < gBot) {
      const pLane = player.lane;
      const dist  = Math.abs(player.x - g.laneX());
      const hW    = g.w / 2 + player.r * 0.6;
      if(dist < hW) {
        // Collision!
        g.passed = true;
        if(g.safe) {
          score++;
          updateDifficulty();
          sfx.score();
          spawnParticles(player.x, player.y, "#22d3a5", 22);
          flashAlpha = 0.12; flashColor = "rgba(34,211,165,1)";
          popHud();
        } else {
          // Hit wrong gate → die
          triggerShake(14);
          sfx.die();
          spawnParticles(player.x, player.y, "#f43f5e", 30);
          flashAlpha = 0.3; flashColor = "rgba(244,63,94,1)";
          setTimeout(endGame, 420);
          state = STATE.DEAD;
        }
      }
    }
  }
}

/* ─── Game Lifecycle ─────────────────────────────────────── */
function startGame() {
  score        = 0;
  frame        = 0;
  speed        = 4.5;
  gateInterval = 90;
  gateTimer    = 0;
  gates        = [];
  particles    = [];
  trails       = [];
  flashAlpha   = 0;
  shakeTtl     = 0;
  player.init();
  scoreDisplay.textContent = "0";
  state = STATE.RUNNING;
  sfx.start();
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
}

function endGame() {
  if(state !== STATE.DEAD) return;
  const isNewBest = score > bestScore;
  if(isNewBest) {
    bestScore = score;
    localStorage.setItem("zapDashBest", bestScore);
    bestDisplay.textContent = bestScore;
  }
  finalScore.textContent = score;
  finalBest.textContent  = bestScore;
  newBestBadge.classList.toggle("hidden", !isNewBest);
  gameoverScreen.classList.remove("hidden");
}

/* ─── Input ──────────────────────────────────────────────── */
let lastTapX = null;
let pointerDown = false;

function handleInput(x, y) {
  if(state === STATE.IDLE) { startGame(); return; }
  if(state !== STATE.RUNNING) return;
  if(lastTapX === null) { lastTapX = x; }
  const dx = x - lastTapX;
  lastTapX = x;
  if(Math.abs(dx) < 8) {
    player.jump();
  } else if(dx > 8) {
    player.switchRight();
  } else {
    player.switchLeft();
  }
}

canvas.addEventListener("pointerdown", e => {
  pointerDown = true;
  lastTapX = e.clientX;
});
canvas.addEventListener("pointerup", e => {
  if(!pointerDown) return;
  pointerDown = false;
  handleInput(e.clientX, e.clientY);
});
canvas.addEventListener("pointermove", e => {
  if(!pointerDown) return;
  // Live lane switching via drag
  if(state !== STATE.RUNNING) return;
  const dx = e.clientX - lastTapX;
  if(dx > 30)       { player.switchRight(); lastTapX = e.clientX; }
  else if(dx < -30) { player.switchLeft();  lastTapX = e.clientX; }
});

document.addEventListener("keydown", e => {
  if(state === STATE.RUNNING) {
    if(e.key === "ArrowLeft"  || e.key === "a") player.switchLeft();
    if(e.key === "ArrowRight" || e.key === "d") player.switchRight();
    if(e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); player.jump(); }
  } else if(state === STATE.IDLE) {
    if(e.key === " " || e.key === "Enter") startGame();
  }
});

startBtn.addEventListener("click",   startGame);
restartBtn.addEventListener("click", startGame);
homeBtn.addEventListener("click",    () => {
  gameoverScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  state = STATE.IDLE;
});

/* ─── Background gradient ────────────────────────────────── */
function drawBg() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0,   "#0b0b1a");
  grd.addColorStop(0.6, "#0f0f28");
  grd.addColorStop(1,   "#1a0a2e");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

/* ─── Speed lines ─────────────────────────────────────────── */
const speedLines = [];
for(let i = 0; i < 12; i++) {
  speedLines.push({ x: Math.random() * 400, y: Math.random() * 900, len: Math.random() * 40 + 20, alpha: Math.random() * 0.2 + 0.05 });
}
function drawSpeedLines() {
  if(state !== STATE.RUNNING) return;
  const ratio = (speed - 4.5) / 12;
  if(ratio <= 0) return;
  for(const sl of speedLines) {
    sl.y += speed * 1.4;
    if(sl.y > H) { sl.y = -sl.len; sl.x = Math.random() * W; }
    ctx.globalAlpha = sl.alpha * ratio;
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y); ctx.lineTo(sl.x, sl.y + sl.len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ─── Main Loop ──────────────────────────────────────────── */
function loop() {
  requestAnimationFrame(loop);
  frame++;

  // Camera shake
  let ox = 0, oy = 0;
  if(shakeTtl > 0) {
    ox = (Math.random() - 0.5) * shakeX;
    oy = (Math.random() - 0.5) * shakeY;
    shakeX *= 0.88; shakeY *= 0.88;
    shakeTtl--;
  }
  ctx.save();
  ctx.translate(ox, oy);

  // Draw background
  drawBg();
  drawSpeedLines();
  drawStars();
  drawLaneGuides();
  drawGround();

  if(state === STATE.RUNNING || state === STATE.DEAD) {
    // Spawn gates
    if(state === STATE.RUNNING) {
      gateTimer++;
      if(gateTimer >= gateInterval) {
        gates.push(new Gate());
        gateTimer = 0;
      }
    }

    // Update
    if(state === STATE.RUNNING) {
      updateStars();
      for(const g of gates) g.update();
      player.update();
      checkCollisions();
    }

    // Cull off-screen gates
    gates = gates.filter(g => g.y < H + 100);

    // Draw
    drawTrails();
    for(const g of gates) g.draw();
    player.draw();

    updateParticles();
    drawParticles();
    updateTrails();
    drawScorePulse();
  } else {
    // IDLE – animate stars
    updateStars();
  }

  ctx.restore();
}

/* ─── Boot ───────────────────────────────────────────────── */
player.init();
scoreDisplay.textContent = "0";
bestDisplay.textContent  = bestScore;
loop();
