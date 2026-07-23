# Prompt do Codex — Vault Guardian v0.8.1

Pracujesz na projekcie **Dungeon of One Room v0.8.0**. Obok projektu masz paczkę `Dungeon-v0.8.1-Vault-Guardian-Codex-Pack` zawierającą patch, referencyjne pliki, testy i placeholdery VFX.

## Cel

Wdróż rozbudowę Vault Room i Vault Guardiana dokładnie według poniższej specyfikacji. Zachowaj zgodność z istniejącą architekturą, rendererami Classic/HD, zapisem gry i wszystkimi dotychczasowymi mechanikami.

## Najpierw

1. Zrób kopię bezpieczeństwa lub osobną gałąź Git.
2. Sprawdź, czy projekt odpowiada wersji v0.8.0.
3. Preferuj zastosowanie:

```bash
git apply --check <ścieżka-do-paczki>/PATCH/vault-guardian-v0.8.1.patch
git apply <ścieżka-do-paczki>/PATCH/vault-guardian-v0.8.1.patch
```

4. Jeżeli patch nie pasuje z powodu późniejszych zmian, użyj `REFERENCE_IMPLEMENTATION/` jako źródła prawdy i przenieś zmiany semantycznie. Nie nadpisuj cudzych zmian w ciemno.

## Wymagania gameplayowe

### 1. Zapieczętowane kufry

- W Vault Room żaden nieotwarty kufer nie może zostać otwarty ani zebrany, dopóki żyje przeciwnik `type === "guardian"`.
- Próba wejścia na zapieczętowany kufer ma zostać zablokowana bez przesunięcia gracza.
- Magnetic Shard nie może automatycznie otwierać tych kufrów ani spamować logu.
- Po śmierci Guardiana wszystkie ocalałe kufry odblokowują się natychmiast.
- Kufer zniszczony przez Guardiana nie może nigdy wygenerować łupu.

### 2. Hoard Sentence

- Pierwsze użycie: 10. tura walki w Vault Room.
- Cooldown po użyciu: 10 tur.
- Umiejętność zużywa akcję Guardiana.
- Wybiera jeden nieotwarty, niezniszczony i jeszcze nieoznaczony kufer.
- Nie wybiera kufra będącego aktualnym celem Lockdown Pulse.
- Na kufrze pojawia się widoczny licznik 5 tur.
- Licznik zmniejsza się dokładnie raz na turę walki.
- Po dojściu do 0 kufer zostaje trwale zniszczony, ale tylko jeśli Guardian nadal żyje w momencie rozwiązania efektu.
- Jeśli Guardian zginie wcześniej, oznaczenie zostaje anulowane i kufer ocaleje.
- Otwieranie save’a w trakcie licznika musi odtworzyć stan bez resetu lub duplikacji.

### 3. Lockdown Pulse

- Pierwsze przygotowanie: 4. tura walki.
- Wybiera maksymalnie dwa dostępne i nieoznaczone kufry.
- Pierwszy cel powinien wywierać presję na gracza; drugi powinien być możliwie odseparowany dla czytelności telegraphu.
- Przygotowanie trwa pełną turę i zużywa akcję Guardiana.
- Każdy wybrany kufer emituje krzyż: środek oraz pola N/S/E/W.
- W kolejnej akcji Guardiana krzyże detonują.
- Gracz otrzymuje maksymalnie jedno trafienie, nawet jeśli stoi na polu wspólnym dwóch krzyży.
- Obrażenia: 65% efektywnego ATK Guardiana, co najmniej minimalne obrażenia gry.
- Trafienie odpycha o 1 pole od najbliższego węzła.
- Forced movement ma korzystać z istniejących zasad: blokady, miny, spike, Frost Rune i pit.
- Pact of Chains blokuje forced movement, ale nie obrażenia.
- Cooldown 10 tur liczony po detonacji.
- Lockdown nie może wybierać kufra z aktywnym Hoard Sentence.

### 4. Rebalans i priorytety

- Cooldown slamu Vault Guardiana: 5 tur. Brute pozostaje przy dotychczasowej wartości.
- Nie rozpoczynaj slamu, jeśli duża umiejętność Vault Guardiana będzie gotowa za 0–1 turę.
- Priorytet akcji:
  1. rozwiąż aktywny Lockdown Pulse,
  2. użyj Hoard Sentence, jeśli gotowe,
  3. rozpocznij Lockdown Pulse, jeśli gotowe,
  4. dopiero potem slam, melee lub ruch.
- Jeśli kufer został zniszczony przez Hoard Sentence w bieżącej turze, nie rozpoczynaj w tej samej turze kolejnego dużego telegraphu.
- Rozpoczęcie dużej umiejętności ma anulować ewentualny stary wind-up slamu.

## Stan i save compatibility

Dodaj i zachowuj co najmniej:

Na Guardianie:

```text
vaultSentenceCooldown
vaultLockdownCooldown
vaultLockdownAiming
vaultLockdownTargets
vaultChestDestroyedTurn
```

Na kufrze:

```text
destroyed
vaultCondemned
vaultCondemnTurns
vaultCondemnMaxTurns
```

- Stare save’y bez tych pól muszą się bezpiecznie zainicjalizować.
- Nie zapisuj obiektów renderera w stanie symulacji.
- Snapshot HD ma kopiować tylko pola potrzebne do prezentacji oraz klonować tablice targetów bez wycieków referencji.

## VFX i czytelność

Wymagany jest działający proceduralny fallback w Classic oraz HD:

- złota pieczęć/kłódka na kufrach podczas życia Guardiana,
- czerwono-złoty marker i licznik Hoard Sentence,
- zgliszcza po zniszczonym kufrze,
- cyjanowo-złote krzyże Lockdown Pulse,
- osobne zaznaczenie węzłów na wybranych kufrach.

Paczka zawiera również placeholdery PNG w `VFX_PLACEHOLDERS/`. Są opcjonalne: mechanika i czytelność nie mogą zależeć od ich załadowania. Jeśli je podłączysz, oznacz wpisy manifestu jako `critical: false` i zachowaj proceduralny fallback.

## Scenariusz QA

Zachowaj lub dodaj:

```text
?scenario=expansion_vault_guardian_hd
```

Scenariusz ma pokazywać zapieczętowane kufry, marker Hoard Sentence oraz Lockdown Pulse bez zmiany balansu zwykłej rozgrywki.

## Pliki objęte referencyjnym patchem

```text
game.js
vault-room.js
scenario-overrides.js
render/visual-snapshot.js
render/hd-vfx.js
render/hd-renderer-layers.js
tests/vault-room.test.js
tests/vault-guardian-integration.test.js
tests/visual-snapshot.test.js
tests/hd-vfx.test.js
```

## Walidacja

Uruchom:

```bash
node --check game.js
node --check vault-room.js
node --check scenario-overrides.js
node --check render/visual-snapshot.js
node --check render/hd-vfx.js
node --check render/hd-renderer-layers.js
node tests/vault-room.test.js
node tests/vault-guardian-integration.test.js
node tests/visual-snapshot.test.js
node tests/hd-vfx.test.js
node tests/scenario-overrides.test.js
node --test tests/*.test.js
```

Baseline v0.8.0 ma 32 znane niezaliczone testy związane głównie z usuniętym katalogiem `art`, wersją Pillow i wcześniejszymi kontraktami assetów. Nie zwiększaj tej liczby.

## Kryteria odbioru

- Kufry nie dają się zebrać przed śmiercią Guardiana.
- Pierwszy Hoard Sentence pojawia się w 10. turze i niszczy kufer 5 tur później, jeśli Guardian żyje.
- Śmierć Guardiana przed końcem licznika ratuje kufer.
- Kolejne znaczniki pojawiają się co 10 tur, o ile istnieją cele.
- Lockdown ma pełną turę ostrzeżenia, trafia tylko raz i poprawnie obsługuje forced movement.
- Slam ma cooldown 5 i nie nakłada się z dużymi umiejętnościami.
- Save/load zachowuje countdown i telegraph.
- Classic i HD pokazują wszystkie stany czytelnie także bez nowych PNG.
- Nowe testy przechodzą, a liczba starych błędów nie rośnie.

Na końcu podaj:

1. listę zmienionych plików,
2. krótkie podsumowanie implementacji,
3. wyniki testów,
4. informację, czy użyłeś PNG, czy tylko fallbacku proceduralnego,
5. ewentualne konflikty z kodem powstałym po v0.8.0.
