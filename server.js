const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Allow local dev + same-origin.
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '256kb' }));

const DATA_DIR = path.join(__dirname, 'data');
const PERIODS_FILE = path.join(DATA_DIR, 'periods.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PERIODS_FILE)) {
    fs.writeFileSync(PERIODS_FILE, JSON.stringify({ records: [] }, null, 2), 'utf-8');
  }
}

function sanitizeString(s, maxLen = 200) {
  if (typeof s !== 'string') return '';
  const trimmed = s.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeISODate(s) {
  if (typeof s !== 'string') return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Keep as ISO date (yyyy-mm-dd)
  return d.toISOString().slice(0, 10);
}

function sanitizeInt(n, fallback) {
  const v = typeof n === 'number' ? n : parseInt(n, 10);
  return Number.isFinite(v) ? v : fallback;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/periods/save', async (req, res) => {
  try {
    ensureFile();

    const body = req.body || {};

    const record = {
      id: Math.random().toString(16).slice(2) + '-' + Date.now().toString(16),
      createdAt: new Date().toISOString(),
      user: {
        name: sanitizeString(body?.user?.name, 200),
        email: sanitizeString(body?.user?.email, 250)
      },
      periods: {
        lmpISO: sanitizeISODate(body?.periods?.lmpISO),
        cycleLength: sanitizeInt(body?.periods?.cycleLength, 28)
      }
    };

    if (!record.periods.lmpISO) {
      return res.status(400).json({ error: 'Invalid lmpISO. Expected ISO date (YYYY-MM-DD).' });
    }

    const raw = fs.readFileSync(PERIODS_FILE, 'utf-8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { records: [] };
    }

    if (!Array.isArray(parsed.records)) parsed.records = [];
    parsed.records.push(record);

    fs.writeFileSync(PERIODS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return res.json({ ok: true, saved: record });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to save period data.' });
  }
});

// Static file hosting for your frontend pages (srh.html, auth.html, images, etc.)
app.use(express.static(__dirname));

// Serve the homepage at `/`
app.get('/', (_req, res) => {
  // If index.html exists, prefer it; otherwise fall back to urungano.html
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  return res.redirect('/urungano.html');
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Urungano period saver listening on http://localhost:${PORT}`);
});


