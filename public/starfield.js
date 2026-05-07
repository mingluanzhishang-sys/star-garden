/* ===========================================================
   星空引擎 v3.1 — 完整重写，含粒子动效
   =========================================================== */

(function () {
  'use strict';

  const TAU  = Math.PI * 2;
  const rand  = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b));

  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    var t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /* ── 全局配置 ── */
  const DEFAULTS = {
    nebulaIntensity     : 1.0,
    bgStarCount         : 380,
    twinkleSpeed        : 1.0,
    glowRadius          : 1.0,
    breathSpeed         : 1.0,
    orbitSpeed          : 1.0,
    trailDecay          : 0.05,
    burstCount          : 80,
    cursorTrail         : false,
    constellationEnabled : true,
    constellationMaxDist : 280,
    starHueRange        : [200, 320],
    nebulaHues          : [260, 290, 220],
  };
  let CFG = { ...DEFAULTS };

  /* ── 视口变换 ── */
  const view = { x: 0, y: 0, scale: 1, targetScale: 1 };

  /* ════════════════════════════════════════════════
     主星
  ════════════════════════════════════════════════ */
  class Star {
    constructor(x, y, opts) {
      opts = opts || {};
      this.x = x; this.y = y;
      this.r            = opts.r       != null ? opts.r       : rand(2.8, 4.4);
      this.hue          = opts.hue     != null ? opts.hue     : rand(CFG.starHueRange[0], CFG.starHueRange[1]);
      this.phase        = Math.random() * TAU;
      this.twinklePhase = Math.random() * TAU;
      this.twinkleFreq  = rand(0.4, 1.4);
      this.spikeRot     = Math.random() * TAU;
      this.id           = opts.id      || Math.random().toString(36).slice(2, 9);
      this.planter      = opts.planter || 'Anonymous';
      this.message      = opts.message || '';
      this.bornAt       = opts.bornAt  || Date.now();
      this.companions   = [];
      this.spawnT       = opts.spawnT  != null ? opts.spawnT : 0;
    }

    update(dt) {
      this.phase        += dt * 0.0012 * CFG.breathSpeed;
      this.twinklePhase += dt * 0.003  * this.twinkleFreq * CFG.twinkleSpeed;
      this.spawnT        = Math.min(1, this.spawnT + dt * 0.002);
      this.spikeRot     += dt * 0.00022;
      return (0.78 + Math.sin(this.phase) * 0.22) *
             (0.85 + Math.sin(this.twinklePhase) * 0.15);
    }

    _spike(ctx, x, y, angle, len, w, hue, alpha) {
      var cos = Math.cos(angle), sin = Math.sin(angle);
      var x1 = x - cos * len * 0.55, y1 = y - sin * len * 0.55;
      var x2 = x + cos * len,        y2 = y + sin * len;
      var lg = ctx.createLinearGradient(x1, y1, x2, y2);
      lg.addColorStop(0,    'hsla(' + hue + ',100%,88%,0)');
      lg.addColorStop(0.32, 'hsla(' + hue + ',100%,95%,' + (alpha * 0.65) + ')');
      lg.addColorStop(0.48, 'hsla(0,0%,100%,' + alpha + ')');
      lg.addColorStop(0.52, 'hsla(0,0%,100%,' + alpha + ')');
      lg.addColorStop(0.68, 'hsla(' + hue + ',100%,95%,' + (alpha * 0.65) + ')');
      lg.addColorStop(1,    'hsla(' + hue + ',100%,88%,0)');
      ctx.save();
      ctx.strokeStyle = lg;
      ctx.lineWidth   = w;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }

    draw(ctx, intensity) {
      var x = this.x, y = this.y, hue = this.hue;
      var ease  = 1 - Math.pow(1 - this.spawnT, 4);
      var baseR = this.r * (0.1 + 0.9 * ease);
      var gR    = baseR * 14 * CFG.glowRadius;
      var tw    = 0.85 + Math.sin(this.twinklePhase) * 0.15;
      var g;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      /* 远距柔光 */
      g = ctx.createRadialGradient(x, y, 0, x, y, gR);
      g.addColorStop(0,    'hsla(' + hue + ',100%,72%,' + (0.19 * intensity) + ')');
      g.addColorStop(0.28, 'hsla(' + hue + ',100%,62%,' + (0.08 * intensity) + ')');
      g.addColorStop(1,    'hsla(' + hue + ',100%,50%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, gR, 0, TAU); ctx.fill();

      /* 中距冕层 */
      g = ctx.createRadialGradient(x, y, 0, x, y, gR * 0.30);
      g.addColorStop(0,   'hsla(' + hue + ',90%,92%,' + (0.80 * intensity) + ')');
      g.addColorStop(0.5, 'hsla(' + hue + ',90%,76%,' + (0.30 * intensity) + ')');
      g.addColorStop(1,   'hsla(' + hue + ',90%,65%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, gR * 0.30, 0, TAU); ctx.fill();

      /* 衍射芒 */
      var spikeLen = baseR * (8.5 + tw * 5.5) * CFG.glowRadius;
      var spikeA   = intensity * ease;
      var spikeW   = 0.85 + baseR * 0.22;
      for (var i = 0; i < 4; i++) {
        this._spike(ctx, x, y, this.spikeRot + i * (Math.PI / 2),
          spikeLen, spikeW, hue, spikeA * 0.90);
      }
      for (var i2 = 0; i2 < 4; i2++) {
        this._spike(ctx, x, y, this.spikeRot + Math.PI / 4 + i2 * (Math.PI / 2),
          spikeLen * 0.40, spikeW * 0.65, hue + 18, spikeA * 0.38);
      }

      /* Airy 环 */
      for (var ai = 1; ai <= 2; ai++) {
        ctx.strokeStyle = 'hsla(' + hue + ',100%,88%,' + (0.065 * intensity * ease / ai) + ')';
        ctx.lineWidth   = 0.65;
        ctx.beginPath(); ctx.arc(x, y, baseR * (2.4 + ai * 2.8), 0, TAU); ctx.stroke();
      }

      /* 彩色核心 */
      g = ctx.createRadialGradient(x, y, 0, x, y, baseR * 2.8);
      g.addColorStop(0,    'hsla(0,0%,100%,' + intensity + ')');
      g.addColorStop(0.22, 'hsla(' + (hue + 18) + ',100%,97%,' + (intensity * 0.95) + ')');
      g.addColorStop(0.58, 'hsla(' + hue + ',100%,82%,' + (intensity * 0.52) + ')');
      g.addColorStop(1,    'hsla(' + hue + ',100%,70%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, baseR * 2.8, 0, TAU); ctx.fill();

      /* 亮核点 */
      g = ctx.createRadialGradient(x, y, 0, x, y, baseR * 1.0);
      g.addColorStop(0, 'hsla(0,0%,100%,' + intensity + ')');
      g.addColorStop(1, 'hsla(' + hue + ',100%,95%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, baseR * 1.0, 0, TAU); ctx.fill();

      ctx.restore();
    }

    dist(px, py) { return Math.hypot(this.x - px, this.y - py); }
  }

  /* ════════════════════════════════════════════════
     伴星
  ════════════════════════════════════════════════ */
  class CompanionStar {
    constructor(host, opts) {
      opts = opts || {};
      this.host  = host;
      this.r     = opts.orbitR != null ? opts.orbitR : rand(45, 80);
      this.theta = opts.theta  != null ? opts.theta  : Math.random() * TAU;
      this.omega = opts.omega  != null ? opts.omega  : (rand(0.0010, 0.0022) * (60 / this.r));
      this.hue     = opts.hue     != null ? opts.hue     : 40;
      this.size    = rand(1.8, 2.8);
      this.message = opts.message || '';
      this.trail   = [];
      this.twinklePhase = Math.random() * TAU;
    }
    update(dt) {
      this.theta += this.omega * dt * CFG.orbitSpeed;
      this.twinklePhase += dt * 0.004 * CFG.twinkleSpeed;
      var x = this.host.x + Math.cos(this.theta) * this.r;
      var y = this.host.y + Math.sin(this.theta) * this.r;
      this.trail.push({ x: x, y: y, alpha: 1 });
      if (this.trail.length > 16) this.trail.shift();
      for (var k = 0; k < this.trail.length; k++) this.trail[k].alpha *= (1 - CFG.trailDecay * 0.5);
      this.x = x; this.y = y;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var twinkle = 0.75 + 0.25 * Math.sin(this.twinklePhase);
      /* 轨迹：极细白色尾迹 */
      for (var i = 1; i < this.trail.length; i++) {
        var a0 = this.trail[i - 1], b0 = this.trail[i];
        var t0 = i / this.trail.length;
        var ta = b0.alpha * t0 * 0.3 * twinkle;
        if (ta < 0.01) continue;
        ctx.globalAlpha = ta;
        ctx.strokeStyle = 'rgba(255,255,255,' + ta + ')';
        ctx.lineWidth   = this.size * 0.5 * t0;
        ctx.lineCap     = 'round';
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      /* 微小光晕 */
      var glowR = this.size * 5;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowR);
      g.addColorStop(0,   'rgba(255,255,255,' + (0.7 * twinkle) + ')');
      g.addColorStop(0.3, 'rgba(255,255,255,' + (0.3 * twinkle) + ')');
      g.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, glowR, 0, TAU); ctx.fill();
      /* 白色核心亮点 */
      ctx.fillStyle = 'rgba(255,255,255,' + twinkle + ')';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.7, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* ════════════════════════════════════════════════
     特效粒子
  ════════════════════════════════════════════════ */
  class Particle {
    constructor(x, y, opts) {
      opts = opts || {};
      this.x  = x; this.y = y;
      this.vx = opts.vx      || 0;
      this.vy = opts.vy      || 0;
      this.life    = opts.life    != null ? opts.life    : 1;
      this.decay   = opts.decay   != null ? opts.decay   : 0.012;
      this.size    = opts.size    != null ? opts.size    : rand(1, 2);
      this.hue     = opts.hue     != null ? opts.hue     : rand(40, 320);
      this.gravity = opts.gravity != null ? opts.gravity : 0;
      this.kind    = opts.kind    || 'dust';
      this.angle   = opts.angle   || 0;
      this.maxR    = opts.maxR    || 0;
      this.lineW   = opts.lineW   != null ? opts.lineW   : 1.4;
    }
    update(dt) {
      this.x  += this.vx * dt * 0.06;
      this.y  += this.vy * dt * 0.06;
      this.vy += this.gravity * dt * 0.06;
      this.vx *= 0.985; this.vy *= 0.985;
      this.life -= this.decay * (dt / 16);
      return this.life > 0;
    }
    draw(ctx) {
      ctx.globalCompositeOperation = 'lighter';
      var a = Math.max(0, this.life);
      if (this.kind === 'ring') {
        var r = this.maxR * (1 - this.life);
        ctx.strokeStyle = 'hsla(' + this.hue + ',100%,85%,' + (a * 0.7) + ')';
        ctx.lineWidth   = this.lineW;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
      } else if (this.kind === 'ray') {
        var len = 22 * a;
        var ex  = this.x + Math.cos(this.angle) * len;
        var ey  = this.y + Math.sin(this.angle) * len;
        var lg  = ctx.createLinearGradient(this.x, this.y, ex, ey);
        lg.addColorStop(0, 'hsla(' + this.hue + ',100%,95%,' + a + ')');
        lg.addColorStop(1, 'hsla(' + this.hue + ',100%,80%,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = this.lineW; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        var g2 = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 5);
        g2.addColorStop(0, 'hsla(' + this.hue + ',100%,92%,' + a + ')');
        g2.addColorStop(1, 'hsla(' + this.hue + ',100%,70%,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 5, 0, TAU); ctx.fill();
      }
    }
  }

  /* ════════════════════════════════════════════════
     星云团
  ════════════════════════════════════════════════ */
  class NebulaBlob {
    constructor(w, h) {
      this.x   = rand(0, w); this.y = rand(0, h);
      this.r   = rand(180, 380);
      this.hue = CFG.nebulaHues[randi(0, CFG.nebulaHues.length)];
      this.vx  = rand(-0.08, 0.08); this.vy = rand(-0.05, 0.05);
      this.phase = Math.random() * TAU;
    }
    update(dt, w, h) {
      this.phase += dt * 0.0004;
      this.x += this.vx * dt * 0.05; this.y += this.vy * dt * 0.05;
      if (this.x < -this.r) this.x = w + this.r;
      if (this.x > w + this.r) this.x = -this.r;
      if (this.y < -this.r) this.y = h + this.r;
      if (this.y > h + this.r) this.y = -this.r;
    }
    draw(ctx) {
      var a = (0.07 + 0.04 * Math.sin(this.phase)) * CFG.nebulaIntensity;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      g.addColorStop(0,   'hsla(' + this.hue + ',80%,55%,' + a + ')');
      g.addColorStop(0.5, 'hsla(' + this.hue + ',70%,45%,' + (a * 0.4) + ')');
      g.addColorStop(1,   'hsla(' + this.hue + ',60%,40%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
    }
  }

  /* ════════════════════════════════════════════════
     流星
  ════════════════════════════════════════════════ */
  class ShootingStar {
    constructor(w, h) {
      var side = Math.random();
      if (side < 0.55) {
        this.x = rand(w * -0.15, w * 1.15); this.y = rand(-40, -8);
        this.angle = rand(Math.PI * 0.17, Math.PI * 0.44);
      } else if (side < 0.78) {
        this.x = rand(-40, -8); this.y = rand(h * -0.1, h * 0.55);
        this.angle = rand(-0.18, 0.28);
      } else {
        this.x = rand(w * 1.0, w * 1.1); this.y = rand(h * -0.1, h * 0.55);
        this.angle = Math.PI - rand(-0.18, 0.28);
      }
      this.speed = rand(5.5, 13.5);
      this.tail  = rand(85, 230);
      this.hue   = rand(175, 285);
      this.size  = rand(0.85, 2.1);
      this.life  = 1;
      this.decay = rand(0.006, 0.016);
    }
    update(dt) {
      this.x    += Math.cos(this.angle) * this.speed * dt * 0.1;
      this.y    += Math.sin(this.angle) * this.speed * dt * 0.1;
      this.life -= this.decay * dt / 16;
      return this.life > 0;
    }
    draw(bg) {
      var a  = Math.max(0, this.life);
      var tx = this.x - Math.cos(this.angle) * this.tail * a;
      var ty = this.y - Math.sin(this.angle) * this.tail * a;
      /* 尾迹长度保证不为0 */
      var tailLen = Math.sqrt((tx - this.x) * (tx - this.x) + (ty - this.y) * (ty - this.y));
      if (tailLen < 1) return;
      bg.save();
      bg.globalCompositeOperation = 'lighter';
      var lg = bg.createLinearGradient(tx, ty, this.x, this.y);
      lg.addColorStop(0,    'hsla(' + this.hue + ',100%,78%,0)');
      lg.addColorStop(0.55, 'hsla(' + this.hue + ',100%,88%,' + (a * 0.30) + ')');
      lg.addColorStop(0.85, 'hsla(' + (this.hue + 20) + ',100%,96%,' + (a * 0.72) + ')');
      lg.addColorStop(1,    'hsla(0,0%,100%,' + a + ')');
      bg.strokeStyle = lg;
      bg.lineWidth   = this.size * (0.7 + a * 0.9);
      bg.lineCap     = 'round';
      bg.beginPath(); bg.moveTo(tx, ty); bg.lineTo(this.x, this.y); bg.stroke();
      /* 头部光晕 */
      var hr = this.size * 8;
      var gg = bg.createRadialGradient(this.x, this.y, 0, this.x, this.y, hr);
      gg.addColorStop(0,    'hsla(0,0%,100%,' + a + ')');
      gg.addColorStop(0.32, 'hsla(' + this.hue + ',100%,93%,' + (a * 0.58) + ')');
      gg.addColorStop(1,    'hsla(' + this.hue + ',100%,80%,0)');
      bg.fillStyle = gg;
      bg.beginPath(); bg.arc(this.x, this.y, hr, 0, TAU); bg.fill();
      bg.restore();
    }
  }

  /* ════════════════════════════════════════════════
     引擎
  ════════════════════════════════════════════════ */
  class Starfield {
    constructor(canvas, bgCanvas) {
      this.canvas   = canvas;
      this.ctx      = canvas.getContext('2d');
      this.bgCanvas = bgCanvas;
      this.bgCtx    = bgCanvas.getContext('2d');

      this.stars          = [];
      this.particles      = [];
      this.bgStars        = [];
      this.nebulae        = [];
      this.bgRipples      = [];
      this.field          = [];
      this.shootingStars  = [];
      this.shootTimer     = rand(2500, 7000);
      this.cosmicDust     = [];
      this.wisps          = [];

      this.connections      = [];
      this.connectingFromId = null;

      this.cursor = { worldX: 0, worldY: 0, lastEmit: 0, screenX: -9999, screenY: -9999 };
      this.hoverStar     = null;
      this.gravityRadius = 100;
      this.haloPhase     = 0;

      /* 3D 旋转 */
      this.rotX = 0; this.rotY = 0;
      this.targetRotX = 0; this.targetRotY = 0;
      this.autoRotY   = 0;

      this.lastT       = performance.now();
      this._listeners  = {};
      this._loop       = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    on(name, fn)  { (this._listeners[name] = this._listeners[name] || []).push(fn); }
    emit(name, p) { (this._listeners[name] || []).forEach(function(f){ f(p); }); }

    setMouseRotation(normX, normY) {
      this.targetRotX = normY * 0.32;
      this.targetRotY = normX * 0.32 + this.autoRotY;
    }

    resize() {
      var dpr = Math.min(devicePixelRatio || 1, 2);
      var self = this;
      [this.canvas, this.bgCanvas].forEach(function(c) {
        c.width  = c.clientWidth  * dpr;
        c.height = c.clientHeight * dpr;
        c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      });
      this._regenBgStars();
      this._regenNebulae();
      this._regenField();
      this._regenCosmicDust();
    }

    _regenCosmicDust() {
      var w = this.bgCanvas.clientWidth, h = this.bgCanvas.clientHeight;
      this.cosmicDust = [];
      for (var i = 0; i < 110; i++) {
        var angle = Math.random() * TAU;
        var spd   = rand(0.008, 0.048);
        this.cosmicDust.push({
          x: rand(0, w), y: rand(0, h),
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          ax: rand(-0.00008, 0.00008),
          ay: rand(-0.00008, 0.00008),
          r:       rand(2.8, 10),
          hue:     rand(215, 305),
          baseA:   rand(0.07, 0.26),
          phase:   Math.random() * TAU,
          phaseSpd: rand(0.0003, 0.0014),
        });
      }
    }

    _regenField() {
      var w = this.bgCanvas.clientWidth, h = this.bgCanvas.clientHeight;
      var N = Math.max(80, Math.floor(w * h * 0.00012));
      this.field = [];
      for (var i = 0; i < N; i++) {
        var x = rand(0, w), y = rand(0, h);
        this.field.push({ ox: x, oy: y, x: x, y: y, vx: 0, vy: 0,
          r: rand(0.6, 1.6), baseA: rand(0.4, 0.95),
          phase: Math.random() * TAU, tw: rand(0.3, 1.2), hue: rand(200, 300) });
      }
    }

    _regenBgStars() {
      this.bgStars = [];
      for (var i = 0; i < CFG.bgStarCount; i++) {
        var theta = TAU * Math.random();
        var phi   = Math.acos(2 * Math.random() - 1);
        this.bgStars.push({
          nx: Math.sin(phi) * Math.cos(theta),
          ny: Math.sin(phi) * Math.sin(theta),
          nz: Math.cos(phi),
          r: rand(0.32, 2.0), baseA: rand(0.25, 1.0),
          phase: Math.random() * TAU, speed: rand(0.4, 1.6),
          hue: rand(200, 295),
        });
      }
    }

    _regenNebulae() {
      var w = this.bgCanvas.clientWidth, h = this.bgCanvas.clientHeight;
      this.nebulae = [];
      for (var i = 0; i < 6; i++) this.nebulae.push(new NebulaBlob(w, h));
    }

    /* 3D 旋转投影 */
    _project3D(nx, ny, nz) {
      var cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
      var x1   =  nx * cosY + nz * sinY;
      var z1   = -nx * sinY + nz * cosY;
      var cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
      var y2   = ny * cosX - z1 * sinX;
      var z2   = ny * sinX + z1 * cosX;
      return { px: x1, py: y2, depth: z2 };
    }

    addStar(wx, wy, opts) {
      var s = new Star(wx, wy, opts);
      this.stars.push(s);
      if (!opts || !opts.silent) this._burst(wx, wy, s.hue, 1);
      this.emit('star-added', s);
      return s;
    }

    addCompanion(host, opts) {
      var c  = new CompanionStar(host, opts);
      host.companions.push(c);
      var cx = host.x + Math.cos(c.theta) * c.r;
      var cy = host.y + Math.sin(c.theta) * c.r;
      if (!opts || !opts.silent) this._burst(cx, cy, c.hue, 0.65);
      this.emit('companion-added', { host: host, companion: c });
      return c;
    }

    addConnection(starAId, starBId, createdBy) {
      if (starAId === starBId) return null;
      for (var i = 0; i < this.connections.length; i++) {
        var ec = this.connections[i];
        if ((ec.starA === starAId && ec.starB === starBId) ||
            (ec.starA === starBId && ec.starB === starAId)) return null;
      }
      var conn = {
        id: Math.random().toString(36).slice(2, 9),
        starA: starAId, starB: starBId,
        createdBy: createdBy || 'Anonymous',
        createdAt: Date.now()
      };
      this.connections.push(conn);
      this.emit('connection-added', conn);
      return conn;
    }

    removeConnection(connId) {
      for (var i = 0; i < this.connections.length; i++) {
        if (this.connections[i].id === connId) {
          var removed = this.connections.splice(i, 1)[0];
          this.emit('connection-removed', removed);
          return removed;
        }
      }
      return null;
    }

    hitTestConnection(wx, wy) {
      var threshold = 14 / view.scale;
      for (var i = this.connections.length - 1; i >= 0; i--) {
        var c = this.connections[i];
        var sa = null, sb = null;
        for (var j = 0; j < this.stars.length; j++) {
          if (this.stars[j].id === c.starA) sa = this.stars[j];
          if (this.stars[j].id === c.starB) sb = this.stars[j];
        }
        if (!sa || !sb) continue;
        if (pointToSegmentDist(wx, wy, sa.x, sa.y, sb.x, sb.y) < threshold) return c;
      }
      return null;
    }

    _burst(x, y, hue, scale) {
      if (scale == null) scale = 1;
      var N = Math.floor(CFG.burstCount * scale);
      for (var i = 0; i < 3; i++) {
        this.particles.push(new Particle(x, y, {
          kind: 'ring', life: 1, decay: 0.014 + i * 0.004,
          maxR: 100 + i * 40, hue: hue + rand(-15, 15), lineW: 1.6 - i * 0.4
        }));
      }
      for (var i2 = 0; i2 < 12; i2++) {
        var a = (i2 / 12) * TAU + rand(-0.06, 0.06);
        this.particles.push(new Particle(x, y, {
          kind: 'ray', angle: a, life: 1, decay: 0.035,
          hue: hue + rand(-25, 25), lineW: rand(1.2, 2.2)
        }));
      }
      for (var i3 = 0; i3 < N; i3++) {
        var a2 = Math.random() * TAU, v = rand(1.5, 5.5);
        this.particles.push(new Particle(x, y, {
          vx: Math.cos(a2) * v, vy: Math.sin(a2) * v,
          gravity: rand(0.005, 0.025), life: 1, decay: rand(0.008, 0.022),
          size: rand(0.8, 1.8), hue: hue + rand(-30, 30)
        }));
      }
    }

    emitCursorDust(wx, wy) {
      if (!CFG.cursorTrail) return;
      var now = performance.now();
      if (now - this.cursor.lastEmit < 18) return;
      this.cursor.lastEmit = now;
      for (var i = 0; i < 3; i++) {
        var a = Math.random() * TAU, v = rand(0.2, 1.4);
        this.particles.push(new Particle(wx + rand(-4, 4), wy + rand(-4, 4), {
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          gravity: rand(-0.005, 0.005), life: 0.85, decay: rand(0.024, 0.045),
          size: rand(0.6, 1.4), hue: rand(CFG.starHueRange[0], CFG.starHueRange[1])
        }));
      }
    }

    addBgRipple(sx, sy) {
      this.bgRipples.push({ x: sx, y: sy, r: 0, life: 1, hue: rand(220, 320) });
    }

    findNearestStar(wx, wy) {
      var best = null, bd = Infinity;
      for (var i = 0; i < this.stars.length; i++) {
        var d = this.stars[i].dist(wx, wy);
        if (d < bd) { bd = d; best = this.stars[i]; }
      }
      if (best && bd < this.gravityRadius / view.scale) return best;
      return null;
    }

    hitTest(wx, wy) {
      for (var i = this.stars.length - 1; i >= 0; i--) {
        var s = this.stars[i];
        if (s.dist(wx, wy) < Math.max(20, s.r * 7) / view.scale) return s;
      }
      return null;
    }

    _loop(t) {
      var self = this;
      try {
        var dt = Math.min(48, t - self.lastT);
        self.lastT = t;

        self.autoRotY += dt * 0.000032;
        self.rotX += (self.targetRotX - self.rotX) * 0.038;
        self.rotY += (self.targetRotY - self.rotY) * 0.038;
        view.scale += (view.targetScale - view.scale) * 0.12;

        var W = self.canvas.clientWidth, H = self.canvas.clientHeight;
        var bg = self.bgCtx;

        /* ── 背景底色 ── */
        bg.globalCompositeOperation = 'source-over';
        bg.fillStyle = 'rgb(6,4,20)';
        bg.fillRect(0, 0, W, H);
        bg.globalCompositeOperation = 'lighter';

        /* ── 星云 + 丝缕（视差：跟随视口移动但慢于前景） ── */
        var PX = view.x * 0.25, PY = view.y * 0.25;
        bg.save();
        bg.translate(PX, PY);
        for (var ni = 0; ni < self.nebulae.length; ni++) {
          self.nebulae[ni].update(dt, W, H);
          self.nebulae[ni].draw(bg);
        }
        bg.restore();

        /* ── 宇宙浮尘 ── */
        for (var di = 0; di < self.cosmicDust.length; di++) {
          var d = self.cosmicDust[di];
          d.phase += dt * d.phaseSpd;
          d.vx = (d.vx + d.ax * dt) * 0.9998;
          d.vy = (d.vy + d.ay * dt) * 0.9998;
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.x < -d.r)       d.x = W + d.r;
          else if (d.x > W + d.r) d.x = -d.r;
          if (d.y < -d.r)       d.y = H + d.r;
          else if (d.y > H + d.r) d.y = -d.r;
          var da = d.baseA * (0.45 + 0.55 * Math.sin(d.phase));
          if (da < 0.01) continue;
          var gd = bg.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
          gd.addColorStop(0,   'hsla(' + d.hue + ',90%,88%,' + da + ')');
          gd.addColorStop(0.5, 'hsla(' + d.hue + ',80%,70%,' + (da * 0.38) + ')');
          gd.addColorStop(1,   'hsla(' + d.hue + ',80%,55%,0)');
          bg.fillStyle = gd;
          bg.beginPath(); bg.arc(d.x, d.y, d.r, 0, TAU); bg.fill();
        }

        /* ── 3D 球面星（视差：比星云更远，移动更慢） ── */
        var halfW = W * 0.58, halfH = H * 0.58;
        var BSX = view.x * 0.12, BSY = view.y * 0.12;
        bg.save();
        bg.translate(BSX, BSY);
        for (var bi = 0; bi < self.bgStars.length; bi++) {
          var bs = self.bgStars[bi];
          bs.phase += dt * 0.001 * bs.speed * CFG.twinkleSpeed;
          var proj = self._project3D(bs.nx, bs.ny, bs.nz);
          var depthF  = (proj.depth + 1) * 0.5;
          var twinkle = 0.42 + 0.58 * Math.abs(Math.sin(bs.phase));
          var bsa     = bs.baseA * twinkle * (0.12 + 0.88 * depthF);
          if (bsa < 0.022) continue;
          var sx = W / 2 + proj.px * halfW;
          var sy = H / 2 + proj.py * halfH;
          var sr = bs.r * (0.35 + 0.65 * depthF);
          bg.fillStyle = 'hsla(' + bs.hue + ',80%,92%,' + bsa + ')';
          bg.beginPath(); bg.arc(sx, sy, sr, 0, TAU); bg.fill();
          if (sr > 0.85 && bsa > 0.42) {
            var gbs = bg.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
            gbs.addColorStop(0, 'hsla(' + bs.hue + ',80%,88%,' + (bsa * 0.30) + ')');
            gbs.addColorStop(1, 'hsla(' + bs.hue + ',80%,88%,0)');
            bg.fillStyle = gbs;
            bg.beginPath(); bg.arc(sx, sy, sr * 5, 0, TAU); bg.fill();
          }
        }
        bg.restore();

        /* ── 流星 ── */
        self.shootTimer -= dt;
        if (self.shootTimer <= 0 && self.shootingStars.length < 4) {
          self.shootingStars.push(new ShootingStar(W, H));
          self.shootTimer = rand(3200, 9500);
        }
        var alive = [];
        for (var si = 0; si < self.shootingStars.length; si++) {
          if (self.shootingStars[si].update(dt)) {
            self.shootingStars[si].draw(bg);
            alive.push(self.shootingStars[si]);
          }
        }
        self.shootingStars = alive;

        /* ── 星云丝缕 ── */
        if (self.nebulae.length > 0 && Math.random() < dt * 0.006) {
          var nb = self.nebulae[randi(0, self.nebulae.length)];
          var wa = Math.random() * TAU;
          var r0 = rand(nb.r * 0.05, nb.r * 0.35);
          self.wisps.push({
            x: nb.x + Math.cos(wa) * r0,
            y: nb.y + Math.sin(wa) * r0,
            vx: Math.cos(wa) * rand(0.02, 0.09),
            vy: Math.sin(wa) * rand(0.02, 0.09),
            hue: nb.hue,
            r: rand(1.5, 5),
            life: 1,
            decay: rand(0.0006, 0.0018),
          });
        }
        var wAlive = [];
        for (var wi = 0; wi < self.wisps.length; wi++) {
          var wp = self.wisps[wi];
          wp.x += wp.vx * dt; wp.y += wp.vy * dt;
          wp.life -= wp.decay * dt;
          if (wp.life <= 0) continue;
          var wa2 = Math.max(0, wp.life) * 0.35 * CFG.nebulaIntensity;
          var gw  = bg.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r);
          gw.addColorStop(0, 'hsla(' + wp.hue + ',90%,80%,' + wa2 + ')');
          gw.addColorStop(1, 'hsla(' + wp.hue + ',80%,60%,0)');
          bg.fillStyle = gw;
          bg.beginPath(); bg.arc(wp.x, wp.y, wp.r, 0, TAU); bg.fill();
          wAlive.push(wp);
        }
        self.wisps = wAlive;

        /* ── 鼠标拖动涟漪 ── */
        var rAlive = [];
        for (var ri = 0; ri < self.bgRipples.length; ri++) {
          var rp = self.bgRipples[ri];
          rp.r += dt * 0.4; rp.life -= dt * 0.0014;
          if (rp.life <= 0) continue;
          bg.strokeStyle = 'hsla(' + rp.hue + ',100%,80%,' + (rp.life * 0.5) + ')';
          bg.lineWidth = 1.2;
          bg.beginPath(); bg.arc(rp.x, rp.y, rp.r, 0, TAU); bg.stroke();
          rAlive.push(rp);
        }
        self.bgRipples = rAlive;

        /* ── Gemini 粒子场：物理更新 ── */
        var mcx = self.cursor.screenX, mcy = self.cursor.screenY;
        var REPEL = 130, REPEL_F = 1800, SPRING = 0.012, FRICTION = 0.88;
        var LNKD = 110, LNKD2 = LNKD * LNKD;
        for (var fi = 0; fi < self.field.length; fi++) {
          var fp  = self.field[fi];
          var fdx = fp.x - mcx, fdy = fp.y - mcy;
          var fd2 = fdx * fdx + fdy * fdy;
          if (fd2 < REPEL * REPEL && fd2 > 0.5) {
            var fd  = Math.sqrt(fd2);
            var ff  = (1 - fd / REPEL) * REPEL_F / fd2;
            fp.vx += fdx * ff * dt * 0.001;
            fp.vy += fdy * ff * dt * 0.001;
          }
          fp.vx += (fp.ox - fp.x) * SPRING;
          fp.vy += (fp.oy - fp.y) * SPRING;
          fp.vx *= FRICTION; fp.vy *= FRICTION;
          fp.x += fp.vx; fp.y += fp.vy;
          fp.phase += dt * 0.001 * fp.tw;
        }

        /* ── Gemini 粒子场：渲染 ── */
        bg.globalCompositeOperation = 'lighter';
        for (var i0 = 0; i0 < self.field.length; i0++) {
          var fa = self.field[i0];
          for (var j0 = i0 + 1; j0 < self.field.length; j0++) {
            var fb  = self.field[j0];
            var lx  = fa.x - fb.x, ly = fa.y - fb.y;
            var ld2 = lx * lx + ly * ly;
            if (ld2 < LNKD2) {
              var lt = 1 - ld2 / LNKD2;
              bg.strokeStyle = 'hsla(260,80%,80%,' + (lt * 0.16) + ')';
              bg.lineWidth = 0.6;
              bg.beginPath(); bg.moveTo(fa.x, fa.y); bg.lineTo(fb.x, fb.y); bg.stroke();
            }
          }
          var mx = fa.x - mcx, my = fa.y - mcy;
          var md2 = mx * mx + my * my;
          if (md2 < LNKD2 * 1.5) {
            var mt = 1 - md2 / (LNKD2 * 1.5);
            bg.strokeStyle = 'hsla(280,90%,85%,' + (mt * 0.42) + ')';
            bg.lineWidth = 0.9;
            bg.beginPath(); bg.moveTo(fa.x, fa.y); bg.lineTo(mcx, mcy); bg.stroke();
          }
        }
        for (var pi = 0; pi < self.field.length; pi++) {
          var fp2 = self.field[pi];
          var ptw = fp2.baseA * (0.5 + 0.5 * Math.sin(fp2.phase));
          var pg  = bg.createRadialGradient(fp2.x, fp2.y, 0, fp2.x, fp2.y, fp2.r * 4);
          pg.addColorStop(0, 'hsla(' + fp2.hue + ',90%,90%,' + ptw + ')');
          pg.addColorStop(1, 'hsla(' + fp2.hue + ',90%,90%,0)');
          bg.fillStyle = pg;
          bg.beginPath(); bg.arc(fp2.x, fp2.y, fp2.r * 4, 0, TAU); bg.fill();
        }
        bg.globalCompositeOperation = 'source-over';

        /* ── 主层（种的星星） ── */
        var ctx = self.ctx;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(view.scale, view.scale);
        ctx.translate(-W / 2 + view.x, -H / 2 + view.y);

        /* 引力光环 */
        if (self.hoverStar) {
          self.haloPhase += dt * 0.0018;
          var hs = self.hoverStar;
          var haloR = self.gravityRadius * 0.55;
          ctx.save();
          ctx.translate(hs.x, hs.y);
          ctx.rotate(self.haloPhase);
          ctx.strokeStyle = 'hsla(' + (hs.hue + 30) + ',100%,90%,.7)';
          ctx.lineWidth = 0.8; ctx.setLineDash([3, 9]);
          ctx.beginPath(); ctx.arc(0, 0, haloR, 0, TAU); ctx.stroke();
          ctx.rotate(-self.haloPhase * 2.4);
          ctx.strokeStyle = 'hsla(' + hs.hue + ',100%,95%,.45)';
          ctx.setLineDash([1, 16]);
          ctx.beginPath(); ctx.arc(0, 0, haloR * 1.35, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        /* ── 星座连线 ── */
        if (CFG.constellationEnabled && self.stars.length >= 2) {
          var maxD = CFG.constellationMaxDist;
          var maxD2 = maxD * maxD;
          var connPhase = performance.now() * 0.0003;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (var ai = 0; ai < self.stars.length; ai++) {
            var sa = self.stars[ai];
            for (var bi = ai + 1; bi < self.stars.length; bi++) {
              var sb = self.stars[bi];
              var dx2 = sa.x - sb.x, dy2 = sa.y - sb.y;
              var d2 = dx2 * dx2 + dy2 * dy2;
              if (d2 > maxD2 || d2 < 1) continue;
              var dist = Math.sqrt(d2);
              var t = 1 - dist / maxD;
              var alpha = t * t * 0.32;
              if (alpha < 0.015) continue;
              var midHue = (sa.hue + sb.hue) / 2;
              var lg2 = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y);
              lg2.addColorStop(0,   'hsla(' + sa.hue + ',100%,85%,0)');
              lg2.addColorStop(0.35, 'hsla(' + midHue + ',90%,88%,' + alpha + ')');
              lg2.addColorStop(0.5,  'hsla(' + midHue + ',80%,92%,' + (alpha * 1.3) + ')');
              lg2.addColorStop(0.65, 'hsla(' + midHue + ',90%,88%,' + alpha + ')');
              lg2.addColorStop(1,    'hsla(' + sb.hue + ',100%,85%,0)');
              ctx.strokeStyle = lg2;
              ctx.lineWidth = 0.6 + t * 0.8;
              ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
            }
          }
          ctx.restore();
        }

        /* ── connect-mode selected star highlight ── */
        if (self.connectingFromId) {
          var cs = null;
          for (var si = 0; si < self.stars.length; si++) {
            if (self.stars[si].id === self.connectingFromId) { cs = self.stars[si]; break; }
          }
          if (cs) {
            var selPulse = 0.5 + 0.3 * Math.sin(t * 0.003);
            ctx.save();
            ctx.strokeStyle = 'hsla(50, 100%, 80%, ' + selPulse + ')';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'hsla(50, 100%, 70%, ' + (selPulse * 0.6) + ')';
            ctx.shadowBlur = 14;
            ctx.setLineDash([3, 5]);
            ctx.beginPath(); ctx.arc(cs.x, cs.y, cs.r * 5.5, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.restore();
          }

          /* preview dashed line to hover star */
          if (self.hoverStar && self.hoverStar.id !== self.connectingFromId) {
            var fc = null;
            for (var si2 = 0; si2 < self.stars.length; si2++) {
              if (self.stars[si2].id === self.connectingFromId) { fc = self.stars[si2]; break; }
            }
            if (fc) {
              ctx.save();
              ctx.setLineDash([4, 8]);
              ctx.strokeStyle = 'hsla(50, 100%, 70%, 0.45)';
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(fc.x, fc.y);
              ctx.lineTo(self.hoverStar.x, self.hoverStar.y); ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }
        }

        /* ── 手动星座连线 ── */
        if (self.connections.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (var ci = 0; ci < self.connections.length; ci++) {
            var conn = self.connections[ci];
            var sa = null, sb = null;
            for (var si3 = 0; si3 < self.stars.length; si3++) {
              if (self.stars[si3].id === conn.starA) sa = self.stars[si3];
              if (self.stars[si3].id === conn.starB) sb = self.stars[si3];
            }
            if (!sa || !sb) continue;
            var pulse = 0.75 + 0.25 * Math.sin(t * 0.002 + conn.id.charCodeAt(0));
            /* 外层光晕 */
            var lg = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y);
            lg.addColorStop(0,   'hsla(50, 100%, 85%, ' + (pulse * 0.18) + ')');
            lg.addColorStop(0.3, 'hsla(50, 100%, 92%, ' + (pulse * 0.38) + ')');
            lg.addColorStop(0.5, 'hsla(0, 0%, 100%, '  + (pulse * 0.48) + ')');
            lg.addColorStop(0.7, 'hsla(50, 100%, 92%, ' + (pulse * 0.38) + ')');
            lg.addColorStop(1,   'hsla(50, 100%, 85%, ' + (pulse * 0.18) + ')');
            ctx.strokeStyle = lg;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.shadowColor = 'hsla(50, 100%, 80%, ' + (pulse * 0.55) + ')';
            ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
            /* 内核细线 */
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'hsla(50, 100%, 95%, ' + (pulse * 0.65) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
          }
          ctx.restore();
        }

        for (var sti = 0; sti < self.stars.length; sti++) {
          var st = self.stars[sti];
          var I  = st.update(dt);
          st.draw(ctx, I);
          for (var ci = 0; ci < st.companions.length; ci++) {
            st.companions[ci].update(dt);
            st.companions[ci].draw(ctx);
          }
        }
        var pAlive = [];
        for (var ppi = 0; ppi < self.particles.length; ppi++) {
          if (self.particles[ppi].update(dt)) {
            self.particles[ppi].draw(ctx);
            pAlive.push(self.particles[ppi]);
          }
        }
        self.particles = pAlive;

        ctx.restore();
      } catch (e) {
        console.error('[Starfield] loop error:', e);
      }

      requestAnimationFrame(self._loop);
    }
  }

  window.STARFIELD = {
    Star: Star,
    CompanionStar: CompanionStar,
    Starfield: Starfield,
    setConfig: function(p) { Object.assign(CFG, p); },
    getConfig:  function()  { return Object.assign({}, CFG); },
    view: view,
  };

})();
