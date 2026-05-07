const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'gardens.json');

/* ── Simple JSON file store ── */
class GardenDB {
  constructor(file) {
    this.file = file;
    this.data = {};
    if (fs.existsSync(file)) {
      try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    }
  }
  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8');
  }
  get(id) {
    return this.data[id] || null;
  }
  set(id, val) {
    this.data[id] = val;
    this._save();
  }
  updateStars(id, stars) {
    if (!this.data[id]) return false;
    this.data[id] = { ...this.data[id], stars };
    this._save();
    return true;
  }
}

const db = new GardenDB(DATA_FILE);

/* ── Middleware ── */
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── Validation ── */
const ID_RE = /^[A-Z]{2,3}-\d{4}$/;

function sanitizeStar(s) {
  return {
    id:         String(s.id     || '').slice(0, 36),
    x:          Number(s.x)     || 0,
    y:          Number(s.y)     || 0,
    r:          Math.min(Math.max(Number(s.r)   || 12, 4), 40),
    hue:        Number(s.hue)   % 360 || 0,
    planter:    String(s.planter  || 'Anonymous').slice(0, 40),
    message:    String(s.message  || '').slice(0, 200),
    bornAt:     Number(s.bornAt)  || Date.now(),
    companions: (s.companions || []).slice(0, 50).map(sanitizeCompanion),
  };
}

function sanitizeCompanion(c) {
  return {
    r:       Math.min(Math.max(Number(c.r)    || 60, 30), 120),
    theta:   Number(c.theta)  || 0,
    omega:   Number(c.omega)  || 0.001,
    hue:     Number(c.hue)    % 360 || 40,
    size:    Math.min(Math.max(Number(c.size) || 2, 0.5), 6),
    message: String(c.message || '').slice(0, 140),
  };
}

/* ── API ── */

// GET garden
app.get('/api/garden/:id', (req, res) => {
  const id = req.params.id.toUpperCase();
  const row = db.get(id);
  res.json(row || { stars: [], connections: [] });
});

// PUT garden (owner full save)
app.put('/api/garden/:id', (req, res) => {
  const id = req.params.id.toUpperCase();
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Invalid garden ID' });
  const stars       = (req.body.stars       || []).slice(0, 500).map(sanitizeStar);
  const connections = (req.body.connections || []).slice(0, 2000);
  db.set(id, { stars, connections });
  res.json({ ok: true });
});

// POST companion (visitor adds single companion to a star)
app.post('/api/garden/:id/companion', (req, res) => {
  const id = req.params.id.toUpperCase();
  const { starId, companion } = req.body;
  if (!starId || !companion) return res.status(400).json({ error: 'Missing starId or companion' });

  const row = db.get(id);
  if (!row) return res.status(404).json({ error: 'Garden not found' });

  const stars = [...row.stars];
  const star  = stars.find(s => s.id === starId);
  if (!star) return res.status(404).json({ error: 'Star not found' });

  star.companions = star.companions || [];
  if (star.companions.length >= 50) return res.status(429).json({ error: 'Too many companions' });
  star.companions.push(sanitizeCompanion(companion));

  db.updateStars(id, stars);
  res.json({ ok: true });
});

// POST visit (visitor announces themselves)
app.post('/api/garden/:id/visit', (req, res) => {
  const id = req.params.id.toUpperCase();
  const visitorId = String(req.body.visitorId || '').toUpperCase();
  if (!ID_RE.test(visitorId)) return res.status(400).json({ error: 'Invalid visitor ID' });
  if (visitorId === id)       return res.status(400).json({ error: 'Cannot visit own garden' });

  const row = db.get(id);
  if (!row) return res.status(404).json({ error: 'Garden not found' });

  const visitors = (row.visitors || []).filter(v => v.id !== visitorId); // dedup
  visitors.unshift({ id: visitorId, at: Date.now() });
  if (visitors.length > 50) visitors.length = 50;
  db.data[id] = { ...row, visitors };
  db._save();
  res.json({ ok: true });
});

// GET random garden (from all gardens that have stars)
app.get('/api/gardens/random', (req, res) => {
  const exclude = (req.query.exclude || '').toUpperCase();
  const ids = Object.keys(db.data).filter(id => {
    if (id === exclude) return false;
    const g = db.data[id];
    return g && g.stars && g.stars.length > 0;
  });
  if (ids.length === 0) return res.status(404).json({ error: 'No other gardens yet' });
  const id = ids[Math.floor(Math.random() * ids.length)];
  res.json({ id, total: ids.length });
});

// Health check for Railway
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ── Start ── */
app.listen(PORT, () => console.log(`✦ Star Garden running on http://localhost:${PORT}`));
