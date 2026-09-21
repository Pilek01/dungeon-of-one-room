# Audyt HD2 — grafika, animacje, VFX, SFX i nieruchomy totem

Data: 2026-09-15. Audyt aktualnego drzewa roboczego, HEAD `0718173`, HD2 włączone przez `?hd2=1`.
Zakres: ocena i rekomendacje; bez zmiany gry, assetów, reguł Ranked lub wdrożenia.
Wcześniejsze lokalne poprawki merchanta i układu mutatorów pozostają niezależne.

## Wniosek

Warto kontynuować HD2, ale największy zysk przyniesie teraz spójność animacji z akcjami, poprawne zakotwiczenie, czytelność umiejętności i budżet ładowania. Nie potrzeba kolejnej wymiany całego bestiariusza.
Zachować ciemny gotycki klimat, obecną jasność bohatera i wielkość planszy — zgodnie z uwagami użytkownika.

## Dowody i granice audytu

- Wykonano `node scripts/build-hd2-preview.mjs` na aktualnych plikach.
- `node scripts/verify-hd2-early.mjs`: PASS, 365 kombinacji podglądu, 2400 wczytanych assetów HD2, boot i akcje gracza oraz siedem scenariuszy bossów; brak błędów JS i brakujących zasobów w tych scenariuszach.
- `node scripts/verify-hd2-npc-skills.mjs`: PASS, 12 kierunkowych podglądów, rzeczywiste heal/buff/rift/bash, pudła i mute; 13 poprawnych niezerowych sygnałów OfflineAudioContext.
- Obejrzano nowe zrzuty: player, slime, skeleton, skitter, acolyte, riftweaver, totem cast/idle/awaken, roster w grze, Vault Guardian i Warden phase 2.
- Odtworzono odrzut totema oraz wybór klipów przez rzeczywiste funkcje w izolowanym harnessie VM. Raport: `output/verification/hd2-totem-audit.json`.
- Pomiar nagłówków i rozmiarów PNG: `output/verification/hd2-audit-budget.json`.
- Nie wykonano odsłuchu na fizycznym sprzęcie ani testu wydajności na telefonie. Ocena barwy i miksu SFX poniżej to zalecenia na podstawie konstrukcji dźwięku, nie deklaracja odsłuchu. Suma RGBA nie jest pomiarem pamięci procesu ani GPU.
- Dawne dokumenty warsztatu opisują historyczny etap sprzed deployu; nie służą do określania aktualnego stanu produkcji.

## Co działa dobrze

1. Rozpoznawalne sylwetki i zachowany mroczny charakter. Na obejrzanych scenach HD2 nie wymaga rozjaśniania całej gry ani powiększania planszy.
2. Player ma wyraźniejsze fazy zamachu; skeleton czytelnie napina łuk. Rozdzielenie przygotowania i wykonania strzału jest wartościowe.
3. Slime zyskuje deformację masy, a skitter czytelniejsze segmenty i odnóża. Nie rekomenduję ponownego redesignu całego modelu skittera bez konkretnego problemu w ruchu.
4. Acolyte ma osobne heal i buff, Bulwark gest pchnięcia tarczą. VFX bossów zachowują kierunek i obszar zagrożenia.
5. Dźwięki NPC są wyzwalane zdarzeniami, a nie renderowaniem; korzystają ze wspólnego mute/master. Trafienie w gracza nie jest wymagane do części sygnałów wykonania ataku.
6. HD2 jest oddzielone od domyślnego HD1. To pozwala porównywać poprawki bez wymiany całej oprawy naraz.

## Totem — ustalenia wymagające pierwszeństwa

### P1: nieruchome AI nie oznacza odporności na przesunięcie

`game.js:20228` obsługuje totema przez `castTotemHex()` i wraca przed zwykłym ruchem AI.
Jednak `forced-movement.js:1` chroni przed odrzutem tylko Blacksmith Guardiana. Dash, Shockwave i Shield korzystają z tej reguły.

Odtworzenie na funkcji `tryKnockbackEnemyFromPoint`: totem przesunął się z (3,3) do (4,3); wynik `true`. Renderer następnie wybrał `enemy.totem.base.move.01`, a plik `assets/hd/all-v2/totem/base-move-01.png` nie istnieje. To nie jest dowód konkretnego wyglądu awaryjnego renderowania w każdej sytuacji, ale potwierdzona niezgodność wyboru animacji z katalogiem.

Zalecenie zgodne z wymaganiem użytkownika: totem odporny na wymuszony ruch; dodatkowo renderer nie może wybierać dla niego `move`, nawet przy starym stanie interpolacji z zapisu. Testować dash, Shockwave, Shield, łańcuchowy odrzut i stare save. Jest to osobna zmiana reguły odrzutu, więc przy implementacji należy uwzględnić zgodność Ranked; sama podmiana obrazka jej nie naprawi.

### P1: jeden castFlash oznacza trzy różne rzeczy

W `game.js:19883` i kolejnych funkcjach:
- poison bolt ustawia `castFlash = 120` po nałożeniu efektu;
- hex również ustawia 120 po zmianie cooldownu;
- pasywna aura ustawia co najmniej 80.

`render/hd-renderer-layers.js:832` wybiera dla totema cast na podstawie samego castFlash, z czasem bazowym 140 ms. Pomiar selektora: 120 oznacza od razu klatkę 2, 80 — klatkę 4. Totem nie ma korekty release/recovery takiej jak skeleton/acolyte/riftweaver/bulwark. Efekt może więc już działać, gdy obraz nadal pokazuje przygotowanie. Aura może uruchamiać gest rzucania bez aktywnego strzału. Również inne źródła castFlash, np. disorientation, wymagają rozdzielenia od rzucania.

Zalecenie: osobna prezentacja idle/aura, poison-release i hex-release na podstawie rzeczywistych zdarzeń. Nie dodawać czasu oczekiwania do AI ani nie opóźniać efektów zaklęcia dla potrzeb animacji.

### P2: korpus powinien być zakotwiczony

W aktualnym cast widać przechylenie kolumny. To wynika także z promptu `art/source/all-v2/totem-totem.json`, który jawnie prosił o „stone leans slightly”. Nie odpowiada to dobrze konstrukcji wbitej w ziemię.

Nowy zestaw powinien zachować identyczny cokół, położenie dolnej części korpusu i skalę. Animować runy, światło w pęknięciach, drobiny i pył. Dla hit: odpryski/rozbłysk zamiast podskoku. Dla śmierci: pęknięcie i osiadanie gruzu w miejscu.

Nie generować chodu ani czterech kierunków. Warsztat mapuje opcję „Ruch” na `awaken` i odtwarza ją z czasem ruchu 120 ms — zmienić nazwę i osobny czas podglądu. `selectEnemyVisual()` nie wybiera normalnie `awaken`, więc jego obecność w warsztacie nie potwierdza używania w grze.

## Pozostałe priorytety

| Priorytet | Obszar | Ustalenie / ryzyko | Zalecana poprawa |
|---|---|---|---|
| P1 | Ładowanie HD2 | 2400 PNG: 1248 × 128² i 1152 × 256²; 77,79 MiB plików, 366 MiB pełnego RGBA. Test potwierdza wczytywanie całego katalogu. | Dzielić katalog według potrzeb/scen/biomów; rozważyć atlasy i format z alpha po pomiarze jakości i dekodowania. Nie podwajać bezwarunkowo liczby klatek. |
| P1 | Śmierć wrogów | Przygotowane klatki śmierci istnieją w warsztacie, ale gra usuwa przeciwników natychmiast. | Krótkie obiekty wyłącznie wizualne po śmierci. Nagroda, zwolnienie pola i logika room clear pozostają natychmiastowe. Najpierw wykorzystać istniejące klatki. |
| P2 | Zakotwiczenie sprite’ów | Pipeline przycina każdą klatkę do jej bounding box i centruje cały obraz. Wyciągnięta broń/glow mogą zmieniać środek kadru mimo stabilnej skali. | Kotwiczyć stopy/korpus, a nie obwiednię wszystkich pikseli; efekty oddzielić od sylwetki. Sprawdzić dryf klatka po klatce przed regeneracją. |
| P2 | Płynność | Ruch trwa 120 ms, atak gracza 240 ms; jest po osiem klatek. Przy 60 Hz ruch zajmuje około siedmiu odświeżeń. Część realnych ataków melee używa tylko klatek 6–8. | Najpierw poprawić dobór póz, przejścia i zgodność z momentem trafienia. Więcej klatek całej sekwencji nie pomoże, jeżeli runtime pokazuje tylko końcówkę. |
| P2 | Tożsamość umiejętności | Wiele ataków korzysta ze wspólnych gestów cast i podobnych świetlnych efektów. Totem szczególnie zlewa aurę, jad i hex. | Oddzielne kształty, rytm i kolory dla jadu, klątwy, leczenia, buffu, riftu. Nie polegać tylko na kolorze. |
| P2 | Czytelność VFX | Warden phase 2 ma już dużą, złożoną aurę. Dodawanie większej poświaty może zakrywać pola i aktorów; nie stwierdzam automatycznie błędu każdego obecnego telegraphu. | Jasny obrys obszaru zagrożenia, oszczędne wnętrze, krótki rozbłysk wykonania i szybkie wygaszenie. Audyt także przy nakładaniu kilku zdolności. |
| P2 | SFX | 13 krótkich syntezowanych cue, zwykle 1–2 oscylatory. Dobre sygnały funkcjonalne; test nie mierzy rozpoznawalności ani jakości barwy. | Osobna praca audio: metal/kość/kamień/mokry impact, warstwa magii, krótkie ogony pogłosowe, balans z muzyką. Zweryfikować odsłuchem. |
| P2 | Miks wielu NPC | Gate ogranicza ten sam rodzaj cue globalnie do jednego na 80 ms, niezależnie od źródła. Może ukryć sygnał kolejnego przeciwnika. | Priorytety zagrożeń i ograniczenie nakładania; nie usuwać limitera bez testu głośności i gęstych walk. |
| P3 | NPC przyjazne / otoczenie | Nie ma potrzeby nadawać im pełnego zestawu walki. | Krótkie, oszczędne gesty interakcji kupca, reakcja paleniska Forge, drganie łańcucha i run portalu. Potem test w faktycznej skali gry. |

## Gdzie generowanie obrazów da największy zysk

1. **Totem:** jedna zatwierdzona nieruchoma sylwetka i osobne warstwy run. Zestawy idle, hex-release, venom-release, hit, collapse; bez ruchu korpusu, bez kierunków chodu. Najpierw kilka kluczowych póz i test kotwicy, dopiero potem komplet.
2. **Umiejętności:** tekstury riftu, runicznych pieczęci, trującego rdzenia, pęknięć ziemi i śladów ciosu. Obszar działania oraz timing nadal wyznacza kod. Oddzielne tekstury efektów, nie glow trwale wmalowany w każdą klatkę aktora.
3. **Kontakt i rozpad:** odpryski kamienia totema, kości skeletona, masa slime’a, fragmenty chityny skittera. Krótkie efekty o czytelnych kształtach dają większy zysk niż dodatkowe detale całej planszy.
4. **Brakujące gesty skilli gracza:** po porównaniu z istniejącymi tierami — osobne pozy dash/shield/shockwave zamiast kolejnego wariantu zwykłego ataku. Nie zmieniać czasu tury, zasięgu ani balansu.
5. **Później otoczenie:** warianty materiałów i małe animowane elementy z zachowaniem aktualnej palety. Bez rozjaśniania bohatera i bez przebudowy skali planszy.

Narzędzie Images pomaga w grafice rastrowej, nie zastępuje implementacji synchronizacji ani produkcji SFX. Dostępne wywołanie narzędzia nie ujawnia wyboru/zweryfikowanej tożsamości modelu; nie można uczciwie zagwarantować, że wygenerowany materiał pochodzi konkretnie z „Images 2.5”. W tym audycie nie generowano nowych grafik.

## Zalecana kolejność dalszej pracy

1. Totem: wykluczyć przesuwanie, brakujący move i fałszywy cast; poprawić nazwy w warsztacie.
2. Totem: zatwierdzić nieruchomy model i event-driven VFX dla jadu/hexu/aureoli.
3. Uruchomić istniejące śmierci jako prezentację po zdarzeniu śmierci.
4. Pakowanie i ładowanie na żądanie, zanim powstanie kolejna duża partia assetów.
5. Dopiero potem nowe grafiki umiejętności i dopracowanie miksu SFX.

Każda partia: porównanie HD1/HD2 w tej samej scenie, test normalnego czasu gry (nie tylko slow motion), kontrola nakładania efektów, braku wpływu na tury i odczytów Ranked. Nie wydłużać okien ataku, nie tworzyć sztucznej telegraphii, nie utrzymywać martwego wroga w aktywnej symulacji.
