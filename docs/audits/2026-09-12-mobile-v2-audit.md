# Audyt i redesign mobile — 2026-09-12

Zakres: interfejs dotykowy i przebieg decyzji gracza na telefonie, na podstawie
aktualnej gry oraz zrzutu dostarczonego przez użytkownika. Użytkownik dał swobodę
projektową. Zmiany dotyczą 45 plików: 10 plików interfejsu, narzędzi i dokumentacji
oraz 35 wygenerowanych plików metadanych źródła. Wcześniejszy HD2 zachowany.

## Audyt przed zmianą

1. **Rozgrywka w poziomie — wymagała poprawy.** W aktualnym przechwyceniu
   915×412 plansza miała 340,69×340,69 px. D-pad kończył się na x=698,28,
   czyli 216,72 px od prawej krawędzi. Paski HP w panelu miały 9 px wysokości.
   Ozdobne ramy i wspólny panel sterowania ograniczały zasięg prawego kciuka.
2. **Niskie okno z paskiem przeglądarki — wymagało poprawy.** Przy 844×288
   kontrolki były stłoczone obok dekoracyjnego panelu; rzadko używany Extract
   stale zajmował miejsce. Zrzut użytkownika pokazuje ponadto około 26% wysokości
   zajętej przez system/przeglądarkę. To nie jest element DOM gry.
3. **Pion — wymagał poprawy.** Rozbudowana sekcja statusu, drobne wskaźniki,
   duże odstępy i D-pad po lewej. Za małe napisy i kosztowna wizualnie rama.
4. **Portal i emergency extract — wymagały zmiany przepływu.** Samo wejście
   w portal nie przedstawiało wyboru celu. Wyjście było stałą akcją w doku,
   mimo że potrzebne jest dopiero przy kończeniu runu lub odwrocie.

Zachowane mocne strony: mroczna paleta, czytelny kwadratowy świat gry, istniejące
ikony umiejętności, czytelna tożsamość fantasy i mechanika tur.

## Wdrożony układ i zachowanie

- W poziomie skille/zużywalne zasoby są pod lewym kciukiem, D-pad pod prawym.
  Plansza jest pomiędzy nimi. Przy 915×412 ma 396×396 px: około 35% większą
  powierzchnię. D-pad kończy się 12 px od prawej krawędzi, z uwzględnieniem safe area.
- Pionowe paski HP, Shield i Barrier korzystają z tych samych danych co PC.
  HP ma pełną wysokość planszy, bieżącą/maksymalną wartość i wyraźny stan poniżej
  30%. Nie trzeba odczytywać miniaturowych pasków w panelu bocznym.
- Cieńsze ramy, większe pola trafienia, osobne ikony/nazwy/statusy, widoczne
  odnowienie i uzbrojenie Dasha. Wszystkie sprawdzone kontrolki mają minimum 44×44 px.
- Środek D-pada pozostaje nieaktywny. Ruch nadal kardynalny; nie zmienia
  prędkości, obrażeń, cooldownów ani liczby tur. Test wykrył brak samodzielnej
  akcji Wait w grze; usunięto przycisk przed zakończeniem prac.
- Interact pojawia się tylko przy obiekcie, z którym można wejść w interakcję.
  Stały Extract znika. Stats przeniesione do menu runu.
- **Portal — poprawny:** wejście po oczyszczeniu pokoju otwiera Descend deeper,
  Go to camp i Stay in this room. Stay jest bezpiecznym wyborem dla klawiatury.
  Po anulowaniu okno nie wraca samo do czasu ponownego wejścia. Aktywny Observer
  Bot nie dostaje tego okna. Portal czeka na zakończenie innych okien/nagród Ranked.
- **Menu runu — poprawne:** Resume, Player details, Full screen, Emergency
  extract/Return to camp i Game menu. Działania w tle są blokowane podczas okna.
- **Awaryjne wyjście — poprawne:** pozycja w menu prowadzi do istniejącego
  potwierdzenia utraty złota. Samo otwarcie i anulowanie nic nie kosztuje.
- **Camp — poprawny:** istniejący przepływ bankowania/nagród i ulepszeń,
  większe napisy i pola dotyku. Nie zmieniono kosztów, nagród ani zasad Ranked.
- Full screen korzysta z click-initiated Fullscreen API. Odrzucenie/nieobsługiwanie
  pokazuje wskazówkę zamiast blokować grę. Pion i niski viewport nadal działają.

Przeglądarka wymaga gestu użytkownika dla pełnego ekranu. CSS nie może wyłączyć
paska adresu. Źródło: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
Dodano metadane uruchamiania z ekranu głównego iPhone'a. Nie dodawano cache ani
service workera do wersji Ranked.

## Dowody wizualne

Zrzuty zostały przechwycone i otwarte w tym audycie. Pełne pliki są lokalnie:

- output/verification/mobile-v2/before-landscape.png
- output/verification/mobile-v2/before-browser-chrome.png
- output/verification/mobile-v2/before-portrait.png
- output/verification/mobile-v2/final-landscape.png
- output/verification/mobile-v2/final-browser-chrome.png
- output/verification/mobile-v2/final-portrait.png
- output/verification/mobile-v2/final-low-health.png
- output/verification/mobile-v2/final-portal.png
- output/verification/mobile-v2/final-run-menu.png
- output/verification/mobile-v2/final-emergency.png
- output/verification/mobile-v2/final-camp.png
- output/verification/mobile-v2/final-desktop.png

Camp został przechwycony po zakończeniu przejścia, aby nie używać klatki fade-in
jako dowodu. Zrzuty nie zastępują testu zasięgu kciuków na fizycznym urządzeniu.

## Weryfikacja

- node --test tests/mobile-v1.test.js tests/mobile-repair-pass.test.js tests/mobile-hd-remake.test.js tests/mobile-gothic-ui.test.js tests/mobile-preview-build-metadata.test.mjs tests/mobile-v2-journey.test.js — 30/30 PASS.
- node scripts/verify-mobile-v2.mjs — sześć rozmiarów mobile/tablet i desktop,
  brak przepełnienia i zasłaniania planszy, side rails, pola dotyku, ruch/portal,
  anulowanie/reentry, descent, camp, emergency cancel, Dash, blokada wejścia
  w menu, szczegóły gracza, rzeczywiste wejście/wyjście z pełnego ekranu oraz
  odmowa fullscreen. Potwierdzono też rzeczywistą wysokość trzech wypełnień
  po zakończeniu animacji wskaźników. Pełny wynik w result.json.
- node --test tests/pages-test-build-metadata.test.mjs — PASS. Potwierdza też
  automatyczne pobieranie commit/date i obecność każdego skryptu wskazanego w HTML.
- Zainstalowany develop-web-game Playwright client: 2 iteracje, pauzy 15000 ms,
  actions.json; stan gry i shot-1.png sprawdzone.
- npm run verify:ui-current -- --scenario hd — PASS.
- npm run verify:ranked-headed -- --scenario camp — PASS.
- npm run verify:baseline — PASS, chroniony commit 5242be0; nie jest testem
  niecommitowanego HD2. Osobny bieżący test desktop potwierdził brak nowego portalu.
- npm run verify:guard — PASS, 15/15, generator i składnia.
- npm run verify:phase — 1141/1149 PASS, 8 FAIL wyłącznie w powiązaniu
  lokalnego kandydata z aktywnym wydaniem Ranked. Log:
  output/verification/phase-20260912T053358948Z.log. Żadne asercje, allowlista
  ani aktywne deskryptory nie zostały osłabione.
- node scripts/generate-online-v3-meta-rules.mjs --check, node --check dla
  zmienionych JS i git diff --check — PASS.
- Porównanie 35 JSON-ów z pominięciem tylko sha256/byteLength/rulesetHash:
  brak zmian kanonicznych reguł gry.

Testowy build Pages wcześniej pomijał niecommitowane moduły w katalogu render.
Teraz target test obejmuje nieignorowane pliki bieżącego runtime assets/render/
online-v3. Release zachowuje dotychczasową granicę plików śledzonych przez Git.
Wcześniejszy pojedynczy błąd testu idempotencji był kolizją dwóch procesów budowy
tego samego katalogu; osobny test przeszedł. Kontrole budujące pages-test-dist
trzeba uruchamiać kolejno.

## Ograniczenia i dalszy stan

Local candidate: sha256:e6fa9843cd9d3bedeec801a525d8f2bcf46222caaa8fb8404fe38b129f459266.
Aktywne powiązania release i allowlista nie były zmieniane. Osiem znanych testów
wymaga powiązania nowego hasha przy autoryzowanym wydaniu; nie należy usuwać ich
asercji, aby uzyskać PASS. Nie wykonywano commitu ani deployu.

Podgląd lokalny: http://127.0.0.1:8091/?scenario=enemy_roster_hd.
Dostęp LAN został odrzucony przez automatyczną kontrolę uprawnień ze względu na
udostępnienie plików runtime innym urządzeniom bez autoryzacji docelowej sieci.
Serwer pozostał na localhost. Fizyczne iPhone/Android i ich rzeczywisty pasek
systemowy nie zostały przetestowane; wyniki dotyczą emulacji Chromium.
