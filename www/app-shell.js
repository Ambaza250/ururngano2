(() => {
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isAuthPage = page === 'auth.html' || page === 'index.html';
  const labels = {
    srh: { en: 'SRH', rw: 'SRH', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z"/><path d="M7 12h3l1.5-3 2.5 6 1.5-3H18"/></svg>', href: 'srh.html' },
    mental: { en: 'Mental Health', rw: 'Mental Health', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 0-5 2.2A3.5 3.5 0 0 0 4.5 13 3.5 3.5 0 0 0 9 19V4Zm6 0a3 3 0 0 1 5 2.2 3.5 3.5 0 0 1-.5 6.8A3.5 3.5 0 0 1 15 19V4ZM9 8h2m2 0h2m-6 5h2m2 0h2m-6 4h2m2 0h2"/></svg>', href: 'mental-health.html' },
    peers: { en: 'Chat with peers', rw: 'Chat with peers', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-4-.9L4 20l1.2-3.5A7 7 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>', href: 'chat.html' },
    therapist: { en: 'Chat with therapist', rw: 'Chat with therapist', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 6-7 10-7 10Z"/><path d="M12 9v6m-3-3h6"/></svg>', href: 'therapychat.html' }
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
  const asDate = value => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.toMillis === 'function') return new Date(value.toMillis());
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const openTherapistArea = async () => {
    const bookingPage = 'booking.html';
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js')
      ]);
      const config = { apiKey: 'AIzaSyDy9ZCOQQIMnq6GOOnSS3Hk3IMSk06jTf4', authDomain: 'urungano-chat-50d62.firebaseapp.com', projectId: 'urungano-chat-50d62', storageBucket: 'urungano-chat-50d62.firebasestorage.app' };
      const app = appMod.getApps()[0] || appMod.initializeApp(config);
      const user = authMod.getAuth(app).currentUser;
      if (!user) return location.assign('auth.html');
      const db = fsMod.getFirestore(app);
      const bookings = fsMod.collection(db, 'users', user.uid, 'bookings');
      let latest = null;
      try {
        const ordered = await fsMod.getDocs(fsMod.query(bookings, fsMod.orderBy('createdAt', 'desc'), fsMod.limit(1)));
        if (!ordered.empty) latest = ordered.docs[0].data();
      } catch (_) { /* Some older bookings have no sortable createdAt. */ }
      if (!latest) {
        const snapshot = await fsMod.getDocs(fsMod.query(bookings, fsMod.limit(10)));
        snapshot.forEach(doc => {
          const candidate = doc.data();
          if (!latest || (asDate(candidate.createdAt)?.getTime() || 0) > (asDate(latest.createdAt)?.getTime() || 0)) latest = candidate;
        });
      }
      const payment = latest?.payment || {};
      const confirmed = latest?.status === 'confirmed' || payment.confirmed === true;
      const expiry = asDate(payment.expiryDate ?? payment.expiry_date ?? latest?.expiryDate ?? latest?.expiry_date);
      if (confirmed && (!expiry || expiry >= new Date())) return location.assign('therapychat.html');
    } catch (error) {
      console.warn('Could not check therapist booking; opening therapist selection.', error);
    }
    location.assign(bookingPage);
  };
  const mount = () => {
    document.querySelectorAll('nav, footer').forEach(node => node.remove());
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `<a class="app-brand" href="urungano.html" aria-label="Urungano home"><img src="urungano-logo.jpeg" alt=""><span>Urungano</span></a><div class="app-header-actions">${page === 'urungano.html' ? '<a class="app-account" href="account.html" hidden data-en="Manage account" data-rw="Konti yanjye">Konti yanjye</a>' : ''}<div class="app-language" aria-label="Language"><button type="button" data-lang="rw">RW</button><button type="button" data-lang="en">EN</button></div></div>`;
    document.body.prepend(header);
    const bottom = document.createElement('nav');
    bottom.className = 'app-bottom-nav'; bottom.setAttribute('aria-label', 'Main navigation');
    bottom.innerHTML = Object.entries(labels).map(([key, item]) => `<a href="${item.href}" class="${key === active ? 'is-active' : ''}" data-nav="${key}"><span class="nav-icon" aria-hidden="true">${item.icon}</span><span data-en="${item.en}" data-rw="${item.rw}">${item.rw}</span></a>`).join('');
    document.body.append(bottom);
    bottom.querySelector('[data-nav="therapist"]')?.addEventListener('click', event => {
      event.preventDefault();
      openTherapistArea();
    });
    header.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
    const sectionOrder = ['srh', 'mental', 'peers', 'therapist'];
    let startX = 0, startY = 0;
    document.addEventListener('touchstart', event => { startX = event.changedTouches[0].clientX; startY = event.changedTouches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', event => {
      const dx = event.changedTouches[0].clientX - startX, dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.35 || event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
      const index = sectionOrder.indexOf(active);
      if (index < 0) return;
      const next = sectionOrder[index + (dx < 0 ? 1 : -1)];
      if (next) location.assign(labels[next].href);
    }, { passive: true });
    renderLanguage(getLanguage());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  if (!isAuthPage) {
    window.addEventListener('load', () => import('https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js').then(async appMod => {
      const authMod = await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js');
      const config = { apiKey: 'AIzaSyDy9ZCOQQIMnq6GOOnSS3Hk3IMSk06jTf4', authDomain: 'urungano-chat-50d62.firebaseapp.com', projectId: 'urungano-chat-50d62', storageBucket: 'urungano-chat-50d62.firebasestorage.app' };
      const app = appMod.getApps()[0] || appMod.initializeApp(config);
      authMod.onAuthStateChanged(authMod.getAuth(app), user => {
        if (!user) location.replace('auth.html');
        document.querySelector('.app-account')?.toggleAttribute('hidden', !user);
      });
    }).catch(() => location.replace('auth.html')), { once: true });
  }
})();
