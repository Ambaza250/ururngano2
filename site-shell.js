(function () {
  const langKey = 'urungano_language';
  const header = `
    <header class="urungano-site-header">
      <nav class="urungano-nav" aria-label="Main navigation">
        <a class="urungano-brand" href="/urungano" aria-label="Urungano home"><img src="/urungano-logo.jpeg" alt=""><span>Urungano</span></a>
        <div class="urungano-header-controls">
          <div class="urungano-language" aria-label="Choose language">
            <button type="button" data-language="rw" id="site-lang-rw">RW</button>
            <button type="button" data-language="en" id="site-lang-en">EN</button>
          </div>
          <a class="urungano-profile" id="site-account-link" href="/auth" aria-label="Account" title="Account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg></a>
          <button type="button" class="urungano-menu-toggle" id="site-menu-toggle" aria-label="Open menu" title="Open menu" aria-expanded="false" aria-controls="site-mobile-menu" style="display:inline-flex">☰</button>
        </div>
        <div class="urungano-mobile-menu" id="site-mobile-menu">
          <a href="/chat" data-site-auth-action="peers" hidden data-en="Chat with peers" data-rw="Ganira n’urungano">Ganira n’urungano</a>
          <a href="/therapychat" data-site-auth-action="therapist-chat" hidden data-en="Chat with a therapist" data-rw="Ganira n’umujyanama">Ganira n’umujyanama</a>
          <a href="/booking" data-site-auth-action="therapist-booking" hidden data-en="Book a therapist" data-rw="Tegura umujyanama">Tegura umujyanama</a>
          <a href="/srh" data-en="SRH services" data-rw="Ubuzima bw’imyororokere">Ubuzima bw’imyororokere</a>
          <a href="/mental-health" data-en="Mental health" data-rw="Ubuzima bwo mu mutwe">Ubuzima bwo mu mutwe</a>
          <a href="/about-us" data-en="About us" data-rw="Ibitwerekeye">Ibitwerekeye</a>
        </div>
      </nav>
    </header>`;
  const shangaziWidget = `
    <details id="whatsapp-shangazi" class="whatsapp-widget">
      <summary class="whatsapp-toggle" aria-label="Baza Shangazi on WhatsApp" title="Baza Shangazi">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </summary>
      <div class="whatsapp-panel">
        <p class="whatsapp-title"><span data-en="Ask Shangazi" data-rw="Baza Shangazi">Baza Shangazi</span></p>
        <p class="whatsapp-desc"><span data-en="Chat with Shangazi on WhatsApp for friendly guidance." data-rw="Ganira na Shangazi kuri WhatsApp ugire ubufasha bwizewe.">Ganira na Shangazi kuri WhatsApp ugire ubufasha bwizewe.</span></p>
        <a class="whatsapp-btn" href="https://wa.me/250786561823" target="_blank" rel="noopener noreferrer"><span data-en="Chat on WhatsApp" data-rw="Ganira kuri WhatsApp">Ganira kuri WhatsApp</span></a>
      </div>
    </details>`;

  function applyLanguage(lang) {
    lang = lang === 'en' ? 'en' : 'rw';
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
    document.querySelectorAll('[data-en][data-rw]').forEach(element => {
      const translated = element.getAttribute(`data-${lang}`);
      const directText = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
      if (directText) directText.nodeValue = ` ${translated} `;
      else if (!element.childElementCount) element.textContent = translated;
    });
    document.querySelectorAll('[data-placeholder-en][data-placeholder-rw]').forEach(element => {
      element.placeholder = element.getAttribute(`data-placeholder-${lang}`);
    });
    document.querySelectorAll('[data-language]').forEach(button => button.classList.toggle('active', button.dataset.language === lang));
    try { localStorage.setItem(langKey, lang); } catch (_) {}
    window.dispatchEvent(new CustomEvent('urungano-language-change', { detail: { lang } }));
  }

  document.body.insertAdjacentHTML('afterbegin', header);
  document.querySelectorAll('body > nav').forEach(nav => { if (!nav.classList.contains('urungano-nav')) nav.hidden = true; });
  document.querySelectorAll('body > header').forEach(existing => { if (!existing.classList.contains('urungano-site-header')) existing.hidden = true; });
  document.body.insertAdjacentHTML('beforeend', shangaziWidget);
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
  const toggle = document.getElementById('site-menu-toggle');
  import('https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js').then(async appMod => {
    const authMod = await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js');
    const app = appMod.getApps()[0] || appMod.initializeApp({apiKey:'AIzaSyDy9ZCOQQIMnq6GOOnSS3Hk3IMSk06jTf4',authDomain:'urungano-chat-50d62.firebaseapp.com',projectId:'urungano-chat-50d62',storageBucket:'urungano-chat-50d62.firebasestorage.app',messagingSenderId:'730372170670',appId:'1:730372170670:web:91300da03f18f488afde3f'});
    let authGeneration = 0;
    authMod.onAuthStateChanged(authMod.getAuth(app), user => {
      const generation = ++authGeneration;
      const account = document.getElementById('site-account-link');
      account.href = user ? '/account' : '/auth'; account.title = user ? (window.siteText('Account','Konti')) : (window.siteText('Sign in','Injira'));
      const peersLink = document.querySelector('[data-site-auth-action="peers"]');
      const bookingLink = document.querySelector('[data-site-auth-action="therapist-booking"]');
      const therapistChatLink = document.querySelector('[data-site-auth-action="therapist-chat"]');
      peersLink.hidden = !user;
      bookingLink.hidden = true;
      therapistChatLink.hidden = true;
      if (!user) return;

      (async () => {
        let hasConfirmedBooking = false;
        try {
          const fsMod = await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js');
          const db = fsMod.getFirestore(app);
          const bookings = await fsMod.getDocs(fsMod.collection(db, 'users', user.uid, 'bookings'));
          hasConfirmedBooking = bookings.docs.some(doc => {
            const booking = doc.data() || {};
            return booking.status === 'confirmed' || booking.payment?.confirmed === true;
          });
        } catch (_) {
          // Keep the booking option available if booking status cannot be checked.
        }
        if (generation !== authGeneration) return;
        therapistChatLink.hidden = !hasConfirmedBooking;
        bookingLink.hidden = hasConfirmedBooking;
      })();
    });
  }).catch(() => {});
  toggle.addEventListener('click', () => {
    const menu = document.getElementById('site-mobile-menu');
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', event => {
    const menu = document.getElementById('site-mobile-menu');
    if (!event.target.closest('.urungano-nav') && menu.classList.contains('open')) {
      menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    }
  });
  window.switchSiteLanguage = applyLanguage;
  window.siteLanguage = () => document.body.dataset.lang || 'rw';
  window.siteText = (english, kinyarwanda) => window.siteLanguage() === 'en' ? english : kinyarwanda;
  const preferred = (() => { try { return localStorage.getItem(langKey) || document.body.dataset.lang || 'rw'; } catch (_) { return document.body.dataset.lang || 'rw'; } })();
  applyLanguage(preferred);
})();
