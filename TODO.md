# TODO

## Implement therapy CTA button on `urungano.html`
- [ ] Add header button element (hidden by default) with id `therapy-cta-btn` and localized text.
- [ ] Add Firebase Auth->onAuthStateChanged hook to show/hide button based on login.
- [x] Implement Firestore lookup for latest booking under `users/{uid}/bookings`.

- [ ] Decide CTA label + destination:
  - [ ] If no bookings OR latest not confirmed OR expiry date expired => `booking.html` with label “Book a therapist”.
  - [ ] If latest confirmed AND expiry not reached => `therapychat.html` with label “chat with a therapist”.
- [ ] Test manually by running server and logging in/out.

---

## Therapist booking + restricted therapy chat
- [x] Update `booking.html`: load all therapists from Firestore and display therapist profile cards with a “Book this therapist” button.
- [x] Update `booking.html`: on payment, write booking fields `therapistUid` and `therapistName` to `users/{uid}/bookings/{bookingId}`.
- [x] Update `therapychat.html` (user mode only): load ONLY the therapist from the latest confirmed booking; block other therapists.

- [ ] Manual test: book -> payment write -> therapy chat sidebar should show exactly one therapist.


