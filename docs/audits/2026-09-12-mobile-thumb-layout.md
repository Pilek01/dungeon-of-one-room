# Audyt mobilnego sterowania — 12 września 2026

Audyt wykonany przed zmianami, na aktualnym drzewie roboczym. Zrzuty i pomiary: output/verification/mobile-thumb-layout/before. Obejmuje 915×412, 844×288, 667×375, 390×844, 360×640 i 1024×768. Uwagę o wycentrowaniu D-pada w „lewym panelu” interpretuję jako prawy panel, zgodnie z opisanym podziałem sterowania.

## Co działa dobrze

- Gotycki kamień i metal pasują do wersji PC.
- Plansza jest kwadratowa i odsłonięta; HP, shield i barrier są przy jej bokach.
- Etykiety, zapas mikstur i stany skilli są widoczne.
- Sterowanie wywołuje istniejące akcje gry. Portal i emergency extract mają działające okna wyboru.

## Co wymaga poprawy

1. Lewa siatka miesza trzy skille i dwa przedmioty. Podział nie odpowiada dwóm kciukom.
2. Przyciski 70×70 px na 915×412 są małe w stosunku do dostępnego panelu. Po ich wewnętrznych ramkach zostaje niewiele miejsca na ikonę.
3. Niesymetryczny ostatni rząd (eliksir i zwykle ukryta interakcja) wygląda jak niekompletna siatka.
4. Obszar pomiędzy górnymi informacjami a przyciskami jest słabo wykorzystany.
5. Nad krzyżakiem jest miejsce na potion i eliksir, które można wyraźnie oddzielić od skilli.
6. D-pad na 915×412 jest około 23 px na prawo od środka panelu. Należy liczyć środek względem bocznego paska i krawędzi ekranu.
7. Powiększenie całej starej siatki powodowałoby kolizje na niskim ekranie z paskiem adresu. Potrzebny jest osobny układ dla tej wysokości.
8. Prostokątne, drobne ramki dają przyciskom podobną wagę wizualną jak małym pozycjom menu.

## Zmiana zgodna z uwagami użytkownika

- Trzy duże, okrągłe skille w lewej strefie; pionowa kolumna, a na bardzo niskim ekranie trójkąt.
- Dwa okrągłe przyciski potion/elixir nad D-padem; wspólna oś środka prawego panelu.
- Metalowe pierścienie i istniejąca faktura kamienia. Większe ikony, widoczne stany i liczby.
- Środek krzyżaka służy istniejącej kontekstowej interakcji tylko wtedy, gdy jest dostępna. Nie ma nowej akcji czekania.
- Wielkość planszy zostaje zachowana; mały widok pionowy może przesunąć planszę minimalnie w górę, aby rozdzielić ją od większych przycisków.
- Regresje sprawdzają rozdział funkcji, okrągły kształt, centrowanie, brak kolizji, obrót ekranu i prawdziwe interakcje.

## Wynik wdrożenia

Wdrożono wskazany podział. Na 915×412 średnica skilli wynosi 86 px, a mikstur 82 px; D-pad przesunął się około 23 px w lewo, na środek prawego panelu. W małym pionie plansza jest 12 px wyżej; jej bok pozostaje niezmieniony. Kolumna skilli ma 100 px średnicy w 390×844 i 72 px w 360×640. Niski poziomy ekran używa trójkąta.

| Widok | Skill przed / po | Potion przed / po | Plansza przed / po | Przesunięcie D-pada w lewo |
|---|---:|---:|---:|---:|
| landscape | 69.8 / 86 px | 69.8 / 82 px | 396 / 396 px | 23.2 px |
| browser-chrome | 64.5 / 72 px | 64.5 / 64 px | 272 / 272 px | 41.4 px |
| small-landscape | 53.5 / 73.7 px | 53.5 / 71 px | 287 / 287 px | -1 px |
| portrait | 77.2 / 100 px | 77.2 / 82 px | 306 / 306 px | 7.1 px |
| small-portrait | 70.8 / 72 px | 70.8 / 74 px | 276 / 276 px | 5.6 px |
| tablet | 79.7 / 108 px | 79.7 / 82 px | 530.4 / 530.4 px | 7.9 px |

Ujemne przesunięcie oznacza niewielki ruch w prawo potrzebny do wycentrowania węższego panelu. Rozmiary przycisków w tabeli to długość boku starego kwadratu i średnica nowego koła. Pomiary nie są oceną komfortu fizycznego telefonu.

Zmienione 4 pliki: style-mobile-v2.css, scripts/verify-mobile-v2.mjs, ten audyt i progress.md. Produkcyjna zmiana dotyczy wyłącznie CSS. Istniejące przyciski, ich etykiety dostępności i akcje gry zostały zachowane.

## Weryfikacja

- PASS: node scripts/verify-mobile-v2.mjs --visual-polish --out=output/verification/mobile-thumb-layout/after — sześć rozmiarów, obrót w obie strony, brak kolizji z planszą/nagłówkiem/innymi przyciskami, centrowanie, minimum 44 px, okrągłe przyciski, potion leczący gracza, użycie wyposażonego eliksiru dokładnie raz, brak zużycia tury przez pusty eliksir, interakcja na środku D-pada otwierająca portal, dotychczasowe przejścia camp/descend/emergency/menu/fullscreen/desktop.
- PASS: node --test tests/mobile-v1.test.js tests/mobile-repair-pass.test.js tests/mobile-hd-remake.test.js tests/mobile-gothic-ui.test.js tests/mobile-preview-build-metadata.test.mjs tests/mobile-v2-journey.test.js — 30 testów, w tym automatyczna identyfikacja wersji z checkoutu.
- PASS: npm run verify:ui-current -- --scenario hd — output/verification/ui-current-20260912T152115468Z.log.
- PASS: node C:/Users/Kamil/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:8091/?scenario=enemy_roster_hd --actions-file tools/hd2-preview/actions.json --iterations 2 --pause-ms 15000 --screenshot-dir output/verification/mobile-thumb-layout/game-client. Obraz shot-1 i stan state-1 sprawdzone podczas gry.
- PASS: npm run verify:ranked-headed -- --scenario camp — output/verification/ranked-headed-20260912T151712127Z.log.
- PASS: npm run verify:baseline — chroniony baseline z HEAD 5242be0, output/verification/baseline-20260912T151917695Z.log.
- PASS: npm run verify:guard — 15 kontroli, output/verification/guard-20260912T152216718Z.log.
- PASS: node --check scripts/verify-mobile-v2.mjs; git diff --check.
- Nie wykryto nierozwiązanych błędów w sprawdzonym zakresie.

## Podgląd po zmianie

![Sterowanie poziome](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-thumb-layout/after/final-landscape.png>)

![Sterowanie pionowe](<D:/Codex workstation/Dungeon/dungeon-online-v3/output/verification/mobile-thumb-layout/after/final-portrait.png>)

## Ograniczenie

Kontrole mobilne wykonano w emulacji dotyku w Chromium. Odbiór przy rzeczywistej jasności ekranu i wygoda kciuków na fizycznym telefonie pozostają do potwierdzenia.
