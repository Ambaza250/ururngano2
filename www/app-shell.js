(() => {
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isAuthPage = page === 'auth.html' || page === 'index.html';
  const labels = {
    srh: { en: 'SRH', rw: 'SRH', icon: '♥', href: 'srh.html' },
    mental: { en: 'Mental Health', rw: 'Mental Health', icon: '♧', href: 'mental-health.html' },
    peers: { en: 'Chat with peers', rw: 'Chat with peers', icon: '☷', href: 'chat.html' },
    therapist: { en: 'Chat with therapist', rw: 'Chat with therapist', icon: '✦', href: 'therapychat.html' }
  };
  const active = page === 'srh.html' ? 'srh' : page === 'mental-health.html' ? 'mental' : page === 'chat.html' ? 'peers' : page === 'therapychat.html' || page === 'booking.html' ? 'therapist' : '';
  const getLanguage = () => localStorage.getItem('urungano-language') || document.documentElement.lang || 'rw';
  const renderLanguage = lang => {
    document.documentElement.lang = lang;
    document.body?.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-en]').forEach(el => { const value = el.getAttribute(`data-${lang}`); if (value) el.textContent = value; });
    document.querySelectorAll('.app-language button').forEach(button => button.classList.toggle('is-active', button.dataset.lang === lang));
  };
  const setLanguage = lang => {
    localStorage.setItem('urungano-language', lang);
    if (typeof window.switchLanguage === 'function' && !window.__appShellSwitching) {
      window.__appShellSwitching = true;
      window.switchLanguage(lang);
      window.__appShellSwitching = false;
    }
    renderLanguage(lang);
    window.dispatchEvent(new CustomEvent('urungano-language-change', { detail: { lang } }));
  };
  const mount = () => {
    document.querySelectorAll('nav, footer, #ai-avatar').forEach(node => node.remove());
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `<a class="app-brand" href="urungano.html" aria-label="Urungano home"><img src="urungano-logo.jpeg" alt=""><span>Urungano</span></a><div class="app-language" aria-label="Language"><button type="button" data-lang="rw">RW</button><button type="button" data-lang="en">EN</button></div>`;
    document.body.prepend(header);
    const bottom = document.createElement('nav');
    bottom.className = 'app-bottom-nav'; bottom.setAttribute('aria-label', 'Main navigation');
    bottom.innerHTML = Object.entries(labels).map(([key, item]) => `<a href="${item.href}" class="${key === active ? 'is-active' : ''}" data-nav="${key}"><span class="nav-icon" aria-hidden="true">${item.icon}</span><span data-en="${item.en}" data-rw="${item.rw}">${item.rw}</span></a>`).join('');
    document.body.append(bottom);
    header.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
    renderLanguage(getLanguage());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  if (!isAuthPage) {
    window.addEventListener('load', () => import('https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js').then(async appMod => {
      const authMod = await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js');
      const config = { apiKey: 'AIzaSyDy9ZCOQQIMnq6GOOnSS3Hk3IMSk06jTf4', authDomain: 'urungano-chat-50d62.firebaseapp.com', projectId: 'urungano-chat-50d62', storageBucket: 'urungano-chat-50d62.firebasestorage.app' };
      const app = appMod.getApps()[0] || appMod.initializeApp(config);
      authMod.onAuthStateChanged(authMod.getAuth(app), user => { if (!user) location.replace('auth.html'); });
    }).catch(() => location.replace('auth.html')), { once: true });
  }
})();
