# Analiza difficulty i ekonomii Camp — 2026-09-26

Stan analizowany: lokalny checkout `5938be5`, bez zmian gameplayu. Zadanie: ustalić, jak depth, składy przeciwników i Camp wpływają na trudność.

## Wniosek

Kod mocno wspiera hipotezę o nakładających się źródłach trudności, szczególnie od depth 20. Nie ma jednak danych pozwalających uczciwie ustalić, że cała gra jest o konkretny procent za trudna. Najbardziej podejrzane są: skok 19→20/21, skalujące się krwawienie omijające armor, procentowe leczenie dużych przeciwników, rosnąca częstość elit oraz koszty progresji, którym nie towarzyszy odpowiedni wzrost podstawowych nagród za zabicia.

Camp jest jednym z głównych regulatorów difficulty. Początkowe zakupy dają bardzo duży skok siły; później ich koszt rośnie szybciej niż korzyść. Samo dodanie HP graczowi lub globalne obniżenie HP przeciwników nie rozwiąże wszystkich tych problemów.

## Metoda i granice

- Inspekcja wzorów i ich miejsc użycia w aktualnym kodzie gry; pomocniczo sprawdzone reguły Camp po stronie Ranked. Nie weryfikowano wdrożenia produkcyjnego ani starych runów przypiętych do wcześniejszych reguł.
- Obliczenia kosztów wykonano funkcjami z `balance-progression.js` na definicjach `camp-data.js`.
- Rozkłady składów: 30 000 próbek na każdy z 10 depth, razem 300 000 pokoi. Wykorzystano funkcje `rollEnemyType`, `rollEnemyTypeWithCaps` i wzory początkowych statystyk wyjęte z `game.js`, moduł odblokowań oraz deterministyczny generator LCG z seedem 20260926.
- To model zwykłego pokoju combat: nie symuluje gracza, pozycji, czasu walki, elit, affixów, leczenia, obrażeń, skrzyń, mutatorów, paktów, bossów ani pokoju specjalnego. Nie odtwarza konkretnego seeda Ranked. Podaje bazową sumę HP i częstość obecności typów, nie win rate ani DPS.
- Liczby depth oznaczają `state.depth`. Zwykłe pokoje w próbkowaniu wybrano poza wielokrotnościami 5, gdzie występują bossowie. Tabele statystyk pokazują wzory dla danego depth, nie obietnicę wystąpienia każdego typu w takim pokoju.
- Pomocniczy kalkulator jest lokalnie w ignorowanym `output/verification/difficulty-audit-20260926.cjs`; można go odtworzyć poleceniem `node output/verification/difficulty-audit-20260926.cjs`. Udany przebieg obliczeń w tej sesji wykonano jako `node` ze skryptem na stdin, następnie zachowano skrypt. Pierwsza próba przerwała się na brakującej zależności `randInt`; została uzupełniona przed uzyskaniem wyników.
- Nie wykonano playtestu ani testów produktu: rezultat jest analizą kodu i obliczeń, bez modyfikacji zachowania gry.

## 1. Krzywa statystyk

`game.js:1633`, `game.js:12785`: oprócz bazowego wzrostu zależnego od depth, od depth 20 zarówno HP, jak i ATK mnoży dodatkowy współczynnik:

`M(d) = 1` dla d < 20; dalej `1 + 0.1 × (floor((d − 20)/10) + 1)`.

Przykładowo Slime ma `10 × (3 + floor(d/2))` HP przed tym mnożnikiem, a Brute `10 × (7 + d)`. Iloczyn dwóch rosnących składników daje w przybliżeniu wzrost kwadratowy, z wyraźnymi schodkami co 10 depth. Nie jest to wzrost wykładniczy. Zwiększanie jednocześnie HP i ATK wydłuża ekspozycję na coraz mocniejsze trafienia.

| Depth | M | Slime HP / ATK | Brute HP / ATK | Skitter HP / ATK | Warden HP / ATK |
|---:|---:|---:|---:|---:|---:|
| 5 | 1.0 | 50 / 20 | — | — | 208 / 45 |
| 10 | 1.0 | 80 / 30 | — | — | 360 / 70 |
| 20 | 1.1 | 143 / 55 | 297 / 99 | 143 / 77 | 640 / 116 |
| 40 | 1.3 | 299 / 117 | 611 / 208 | 299 / 156 | 1348 / 239 |
| 60 | 1.5 | 495 / 195 | 1005 / 345 | 495 / 255 | 2285 / 404 |
| 80 | 1.7 | 731 / 289 | 1479 / 493 | 731 / 374 | 3471 / 592 |
| 100 | 1.9 | 1007 / 399 | 2033 / 684 | 1007 / 513 | 4925 / 830 |

Bez elit i mutatorów. ATK nie oznacza obrażeń każdego skilla: poszczególne ataki mają własne mnożniki. Warden uwzględnia profil regionu; depth 5 ma specjalne osłabienie, a depth 100 pokazuje tylko fazę I. Faza II ma osobne statystyki i mechaniki (`boss-campaign.js:155`, `:255`), więc ostatniego wiersza nie należy traktować jako kosztu całej finałowej walki.

## 2. Progi, które nakładają kilka utrudnień

| Depth | Nowe obciążenie |
|---:|---|
| 5–6 | Skeleton w puli od 5; pierwszy boss bez addów; elity i Cursed od 6. |
| 11 | Acolyte, procentowe leczenie/buffy; dostępność Forge. |
| 15 | Brute i Ambush; boss ma już jednego elitarnego adda. |
| 20–21 | Mnożnik ×1.1; zwykły combat 5→6 enemies; Skitter; mocniejsze anti-strafe; nowy profil bossa. Boss 20 ma 3 elitarne addy. |
| 25 | Horde: 7–9 słabszych przeciwników; inna presja niż zwykły combat. |
| 30–31 | Totem, blokowanie powrotu skilli i poison; kolejny skok mnożnika. |
| 35 | Duel i flame vents. |
| 40–41 | Mnożnik ×1.3, silniejsze anti-strafe, Arena, boss z Void Aegis. |
| 45–46 | Riftweaver i dodatkowa kontrola pola. |
| 50 | Frost runes i kolejny skok statystyk. |
| 60 | Zmiana zestawu bossa na Rift Lattice / Void Step. |
| 65–66 | Bulwark: wysoka pula HP i redukcja obrażeń od frontu. |
| 80 | Boss z dwoma następującymi po sobie Lattice. |

Źródła: `game.js:925`, `:12660`, `:13245`, `expansion-content.js:2`, `boss-campaign.js:1`, `:273`.

Szczególnie istotne jest przekroczenie 6 przeciwników: bazowy limit melee commit rośnie z 1 do 2, a telegraphów z 2 do 3 (`game.js:19995`). Nie oznacza to twardego limitu wszystkich ataków. Aktywne anti-strafe dodaje od depth 20 kolejny melee commit, a od 40 także telegraph (`enemy-blackboard.js:128`). Istnieje też mechanizm dodatkowej presji sąsiadujących przeciwników, z limitem 2 i szansą 65% (`game.js:20077`). Dlatego przejście 5→6 nie jest wyłącznie wzrostem liczebności o 20%.

## 3. Losowe kombinacje

Limity typów: 2 Acolytes, 2 Skitters, 1 Totem, 1 Riftweaver i 1 Bulwark. Rerolle pilnują tych limitów, lecz nie ma w tym generatorze wspólnego budżetu trudności kombinacji. Nie ma zakazu Acolyte + Totem + Skitter, ani Acolyte + Bulwark. Rerolle zmieniają rozkład, dlatego surowych szans pojedynczego losowania nie można bezpośrednio uznać za szanse całego pokoju.

| Depth | Średnia bazowa suma HP | P90 sumy HP | Bazowe złoto za zabicia | ≥1 Acolyte | 2 Acolytes | Acolyte + Totem + Skitter |
|---:|---:|---:|---:|---:|---:|---:|
| 11 | 430 | 440 | 15.58 | 82.9% | 46.7% | 0% |
| 19 | 780 | 910 | 16.63 | 71.1% | 30.9% | 0% |
| 21 | 1087 | 1353 | 20.02 | 65.2% | 24.8% | 0% |
| 31 | 1584 | 1824 | 22.81 | 68.6% | 27.5% | 27.0% |
| 41 | 2177 | 2496 | 22.81 | 68.1% | 27.3% | 27.2% |
| 46 | 2407 | 2795 | 25.30 | 62.0% | 21.1% | 19.3% |
| 61 | 3516 | 4095 | 25.33 | 62.7% | 21.9% | 19.4% |
| 66 | 4072 | 4590 | 26.95 | 60.7% | 19.6% | 18.1% |
| 81 | 5520 | 6222 | 26.91 | 60.2% | 20.2% | 17.4% |
| 99 | 7036 | 7902 | 26.95 | 60.6% | 20.2% | 17.4% |

P90: 90% próbek miało sumę HP nie większą od tej liczby. To nie jest percentyl rzeczywistej trudności. Błąd losowy udziałów przy tej liczbie prób wynosi w najgorszym przypadku około ±0.6 punktu procentowego dla przybliżonego przedziału 95%; ograniczenia modelu są znacznie ważniejsze.

Najbardziej podejrzane interakcje:

- **Acolyte + tank/elite.** Leczy 30% max HP, buffuje ATK o 30% przez 3 tury. Procentowe leczenie samo skaluje się z HP celu. Na depth 40 zwykły Brute ma 611 HP; Elite Juggernaut około 1112 HP, więc jeden heal przy odpowiednich brakach przywraca do 334 HP. To więcej niż podstawowy hit 220 ATK z Blade 10, bez crit/Fury. Długi czas dojścia do supportu może znaczyć więcej niż bazowe HP pokoju. Buff nie nakłada się ponownie na już zbuffowany cel; nie należy mnożyć dwóch Acolytów jako dwóch równoczesnych buffów tego samego celu.
- **Acolyte + Totem + Skitter.** Trzeba szybko zabić support, odzyskać dostęp do skilli i obsłużyć bleed. Sklep zwiększający armor nie neutralizuje dwóch ostatnich źródeł zagrożenia. Ta trójka występuje w około 27% modelowanych zwykłych pokoi na depth 31/41.
- **Acolyte + Bulwark.** Na depth 66 około 24.3% próbek. Bulwark otrzymuje od frontu 40% obrażeń, od tyłu 125%. Dla frontalnych ciosów powyżej minimum oznacza to około 2.5× efektywnego HP, przed leczeniem i elitą. Wysokie HP nie jest tu pełną miarą wytrzymałości.
- **Riftweaver + frontline + hazards.** Ograniczenie bezpiecznych pól może uniemożliwiać obejście Bulwarka lub dojście do Acolyte. Tego efektu nie wycenia model statystyczny; wymaga analizy pozycji.

Źródła: `game.js:12748`, `:16050`, `:19706`, `:19837`, `:19854`, `:19921`.

## 4. Elity i obrażenia okresowe

Szansa próby elity w zwykłym pokoju to `clamp(0.12 + 0.01 × depth, 0.02, 0.75)`: 22% na 10, 32% na 20, 52% na 40 i 72% na 60; od 63 osiąga 75%. Cursed dodaje 22 punkty procentowe przed ograniczeniem. Zwykły generator ogranicza liczbę prób zakończonych flagą elite do 4; Totem nie staje się elitą. Wymuszone pokoje i boss addy mają wyjątki. To nie jest informacja, że dokładnie 75% wszystkich enemies na końcu gry będzie elitami.

Elita ma ×1.4 HP i +10 ATK. Juggernaut mnoży HP dodatkowo ×1.3, czyli łącznie około ×1.82; Relentless podnosi ATK ×1.2 i daje bonusowy ruch. Blooddrinker może odzyskać do 30% max HP przy swoim melee, ograniczone brakującym HP i raz na turę. W modelu powyżej tych wzmocnień nie ma, więc nie opisuje on pełnej późnej wytrzymałości przeciwników (`game.js:13009`, `:13507`, `:19602`).

**Bleed i poison omijają armor, lecz są pochłaniane przez osłony.** Główne trafienie korzysta z `getDamageAfterArmor`; ticki odejmują pozostałe po osłonach obrażenia bezpośrednio od HP (`game.js:15664`, `:15730`, `:15821`, `:16727`). Skitter nakłada bleed po zadaniu obrażeń graczowi, jeśli przed ciosem nie miał on osłony: 35% efektywnego ATK przez 3 tury.

Przykład izolowany, bez elity, osłon, leczenia, cleanse i dalszych trafień:

| Skitter | ATK | Trafienie po 150 ARM | Bleed/tick | Pełne 3 ticki | Łączny koszt |
|---|---:|---:|---:|---:|---:|
| Depth 40 | 156 | 63 | 55 | 165 | 228 HP |
| Depth 80 | 374 | 150 | 131 | 393 | 543 HP |

To nie prognoza nieuniknionej śmierci: gracz może używać osłon, mikstur i kontroli. Jest to dowód, że dodatkowy armor nie rozwiązuje znacznej części późnych obrażeń Skittera. Powtórne aplikacje odświeżają czas/zachowują mocniejszą wartość, zamiast tworzyć niezależny stos za każdy cios.

Totem wydłuża losowy aktywny cooldown o 2 tury; jeśli nie ma takiego celu, nakłada poison. Poison bolt ma 15/tick przy naturalnym odblokowaniu i 20/tick od 40; aura ma zasięg 2 i 10/tick. Sam hex/bolt nie sprawdza linii widzenia ani odległości w swojej ścieżce. Akcja Totemu zachodzi przed ogólną obsługą disorient/freeze. To istotna różnica względem zwykłego caster enemy, a nie tylko kolejny typ z większym HP (`game.js:19880`, `:19921`, `:20231`).

## 5. Camp: bardzo silny początek, drogi środek i koniec

Podstawowy gracz ma 100 HP, 20 ATK, 0 ARM, 10% crit i jedną miksturę. Poniżej same bonusy Camp na nowym runie, bez relikwii, skrzyń, paktów i mutatorów:

| Poziom | HP z Vitality | ATK z Blade | ARM z Guard | Koszt dojścia od 0: jedna z tych ścieżek* |
|---:|---:|---:|---:|---:|
| 0 | 100 | 20 | 0 | 0 |
| 1 | 110 | 31 | 10 | 30 |
| 3 | 130 | 59 | 30 | 131 |
| 5 | 150 | 95 | 50 | 328 |
| 10 | 200 | 220 | 100 | 2094 |
| 15 | 250 | 395 | 150 | 11 593 |
| 20 | 300 | 520 | limit 15 | 28 263 |
| 25 | 350 | 645 | limit 15 | 44 933 |

*Cena jednej ścieżki, nie całego zestawu. Do 15 wszystkie trzy mają te same koszty; od 16 dotyczy tylko Blade/Vitality. Pełne Blade 25 + Vitality 25 + Guard 15 kosztują 101 459 Camp Gold, bez pozostałych zakupów i podatków.

Blade: do poziomu 15 bonus wynosi `10L + L²`; później +25 ATK/poziom. Mnożnik flat ATK z innych wspieranych źródeł rośnie do ×2.5. Bazowe 20 ATK nie dostaje automatycznie tego mnożnika. Vitality daje +10% bazowego HP na poziom, a nie procent składany. Guard: +10 armor/poziom. Redukcja armor = `A/(A+100)`, z capem 70%, przy minimum typowego trafienia 10. Guard 15 daje 60% redukcji; większe zasoby armor muszą pochodzić z innych źródeł.

**Wniosek ekonomiczny:** pierwsze Blade za 30 daje +55% podstawowego ATK; pierwsze Vitality za 30 daje +10% HP. Blade skraca walkę i pośrednio ogranicza incoming damage. Nie oznacza to, że Vitality jest bezużyteczne: powiększa także bazę osłony Shield i może przekroczyć próg przeżycia. Jednak identyczna cena nie oznacza identycznej wartości wyborów.

Zakup kolejnego poziomu głównej ścieżki: 30, 42, 59, …; z 10→11 koszt 868, z 14→15 koszt 3334. Blade i Vitality utrzymują następnie cenę 3334. Dodatkowe +10 HP Vitality i +25 ATK Blade konkurują o tę samą kwotę mimo zupełnie innego wpływu na build.

Źródła: `balance-progression.js:14`, `:26`, `:37`, `camp-data.js:2`, `game.js:10885`, `:14735`.

## 6. Pozostały sklep i koszt alternatywny

| Ulepszenie | Łączny koszt do maksimum | Wpływ na difficulty |
|---|---:|---|
| Satchel 6 | 245 | Start 1→7 mikstur i pojemność 5→11. Bardzo duża wartość przy częstych powrotach do Camp. |
| Potion Strength 5 | 876 | Leczenie 40–60→140–160; +20/poziom. Z Satchel tworzy mocną synergię. |
| Auto Potion 1 | 600 | Reakcja przy ≤30% HP, CD 5 tur. Nie ratuje po spadku HP do zera. |
| Crit Training 4 | 710 | Crit 10→30%; przy ×2 crit średni mnożnik bazowego ataku 1.1→1.3, około +18.2% względem startu. Relikwie i progi zabicia zmieniają wartość. |
| Bounty Contract 5 | 766 | +50% bazowej nagrody za enemy; zaokrąglanie osłabia lub wzmacnia poszczególne progi. |
| Treasure Sense 5 | 876 | +50% chest gold; nie +50% wszystkich przychodów. |
| Emergency Stash 3 | 523 | Strata emergency extract 70→40%; zachowane złoto 30→60%. Nie zmienia dochodu normalnej ekstrakcji. |
| Relic Ward 3 | 2010 | Ochrona przed utratą relikwii 33/66/100%; boss gates 10/30/50. Stabilizuje build. |
| Relic Appraisal 3 | 1050 | Sprzedaż +15/30/45%; boss gates 10/20/30. Wymaga sprzedawania relikwii. |

Satchel 6 + Potion Strength 5 kosztują 1121 i dają na starcie 7 mikstur po średnio 150 HP, czyli potencjalnie 1050 leczenia zamiast 50. To surowy potencjał przed overhealem, utratą dostępu do mikstur i ryzykiem śmiertelnego trafienia, nie dodatkowe 1050 max HP. Mikstury również usuwają bleed/poison. W efekcie wybór zakupów może silnie różnicować trudność runów na tym samym depth.

Uwaga o Bounty: pierwszy poziom kosztuje 70, lecz Slime nadal daje `round(2×1.1)=2`, Skeleton `round(3×1.1)=3`, Brute i Skitter `round(4×1.1)=4`. Dopiero nagrody 5+ mogą zyskać pierwszy punkt. Wczesna inwestycja może więc opóźnić zakup bojowy bez natychmiastowego zysku na większości zabijanych enemies. Zaokrąglanie następuje przed ogólnym mnożnikiem gold (`game.js:16149`, `:12205`).

Eliksiry to kolejna zakładka Camp: 75/200/500 za pełny zapas 5 ładunków, nie za jeden ładunek; uzupełnienie jest proporcjonalne do braków. Działają 6 tur; tiers dają +30/60/90 ARM lub ATK, albo +15/30/45 punktów procentowych crit. Odblokowania tiers: 0/20/40. Koszt jednostkowy pełnego zakupu to 15/40/100. Są narzędziem na krótki skok zagrożenia, ale regularne używanie konkuruje z progresją stałą (`elixir-data.js`, `game.js:11078`).

Merchant podczas wyprawy także konkuruje o zasoby: upgrade'y skilli mogą pobierać Run Gold i Camp Gold. Shield kosztuje 300/600/1200, Dash 400/800/1600, AoE 600/1200/2400 za kolejne tiers. Brak AoE lub wyższego Shield zmienia możliwość obsługi trudnego składu, nawet gdy statystyki Camp wyglądają dobrze (`camp-runtime.js:71`, `skills-data.js:30`).

## 7. Czy dochód nadąża?

Nagrody za typ enemy są stałe z depth: Slime 2, Skeleton 3, Brute/Skitter 4, Acolyte 5, Totem 6, Riftweaver 7, Bulwark 9, Warden 35. Elita dodaje bazowo 3. Skrzynia z gold daje 4–8, w treasure ×6 (`game.js:16149`, `:17583`). Głębsze pokoje zwiększają przychód głównie składem, elitami i dodatkowymi mechanikami, nie indywidualnym skalowaniem nagrody.

W izolowanym modelu 21→99 średnie HP pokoju rośnie 6.47×, a base kill gold 1.35×. Cena 3334 odpowiada około 124 pokojom przy bazowym przychodzie 26.95 wyłącznie z zabijania; to ilustracja skali kosztu, nie prognoza czasu farmienia. Relikwie, bossowie, skarby, elity, Otter, mutatory i sprzedaż mogą istotnie zwiększyć dochód. Sprzedaż może jednocześnie osłabiać build. Bez kompletnego modelu tych źródeł i decyzji gracza nie wolno przeliczać tabeli na „liczbę koniecznych runów”.

Normalna ekstrakcja przenosi Run Gold 1:1 do Camp. Emergency bez Stash zachowuje 30%. Niepowodzenie nie realizuje tego transferu. Camp upgrades i bonusy sesyjne to progresja zachowywana między wyprawami w ramach gry; nie należy utożsamiać jej z nieograniczonym trwałym wzmocnieniem konta po Final Defeat. Lokalna ścieżka wywołuje wtedy reset (`game.js:10608`, `:10842`, `:15102`).

Greed daje +40% gold, ale też ×1.2 enemy HP i ×1.25 shop cost. Na samym stosunku waluta/cena ulepszenia korzyść wynosi około 1.4/1.25 = 1.12, przed pozostałymi efektami i zaokrąglaniem. Podatek sklepu jest zapamiętywany na wizytę w Camp. Ascension dodatkowo zwiększa ATK enemies o 3% co 3 osiągnięte depth (`game.js:11985`, `:12093`, `:10619`). Analiza konkretnego problematycznego runu musi uwzględniać te wybory.

## 8. Co kompensuje skalowanie poza sklepem

Skrzynie dają bazowo +2/3/4/5 ATK lub ARM zależnie od depth; HP +5/7/10. Maksymalnie 5 zdobyczy każdej statystyki na bucket 10 depth. Bonusy są przenoszone między wyprawami tej samej sesji, a ATK korzysta z Blade. Zwykły combat ma średnio 0.75 skrzyni: 1–2 próby po 50%. Standardowa skrzynia ma 24% szans na ATK, 16% ARM, 18% max HP, 20% leczenia. Nie jest to gwarantowany rozwój statystyk na każdym depth (`loot-tables.js:16`, `game.js:10927`, `:11016`, `:13489`, `:17261`).

Relikwie, skill tiers, Fury, osłony, wykorzystywanie hazards przeciw enemies oraz powrót na niższy checkpoint są istotne. Nie można porównywać wszystkich późnych przeciwników z nieulepszonym graczem i ogłaszać gry niemożliwą. Z drugiej strony mocne combo relikwii może maskować problemy podstawowej krzywej. Konieczne jest rozdzielenie silnych i przeciętnych buildów oraz pierwszego podejścia od farmionej sesji.

## 9. Decyzje do rozważenia, bez zmiany kodu

1. **Najpierw zbadać próg 20.** Oddzielić w wariantach testowych wzrost statystyk, szóstego enemy i wejście Skittera. Pozwala to ustalić, co tworzy największy skok, zamiast obniżać całą grę.
2. **Wprowadzić wspólny budżet składu do eksperymentu.** Liczyć support, kontrolę pola, tanków, DoT i elity. Przykładowy wariant do porównania: w pierwszych pokojach z nowym typem nie dopuszczać od razu dwóch supportów i elitarnego tanka obok niego. Nie ustalono jeszcze końcowych wag ani zakazów.
3. **Testować bleed oddzielnie.** Porównać obecny model z redukcją ticków przez armor albo ograniczeniem skalowania. Nie stosować obu zmian naraz w pierwszym porównaniu. Zachować znaczenie osłon i cleanse.
4. **Sprawdzić górną częstość elit i procentowe leczenie.** Rozdzielić trudność bazowego archetypu od bonusu elite i Acolyte. Górny ogon trudnych pokoi może wymagać korekty, nawet jeśli mediana jest dobra.
5. **Dopasować koszt progresji do docelowej długości sesji.** Najpierw określić, ile wypraw powinno prowadzić do checkpointów i tierów skilli. Dopiero wtedy porównać łagodniejszy wzrost cen z większym dochodem na głębokich poziomach. Globalne zwiększenie gold może równocześnie nadmiernie przyspieszyć zakupy u Merchant.
6. **Sprawdzić wartość i komunikację zakupów.** Szczególnie Bounty 1, późne Vitality vs Blade, armor vs DoT i Auto Potion vs śmiertelny cios. Eliksiry oceniać jako paczki 5 użyć, a nie pojedyncze zakupy za 500.

Nie rekomenduję obecnie konkretnego globalnego „−20% enemy HP”. Bez runów referencyjnych byłaby to arbitralna liczba; mogłaby nadmiernie wzmocnić dobry build, pozostawiając słabszy bez obrony przeciw DoT i blokadzie skilli.

## 10. Minimalny plan potwierdzenia w praktyce

To pozostała praca badawcza, nie wykonany playtest ani rozpoczęta implementacja:

- Rozdzielić Practice i Ranked oraz jawnie zapisać mutatory/pakty, liczbę wcześniejszych ekstrakcji, start depth, poziomy Camp, chest carry, skill tiers i relikwie.
- Zmierzyć okna 9–12, 18–22, 28–32, 38–42, 44–47, 64–67, 78–82, a finał osobno.
- Porównać pierwszy awans, przeciętny build po farmieniu i mocny build; identyczne zasoby startowe w porównaniach wariantów.
- Dla zwykłych pokoi raportować medianę/P90 tur walki i utraty HP, potions/room, deaths/100 rooms, emergency extracts, udział damage z direct/bleed/poison/hazards oraz statystyki konkretnych kombinacji.
- Dla ekonomii: rzeczywiście zbankowane gold na minutę i na życie, wydatki na leczenie/eliksiry/skille, czas do następnego istotnego zakupu oraz strata siły przez sprzedaż relikwii.
- Porównywać te same seedy/składy i zmieniać jeden mechanizm naraz. Observer Bot może uzupełniać pomiary, ale sam nie zastąpi gry człowieka; AI reaguje na powtarzalne strafe, a bot ma własną politykę farmienia.

Nieustalone pozostają: rzeczywisty depth wystąpienia problemu u użytkownika, konfiguracja jego builda, docelowa długość sesji, rozkład przeżywalności i pełny bilans dochodów. Dowody z kodu wskazują miejsca do korekty/testów, ale nie wyznaczają jeszcze ostatecznych wartości nowego balansu.

## Weryfikacja i zakres plików

Wykonano `npm run status:compact`, inspekcję źródeł i obliczenia Node opisane powyżej. Raportowi towarzyszy lokalny kalkulator w ignorowanym output. Nie zmieniono gry, testów, reguł Ranked ani handoffu. Nie wykonywano product suites, baseline ani headed QA, ponieważ nie zmieniano zachowania. Końcowy check whitespace: `git diff --check`.
