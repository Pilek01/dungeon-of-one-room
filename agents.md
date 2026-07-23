# Zasady pracy w projekcie

## Dobór procesu do zadania

Najpierw oceń rozmiar zadania.

### Zadanie mikro
Zadanie jest mikro, jeżeli:
- dotyczy maksymalnie 5 plików,
- ma jasno określony rezultat,
- nie zmienia architektury ani publicznych API.

Dla zadania mikro:
- pracuj jednym agentem,
- nie twórz design doc ani formalnego planu,
- przed edycją podaj najwyżej 3 krótkie kroki,
- nie używaj worktree,
- nie dodawaj testów dla samych wartości, wymiarów lub plików PNG,
- uruchom najwyżej jeden bezpośrednio związany test,
- dla zmiany wizualnej wykonaj najwyżej jeden podgląd w grze,
- pokaż diff i zakończ.
- nie uruchamiaj żadnych skillów Superpowers,
- nie uruchamiaj brainstormingu, writing-plans, TDD ani worktree,
- nie uruchamiaj subagent-driven-development,
- nie twórz osobnych agentów implementacji i review,
- nie wykonuj pełnego QA ani pełnej procedury wydania,
- zastosuj najwyżej jeden bezpośrednio związany skill domenowy,
- wykonaj najwyżej jeden celowany test lub jeden podgląd wizualny.

### Zadanie standardowe
Dla zadania obejmującego kilka systemów:
- przedstaw plan liczący maksymalnie 7 kroków,
- pracuj jednym agentem, o ile części nie są naprawdę niezależne,
- uruchom tylko testy odpowiednich modułów,
- wykonaj jedno końcowe sprawdzenie wizualne, jeśli dotyczy.
- pracuj jednym agentem,
- przedstaw krótki plan maksymalnie 7 kroków,
- możesz użyć jednego właściwego skilla domenowego,
- nie używaj subagent-driven-development, worktree ani pełnego
  release verification bez wyraźnej zgody użytkownika.


### Zadanie duże lub wydaniowe

Skille procesowe Superpowers można zastosować tylko:

- po jawnym wywołaniu ich przez użytkownika,
- albo po przedstawieniu proponowanego workflow i otrzymaniu zgody.

Nigdy automatycznie nie wybieraj opcji „Subagent-Driven Development”.
Przed uruchomieniem subagentów podaj ich planowaną liczbę i zadania.
Przed uruchomieniem więcej niż 3 subagentów poproś o zgodę.

### Pełna weryfikacja
Pełny zestaw testów, desktop/mobile, osobne review, worktree
i subagenci są dozwolone tylko:
- przed wydaniem,
- po większym refaktorze,
- albo na wyraźne polecenie użytkownika.

## Ogólne zasady
- Nie wykonuj usprawnień niezwiązanych z zadaniem.
- Nie aktualizuj progress.md po małych zmianach.
- Nie przygotowuj integracji gałęzi bez polecenia.
- Jeżeli zmiana dotyczy generowanych danych, sprawdź generator,
  ale tylko wtedy, gdy zmieniana wartość rzeczywiście pochodzi z generatora.
- Zawsze sprawdź końcowy diff pod kątem niezamierzonych zmian.

## Routing skillów i workflowów

Przed uruchomieniem opcjonalnego skilla sklasyfikuj zadanie jako:
mikro, standardowe albo duże/wydaniowe.


### Ograniczenie zakresu

Instrukcja użytkownika dotycząca zakresu, liczby testów, liczby agentów
i sposobu weryfikacji ma pierwszeństwo przed opcjonalnym workflowem.

Nie rozszerzaj małego zadania do pełnego procesu projektowego,
wydaniowego ani integracyjnego.