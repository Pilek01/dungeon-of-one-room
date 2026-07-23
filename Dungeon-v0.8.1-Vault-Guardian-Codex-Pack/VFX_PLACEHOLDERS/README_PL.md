# Placeholdery VFX Vault Guardiana

To są funkcjonalne, przezroczyste placeholdery pixel-art, a nie docelowa grafika.

## Zestawy

| Zestaw | Klatki | Czas klatki | Tryb |
|---|---:|---:|---|
| vault-chest-lock | 4 | 140 ms | pętla |
| hoard-sentence-mark | 6 | 120 ms | pętla |
| hoard-sentence-destroy | 8 | 75 ms | one-shot |
| lockdown-pulse-node | 6 | 105 ms | pętla |
| lockdown-pulse-blast | 8 | 70 ms | one-shot |

Classic ma klatki 16×16, HD ma klatki 64×64. Kotwica: środek pola.

`manifest.json` opisuje ścieżki, timing, liczbę klatek i tryb pętli.

Kod referencyjny posiada proceduralny fallback. Można więc wymienić te grafiki później bez zmiany logiki walki.
