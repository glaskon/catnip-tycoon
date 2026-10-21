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
