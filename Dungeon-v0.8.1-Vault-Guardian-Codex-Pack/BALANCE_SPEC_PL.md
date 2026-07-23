# Vault Guardian — specyfikacja balansu

## Zamierzony rytm pierwszych 30 tur

| Tura | Zdarzenie dominujące |
|---:|---|
| 4 | Lockdown Pulse — przygotowanie |
| 5 | Lockdown Pulse — detonacja, start cooldownu 10 |
| 10 | Hoard Sentence — oznaczenie kufra |
| 15 | Oznaczony kufer zostaje zniszczony; Lockdown gotowy, ale odroczony przez regułę antynakładania |
| 16 | Lockdown Pulse — kolejne przygotowanie |
| 17 | Lockdown Pulse — detonacja |
| 20 | Hoard Sentence — kolejne oznaczenie |
| 25 | Kolejny kufer zostaje zniszczony, jeśli Guardian nadal żyje |
| 27 | Lockdown Pulse może wrócić po swoim cooldownie |
| 30 | Kolejny Hoard Sentence |

## Uzasadnienie

- Gracz ma około 15 tur na uratowanie pełnej puli łupu.
- Każde kolejne 10 tur walki kosztuje potencjalnie następny kufer.
- Lockdown Pulse wymusza ruch, lecz ma pełną turę kontrgry.
- Obrażenia 65% ATK są karą za złą pozycję, ale nie zastępują głównego slamu.
- Slam z cooldownem 5 pozostaje groźny, lecz nie konkuruje co chwilę z dwoma nowymi systemami.
- Druga duża umiejętność nie zwiększa losowej presji — używa stałych, czytelnych węzłów będących już celem gracza.

## Parametry do późniejszej telemetrii

Warto śledzić:

- średnią długość walki z Guardianem,
- średnią liczbę ocalałych kufrów,
- procent walk kończących się przed pierwszym zniszczeniem,
- trafialność Lockdown Pulse,
- liczbę obrażeń z pułapek po odepchnięciu,
- różnicę wyników z Pact of Chains i bez niego.

Próg sugerujący nerf: mniej niż 50% graczy na właściwym poziomie mocy ratuje przynajmniej połowę kufrów.
Próg sugerujący buff: ponad 80% walk kończy się przed pierwszym zniszczeniem kufra.
