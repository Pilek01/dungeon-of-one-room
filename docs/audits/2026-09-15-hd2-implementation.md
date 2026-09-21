# HD2: wdrożenie prezentacji i ładowania — 2026-09-15

Zakres: pięć pozycji zatwierdzonych przez użytkownika. Zmiany działają w opt-in HD2 (`?hd2=1`). Bez nowej generacji obrazów: wykorzystano istniejące klatki.

## Zrealizowane

- Śmierć NPC i bossów: osobny, ograniczony czasowo rekord wizualny; cztery klatki, końcowe wygaszenie, 480/640 ms. Usunięcie z walki, zwolnienie pola i nagroda pozostają natychmiastowe. Przejście fazy finałowego bossa nie tworzy zwykłego trupa. Rekord zachowuje pozycję prezentacji w trakcie ruchu.
- Zakotwiczenie: niewielka korekta względem nieprzezroczystej dolnej części sprite’a i klatki idle, ograniczona do 3,5% rozmiaru. Ruch i upadek zachowują autorskie przemieszczenia. Obliczenia są buforowane słabo, bez utrzymywania usuniętych obrazów w pamięci.
- Totem: aura pozostaje idle; faktyczny hex/jad uruchamia klatki release 6–8. Renderer HD2 nie wybiera nieistniejącego move. Brak zmiany odporności na wymuszone przesunięcie w logice walki.
- VFX: krople jadu, skrzyżowany znak hexu, krzyż leczenia, diament wzmocnienia, pęknięcie riftu. Cienkie kontury bez wypełniania zagrożonych pól. Leczenie/wzmocnienie/jad mają docelowe współrzędne, niezależne od pozycji rzucającego.
- SFX: ciche proceduralne warstwy kamienia, kości, metalu i magii; lokalny deterministyczny generator nie korzysta z RNG walki. Kompresor prowadzi do istniejącego mastera. Limit sześciu sygnałów/250 ms, z miejscem na magię przy wielu atakach wręcz; deduplikacja per źródło. Dotychczasowe mute i wyciszenie symulacji zachowane.
- Ładowanie: player i podstawowa klatka każdej orientacji NPC przy starcie, pełne pakiety tylko dla potrzebnych typów. Kolejka ogranicza równoległość do limitu loadera. Pakiet trafia do mapy atomowo po walidacji wszystkich klatek. Nieaktywny cache: najwyżej dwa typy; błąd zachowuje idle i ma 10 s odstępu przed ponowną próbą.

## Budżet HD2

| Zestaw | Klatki | PNG | Teoretyczne RGBA |
|---|---:|---:|---:|
| Pełny katalog używany przez runtime | 2144 | 62,61 MiB | 302 MiB |
| Zestaw HD2 przy starcie | 189 | 3,18 MiB | 17,06 MiB |

Wartości dotyczą wyłącznie grafiki HD2, bez pozostałych assetów, narzutu przeglądarki i GPU. Katalog na dysku zawiera również dodatkowe klatki warsztatu (łącznie 2400); nie należy utożsamiać rozmiaru PNG ani obliczenia RGBA z pomiarem RAM procesu.

## Weryfikacja

- `node --test tests/hd2-presentation.test.js tests/hd2-stream.test.js tests/hd2-mix.test.js tests/hd2-npc-audio.test.js tests/hd2-npc-skills.test.js tests/hd2-early-animation.test.js tests/hd2-all-animation.test.js tests/hd-player-motion.test.js tests/hd-renderer.test.js tests/hd-asset-loader.test.js tests/audio-freeze.test.js`: 78 PASS; następnie dodatkowa regresja totema i ponowny test `tests/hd2-npc-skills.test.js`: 6 PASS (łącznie 79 różnych testów).
- `node scripts/verify-hd2-early.mjs`: PASS, 365 sekwencji, realny start i akcje, siedem scenariuszy bossów, brak błędów i 404, sprawdzenie braku preloadu nieobecnych bossów.
- `node scripts/verify-hd2-npc-skills.mjs`: PASS, 12 kierunkowych podglądów, rzeczywiste heal/buff/rift/bash, pudła i mute, 13 sygnałów tonalnych.
- `node scripts/verify-hd2-presentation.mjs`: PASS, natychmiastowe usunięcie i licznik zabicia oraz faktyczny draw drugiej klatki death; sześć nakładających się materiałowych SFX: peak 0,146641, wszystkie próbki skończone.
- `npm run verify:ui-current -- --scenario hd`: PASS, log `output/verification/ui-current-20260915T004424061Z.log`.
- `npm run verify:baseline`: PASS, 4 testy ochrony i pełny scenariusz committed HEAD; log `output/verification/baseline-20260915T003716351Z.log`. Bieżące zmiany HD2 sprawdzają odrębne testy powyżej.
- `node --check`: game.js, render/hd2-actor-stream.js, render/hd2-presentation.js, render/hd2-npc-cues.js, render/hd-renderer.js, render/hd-renderer-layers.js, render/visual-snapshot.js — PASS.

Artefakty: `output/verification/hd2-presentation/result.json`, `death-in-room.png`, `npc-material-mix.wav`. Zrzut obejrzany; jakości odsłuchowej nie oceniano fizycznie. Brak pomiaru wydajności na prawdziwym telefonie.

## Integracja zakończona

Odświeżenie generatora zostało poprzedzone porównaniem w pamięci: różnice dotyczyły wyłącznie pól `sources` w 34 dokumentach oraz pochodnego manifestu. Lokalny manifest ma sumę `sha256:8c5c26851cbf440a62c2c2acf5f168fc13495de6601abd2e9681d6fa0f2d6c32`.

Użytkownik zatwierdził synchronizację. Stała RULESET_HASH w online-v3/ranked-v3-protocol.js wskazuje teraz końcową sumę lokalnego manifestu podaną powyżej. Zmiana nie modyfikuje reguł ani list kompatybilności. Końcowy verify:phase przeszedł: 1153/1153 testów.

## Wynik integracji i ostatnich regresji

- Wcześniejszy przebieg `npm run verify:phase`: FAIL, 1144/1153 PASS. Osiem niepowodzeń dotyczy niezgodnej sumy klienta/manifestu. Dziewiąte było odwołaniem do `window` przy wykonaniu zabicia bez przeglądarki; naprawiono warunkiem środowiska. Log: `output/verification/phase-20260915T003831122Z.log`.
- Po poprawce: `node --test cloudflare/leaderboard-v3/test/ranked-enemy-kill-idempotency.test.js` — 1 PASS, nagroda i zabicie naliczane dokładnie raz. `node --test tests/hd2-presentation.test.js tests/hd-renderer.test.js` — 26 PASS. `node scripts/verify-hd2-presentation.mjs` — ponownie PASS na ostatecznym game.js.
- `node scripts/generate-online-v3-meta-rules.mjs --check` — PASS po ostatecznej poprawce; `node --check game.js` i `node --check render/hd-renderer-layers.js` — PASS.
- `npm run verify:ui-current -- --scenario hd` — ponownie PASS na ostatecznej wersji, log `output/verification/ui-current-20260915T004424061Z.log`.
- Po zgodzie użytkownika zsynchronizowano jedną stałą protokołu z manifestem. Końcowy `npm run verify:phase`: PASS, 1153/1153, generator drift, składnia zmienionych plików JavaScript i whitespace. Log: `output/verification/phase-20260915T005023077Z.log`. Osobne `node --check online-v3/ranked-v3-protocol.js` oraz porównanie sum klienta/manifestu: PASS. Blokada integracji zamknięta.
- Ten etap: 17 plików implementacji, testów, dokumentacji HD2 i protokołu oraz 35 wygenerowanych plików pochodzenia danych (52 pliki). Wcześniejsze zmiany merchanta i układu mutatorów zachowano.
- `git diff --check` — PASS.
