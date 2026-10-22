# Decyzja 2A — klik i prestiż

`calculateClickValue()` mnoży pełny wynik (baza, skalowanie, miska, Lucky Paw) przez `getPrestigeFishMultiplier()` dokładnie raz, przed końcowym zaokrągleniem. Dotyczy kliknięć ręcznych i autoclickera. Tryb `baseAutoclicker`, używany wyłącznie do obliczania R₀, pozostaje bez prestiżu — inaczej mnożnik wracałby do skalowania drugi raz. Przy prestiżu 0 i mnożniku stałym 1 wynik jest liczbowo identyczny jak wcześniej.

Jawna konfiguracja pomiaru: jeden Kotfeniks, miska, 5 ręcznych kliknięć/s, mnożnik stały ×1, bazowy klik 1, baseline 0, bez pozostałych ulepszeń, pupila i boosterów. Udział = `100 × (5 × wartość kliku) / (fishPerSecond + 5 × wartość kliku)`. To udział w całkowitym dochodzie, a nie stosunek do samego dochodu pasywnego. Liczby ze zlecenia (~4,5% → 0,011%) pozostają punktem odniesienia; poniżej osobny, odtwarzalny pomiar przy jawnych założeniach.

| Prestiż | Mnożnik ryb | Klik przed | Klik po | Udział przed | Udział po |
|---:|---:|---:|---:|---:|---:|
| 0 | 1 | 12502 | 12502 | 4,762630% | 4,762630% |
| 20 | 2,2 | 12502 | 27504,4 | 2,222570% | 4,762630% |
| 100 | 300 | 12502 | 3750600 | 0,016667% | 4,762630% |
| 200 | 400 | 12502 | 5000800 | 0,012500% | 4,762630% |

Przy prestiżu 200 i stałym ×3 klik daje 15 002 400, a udział pozostaje 4,762630%. Szczęśliwy pupil nadal daje +10% produkcji pasywnej, bez dodatkowego mnożnika kliku; jego działanie sprawdzamy rzeczywistym modułem `catlife.js`. Testy obejmują miskę, Lucky Paw, boost i jego wygaśnięcie, krytyk oraz zgodność autoclickera online/offline. Chwilowe bonusy i tempo klikania nadal wpływają na udział — prestiż sam go już nie obniża.
