# START HERE — Dungeon of One Room v0.8.0

## Uruchomienie

Gra używa modułów i assetów ładowanych przez przeglądarkę, dlatego najlepiej uruchamiać ją przez lokalny serwer HTTP, a nie bezpośrednio jako `file://`.

W katalogu projektu:

```bash
python -m http.server 8000
```

Następnie otwórz:

```text
http://localhost:8000/
```

## Szybkie sprawdzenie nowych systemów

```text
http://localhost:8000/?scenario=expansion_enemies_hd
http://localhost:8000/?scenario=expansion_traps_hd
http://localhost:8000/?scenario=expansion_crossroads_hd
http://localhost:8000/?scenario=expansion_arena_hd
http://localhost:8000/?scenario=expansion_warden_collapse_hd
http://localhost:8000/?scenario=expansion_warden_reborn_hd
http://localhost:8000/?scenario=expansion_forge_boss_hd
```

## Dokumentacja zmian

Pełny opis zawartości, progów odblokowań, balansu, kontrgry, testów i dalszej roadmapy znajduje się w:

```text
EXPANSION_NOTES_PL.md
```

## Assety

Folder źródłowy `art` nie był dostępny. Nowe typy logiczne działają niezależnie od niego; na czas tej wersji przeciwnicy używają wariantów istniejących modeli, a pułapki i telegraphy są proceduralne. Dedykowane sprite'y można później podpiąć przez istniejące pola `renderType` bez zmian w AI.
