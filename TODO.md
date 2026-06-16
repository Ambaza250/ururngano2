# TODO - SRH popup for next period & fertility

- [x] Inspect current SRH logic in `srh.html` for period reminder + savedPeriod loading.

- [x] Implement next-period + fertile-window calculation from `savedPeriod.lmpISO` and `savedPeriod.cycleLength`.

- [x] Add a modal/popup UI that shows:
  - next period date
  - fertile window range
  - (optional) cycle stage text

- [x] Call the popup logic immediately after `loadSavedPeriod()` when user is logged in.

- [x] Ensure language switching (en/rw) is respected.

- [x] Test by signing in, saving a period via calculator, then reloading SRH to confirm popup appears.


