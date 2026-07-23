# Dungeon v0.8.1 — Vault Guardian / Codex Pack

Paczka zawiera kompletną referencyjną implementację rozbudowy Vault Room oraz Vault Guardiana dla projektu Dungeon of One Room v0.8.0.

## Co zmienia patch

1. **Wszystkie kufry w Vault Room są zapieczętowane**, dopóki Vault Guardian żyje.
2. **Hoard Sentence**:
   - pierwsze użycie w 10. turze walki,
   - oznacza jeden dostępny kufer,
   - kufer ma widoczny licznik 5 tur,
   - jeśli Guardian nadal żyje po wyzerowaniu licznika, kufer zostaje trwale zniszczony bez łupu,
   - cooldown: 10 tur,
   - śmierć Guardiana natychmiast anuluje wszystkie znaczniki.
3. **Lockdown Pulse**:
   - pierwsze przygotowanie w 4. turze,
   - wybiera maksymalnie dwa nieoznaczone kufry,
   - przez pełną turę pokazuje krzyżowe pola rażenia,
   - następnie zadaje 65% efektywnego ATK Guardiana i odpycha o 1 pole,
   - każdy gracz może otrzymać obrażenia tylko raz, nawet gdy dwa krzyże nachodzą na siebie,
   - Pact of Chains blokuje odepchnięcie,
   - cooldown po detonacji: 10 tur.
4. Slam Guardiana ma cooldown zwiększony z 3 do **5 tur**.
5. Priorytety AI zapobiegają nakładaniu dużych telegraphów:
   - detonacja Lockdown,
   - Hoard Sentence,
   - przygotowanie Lockdown,
   - slam / zwykła akcja.
6. Pozostałe kufry odblokowują się natychmiast po śmierci Guardiana.
7. Stan nowych mechanik zapisuje się w run save i poprawnie odtwarza po wczytaniu.
8. Dodano proceduralny fallback VFX dla Classic i HD oraz osobne placeholdery PNG.
9. Dodano scenariusz QA:
   - `?scenario=expansion_vault_guardian_hd`

## Najbezpieczniejszy sposób instalacji

Z katalogu głównego czystej wersji v0.8.0:

```bash
git apply --check PATCH/vault-guardian-v0.8.1.patch
git apply PATCH/vault-guardian-v0.8.1.patch
```

Ścieżkę do patcha dopasuj do miejsca rozpakowania tej paczki.

Jeżeli projekt nie jest repozytorium Git, Codex może porównać pliki z `REFERENCE_IMPLEMENTATION/` i przenieść zmiany semantycznie. Nie zaleca się bezrefleksyjnego nadpisywania `game.js`, jeśli po v0.8.0 pojawiły się w nim inne zmiany.

## Placeholdery VFX

`VFX_PLACEHOLDERS/` zawiera przezroczyste animacje pixel-art:

- `vault-chest-lock` — 4 klatki,
- `hoard-sentence-mark` — 6 klatek,
- `hoard-sentence-destroy` — 8 klatek,
- `lockdown-pulse-node` — 6 klatek,
- `lockdown-pulse-blast` — 8 klatek.

Każdy zestaw ma wariant:

- Classic: 16×16,
- HD: 64×64,
- osobne klatki,
- poziomy strip,
- dane animacji w `manifest.json`.

Kod działa również bez tych PNG, ponieważ zawiera proceduralny fallback. Dzięki temu grafiki można później podmienić bez blokowania mechaniki.

Gotową strukturę katalogów assetów do skopiowania zawiera:

```text
COPY_INTO_PROJECT/
```

Opcjonalne klucze dla manifestu HD znajdują się w:

```text
integration/hd-asset-manifest-snippet.js
```

## Testy

Patch został sprawdzony poleceniami:

```bash
node --check game.js
node --check vault-room.js
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

Wynik pełnego zestawu:

- v0.8.0 baseline: **300 testów, 268 zaliczonych, 32 niezaliczone**,
- po patchu: **303 testy, 271 zaliczonych, 32 niezaliczone**.

Patch nie dodał nowych niezaliczonych testów. Istniejące 32 błędy pochodzą z baseline, głównie z usuniętego katalogu `art`, wersji Pillow i wcześniejszych kontraktów assetów.

Pełne logi są w `TEST_RESULTS/`.
