# Decyzja 4A — ranking czasowo schowany

Publiczny ranking nie wymaga logowania, ujawnia zamaskowane e-maile i sortuje po `totalFishEarned`, które prestiż zeruje. Serwer przyjmuje ekonomię zapisu bez weryfikacji, więc zmodyfikowany zapis może wejść na szczyt. Lista zawiera również konta testowe. Do czasu weryfikacji ranking jest niedostępny.

Bez zmiennej `LEADERBOARD_ENABLED` (lub dla dowolnej wartości innej niż dokładnie `true`) `GET /api/leaderboard` zwraca HTTP 404 z `{"error":"Not found"}`. Nie wykonuje zapytania SQL i nie ujawnia danych graczy. Plik trasy, SQL, klient API i renderer pozostają w repozytorium. Przycisk nawigacji i panel w `public/index.html` zachowano w komentarzach HTML, poza aktywnym interfejsem.

Przed przywróceniem trzeba zweryfikować ekonomię po stronie serwera, ustalić miarę rankingu odporną na reset prestiżu, rozstrzygnąć publiczny dostęp i identyfikację graczy oraz usunąć lub wykluczyć konta testowe z rankingu.

Przywrócenie endpointu: ustaw `LEADERBOARD_ENABLED=true` w środowisku serwera i uruchom go ponownie. Wtedy odpowiedź i SQL działają jak wcześniej; flaga sama nie naprawia opisanych problemów. Aby przywrócić wejście w interfejsie, odkomentuj przycisk oraz panel oznaczone `Ranking disabled` / `Leaderboard disabled` w `public/index.html`. Zaktualizuj test oczekujący schowanego interfejsu. Wyłączenie: usuń flagę lub ustaw `false` i ponownie uruchom serwer.

Testy wywołują rzeczywisty handler z atrapą bazy i osobnym środowiskiem: domyślne 404 bez zapytania, ścisła flaga, odpowiedź włączonego rankingu, pusta lista i błąd bazy. Kontrola HTML pomija komentarze i sprawdza brak aktywnego wejścia/panelu. Testy nie uruchamiają PostgreSQL ani przeglądarki.
