# TODO

## Implement therapy CTA button on `urungano.html`
- [ ] Add header button element (hidden by default) with id `therapy-cta-btn` and localized text.
- [ ] Add Firebase Auth->onAuthStateChanged hook to show/hide button based on login.
- [x] Implement Firestore lookup for latest booking under `users/{uid}/bookings`.

- [ ] Decide CTA label + destination:
  - [ ] If no bookings OR latest not confirmed OR expiry date expired => `booking.html` with label “Book a therapist”.
  - [ ] If latest confirmed AND expiry not reached => `therapychat.html` with label “chat with a therapist”.
- [ ] Test manually by running server and logging in/out.


