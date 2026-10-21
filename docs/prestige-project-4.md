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
