const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

require('dotenv').config();

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

// ===== Firebase Admin (server-side) =====
const adminEmailAllowed = process.env.ADMIN_EMAIL || 'admin@urungano.com';
function getAdminAllowedEmails() {
  const raw = process.env.ADMIN_EMAILS; // comma-separated list
  if (!raw || typeof raw !== 'string') return [adminEmailAllowed];
  return raw
    .split(',')
    .map(s => (s || '').trim())
    .filter(Boolean);
}


function safeToString(v) {
  try {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}


let firebaseAdmin = null;
try {
  firebaseAdmin = require('firebase-admin');
} catch (e) {
  // If firebase-admin isn't installed yet, startup will still work for period saver.
  // Therapist creation endpoint will fail with a clear error.
}

let firebaseInitialized = false;
async function ensureFirebaseAdminInit() {
  if (firebaseInitialized) return;
  if (!firebaseAdmin) throw new Error('firebase-admin is not installed.');

  // Preferred for local dev: use a service account JSON file path via GOOGLE_APPLICATION_CREDENTIALS.
  // Fallback: allow passing service account JSON via env var FIREBASE_SERVICE_ACCOUNT_JSON.
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Preferred: inline JSON via env var (no file path issues)
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = firebaseAdmin.credential.cert(parsed);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // GOOGLE_APPLICATION_CREDENTIALS may point to a JSON key file OR be the JSON contents.
    // If it looks like JSON, parse it; otherwise treat it as a path.
    const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (typeof gac === 'string' && gac.trim().startsWith('{')) {
      credential = firebaseAdmin.credential.cert(JSON.parse(gac));
    } else {
      credential = firebaseAdmin.credential.cert(gac);
    }
  } else {
    // Last resort (will throw the same Project Id detection error in many local setups)
    credential = firebaseAdmin.credential.applicationDefault();
  }


  function extractProjectIdFromServiceAccount(serviceAccountObj) {
    if (!serviceAccountObj || typeof serviceAccountObj !== 'object') return null;
    // service account JSON uses `project_id` (snake_case) in most exports.
    return serviceAccountObj.project_id || serviceAccountObj.projectId || null;
  }

  // Provide projectId explicitly.
  // 1) Prefer env var FIREBASE_PROJECT_ID
  // 2) If we have service account JSON inline, extract project_id
  // 3) If GOOGLE_APPLICATION_CREDENTIALS is a *path*, read the JSON and extract project_id
  // 4) Otherwise throw a clear error (avoids the opaque "Unable to detect a Project Id" message)

  const projectIdFromEnv = process.env.FIREBASE_PROJECT_ID || null;

  // If GOOGLE_APPLICATION_CREDENTIALS is a path (common), parse the file to extract project_id.
  // This is specifically to avoid relying on firebase-admin internal heuristics.
  let serviceAccountParsed = null;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccountParsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (typeof gac === 'string' && gac.trim().startsWith('{')) {
        // inline json
        serviceAccountParsed = JSON.parse(gac);
      } else {
        // path to json file
        const absPath = path.isAbsolute(gac) ? gac : path.join(process.cwd(), gac);
        const raw = fs.readFileSync(absPath, 'utf8');
        serviceAccountParsed = JSON.parse(raw);
      }
    }
  } catch (e) {
    // keep null; we’ll surface clearer error below
  }

  const projectIdFromSa = extractProjectIdFromServiceAccount(serviceAccountParsed);
  const projectId = projectIdFromEnv || projectIdFromSa;

  if (!projectId) {
    throw new Error(
      'Firebase Admin init failed: missing FIREBASE_PROJECT_ID and could not extract project id. ' +
      'Set FIREBASE_PROJECT_ID and ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account JSON file. '
    );
  }

  // Avoid double-initialize issues in hot reload / repeated calls
  if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
    firebaseAdmin.initializeApp({ credential, projectId });
  }





  firebaseInitialized = true;

}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ===== Therapist creation endpoint =====
app.post('/api/admin/therapists/create', async (req, res) => {
  try {
    if (!firebaseAdmin) {
      return res.status(500).json({ error: 'firebase-admin is not installed on the server.' });
    }


    // DEBUG env (keep minimal - remove once fixed)
    console.log('DEBUG env:', {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    await ensureFirebaseAdminInit();


    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    console.log('DEBUG authHeader present:', !!authHeader, 'tokenLen:', token ? token.length : 0);

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    }

    const adminEmails = getAdminAllowedEmails();
    console.log('DEBUG allowed admin emails:', adminEmails);


    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(token);
    } catch (e) {
      // Make token errors explicit for the frontend (instead of generic 500)
      const code = e?.code || '';
      if (code.startsWith('auth/')) {
        return res.status(401).json({ error: 'Invalid Firebase ID token. Ensure the frontend sends currentUser.getIdToken() as Authorization: Bearer <token>.' });
      }
      throw e;
    }
    const email = decoded?.email;

    // Admin authorization: allow any email in ADMIN_EMAILS (comma-separated) or fallback to ADMIN_EMAIL.
    // This prevents hard failures when the configured admin email differs from the default string.
    const allowedEmails = getAdminAllowedEmails();
    const isAllowed = !!email && allowedEmails.includes(email);

    console.log('DEBUG therapist auth:', {
      uid: decoded?.uid,
      email,
      allowedEmails
    });

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden: admin email not allowed to create therapists.',
        allowedEmails
      });
    }


    const body = req.body || {};
    const username = sanitizeString(body?.username, 100);
    const password = (body?.password || '').toString();
    const emailTherapist = sanitizeString(body?.email, 250);
    const institution = sanitizeString(body?.institution, 150);
    const yearsOfExperience = sanitizeInt(body?.yearsOfExperience, null);

    if (!username || !emailTherapist || !password || !institution || yearsOfExperience === null) {
      return res.status(400).json({ error: 'Missing/invalid fields: username, password, email, institution, yearsOfExperience.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Create Firebase Auth user
    const userRecord = await firebaseAdmin.auth().createUser({
      email: emailTherapist,
      password,
      displayName: username
    });

    // Create Firestore doc (collection auto-creates)
    const db = firebaseAdmin.firestore();
    await db.collection('therapists').doc(userRecord.uid).set({
      uid: userRecord.uid,
      username,
      email: emailTherapist,
      institution,
      yearsOfExperience,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true, uid: userRecord.uid });
  } catch (e) {
    console.error(e);
    const msg = e?.message || 'Failed to create therapist.';
    return res.status(500).json({ error: msg });
  }
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
  console.log(`Urungano server listening on http://localhost:${PORT}`);
});

