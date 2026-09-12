# Mobile — szczegółowy audyt wizualny i poprawki

Zakres: aktualny lokalny interfejs mobile po redesignie ergonomii. Ocena opiera się na nowych zrzutach wykonanych w tym audycie, nie na poprzednim raporcie. Celem jest spójna, dopracowana oprawa gry fantasy. „10/10” jest kierunkiem jakości, nie obiektywnym certyfikatem.

## Co jest dobre i zostaje

1. Plansza pozostaje głównym elementem ekranu; nic nie zasłania walki.
2. D-pad znajduje się przy prawej krawędzi, a skille pod lewym kciukiem.
3. Plansza w poziomie wykorzystuje niemal całą dostępną wysokość.
4. Boczne paski HP/Shield/Barrier dają ciągłą informację o przeżywalności.
5. Niski HP wyróżnia się zmianą koloru i ramy; nie wymaga odczytania małej liczby.
6. Paleta świata i ciemny bohater pasują do dungeon crawlera. Nie wymagają rozjaśniania.
7. Istniejące ilustracje skilli, reliktów i kuźni mają własny charakter i nadają się do ponownego użycia.
8. Portal przedstawia trzy zrozumiałe decyzje; powrót do campu nie zaśmieca walki.
9. Emergency extract jest odseparowane od codziennych akcji i pokazuje koszt.
10. Znaczenie rzadkości reliktu jest przekazywane kolorem oraz podpisem.
11. Domyślna koncentracja klawiatury na Stay/Resume jest bezpieczna.
12. Można grać w pionie; poziom i pełny ekran pozostają najbardziej przestronne.

## Lista problemów przed poprawkami

| Nr | Ekran / dowód | Co obniża jakość | Poprawka / warunek odbioru |
|---|---|---|---|
| 1 | Rozgrywka, final-landscape.png | Ikony 25 px i nazwy 10 px wyglądają jak miniatury. | Ikony 34 px w normalnym poziomie, nazwy co najmniej 11 px, mocniejsze statusy. |
| 2 | Rozgrywka | Przyciski są płaskie i prawie jednakowe; słabo przypominają wyposażenie gry. | Żelazne powierzchnie, cień, delikatny kolor skilla, spójne narożniki. |
| 3 | Rozgrywka | Nieaktywny Elixir ma obniżoną czytelność całego przycisku. | Wygaszona ilustracja i rama, czytelny napis NONE. |
| 4 | Rozgrywka | D-pad ma małe strzałki i mało wyraziste wciśnięcie. | Większe strzałki, spokojniejsze centrum, wyraźne naciśnięcie. |
| 5 | Pion, final-portrait.png | Złoto jest samotną liczbą obok Fury, bez podpisu. | Stały widoczny podpis złota, osobne grupy zasobów. |
| 6 | Pion | Małe przyciski są rozproszone na dużym tle; brakuje rytmu odstępów. | Większy blok skilli i zrównoważone odległości od planszy, bez nowych ozdobnych paneli. |
| 7 | Tło / rama planszy | Wyrazista powtarzalna tekstura konkuruje z planszą. | Ciemniejsza tekstura tła, cienka spójna rama i subtelna głębia. |
| 8 | Portal, final-portal.png | Okno jest czytelne, ale wizualnie bliższe formularzowi niż grze. | Ilustracja portalu z zasobów gry, bardziej zdecydowana hierarchia i akcent celu. |
| 9 | Menu runu, final-run-menu.png | Dolne opcje są poza widokiem nawet przy 915×412. | Siatka w poziomie: wszystkie decyzje widoczne bez przewijania w tym rozmiarze. |
| 10 | Szczegóły, final-details.png | Nagłówek świata nachodzi na panel Player. | Osobna, nieprzezroczysta powierzchnia; nagłówek rozgrywki ukryty; wyraźne Close. |
| 11 | Menu gry, final-game-menu.png | Wąska kolumna, zbędna gruba rama, drobny podtytuł. | Wykorzystanie szerokości w poziomie, wspólna typografia i cieńsze obramowanie. |
| 12 | Emergency, final-emergency.png | Potwierdzenie opuszczenia gry jest wizualnie równie neutralne jak anulowanie. | Ostrzegawczy akcent akcji opuszczenia i lepiej czytelny koszt, bez zmiany kosztu. |
| 13 | Camp, final-camp.png | Ikony, ceny i tekst mieszają kilka skali/fontów. | Spójny font treści, wyraźna cena i poziom, czytelne zakładki. |
| 14 | Kuźnia, forge-landscape/portrait.png | Opis 8 px; w pionie dwie ogromne karty z pustym wnętrzem. | Opis minimum 12 px, kompaktowe karty, czytelny stan zablokowany. |
| 15 | Sklep, merchant-portrait.png | Nazwy i badge rzadkości są ucinane; statystyki stłoczone. | Zawijanie nazwy i badge, osobna kolumna ceny, większa typografia. |
| 16 | Relikty, reward-landscape.png | Olbrzymia ilustracja pierwszej karty wypycha opis i pozostałe nagrody. | Trzy równorzędne karty w poziomie, ograniczona ilustracja, widoczny opis i Skip. |
| 17 | Relikty, reward-portrait.png | Wielka rama otacza pustą dolną połowę. | Wysokość dopasowana do treści, konsekwentne odstępy i ilustracje. |
| 18 | Porażka, defeat-landscape.png | Etykiety zlewają się z liczbami i opisami przycisków. | Osobne wiersze/kolumny, dominujący tytuł, wydzielone akcje. |
| 19 | Porażka, defeat-portrait.png | Przypadkowo wielkie pionowe przerwy między blokami. | Zwarta kompozycja podsumowania, bez pustych wypełniaczy. |
| 20 | Start campu, camp-start-portrait.png | Długa lista głębokości przypomina tabelę tekstową; słaby wybór. | Karty głębokości, wyraźny wybrany stan, zwarta siatka. |
| 21 | Wszystkie okna | Georgia, monospace i system-ui są mieszane bez wspólnej hierarchii. | Georgia dla tytułów, czytelny systemowy sans dla opisów i wartości. |
| 22 | Wszystkie okna | Grube wielokrotne ramy zużywają miejsce. | Wspólna cienka rama, zachowane oryginalne ilustracje; ograniczony ornament. |

## Dowody

Wszystkie wymienione obrazy zostały otwarte i obejrzane. Pliki przed zmianami: output/verification/mobile-visual-audit/before/. Pliki po zmianach: output/verification/mobile-visual-audit/after/.

Sekwencja audytu: 1 rozgrywka w poziomie, 2 pion, 3 niski HP, 4 portal, 5 menu runu, 6 szczegóły, 7 menu gry, 8 emergency, 9 camp, 10 kuźnia, 11 sklep, 12 nagrody, 13 porażka, 14 start campu. Każdy krok otrzyma ocenę końcową po porównaniu.

## Weryfikacja i ograniczenia

Przed zmianą test czytelności faktycznie zakończył się FAIL: nazwy przycisków miały 10 px. Pozostałe problemy potwierdzono na zrzutach i przez pomiary DOM. Nie zmieniamy zasad walki, nagród, Ranked ani grafik bohaterów. Wyniki finalne znajdują się poniżej. Emulacja przeglądarki nie jest testem fizycznego telefonu ani gwarancją pełnej dostępności.


## Wynik wdrożenia

Wdrożono poprawki ze wszystkich 22 pozycji. Zmieniono 6 plików: style-mobile-v2.css, render/mobile-experience.js (jedynie oznaczenie rodzaju okna dla stylów), scripts/verify-mobile-v2.mjs, scripts/audit-mobile-visual.mjs, ten raport i progress.md. Kod walki, nagród, metadane reguł i aktywne powiązania Ranked nie były modyfikowane w tym audycie.

| Etap | Ocena końcowa | Co sprawdzono |
|---|---|---|
| 1. Rozgrywka pozioma | Poprawiony | Duża plansza, prawy D-pad, większe ikony i podpisy; brak zasłaniania planszy. |
| 2. Rozgrywka pionowa | Poprawiony | Podpis złota, większy blok skilli, zbalansowane odstępy. |
| 3. Niskie HP | Dobry, zachowany | Liczba, wypełnienie paska, kolor i rama; także wartości Shield/Barrier. |
| 4. Portal | Poprawiony | Oryginalna ilustracja portalu, hierarchia decyzji i bezpieczne anulowanie. |
| 5. Menu runu | Poprawiony | Wszystkie opcje mieszczą się przy 915×412, działają akcje i blokada wejścia w tle. |
| 6. Szczegóły gracza | Naprawiony | Nagłówek świata nie nachodzi na treść; osobne czytelne okno i Close. |
| 7. Menu gry | Poprawiony | Pełna szerokość siatki, czytelne opisy, spójny materiał i ramy. |
| 8. Emergency extract | Poprawiony | Ostrzegawczy wygląd i widoczny istniejący koszt; anulowanie nie wydaje złota. |
| 9. Camp | Poprawiony | Ceny, oznaczenia rzadkości i zakładki; stopka ma własne miejsce poniżej przewijanej listy. |
| 10. Kuźnia | Naprawiony | Opis minimum 12 px, zwarte karty, brak pustej kolumny. |
| 11. Sklep | Poprawiony | Nazwy i rzadkości mieszczą się, osobna cena. |
| 12. Nagrody | Naprawiony | Trzy widoczne oferty i Skip w poziomie; czytelne karty w pionie. |
| 13. Porażka | Naprawiony | Oddzielne etykiety/liczby, zwarty układ; brak klawiszy R/Esc na przyciskach dotykowych. |
| 14. Wybór głębokości | Poprawiony | Dwukolumnowa siatka, oznaczenie Selected nie nachodzi na nazwę; akcje minimum 48 px. |

Żaden etap nie otrzymuje automatycznie „10/10”. Kryteria tego audytu są sprawdzalne: brak nakładania tekstu, właściwa skala ilustracji, widoczne decyzje, czytelna hierarchia, spójne materiały i zachowane działanie. Komfort na fizycznym telefonie i indywidualna ocena estetyki pozostają do oceny przez gracza.

## Dokładne kontrole

- PASS 30/30: node --test tests/mobile-v1.test.js tests/mobile-repair-pass.test.js tests/mobile-hd-remake.test.js tests/mobile-gothic-ui.test.js tests/mobile-preview-build-metadata.test.mjs tests/mobile-v2-journey.test.js.
- PASS: node scripts/verify-mobile-v2.mjs --visual-polish --out=output/verification/mobile-visual-audit/after — sześć rozmiarów mobile, desktop, menu/portal/camp, fullscreen, wartości pasków i nowe warunki czytelności.
- PASS: node scripts/audit-mobile-visual.mjs --visual-polish --out=output/verification/mobile-visual-audit/after — 12 ekranów w pionie i poziomie, rzeczywiste pomiary ofert/opisów/stopek oraz brak błędów strony.
- PASS: node scripts/audit-mobile-visual.mjs --visual-polish --camp-only --out=output/verification/mobile-visual-audit/final-camp — 2 ujęcia po ostatniej korekcie rzadkości w campie.
- PASS: npm run verify:ui-current -- --scenario hd.
- PASS: npm run verify:ranked-headed -- --scenario camp.
- PASS: npm run verify:baseline — chroniony HEAD 5242be0, log output/verification/baseline-20260912T060615361Z.log. Osobny test bieżącego drzewa sprawdził też desktop.
- PASS: npm run verify:guard — 15/15, generator, składnia i whitespace; log output/verification/guard-20260912T060457842Z.log.
- PASS: node --check render/mobile-experience.js; node --check scripts/verify-mobile-v2.mjs; node --check scripts/audit-mobile-visual.mjs.
- PASS: zainstalowany develop-web-game web_game_playwright_client.js, 2 iteracje, actions-file tools/hd2-preview/actions.json, pause-ms 15000. Dowody w output/verification/mobile-visual-audit/game-client/.
- git diff --check — końcowa kontrola zmian.

Test campu zamyka pierwszy przewodnik przed oceną właściwego ekranu. Wcześniejsze pliki camp-landscape/portrait w katalogu before pokazują przewodnik, dlatego dowodem wyglądu wcześniejszego campu jest final-camp.png. Końcowe oznaczenia rzadkości pokazuje katalog final-camp. Nie porównujemy różnych ekranów jako rzekomo tego samego stanu.

### Rozgrywka pozioma — przed / po

![Przed — Rozgrywka pozioma](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/final-landscape.png>)

![Po — Rozgrywka pozioma](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/final-landscape.png>)

### Pion — przed / po

![Przed — Pion](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/final-portrait.png>)

![Po — Pion](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/final-portrait.png>)

### Menu runu — przed / po

![Przed — Menu runu](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/final-run-menu.png>)

![Po — Menu runu](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/final-run-menu.png>)

### Szczegóły gracza — przed / po

![Przed — Szczegóły gracza](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/final-details.png>)

![Po — Szczegóły gracza](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/final-details.png>)

### Camp — przed / po

![Przed — Camp](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/final-camp.png>)

![Po — Camp](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/final-camp.png>)

### Kuźnia — przed / po

![Przed — Kuźnia](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/forge-portrait.png>)

![Po — Kuźnia](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/forge-portrait.png>)

### Nagrody poziomo — przed / po

![Przed — Nagrody poziomo](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/reward-landscape.png>)

![Po — Nagrody poziomo](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/reward-landscape.png>)

### Porażka — przed / po

![Przed — Porażka](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/defeat-portrait.png>)

![Po — Porażka](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/defeat-portrait.png>)

### Start campu — przed / po

![Przed — Start campu](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/before/camp-start-portrait.png>)

![Po — Start campu](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-visual-audit/after/camp-start-portrait.png>)
