const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

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

function normalizeInstitutionName(value) {
  return sanitizeString(value, 120).replace(/\s+/g, ' ');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

const INSTITUTION_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function institutionSessionSecret() {
  return process.env.INSTITUTION_SESSION_SECRET || process.env.FIREBASE_PROJECT_ID || 'change-this-in-production';
}
function createInstitutionSession(institutionId) {
  const payload = Buffer.from(JSON.stringify({ institutionId, expiresAt: Date.now() + INSTITUTION_SESSION_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', institutionSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function readInstitutionSession(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', institutionSessionSecret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session?.institutionId && session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}

// ===== Firebase Admin (server-side) =====
const adminEmailAllowed = process.env.ADMIN_EMAIL || 'admin@urungano.com';
function getAdminAllowedEmails() {
  // Keep the primary ADMIN_EMAIL authorized even when a deployment also sets
  // ADMIN_EMAILS. Previously ADMIN_EMAILS replaced it completely, which could
  // lock the configured admin out of newly added admin-only endpoints.
  const extra = typeof process.env.ADMIN_EMAILS === 'string' ? process.env.ADMIN_EMAILS.split(',') : [];
  return [...extra, adminEmailAllowed, 'admin@urungano.com']
    .map(email => String(email || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((email, index, list) => list.indexOf(email) === index);
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

  // Support multiple env var names for the service account JSON
  function getServiceAccountJsonString() {
    if (process.env.serviceAccountKey) return process.env.serviceAccountKey;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (typeof gac === 'string' && gac.trim().startsWith('{')) return gac;
    }
    return null;
  }

  let credential = null;
  let serviceAccountParsed = null;

  const jsonString = getServiceAccountJsonString();

  if (jsonString) {
    try {
      serviceAccountParsed = JSON.parse(jsonString);
      credential = firebaseAdmin.credential.cert(serviceAccountParsed);
    } catch (e) {
      throw new Error(
        'Failed to parse service account JSON from environment variable. ' +
        'Make sure the full JSON is pasted correctly (including the private_key).'
      );
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Treat as a file path
    const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const absPath = path.isAbsolute(gac) ? gac : path.join(process.cwd(), gac);
    if (!fs.existsSync(absPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${absPath}`);
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    serviceAccountParsed = JSON.parse(raw);
    credential = firebaseAdmin.credential.cert(serviceAccountParsed);
  } else {
    // Local development fallback
    const localKeyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
      const raw = fs.readFileSync(localKeyPath, 'utf8');
      serviceAccountParsed = JSON.parse(raw);
      credential = firebaseAdmin.credential.cert(serviceAccountParsed);
    } else {
      throw new Error(
        'No Firebase credentials found. ' +
        'Set the environment variable "serviceAccountKey" (or FIREBASE_SERVICE_ACCOUNT_JSON) ' +
        'with the full service account JSON, or place serviceAccountKey.json in the project root.'
      );
    }
  }

  // Get project ID
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    (serviceAccountParsed && (serviceAccountParsed.project_id || serviceAccountParsed.projectId)) ||
    null;

  if (!projectId) {
    throw new Error(
      'Could not determine Firebase project ID. ' +
      'Set FIREBASE_PROJECT_ID=urungano-chat-50d62 in Vercel environment variables.'
    );
  }

  if (!credential) {
    throw new Error('Firebase credential could not be created.');
  }

  // Initialize only once
  if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
    firebaseAdmin.initializeApp({ credential, projectId });
  }

  firebaseInitialized = true;
}


async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    const error = new Error('Missing Authorization Bearer token.');
    error.status = 401;
    throw error;
  }
  try {
    return await firebaseAdmin.auth().verifyIdToken(token);
  } catch {
    const error = new Error('Invalid Firebase ID token.');
    error.status = 401;
    throw error;
  }
}

async function verifyAdmin(req) {
  const decoded = await verifyFirebaseUser(req);
  const allowedEmails = getAdminAllowedEmails();
  const emailMatches = !!decoded?.email && allowedEmails.includes(String(decoded.email).trim().toLowerCase());
  // Firebase ID tokens normally include email, but UID is the authoritative
  // account identifier. Looking it up also handles deployments where the token
  // does not expose an email claim as expected.
  let uidMatches = false;
  if (!emailMatches && decoded?.uid) {
    for (const email of allowedEmails) {
      try {
        const configuredAdmin = await firebaseAdmin.auth().getUserByEmail(email);
        if (configuredAdmin.uid === decoded.uid) { uidMatches = true; break; }
      } catch (e) {
        if (e?.code !== 'auth/user-not-found') throw e;
      }
    }
  }
  if (!emailMatches && !uidMatches) {
    console.warn('Institution admin authorization rejected', { uid: decoded?.uid || null, email: decoded?.email || null, allowedEmails });
    const error = new Error('Forbidden: admin access required.');
    error.status = 403;
    throw error;
  }
  return decoded;
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
    const isAllowed = !!email && allowedEmails.includes(String(email).trim().toLowerCase());

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

// ===== Institution accounts and aggregate analytics =====
app.get('/api/institutions', async (_req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const snapshot = await firebaseAdmin.firestore().collection('institutions').orderBy('name').get();
    return res.json({ institutions: snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unable to load institutions.' });
  }
});

app.post('/api/admin/institutions/create', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    await verifyAdmin(req);
    const name = normalizeInstitutionName(req.body?.name);
    const password = String(req.body?.password || '');
    if (!name || password.length < 6) return res.status(400).json({ error: 'Enter an institution name and a password of at least 6 characters.' });

    const db = firebaseAdmin.firestore();
    const existing = await db.collection('institutions').where('name', '==', name).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'An institution with that name already exists.' });
    const ref = db.collection('institutions').doc();
    await ref.set({
      name,
      passwordHash: hashPassword(password),
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      stats: { accountsCount: 0, totalVisits: 0, pages: {}, quiz: { totalResults: 0, totalScore: 0, byType: {}, bySeverity: {} } }
    });
    return res.json({ ok: true, institution: { id: ref.id, name } });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'Unable to create institution.' });
  }
});

app.post('/api/institutions/select', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const user = await verifyFirebaseUser(req);
    const institutionId = sanitizeString(req.body?.institutionId, 200);
    const db = firebaseAdmin.firestore();
    const institutionRef = db.collection('institutions').doc(institutionId);
    const userRef = db.collection('users').doc(user.uid);
    await db.runTransaction(async transaction => {
      const [institutionSnap, userSnap] = await Promise.all([transaction.get(institutionRef), transaction.get(userRef)]);
      if (!institutionSnap.exists) throw Object.assign(new Error('Institution not found.'), { status: 404 });
      const previousInstitutionId = userSnap.exists ? userSnap.data().institutionId : null;
      transaction.set(userRef, { institutionId, institutionSelectedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (previousInstitutionId !== institutionId) {
        transaction.update(institutionRef, { 'stats.accountsCount': firebaseAdmin.firestore.FieldValue.increment(1) });
      }
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'Unable to save institution choice.' });
  }
});

app.post('/api/institutions/track', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const user = await verifyFirebaseUser(req);
    const userSnap = await firebaseAdmin.firestore().collection('users').doc(user.uid).get();
    const institutionId = userSnap.exists ? userSnap.data().institutionId : null;
    if (!institutionId) return res.json({ ok: true, tracked: false });

    const page = sanitizeString(req.body?.page, 80).replace(/[^a-zA-Z0-9_-]/g, '_');
    const result = req.body?.result;
    const updates = {};
    if (page) {
      updates['stats.totalVisits'] = firebaseAdmin.firestore.FieldValue.increment(1);
      updates[`stats.pages.${page}`] = firebaseAdmin.firestore.FieldValue.increment(1);
    }
    if (result && typeof result === 'object') {
      const quizType = sanitizeString(result.quizType, 30).replace(/[^a-zA-Z0-9_-]/g, '_');
      const severity = sanitizeString(result.severity, 30).replace(/[^a-zA-Z0-9_-]/g, '_');
      const score = sanitizeInt(result.score, 0);
      updates['stats.quiz.totalResults'] = firebaseAdmin.firestore.FieldValue.increment(1);
      updates['stats.quiz.totalScore'] = firebaseAdmin.firestore.FieldValue.increment(Math.max(0, score));
      if (quizType) updates[`stats.quiz.byType.${quizType}`] = firebaseAdmin.firestore.FieldValue.increment(1);
      if (severity) updates[`stats.quiz.bySeverity.${severity}`] = firebaseAdmin.firestore.FieldValue.increment(1);
    }
    if (Object.keys(updates).length) await firebaseAdmin.firestore().collection('institutions').doc(institutionId).update(updates);
    return res.json({ ok: true, tracked: true });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'Unable to record aggregate statistics.' });
  }
});

app.post('/api/institutions/login', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const institutionName = normalizeInstitutionName(req.body?.institutionName);
    const password = String(req.body?.password || '');
    if (!institutionName || !password) return res.status(400).json({ error: 'Enter your institution name and password.' });
    // Names are entered manually on the dashboard, so match them without
    // requiring the exact capitalization used when the admin created them.
    const institutions = await firebaseAdmin.firestore().collection('institutions').get();
    const expectedName = institutionName.toLocaleLowerCase();
    const snap = institutions.docs.find(doc => normalizeInstitutionName(doc.data().name).toLocaleLowerCase() === expectedName) || null;
    if (!snap || !passwordMatches(password, snap.data().passwordHash)) return res.status(401).json({ error: 'Invalid institution name or password.' });
    return res.json({ ok: true, session: createInstitutionSession(snap.id), institution: { id: snap.id, name: snap.data().name } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unable to sign in.' });
  }
});

app.get('/api/institutions/dashboard', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const session = readInstitutionSession(req);
    if (!session) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    const snap = await firebaseAdmin.firestore().collection('institutions').doc(session.institutionId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Institution not found.' });
    const data = snap.data();
    return res.json({ institution: { id: snap.id, name: data.name, stats: data.stats || {} } });
  } catch (e) { return res.status(500).json({ error: 'Unable to load dashboard.' }); }
});

app.post('/api/institutions/password', async (req, res) => {
  try {
    await ensureFirebaseAdminInit();
    const session = readInstitutionSession(req);
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!session) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    const ref = firebaseAdmin.firestore().collection('institutions').doc(session.institutionId);
    const snap = await ref.get();
    if (!snap.exists || !passwordMatches(currentPassword, snap.data().passwordHash)) return res.status(401).json({ error: 'Current password is incorrect.' });
    await ref.update({ passwordHash: hashPassword(newPassword), passwordChangedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: 'Unable to change password.' }); }
});

// ===== Forgot Password / Reset endpoints =====
// Note: Password reset is now handled entirely client-side via Firebase's
// sendPasswordResetEmail() in auth.html. No backend endpoints needed.
// The client-side SDK sends the reset email directly without needing the Admin SDK.

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

// ===== Serve static files (HTML, images, CSS, etc.) =====
app.use(express.static(__dirname));

// Homepage
app.get('/', (_req, res) => {
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  return res.redirect('/urungano.html');
});

// Always export for Vercel
module.exports = app;

// Listen only when running on your computer
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Urungano server listening on http://localhost:${PORT}`);
  });
}