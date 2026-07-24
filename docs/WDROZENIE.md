# Publikacja frontendu

## Konfiguracja lokalna

1. Skopiuj `config.example.js` do `config.js`.
2. W `config.js` uzupełnij `APPS_SCRIPT_URL` wartością otrzymaną bezpiecznym
   kanałem od administratora prywatnego backendu Tutlo.
3. Uruchom `npm run check`. Plik `config.js` jest ignorowany przez Git.

Nie umieszczaj w tym repozytorium kodu backendu, identyfikatorów zasobów,
adresów wdrożeń, tokenów, danych klientów ani plików `.env`.

## GitHub Pages

1. W GitHub utwórz sekret repozytorium Actions o nazwie `APPS_SCRIPT_URL`.
2. Jako wartość podaj adres otrzymany od administratora prywatnego backendu.
3. Włącz GitHub Pages ze źródłem **GitHub Actions**.
4. Push do `main` uruchomi testy, zbuduje wydanie i opublikuje frontend.

Workflow zapisuje konfigurację tylko w katalogu roboczym runnera i artefakcie
Pages. Nie zapisuje jej w commicie. Ponieważ przeglądarka musi znać adres
backendu, użytkownik strony może go odczytać; bezpieczeństwo zapewniają zasady
dostępu skonfigurowane po stronie prywatnej usługi organizacji.

## Prywatny backend

Kod backendu i jego konfiguracja pozostają w prywatnej przestrzeni Tutlo.
Zmiany backendu, identyfikatorów zasobów i uprawnień wykonuje się wyłącznie tam,
zgodnie z wewnętrzną procedurą organizacji.

## Test wydania

Po publikacji użyj wyłącznie danych syntetycznych. Sprawdź klasyfikację umowy,
generowanie aneksu i otwarcie wyniku oraz potwierdź, że użytkownik spoza
uprawnionej organizacji nie może wykonać operacji backendowej.
