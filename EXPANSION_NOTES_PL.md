# Dungeon of One Room — rozszerzenie v0.8.0

## Cel aktualizacji

Aktualizacja rozbudowuje późną część kampanii bez dokładania prostego power creepu. Nowa zawartość opiera się na trzech zasadach:

1. **Czytelna kontrgra** — niebezpieczne ataki mają telegraph i dają graczowi turę na reakcję.
2. **Więcej archetypów buildów** — relikty premiują sposób gry, a nie tylko stały bonus do obrażeń.
3. **Stopniowa eskalacja** — nowe pokoje, pułapki, przeciwnicy i zestawy Wardena pojawiają się etapami.

## Podsumowanie zawartości

- 10 nowych reliktów — pula wzrosła z 47 do 57.
- 5 nowych paktów — pula wzrosła z 7 do 12.
- 2 nowe typy przeciwników na późne głębokości.
- 2 nowe pułapki.
- 3 nowe warianty zwykłych pokoi walki.
- 2 nowe pokoje specjalne.
- Nowy zestaw Wardena od głębokości 60.
- Wzmocniony zestaw Wardena od głębokości 80.
- Całkowicie nowa druga faza Wardena na głębokości 100.
- 2 nowe mechaniki Blacksmith Guardiana w Forge Room.
- Pełna obsługa zapisu/odczytu nowych pól stanu.
- Telegraphy i opisy kontrgry w rendererze HD oraz Classic.

## Harmonogram odblokowań

| Głębokość | Nowa zawartość |
|---:|---|
| 15 | Ambush Room |
| 25 | Horde Room |
| 30 | Crossroads Room |
| 35 | Duel Room, Flame Vent, Pact of Silence |
| 40 | Blood Arena, Pact of Cinders, Pact of Chains |
| 45 | Riftweaver, Pact of the Hunt |
| 50 | Frost Rune |
| 60 | Collapse Warden — nowy model/profil i nowy zestaw umiejętności |
| 65 | Abyss Bulwark |
| 80 | Abyssal Warden — ulepszona wersja zestawu z poziomu 60 |
| 100 | Dwie fazy finałowego Wardena; faza II ma całkowicie nowe umiejętności |

# 10 nowych reliktów

## Normal

### Trapweaver Padding
- **Efekt:** obrażenia środowiskowe są mniejsze o 35%.
- **Rola:** sustain/control.
- **Balans:** nie zwiększa DPS; pozwala budować strategię opartą o pozycjonowanie przeciwników na pułapkach.

### Cache Key
- **Efekt:** pierwsza skrzynia otwarta na każdej głębokości daje Barierę równą 8% maksymalnego HP.
- **Rola:** barrier/economy.
- **Balans:** nagroda jest ograniczona do jednego uruchomienia na głębokość.

## Rare

### Duelist Seal
- **Efekt:** gdy został dokładnie jeden przeciwnik, gracz zadaje +20% obrażeń i otrzymuje ich o 15% mniej.
- **Rola:** assault/control.
- **Balans:** mocny w pojedynkach i końcówkach walk, ale nie pomaga podczas najbardziej niebezpiecznej fazy pokoju z dużą liczbą przeciwników.

### Afterimage Boots
- **Efekt:** Dash przyznaje Barierę równą 10% maksymalnego HP.
- **Rola:** skill engine/barrier.
- **Balans:** obrona jest powiązana z cooldownem i aktywnym użyciem umiejętności.

### Alchemist Coil
- **Efekt:** wypicie mikstury skraca wszystkie aktywne cooldowny o 2 tury.
- **Rola:** skill engine/sustain.
- **Balans:** zamienia ograniczony zasób leczenia w decyzję ofensywną; nie daje darmowego resetu bez kosztu mikstury.

## Epic

### Execution Chain
- **Efekt:** zabójstwo skraca wszystkie aktywne cooldowny o 1 turę; zabójstwo elity lub bossa o 2 tury.
- **Rola:** skill engine/assault.
- **Balans:** wymaga tempa i kolejności celów; jest słabszy przeciw pojedynczym, bardzo wytrzymałym celom.

### Aegis Dynamo
- **Efekt:** jednorazowe wchłonięcie przez Shield lub Barrier obrażeń równych co najmniej 33% maksymalnego HP wzmacnia następne trafienie o 40%.
- **Rola:** barrier/assault.
- **Balans:** relikt jest przeznaczony pod ciężkie trafienia elit i bossów; próg skaluje się z maksymalnym HP i nie sumuje małych bloków.

### Hazard Prism
- **Efekt:** przeciwnik zraniony przez środowisko zostaje Exposed na 3 tury i otrzymuje od gracza +20% obrażeń.
- **Rola:** control/attrition.
- **Balans:** wymaga ustawiania przeciwników na pułapkach; nie jest stałym mnożnikiem obrażeń.

## Legendary

### Perfect Rhythm
- **Efekt:** po 3 turach walki bez utraty HP gracz zadaje +30% obrażeń aż do utraty HP.
- **Rola:** assault/control.
- **Balans:** wysoki sufit mocy, ale bonus znika natychmiast po rzeczywistej utracie HP.

### Heart of the Labyrinth
- **Efekt:** bezbłędne ukończenie pokoju walki daje +5 maksymalnego HP i +2 ATK; maksymalnie 8 razy.
- **Rola:** sustain/assault.
- **Balans:** maksymalny bonus jest ograniczony; relikt wymaga konsekwentnie czystej gry przez wiele pokoi.

# Nowi przeciwnicy

## Riftweaver — od głębokości 45

- Rola: kontrola przestrzeni.
- Maksymalnie 1 na pokój.
- **Spatial Rift:** zaznacza obszar 3×3 wokół aktualnej pozycji gracza, a na następnej turze detonuje go za 85% efektywnego ataku.
- Kontrgra: natychmiastowe opuszczenie zaznaczonego obszaru albo szybkie przerwanie walki z Riftweaverem.
- Tymczasowy wygląd: wariant istniejącego Acolyte z odmiennym tintem i proceduralnym efektem szczeliny.

## Abyss Bulwark — od głębokości 65

- Rola: frontline/pozycjonowanie.
- Maksymalnie 1 na pokój.
- Redukuje obrażenia otrzymywane od przodu do 40% normalnej wartości.
- Otrzymuje 125% obrażeń od tyłu.
- Obrażenia środowiskowe omijają kierunkową gardę.
- **Shield Bash:** sygnalizowany cios sąsiedniego pola za 85% ataku i odepchnięcie o 1 pole.
- Kontrgra: flankowanie, Dash, forced movement, pułapki i ataki od tyłu.
- Tymczasowy wygląd: wariant istniejącego Brute ze stalowym obrysem.

# Nowe pułapki

## Flame Vent — od głębokości 35

- Maksymalnie 2 na pokój.
- Cykl co 3 tury.
- Eksplozja obejmuje środek oraz cztery pola w krzyżu.
- Zadaje 80% obrażeń standardowego kolca dla aktualnej głębokości.
- Może ranić gracza i przeciwników.
- Stan przygotowania i pola wybuchu są wizualnie sygnalizowane.

## Frost Rune — od głębokości 50

- Maksymalnie 2 na pokój.
- Jednorazowa pułapka.
- Zadaje 50% obrażeń standardowego kolca.
- Gracz traci następną akcję; przeciwnik zostaje zamrożony na następną turę, o ile nie ma odporności.
- Może być wykorzystywana ofensywnie przez wciąganie lub odpychanie przeciwników.

# Nowe zwykłe typy pokoi

## Ambush — od głębokości 15

- Większa presja od pierwszej tury.
- Jeden dodatkowy przeciwnik.
- Skład bardziej agresywny.
- Przeciwnicy otrzymują niewielki bonus do ataku.
- Nagroda jest podniesiona, aby ryzyko miało sens ekonomiczny.

## Horde — od głębokości 25

- 7–9 słabszych przeciwników.
- Około 72% normalnego HP i 88% normalnego ataku dla jednostek pokoju.
- Pokój testuje AoE, cooldown management i kolejność eliminacji zamiast pojedynczego burst damage.

## Duel — od głębokości 35

- Jeden wymuszony elitarny champion.
- Około 165% normalnego HP i 112% normalnego ataku.
- Wyższa nagroda za zwycięstwo.
- Naturalne miejsce dla Duelist Seal i buildów single-target.

# Nowe pokoje specjalne

## Crossroads — od głębokości 30

Gracz wybiera jedną z dwóch skrzyń. Po otwarciu druga zostaje zamknięta.

### POWER
- Odbiera 15% aktualnego maksymalnego HP na 100 tur; po wygaśnięciu przywraca dokładnie odebrany limit bez leczenia.
- Otwiera wybór 1 z 3 reliktów klasy Epic lub wyższej.
- Wymaga potwierdzenia drugim naciśnięciem klawisza interakcji.
- Crossroads nie może zostać ponownie wylosowane podczas aktywnej kary.
- Skrzynia ma fioletową aurę i opis: `POWER — Epic+ Relic Choice` / `-15% Max HP for 100 turns`.

### MERCY
- Leczy gracza do pełnego HP.
- Zeruje wszystkie aktywne cooldowny.
- Uzupełnia wszystkie puste sloty mikstur; przy modyfikatorze Avarice każdy uzupełniany slot podlega istniejącej konwersji zasobu.
- Skrzynia ma turkusową aurę i opis: `MERCY — Recovery` / `Heal to Max HP, reset cooldowns, refill potions`.

## Blood Arena — od głębokości 40

- Dwie fale po 5–7 przeciwników.
- Po pierwszej fali gracz dostaje Barierę równą 6% maksymalnego HP.
- Po drugiej fali pojawia się skrzynia z wyborem reliktu klasy Rare lub wyższej.
- Arena wymaga zarządzania zasobami między falami, ale daje gwarantowaną premię adekwatną do ryzyka.

# 5 nowych paktów

## Pact of Silence — od głębokości 35
- **Korzyść:** podstawowe ataki zadają +25% obrażeń.
- **Koszt:** umiejętności zadają 25% mniej obrażeń i mają cooldown dłuższy o 2 tury.

## Pact of Cinders — od głębokości 40
- **Korzyść:** podstawowe ataki podpalają na 12 obrażeń przez 2 tury.
- **Koszt:** obrażenia środowiskowe otrzymywane przez gracza rosną o 25%.

## Pact of Chains — od głębokości 40
- **Korzyść:** +20 ARM i odporność na forced movement.
- **Koszt:** Dash ma cooldown dłuższy o 4 tury.

## Pact of the Hunt — od głębokości 45
- **Korzyść:** +30% obrażeń przeciw elitom i bossom.
- **Koszt:** zwykli przeciwnicy zadają +15% obrażeń.

# Ewolucja Wardena

## Głębokości 0–19 — Gate Warden

- Profil bazowy.
- Uczy podstawowych wzorców pulsu i burstu.
- Najmniej agresywne pozycjonowanie.

## Głębokości 20–39 — Corrupt Warden

- Przewiduje kierunek ruchu przy części ataków.
- Lepsze ustawianie i krótsze okna bezpieczeństwa.
- Około +4% HP i +5% ataku względem profilu bazowego.

## Głębokości 40–59 — Rift Warden

- Zachowuje rozwinięty zestaw klasyczny.
- Otrzymuje Void Aegis: czasową barierę uruchamianą przy niskim HP, z limitem użyć.
- Około +8% HP i +8% ataku względem profilu bazowego.

## Głębokości 60–79 — Collapse Warden

Od tego etapu klasyczny pulse/burst zostaje całkowicie zastąpiony.

### Rift Lattice
- Zaznacza cały wiersz i kolumnę gracza.
- Detonuje po 2 kolejnych akcjach Wardena.
- Cooldown: 5 tur.
- Obrażenia: 90% efektywnego ataku.

### Void Step
- Zaznacza obszar 3×3 wokół aktualnej pozycji Wardena.
- Na następnej akcji stara pozycja imploduje, a Warden teleportuje się na korzystniejsze pole.
- Cooldown: 6 tur.
- Obrażenia: 70% efektywnego ataku.

## Głębokości 80–99 — Abyssal Warden

- Od głębokości 80 Warden rzuca dwa pojedyncze Rift Lattice w kolejnych turach, każdorazowo w bieżącej pozycji gracza.
- Rift Lattice: oba wzory detonują osobno, w kolejnych turach; pełny cooldown 5 zaczyna się po drugim wybuchu. Boss roomy 80+ mają maksymalnie 2 elity.
- Void Step: cooldown 5, 80% ataku.
- Lepsze utrzymywanie optymalnego dystansu.
- Około +16% HP i +16% ataku względem profilu bazowego.

## Głębokość 100 — finał dwufazowy

### Faza I

- Pełny Abyssal Warden z lekko podniesionymi mnożnikami.
- Jest sprawdzianem opanowania mechanik z głębokości 80–99.

### Faza II — Abyssal Warden Reborn

Stary zestaw zostaje porzucony. Druga faza używa dwóch nowych mechanik:

#### Doom Sigils
- Rozstawia maksymalnie 3 pieczęcie: 1–2 w pobliżu bieżącej lub przewidywanej pozycji gracza, a 1–2 na losowych polach mapy.
- Każda wybucha w kształcie krzyża po jednej pełnej turze ostrzeżenia.
- Cooldown: 5 tur.
- Obrażenia: 115% efektywnego ataku.

#### Soul Chain
- Blokuje linię między Wardenem a aktualną pozycją gracza.
- Przy pozostaniu na linii zadaje 80% ataku i przyciąga gracza maksymalnie o 2 pola.
- Pact of Chains blokuje przyciągnięcie, ale nie same obrażenia.
- Cooldown: 5 tur.

# Forge Room Boss — nowe mechaniki

## Chain Hook

- Warden kuźni zaznacza linię prowadzącą do aktualnego pola gracza.
- Na następnej akcji zadaje 65% ataku.
- Przyciąga o maksymalnie 2 pola.
- Może uzbroić minę na końcowej pozycji gracza.
- Pact of Chains blokuje przyciągnięcie.
- Cooldown: 5 tur.

## Overheat

- Jednorazowo uruchamia się po zejściu poniżej 35% HP.
- Zużywa akcję bossa.
- Trwale zwiększa jego atak o 20% do końca walki.
- Jest czytelnym sygnałem wejścia w końcową, bardziej agresywną część starcia.

# Decyzje balansowe

- Nowi przeciwnicy mają limit 1 sztuki na pokój, aby telegraphy nie nakładały się w nieczytelny sposób.
- Nowe pułapki mają limit 2 sztuk na pokój oraz niewielką szansę zastąpienia dotychczasowych zagrożeń.
- Najsilniejsze relikty są warunkowe i mają cap, reset albo wymaganie wykonania konkretnej akcji.
- Pokoje specjalne mają niskie wagi losowania, aby nie rozbić ekonomii runu.
- Warianty zwykłych walk zmieniają pytanie taktyczne: presja startowa, AoE/cooldowny albo single-target.
- Warden od poziomu 60 nie jest wyłącznie większym workiem HP; zmienia sposób poruszania się po planszy.
- Faza II na poziomie 100 nie kopiuje fazy I — wymaga nowej interpretacji telegraphów.
- Obrażenia środowiskowe współpracują z Trapweaver Padding, Hazard Prism i Pact of Cinders zgodnie z ich opisami.

# Scenariusze QA

Po uruchomieniu lokalnego serwera w katalogu gry można bez przechodzenia całej kampanii otworzyć:

- `?scenario=expansion_enemies_hd`
- `?scenario=expansion_traps_hd`
- `?scenario=expansion_crossroads_hd`
- `?scenario=expansion_arena_hd`
- `?scenario=expansion_warden_collapse_hd`
- `?scenario=expansion_warden_reborn_hd`
- `?scenario=expansion_forge_boss_hd`

Przykład:

```text
http://localhost:8000/?scenario=expansion_warden_reborn_hd
```

Scenariusze używają deterministycznego układu planszy i służą do kontroli telegraphów, HUD-u oraz działania renderera HD.

# Ograniczenie związane z usuniętym folderem `art`

Nowe mechaniki są w pełni grywalne bez źródłowego folderu `art`, ale nie powstały nowe, dedykowane sprite'y/modelowe pliki źródłowe:

- Riftweaver używa wariantu istniejącego Acolyte.
- Abyss Bulwark używa wariantu istniejącego Brute.
- Flame Vent, Frost Rune, Doom Sigils i pola ostrzegawcze są rysowane proceduralnie.
- Nowe ikony reliktów korzystają z aliasów istniejących ikon.

Kod ma osobne typy logiczne i `renderType`, więc późniejsze podmienienie wyglądu nie wymaga przebudowy AI ani balansu.

# Rekomendowana droga do gry „10/10”

## Priorytet 0 — największy zwrot z pracy

### 1. Preview synergii w drafcie reliktów

System rozpoznawania archetypu buildu już istnieje. W ekranie wyboru reliktu warto pokazywać:

- obecny archetyp, np. `Barrier / Skill Engine`,
- które tagi wzmacnia kandydat,
- prostą ocenę `Core`, `Synergy`, `Off-build`.

To pomaga graczowi podejmować świadome decyzje i sprawia, że run ma wyraźną tożsamość.

### 2. Room Mastery — małe cele opcjonalne

Przykłady:

- ukończ pokój bez utraty HP,
- zabij elitę pułapką,
- nie używaj Dash,
- zakończ walkę w maksymalnie 8 turach.

Nagrodą powinien być wybór małego bonusu, waluta lub lepsza jakość skrzyni, nie stały obowiązkowy power creep.

### 3. Więcej „combat juice”

Najbardziej opłacalne ulepszenia odczuwalności:

- krótki hit-stop dla mocnych trafień,
- osobne dźwięki przełamania bariery, ciosu krytycznego i zabicia elity,
- subtelne camera punch zgodne z siłą ataku,
- mocniejsze efekty death/impact bez wydłużania tury.

## Priorytet 1 — retencja i regrywalność

### 4. Rozgałęziony wybór następnego pokoju

Zamiast pełnego, rozbudowanego mapowania wystarczy pokazywać 2 możliwe drzwi z częściową informacją, np. `Combat + high hazard` kontra `Unknown special`. Gracz uzyskuje agency bez utraty „one room” fantasy.

### 5. Codex i Boss Practice

- lista poznanych przeciwników,
- animowany podgląd ich telegraphów,
- opis kontrgry,
- trening Wardena dla odblokowanych progów 20/40/60/80/100.

Pozwala uczyć się trudnej gry bez marnowania długiego runu.

### 6. Challenge Seeds i mutatory

Codzienny seed lub ręcznie wybierane modyfikatory:

- podwójne pułapki,
- brak leczenia ze skrzyń,
- elity mają dodatkowy affix,
- tylko określone rodziny reliktów.

Nagrody powinny być kosmetyczne, punktowe lub odblokowywać warianty, a nie obowiązkową permanentną przewagę.

## Priorytet 2 — balans długoterminowy

### 7. Telemetria runów

Warto lokalnie zapisywać lub eksportować anonimowy JSON zawierający:

- depth śmierci,
- przyczynę obrażeń/śmierci,
- wybrane relikty i pakt,
- liczbę tur na pokój,
- otrzymane obrażenia według przeciwnika i pułapki,
- skuteczność wyborów Crossroads/Arena.

To pozwoli balansować na danych: odróżnić mechanikę trudną, ale sprawiedliwą, od mechaniki niezrozumiałej lub losowo zabójczej.

# Najważniejsze pliki rozszerzenia

- `expansion-content.js` — definicje i progi nowej zawartości.
- `relic-data.js` — nowe relikty.
- `pact-room.js`, `pact-effects.js` — nowe pakty i ich efekty.
- `boss-campaign.js` — profile Wardena co 20 głębokości i finałowe fazy.
- `game.js` — integracja symulacji, AI, pokoi, pułapek, zapisu i logiki walki.
- `render/visual-snapshot.js` — bezpieczny snapshot nowych pól dla renderera.
- `render/hd-renderer-layers.js`, `render/hd-vfx.js` — telegraphy i proceduralne wizuale HD.
- `scenario-overrides.js` — deterministyczne scenariusze QA.
- `tests/expansion-*.test.js` — testy kontraktu i integracji rozszerzenia.

# Walidacja wydania

## Składnia

Kontrola `node --check` przeszła dla zmodyfikowanych modułów symulacji, danych, scenariuszy, renderera i testów.

## Testy rozszerzenia

Skupiony zestaw obejmujący profile bossów, relikty, pakty, scenariusze, snapshot renderera, telegraphy VFX i tooltipy:

- **34/34 testów zaliczonych**,
- 0 błędów,
- 0 pominiętych.

## Pełny zestaw regresji

- **300 testów łącznie**,
- **268 zaliczonych**,
- **32 niezaliczone**.

Przed rozszerzeniem projekt miał 297 testów, 265 zaliczonych i również 32 niezaliczone. Liczba istniejących niepowodzeń nie wzrosła; trzy nowe kontrakty wydania przechodzą. Pozostałe niepowodzenia dotyczą głównie brakujących źródeł i locków pipeline'u `art`, testów referencyjnych grafik oraz wcześniejszych kontraktów audio/legacy, które były niespełnione już w dostarczonej wersji bez folderu `art`.

## Przeglądarka i obraz

- Zweryfikowano start gry w Chromium po dodaniu faviconu.
- Końcowy cold-load nie zgłosił błędów strony, błędów konsoli ani odpowiedzi HTTP 4xx/5xx.
- Wizualnie sprawdzono scenariusze nowych przeciwników, nowych pułapek i Crossroads w trybie HD przy 1440×1000.
- Telegraphy nie zasłaniają postaci ani głównych elementów HUD-u.
- Crossroads ma rozróżnialne aury POWER/MERCY, a Arena osobną złotą aurę nagrody.
