# Oczyszczenie historii przed publikacją

Skan historii wykazał, że wcześniejsze commity zawierają prywatny kod backendu,
identyfikatory zasobów oraz rzeczywistą konfigurację frontendu. Samo usunięcie
ich w najnowszym commicie nie usuwa danych ze starszych obiektów Git.

## Wymagane kroki

Wykonaj poniższe polecenia w świeżym klonie przeznaczonym do publikacji, po
utworzeniu kopii zapasowej i uzgodnieniu przerwy w pushach:

```bash
python3 -m pip install git-filter-repo
git filter-repo --force \
  --path apps-scirpt/ \
  --path config.js \
  --invert-paths
git log --all -- config.js apps-scirpt/
git push --force --all origin
git push --force --tags origin
```

Polecenie usuwa ze wszystkich rewizji prywatny katalog backendu i historyczny
plik z rzeczywistą konfiguracją. Następnie:

1. unieważnij lub zmień wszystkie ujawnione identyfikatory i adres wdrożenia;
2. dodaj aktualną wartość jako sekret Actions `APPS_SCRIPT_URL`;
3. poproś współpracowników o ponowne sklonowanie repozytorium;
4. usuń stare forki, artefakty, cache i kopie repozytorium, do których osoby
   nieuprawnione mogły mieć dostęp;
5. ponownie przeskanuj wszystkie gałęzie i tagi przed zmianą widoczności.

Oczyszczenie historii nie unieważnia skopiowanych wartości, dlatego rotacja i
weryfikacja uprawnień prywatnej usługi są obowiązkowe.
