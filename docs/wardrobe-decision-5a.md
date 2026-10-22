# Garderoba — decyzja 5A Łukasza

Garderoba to widok kolekcji kosmetyków z trzema niezależnymi kategoriami: skórki (`skin_*`), stroje (`outfit_*`) i efekty cząsteczek (`effect_*`). Pokazuje przedmioty ze sklepu, losowania i albumu, ich źródła oraz stan posiadania. Posiadany kosmetyk można założyć lub zdjąć; nieposiadany jest widoczny i zablokowany. Garderoba nie sprzedaje przedmiotów ani nie daje ryb, catnipu, diamentów czy mnożników.

Opcje były następujące: pozostawić automatyczny wygląd wynikający z posiadanych kosmetyków albo dać graczowi kolekcję i jawny wybór wyposażenia. Łukasz wybrał **wariant 5A: garderobę i jeden slot w każdej kategorii** — jedna skórka, jeden strój i jeden efekt jednocześnie. Wybór zapisują `equippedSkin`, `equippedOutfit`, `equippedEffect`; `null` oznacza wygląd domyślny. Zmiana jednego slotu nie zdejmuje kosmetyków z pozostałych kategorii. Własność pozostaje oddzielona od wyposażenia: zdjęcie przedmiotu nie usuwa go z kolekcji.

## Świadomy trade-off: efekty przestają się sumować

**Przed garderobą efekty cząsteczek sumowały się: kod dokładał palety wszystkich posiadanych efektów. Teraz jest jeden slot na efekt i działa tylko wybrana paleta.** Gracz z kilkoma efektami widzi więc jeden naraz; może przełączać je w garderobie. To świadoma decyzja o uproszczeniu do jednego slotu, a nie cicha zmiana ani utrata posiadanych przedmiotów. Zachowanie dawnego „wszystkie naraz” wymagałoby innego modelu wyposażenia, którego w 5A nie wybrano.

Spadek liczby równocześnie widocznych kosmetyków dotyczy **wyłącznie efektów**. Skiny i stroje już wcześniej zachowywały się jak „ostatni kupiony wygrywa” (`lastOwned('skin_')`, `lastOwned('outfit_')`), więc dla nich nie ma zmiany liczby aktywnych elementów: nadal jedna skórka i jeden strój. Nowością jest możliwość jawnego wyboru, także wcześniejszego zakupu.

## Dziedziczenie wyglądu ze starych zapisów

Początkowy wariant wczytywania nadawał brakującym polom `null`; późniejsza korekta ciągłości wyglądu w `applyGameState()` zastąpiła ten domyślny wybór migracją. Gdy pole `equipped*` nie istnieje, wybierany jest ostatni poprawny, posiadany identyfikator danej kategorii z zapisanej kolejności `purchasedItems`. Dla skórek i strojów odtwarza to dawny wygląd. Dla efektów wybierany jest ostatnio posiadany efekt, co świadomie zastępuje dawną mieszaną paletę pojedynczą.

Jawne `null` pozostaje `null`, a poprawny zapisany wybór pozostaje bez zmian. Brak kosmetyku w kategorii oznacza `null`. Migracja nie dopisuje ani nie usuwa własności; identyfikator musi przejść istniejącą walidację kategorii i posiadania. Przykładowo stary zapis z dwiema skórkami, dwoma strojami i dwoma efektami zachowuje wszystkie sześć przedmiotów, lecz wyposaża po jednym ostatnim z każdej kategorii.

## Weryfikacja dokumentowanej decyzji

`tests/cosmetic-state.test.js` sprawdza migrację brakujących pól, jawne `null`, walidację i zachowanie własności. `tests/wardrobe.test.js` sprawdza wybór jednego kosmetyku na kategorię, zdejmowanie, zapis i renderowanie. Dodatkowy test starego zapisu z wieloma kosmetykami sprawdza razem odziedziczoną skórkę i strój, pojedynczą paletę cząsteczek oraz zachowanie całej kolekcji. Dokumentacyjny commit nie zmienia kodu gry.
