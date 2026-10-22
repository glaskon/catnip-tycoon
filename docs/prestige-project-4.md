# Projekt 4 — prestiż

## Stan przed zmianami

Pomiar kodu z `dev` przed pierwszą zmianą. Numer n oznacza wykonywany reset (przed nim prestigeCount=n−1). Dokładny próg, bez ulepszeń, zwierzaka i boosterów. Mnożnik ryb po resecie. Wbrew briefowi pierwiastek wypłacał catnip, nie ryby; Kocia Łaska działała dopiero od 50 ukończonych prestiży. Istniały już bonusy progowe.

| Reset | Wymaganie (ryby) | Ryby | Catnip bazowy | Kocia Łaska | Mnożnik ryb po |
|---:|---:|---:|---:|---:|---:|
| 1 | 10000000 | 0 | 31 | 0 | 1.00 |
| 2 | 20000000 | 0 | 44 | 0 | 1.00 |
| 3 | 30000000 | 0 | 54 | 0 | 1.00 |
| 4 | 40000000 | 0 | 63 | 0 | 1.00 |
| 5 | 50000000 | 0 | 70 | 0 | 2.00 |
| 6 | 60000000 | 0 | 77 | 0 | 2.00 |
| 7 | 70000000 | 0 | 83 | 0 | 2.00 |
| 8 | 80000000 | 0 | 89 | 0 | 2.00 |
| 9 | 90000000 | 0 | 94 | 0 | 2.00 |
| 10 | 100000000 | 0 | 100 | 0 | 2.10 |
| 11 | 110000000 | 0 | 104 | 0 | 2.10 |
| 12 | 120000000 | 0 | 109 | 0 | 2.10 |
| 13 | 130000000 | 0 | 114 | 0 | 2.10 |
| 14 | 140000000 | 0 | 118 | 0 | 2.10 |
| 15 | 150000000 | 0 | 122 | 0 | 2.10 |
| 16 | 160000000 | 0 | 126 | 0 | 2.10 |
| 17 | 170000000 | 0 | 130 | 0 | 2.10 |
| 18 | 180000000 | 0 | 134 | 0 | 2.10 |
| 19 | 190000000 | 0 | 137 | 0 | 2.10 |
| 20 | 200000000 | 0 | 141 | 0 | 2.20 |
| 21 | 210000000 | 0 | 144 | 0 | 2.20 |
| 22 | 220000000 | 0 | 148 | 0 | 2.20 |
| 23 | 230000000 | 0 | 151 | 0 | 2.20 |
| 24 | 240000000 | 0 | 154 | 0 | 2.20 |
| 25 | 250000000 | 0 | 158 | 0 | 2.20 |

## Commit 1

Nowy zapisany `prestigeMultiplier`: +0,1/reset, limit ×3. `recalcFPS()` mnoży produkcję kotów, `getCatnipShrineRate()` produkcję catnipu. Booster pozostaje niezależny; reset przelicza go przez `recomputeBoostedValues()`. Offline korzysta z tych samych funkcji. Dotychczasowe bonusy progowe zostają, więc po 20 resetach łączny mnożnik ryb wynosi ×6,6 (nowy składnik ×3).

Ulepszenia za catnip zostają, rybne (również poziomowe) resetują się poza jednym wskazanym. Ulepszenia za diamenty zachowują dotychczasowe działanie. Kotwica zostawia jedną posiadaną sztukę; nie tworzy nieposiadanego kota.

Decyzja migracyjna: brak nowego pola oznacza ×1, bez zmiany zasobów i bieżących stawek przy wczytaniu. Gracz ze starym zapisem zbiera nowy bonus przez następnych 20 resetów. Natychmiastowe przyznanie bonusu za wcześniejsze resety przeczyłoby wymaganiu braku skoku wartości.

## Commit 2 — progi i czas rundy

`n` to numer wykonywanego resetu: do n=21 wymaganie wynosi 10 mln × n; później 10 mln × n²/21. To dokładnie warunek „powyżej 20 ukończonych prestiży”. Przejście 200→210 mln jest liniowe; następny przyrost wynosi 20,476 mln. Reset 25 wymaga 297,619 mln, czyli o 19,05% więcej niż liniowe 250 mln.

Czas to oszacowanie dla średniej bazowej produkcji kotów 10 000 ryb/s (np. równowartość 10 sfinksów), mnożonej przez bonusy posiadane PRZED resetem. Bez klikania, zwierzaka i boosterów. To porównanie przy tej samej średniej bazie, nie symulacja zakupów od zera ani obietnica czasu gry. Nagroda na tym etapie nadal jest catnipem.

| Reset | Wymaganie (mln) | Nagroda (catnip) | Nowy mnożnik po | Łączny mnożnik ryb po | Czas (min) |
|---:|---:|---:|---:|---:|---:|
| 1 | 10.000 | 31 | 1.10 | 1.10 | 16.7 |
| 2 | 20.000 | 44 | 1.20 | 1.20 | 30.3 |
| 3 | 30.000 | 54 | 1.30 | 1.30 | 41.7 |
| 4 | 40.000 | 63 | 1.40 | 1.40 | 51.3 |
| 5 | 50.000 | 70 | 1.50 | 3.00 | 59.5 |
| 6 | 60.000 | 77 | 1.60 | 3.20 | 33.3 |
| 7 | 70.000 | 83 | 1.70 | 3.40 | 36.5 |
| 8 | 80.000 | 89 | 1.80 | 3.60 | 39.2 |
| 9 | 90.000 | 94 | 1.90 | 3.80 | 41.7 |
| 10 | 100.000 | 100 | 2.00 | 4.20 | 43.9 |
| 11 | 110.000 | 104 | 2.10 | 4.41 | 43.7 |
| 12 | 120.000 | 109 | 2.20 | 4.62 | 45.4 |
| 13 | 130.000 | 114 | 2.30 | 4.83 | 46.9 |
| 14 | 140.000 | 118 | 2.40 | 5.04 | 48.3 |
| 15 | 150.000 | 122 | 2.50 | 5.25 | 49.6 |
| 16 | 160.000 | 126 | 2.60 | 5.46 | 50.8 |
| 17 | 170.000 | 130 | 2.70 | 5.67 | 51.9 |
| 18 | 180.000 | 134 | 2.80 | 5.88 | 52.9 |
| 19 | 190.000 | 137 | 2.90 | 6.09 | 53.9 |
| 20 | 200.000 | 141 | 3.00 | 6.60 | 54.7 |
| 21 | 210.000 | 144 | 3.00 | 6.60 | 53.0 |
| 22 | 230.476 | 151 | 3.00 | 6.60 | 58.2 |
| 23 | 251.905 | 158 | 3.00 | 6.60 | 63.6 |
| 24 | 274.286 | 165 | 3.00 | 6.60 | 69.3 |
| 25 | 297.619 | 172 | 3.00 | 6.60 | 75.2 |

## Stan końcowy — po trzech zmianach

Te same założenia co w tabeli commitu 2; nowa gra, reset dokładnie przy progu. Wszystkie mnożniki „po” odnoszą się do identycznej kolonii odtworzonej po resecie. Ryby z nagrody trafiają do portfela startowego; nie zwiększają `totalFishEarned` następnej rundy. Łaska w resetach 1–25 nadal wynosi 0; catnip stanowi jedną wypłatę.

| Reset | Wymaganie (mln ryb) | Ryby nagrody | Catnip łącznie | Nowy mnożnik po | Łączny mnożnik ryb po | Czas (min) |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 10.000 | 31 | 31 | 1.10 | 1.10 | 16.7 |
| 2 | 20.000 | 44 | 44 | 1.20 | 1.20 | 30.3 |
| 3 | 30.000 | 54 | 54 | 1.30 | 1.30 | 41.7 |
| 4 | 40.000 | 63 | 63 | 1.40 | 1.40 | 51.3 |
| 5 | 50.000 | 70 | 70 | 1.50 | 3.00 | 59.5 |
| 6 | 60.000 | 77 | 77 | 1.60 | 3.20 | 33.3 |
| 7 | 70.000 | 83 | 83 | 1.70 | 3.40 | 36.5 |
| 8 | 80.000 | 89 | 89 | 1.80 | 3.60 | 39.2 |
| 9 | 90.000 | 94 | 94 | 1.90 | 3.80 | 41.7 |
| 10 | 100.000 | 100 | 100 | 2.00 | 4.20 | 43.9 |
| 11 | 110.000 | 104 | 104 | 2.10 | 4.41 | 43.7 |
| 12 | 120.000 | 109 | 109 | 2.20 | 4.62 | 45.4 |
| 13 | 130.000 | 114 | 114 | 2.30 | 4.83 | 46.9 |
| 14 | 140.000 | 118 | 118 | 2.40 | 5.04 | 48.3 |
| 15 | 150.000 | 122 | 122 | 2.50 | 5.25 | 49.6 |
| 16 | 160.000 | 126 | 126 | 2.60 | 5.46 | 50.8 |
| 17 | 170.000 | 130 | 130 | 2.70 | 5.67 | 51.9 |
| 18 | 180.000 | 134 | 134 | 2.80 | 5.88 | 52.9 |
| 19 | 190.000 | 137 | 137 | 2.90 | 6.09 | 53.9 |
| 20 | 200.000 | 141 | 141 | 3.00 | 6.60 | 54.7 |
| 21 | 210.000 | 144 | 144 | 3.00 | 6.60 | 53.0 |
| 22 | 230.476 | 151 | 151 | 3.00 | 6.60 | 58.2 |
| 23 | 251.905 | 158 | 158 | 3.00 | 6.60 | 63.6 |
| 24 | 274.286 | 165 | 165 | 3.00 | 6.60 | 69.3 |
| 25 | 297.619 | 172 | 172 | 3.00 | 6.60 | 75.2 |

## Dobór nagrody i skuteczność

Przelicznik bazowy: **1 catnip za 1 rybę NAGRODY** (`floor(sqrt(F)/100)`), a nie za ryby zgromadzone w rundzie. Karmnik mnoży catnip ×2, PrestigeBoost ×1,25 (z dotychczasowym zaokrągleniem). Od 50 ukończonych prestiży Kocia Łaska daje +25% do tej samej wypłaty catnipu, po pozostałych modyfikatorach. Nie ma oddzielnego cashbacku.

| Reset | Ryby nagrody | Catnip resetu bez ulepszeń | Catnip ze świątyni w modelowej rundzie |
|---:|---:|---:|---:|
| 1 | 31 | 31 | 0.0 |
| 5 | 70 | 70 | 50.0 |
| 10 | 100 | 100 | 50.0 |
| 20 | 141 | 141 | 571.4 |
| 25 | 172 | 172 | 1149.9 |

Pierwsza nagroda uruchamia rozwój catnipowy: świątynia jest wtedy jeszcze zamknięta. Dla 5. i 10. resetu nagroda to odpowiednio 1,4× i 2× modelowy dochód ze świątyni; przy 20. i 25. to około 25% i 15%. Jest dodatkiem do dochodu rundy, nie tysiącami lub milionami catnipu. SuperKarmnik, kliknięcia i czas rzeczywistej rundy zmieniają te proporcje; nie przyjęto statystycznego profilu gracza bez danych.

Przy tej samej kolonii piąty reset: ×1,4 → ×3, czyli **+114,29%** (próg ≥15%). Dwudziesty: ×6,09 → ×6,6, czyli **+8,37%** (próg ≥5%). Nowy składnik ma dokładnie +200% po 20 resetach; całość obejmuje też stare bonusy progowe.

## Decyzje tam, gdzie brief nie rozstrzygał

- Faktyczny stan repo odbiegał od opisu: nagroda pierwiastkowa była catnipem. Zgodnie z zamówionym rozliczeniem dodano ryby startowe według pierwiastka, a dotychczasową wielkość bazowej nagrody catnipowej zachowano przez przelicznik 1:1.
- Migracja zachowuje ×1 nowego składnika dla zapisów bez pola. Wczytanie nie przyznaje retrospektywnego bonusu; nowe resety zwiększają go o 0,1. Istniejące zasoby i ulepszenia nie są zmieniane przy ładowaniu.
- Punkt przejścia kwadratowego wynika z liczby **ukończonych** resetów: obie gałęzie spotykają się przy wymaganiu na reset 21. Progi pozostają liczbami rzeczywistymi; tabela zaokrągla wyłącznie prezentację.
- Łaska zachowuje miejsce na poziomie 50, lecz daje ograniczone +25% do proporcjonalnej nagrody. Pozostawienie starego F/1000 wywoływałoby ten sam problem później.
- Jeśli wypłata lub zachowany dorobek zmieni się między otwarciem a potwierdzeniem, okno pokazuje nową listę i wymaga ponownego potwierdzenia. Nie wypłaca innej kwoty niż zatwierdzona.
- Test wzrostu ≥5% dotyczy **20. resetu**. Limit +200% oznacza, że reset 21–25 nie zwiększa samego mnożnika przy identycznym wyposażeniu. Gwarancja ≥5% dla każdego późniejszego resetu byłaby sprzeczna z tym limitem bez dodatkowej, niezamówionej mechaniki.

## Świadomie bez zmian i ograniczenia pomiaru

- Pozostają bonusy progowe ×2 od 5., +5 punktów procentowych co 10 prestiży oraz ×100 od 100., odblokowania kotów, świątyni, eliksirów, kotwicy i wskazanego ulepszenia.
- Pozostają ceny i produkcja kotów, koszt ulepszeń, kliknięcia i autoclicker, eliksiry, zwierzak, osiągnięcia, diamenty, gacha, limity offline. Autoclicker nie dostaje dodatkowego mnożnika produkcji kotów — zgodnie z dotychczasowym rozdzieleniem tych źródeł dochodu.
- Kot Feniks nadal kosztuje 100 catnipu i daje bazowo milion ryb/s plus swój bonus. Jeden Feniks z pełnymi bonusami prestiżu produkuje 8,25 mln ryb/s: zebranie progu resetu 25 zajmuje wtedy około 36 sekund po jego zakupie. Narzucony wzór kwadratowy podnosi progi, ale sam nie gwarantuje długich rund w tym wariancie. Tabela ze średnią bazą 10 tys./s nie jest symulacją całej ekonomii ani dowodem długości gry.
- Nie cofnięto zasobów przyznanych wcześniej przez Łaskę. Nie rekonstruowano ulepszeń, które stare resety już skasowały: zapis nie przechowuje historii ich zakupu.
- Zachowano dwa kroki oraz 5-sekundowe rozbrojenie. Natywny `<dialog>` obsługuje modalność, klawiaturę i Escape; własny kod przywraca fokus.

## Pliki

| Plik | Zmiana |
|---|---|
| `public/js/game.js` | Trwały bonus, migracja i zapis, reset dorobku, progi, wspólne rozliczenie oraz mnożnik progowy |
| `server/routes/save.js` | `prestigeMultiplier` w `STATE_SCHEMA`, zakres 1–3 |
| `public/js/prestige.js` | Jedna lista zysków, podgląd, potwierdzenie, anulowanie i kontrola zmiany wypłaty |
| `public/js/render.js` | Usunięcie osobnego licznika cashbacku F/1000 |
| `public/index.html`, `public/css/style.css` | Okno rozliczenia i jego wygląd |
| `public/locales/{pl,en,de,es}.json` | Opisy nagród, zachowanego postępu i Łaski; zgodność kluczy |
| `tests/prestige.test.js` | 12 testów ekonomii, migracji, offline, limitów i zachowania dorobku |
| `tests/prestige-ui.test.js` | 4 testy okna: podgląd, potwierdzenie, anulowanie, timeout, zmiana nagrody i bezpieczny HTML |
| `tests/save-route.test.js` | 1 dodatkowy test zapisu i walidacji mnożnika |
| `docs/prestige-project-4.md` | Punkt odniesienia, tabele zmian, pomiary i decyzje |

## Weryfikacja

Po commicie 1: 45/45 testów. Po commicie 2: 47/47. Stan końcowy: **55/55 testów w 7 plikach**, w tym **17 nowych**; 0 pominiętych, 0 błędów. Każdy plik uruchamiany osobno przez `node tests/<plik>.test.js`.

`node --check` wykonano dla wszystkich plików JavaScript w `public/`, `server/` i `tests/`; bez błędów. `git diff --check` bez błędów. Testy korzystają z `createGame()` i wykonują rzeczywiste funkcje gry. Okno testowano z atrapą DOM i zegara w Node; nie wykonano wizualnego testu w przeglądarce. Test trasy zapisu korzysta z istniejącej atrapy transakcji, nie z uruchomionej bazy PostgreSQL.

Praca wyłącznie na `dev`, trzy commity w kolejności 1→2→3, bez pushowania, zmian `main` i usuwania plików.

## Decyzja 1A — wymagania po 100 ukończonych resetach

`c` oznacza `game.prestigeCount`, czyli liczbę ukończonych resetów, a nie numer następnego resetu.
Dotychczasowy próg `W(c) = 10 000 000 × (c+1) × max(1, (c+1)/21)` zostaje dokładnie bez zmian dla `c ≤ 100`.
Dla `c > 100` nowy próg to `W(c) × 100 × A(c)/1,5`, gdzie `A(c) = 1 + floor(c/10) × 0,05`.
Bonus produkcji ×100 zostaje. Czynnik A kompensuje skoki produkcji co 10 prestiży, więc przy identycznej kolonii czas rośnie jak `(c+1)²`, także na granicach dziesiątek. Próg nie zależy od mnożnika stałego gracza.

Pomiar: jeden Kotfeniks (1 250 000 bazowych ryb/s wraz z własnym bonusem), bez ulepszeń, pupila, klikania, zakupów i boosterów. Czas = próg / rzeczywiste `fishPerSecond`; start od zerowego `totalFishEarned`.

| Ukończone prestiże | Stary czas ×1 (min) | Nowy czas ×1 (min) | Nowy czas ×3 (min) |
|---:|---:|---:|---:|
| 99 | 21,893815 | 21,893815 | 7,297938 |
| 100 | 0,215894 | 0,215894 | 0,071965 |
| 101 | 0,220190 | 22,019048 | 7,339683 |
| 110 | 0,252350 | 26,076190 | 8,692063 |
| 150 | 0,413624 | 48,256085 | 16,085362 |
| 200 | 0,641286 | 85,504762 | 28,501587 |
| 300 | 1,150489 | 191,748148 | 63,916049 |
| 500 | 2,276653 | 531,219048 | 177,073016 |

Porównanie chronionych progów (ryby, przed = po): `c=0`: 10 000 000; `c=20`: 210 000 000; `c=99`: 4 761 904 761,904762; `c=100`: 4 857 619 047,619047. Test porównuje wszystkie 101 wartości `c=0…100` ścisłym `assert.equal`.

**Niespełnione kryteria:** przy 100 nadal jest 12,95 s (×1) / 4,32 s (×3), a więc nie ma 5–15 min ani monotoniczności całej listy 99→100→110. Zachowanie niezmiennego wymagania dla `c ≤ 100` i bonusu ×100 uniemożliwia spełnienie tych warunków przez zmianę progu. Dodatkowo 21,89 min przy 99 dla ×1 już przekracza górną granicę 15 min żądaną przy 100. Od 101 każdy kolejny czas do 500 jest dłuższy i wynosi ≥5 min w obu wariantach; test sprawdza wszystkie poziomy, nie tylko wiersze tabeli. Wysokie poziomy mogą trwać godziny.

Pomiary ze zlecenia pozostają punktem odniesienia: ~13 s przy 100, ~39 s przy 200 i ~3 min przy 500 dotyczą ×1; ~7 min przy 99 odpowiada ×3. Powyższa tabela pokazuje obie konfiguracje osobno, bez zmiany tych danych odniesienia.
