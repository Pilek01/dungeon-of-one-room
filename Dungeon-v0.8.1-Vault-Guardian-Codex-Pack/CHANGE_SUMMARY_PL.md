# Podsumowanie zmian

## Pliki produkcyjne

- `game.js`
  - blokada interakcji z kuframi,
  - Hoard Sentence,
  - Lockdown Pulse,
  - priorytety AI i cooldown slamu,
  - save/load nowych pól,
  - anulowanie efektów po śmierci Guardiana,
  - proceduralny fallback Classic,
  - scenariusz QA.
- `vault-room.js`
  - stałe balansu,
  - inicjalizacja i sanityzacja stanu,
  - wybór celów obu umiejętności,
  - deduplikacja krzyżowych pól Lockdown,
  - reguła rezerwowania dużej akcji.
- `render/visual-snapshot.js`
  - bezpieczne DTO dla targetów i stanu kufrów.
- `render/hd-vfx.js`
  - telegraph Hoard Sentence i Lockdown Pulse.
- `render/hd-renderer-layers.js`
  - HD seal/lock i debris zniszczonego kufra.
- `scenario-overrides.js`
  - `expansion_vault_guardian_hd`.

## Testy

Rozszerzone:

- `tests/vault-room.test.js`
- `tests/visual-snapshot.test.js`
- `tests/hd-vfx.test.js`

## Rozmiar patcha kodu

Według `git diff --stat`:

- 10 zmienionych plików,
- 1105 dodanych linii,
- 47 usuniętych lub zastąpionych linii.

Liczba obejmuje testy, komentarze i puste linie.
