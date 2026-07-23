# Complete Graphics Overhaul — Design

**Data:** 2026-07-12  
**Gra:** Dungeon of One Room v0.6.1 / dungeon-2.0  
**Kierunek:** Abyssal Gothic HD

## Cel

Przebudować całą aktywną oprawę graficzną gry z obecnego stylu 16-bit/pixel-art do szczegółowego stylu HD opartego na kaflu wizualnym 64×64 px. Mechanika, sterowanie, RNG, zapis gry i soundtrack pozostają funkcjonalnie niezmienione.

Menu zachowuje istniejący układ i charakter. Dozwolone są wyłącznie niewielkie poprawki czytelności, responsywności, focusu i dostępności.

## Decyzja techniczna

Gra pozostaje przy obecnym Canvas 2D. Migracja do Phasera lub innego silnika została odrzucona, ponieważ wymagałaby niemal pełnego przepisania dojrzałej, monolitycznej gry i niosłaby duże ryzyko regresji.

Sama podmiana plików graficznych również została odrzucona. Nie wystarczy do prawidłowego wdrożenia większych bossów, wielowarstwowego środowiska, telegraphów, światła i skalowalnych efektów.

Nowa warstwa renderująca zostanie wydzielona z logiki gry. Dotychczasowy renderer pozostanie tymczasowo jako fallback i narzędzie porównawcze.

## Art direction: Abyssal Gothic HD

Oprawa zachowuje rozpoznawalne funkcje i ogólne sylwetki postaci, ale nie kopiuje starych sprite’ów piksel po pikselu.

### Język materiałów i kolorów

- baza: kamień, żelazo, kości, kurz i pradawne ornamenty;
- neutralne środowisko: chłodne grafity, stalowe błękity i przygaszone szarości;
- źródła światła: bursztyn i pomarańcz pochodni;
- magia: fiolet i turkus;
- spaczenie: toksyczna zieleń;
- niebezpieczeństwo i bossowie: czerwień oraz głęboki karmazyn;
- najważniejsze obiekty interaktywne otrzymują kontrolowany kontrast wartości i koloru.

### Trzy poziomy środowiska

1. **Descent** — chłodny kamień, żelazo, kurz i ciepłe pochodnie.
2. **Corruption** — wilgoć, kości, zielone spaczenie i pęknięcia.
3. **Abyss** — obsydian, runy, fioletowa energia i czerwone światło bossów.

Każdy poziom otrzyma podłogi, ściany, narożniki, uszkodzenia, kratki, plamy, gruz, pochodnie oraz dekoracje. Specjalne pokoje użyją nakładek i setpiece’ów na wspólnych zestawach materiałowych, aby utrzymać spójność i rozsądny budżet assetów.

## Architektura renderera

Logiczna siatka, kolizje i współrzędne gry pozostają bez zmian. Renderer przelicza pozycje logiczne na kafle wizualne 64×64 px. Dla siatki 9×9 podstawowy świat ma rozmiar 576×576 px.

Przepływ danych jest jednokierunkowy:

`stan symulacji → snapshot wizualny tylko do odczytu → renderer HD → Canvas`

Renderer nie może zmieniać:

- pozycji i kolizji;
- wyników walki;
- kolejności tur;
- RNG;
- progresji;
- zapisów;
- stanu audio.

### Moduły renderera

- manifest i loader assetów;
- przeliczenie przestrzeni logicznej na wizualną;
- renderer środowiska;
- renderer obiektów i hazardów;
- renderer postaci;
- renderer telegraphów;
- renderer VFX;
- renderer światła i końcowej kompozycji;
- kontrola jakości efektów dla urządzeń mobilnych;
- fallback do renderera legacy.

### Kolejność warstw

`podłoże → dekoracje → pułapki → obiekty → przeciwnicy → gracz → telegraphy → VFX → światło`

Menu i HUD pozostają w DOM. Canvas obsługuje wyłącznie pole gry.

## Katalog assetów

Nowe zasoby trafiają do `assets/hd/`. Stare zasoby pozostają jako fallback do czasu zakończenia migracji.

### Środowisko i obiekty

- trzy zestawy podłoża, ścian i dekoracji;
- zwykłe i specjalne skrzynie;
- portale zwykłe, złote, czerwone i kuźnicze;
- shrine;
- pact sigil;
- forge i setpiece kuźni;
- merchant;
- kolce w wariantach głębokości;
- miny i ich telegraphy;
- pochodnie w wariantach głębokości;
- wizualne oznaczenia pomieszczeń: combat, treasure, shrine, cursed, merchant, vault, otter, forge, pact i boss.

### Bohater i przeciwnicy

- bohater: stalowa zbroja, ciemnopurpurowy płaszcz i czytelna sylwetka;
- slime;
- skeleton;
- brute;
- acolyte;
- skitter;
- totem;
- otter;
- Vault Guardian;
- Blacksmith Guardian;
- Warden z dwiema wizualnie odmiennymi fazami.

Postacie mobilne otrzymują cztery kierunki oraz animacje bezczynności, ruchu lub ataku, trafienia i śmierci. Obiekty stacjonarne otrzymują animacje bezczynności i aktywacji. Bossowie używają sprite’ów 128–192 px, zachowując logiczne hitboxy gry.

Elite affixy otrzymują odrębne aury, runy, materiały i efekty, a nie tylko zmianę tintu.

### VFX i czytelność walki

- dash i jego ślad;
- shockwave;
- shield;
- blood barrier;
- void aegis;
- pociski i impacty dystansowe;
- trafienia, śmierć, kurz i iskry;
- telegraphy min, ataków obszarowych i celowania;
- efekty elite affixów;
- kontrolowany ekranowy feedback niskiego HP, obrażeń, zwycięstwa i przejść faz bossa.

Efekty muszą podkreślać stan gry, nigdy zasłaniać pola i jednostek.

## Menu i HUD

Układ oraz przepływy menu pozostają bez zmian. Dopuszczone poprawki:

- naprawa uciętego tytułu i tekstów;
- czytelny focus klawiatury;
- wyraźniejsze stany aktywne i zaznaczone;
- poprawa poziomego przepełnienia na telefonach;
- obsługa `prefers-reduced-motion` dla nieistotnych animacji;
- spójne ikony umiejętności, efektów, reliktów i eliksirów;
- zachowanie obecnej stylistyki paneli i hierarchii informacji.

HUD pozostaje w DOM i nie może przesłaniać pola gry.

## Audio freeze

Soundtrack jest zamrożony. Overhaul nie może zmieniać:

- plików audio;
- nazw i ścieżek plików;
- mapowania `MUSIC_TRACKS`;
- głośności;
- ustawień pętli;
- momentów przełączania utworów;
- logiki mute, autoplay i wyboru motywu dla pokoju lub głębokości.

Przed rozpoczęciem implementacji zostaną zapisane sumy kontrolne aktywnych plików audio oraz snapshot konfiguracji. Te wartości będą kontrolowane w testach regresji.

## Ładowanie i obsługa błędów

- manifest używa stabilnych kluczy zamiast rozproszonych ścieżek do plików;
- krytyczne assety są preloadowane przed pokazaniem gry;
- brakujący asset otrzymuje kontrolowany placeholder i komunikat diagnostyczny;
- błąd krytycznego pakietu HD przełącza grę na renderer legacy;
- uszkodzony lub częściowo załadowany pakiet nie może blokować zapisu ani działania menu;
- urządzenia mobilne mogą ograniczyć światło, cząsteczki i efekty ekranowe bez zmiany stanu gry.

## Etapy wdrożenia

1. Zamrożenie baseline’u: testy, screenshoty i kontrola audio.
2. Wydzielenie renderera oraz manifestu bez zmiany mechaniki.
3. Vertical slice: Descent, bohater, podstawowi przeciwnicy, shrine, pułapki i podstawowe VFX.
4. Corruption i Abyss wraz ze wszystkimi pokojami specjalnymi.
5. Pełny zestaw przeciwników, guardianów i bossów.
6. Oświetlenie, telegraphy, efekty walki i polish.
7. Minimalne poprawki menu i HUD oraz naprawa wersji mobilnej.
8. Testy regresji, wydajności i kompatybilności zapisów.

## Testowanie i kryteria akceptacji

- wszystkie istniejące testy pozostają zielone;
- scenariusze deterministyczne obejmują każdy typ pokoju, obiekt specjalny i fazę bossa;
- porównania screenshotów obejmują desktop i mobile;
- stare zapisy uruchamiają się bez migracji danych graficznych;
- tryb HD nie pokazuje przypadkowo aktywnych sprite’ów legacy;
- nie występują brakujące assety ani błędy ładowania w normalnym przebiegu;
- cel wydajnościowy to 60 FPS na desktopie i stabilny tryb ograniczonych efektów na mobile;
- pliki oraz konfiguracja soundtracku pozostają identyczne z baseline’em;
- błąd pakietu HD poprawnie uruchamia fallback bez utraty stanu gry.

## Zatwierdzenie

Użytkownik zatwierdził:

- kierunek Abyssal Gothic HD;
- architekturę wydzielonego renderera Canvas 2D;
- pełny katalog produkcji assetów;
- etapowe wdrożenie, poprawki menu i kryteria QA;
- bezwzględne zachowanie soundtracku.
