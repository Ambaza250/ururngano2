import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDy9ZCOQQIMnq6GOOnSS3Hk3IMSk06jTf4',
  authDomain: 'urungano-chat-50d62.firebaseapp.com',
  projectId: 'urungano-chat-50d62',
  storageBucket: 'urungano-chat-50d62.firebasestorage.app',
  messagingSenderId: '730372170670',
  appId: '1:730372170670:web:91300da03f18f488afde3f'
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);

async function track(user, result) {
  const page = location.pathname.split('/').pop() || 'index.html';
  await fetch('/api/institutions/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ page: result ? undefined : page, result })
  }).catch(() => {});
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  track(user);
  window.addEventListener('urungano:quiz-result', event => track(user, event.detail));
});
