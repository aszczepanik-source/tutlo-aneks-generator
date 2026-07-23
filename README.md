# Team Utrzymanie Generator

Ta wersja jest oparta bezpośrednio na wcześniejszym projekcie **Tutlo Router Główny v2** — zachowuje jego żółty interfejs, układ, klasyfikację PDF i listę dostępnych aneksów.

## Dokumentacja

- [Obecna logika aneksów](docs/LOGIKA_ANEKSOW.md)
- [Analiza repozytorium i docelowa architektura](docs/ARCHITEKTURA_DOCELOWA.md)

## Fundament modułów aneksów

Każdy obsługiwany aneks ma niezależny katalog w `src/annexes/<id>/`, zawierający:

- `manifest.json` — identyfikator, warianty umów, wersję wzoru i wymagane pola;
- `generator.js` — budowanie neutralnego planu renderowania;
- `validator.js` — walidację kompletności danych na granicy dokumentu;
- `template.docx` — własny, niezmieniony wzór dokumentu;
- `tests/module.test.js` — testy kontraktu modułu.

Fundament nie jest jeszcze podłączony do istniejącego interfejsu i nie wykonuje
obliczeń biznesowych. Dzięki temu dotychczasowa klasyfikacja i routing działają bez
zmian, a logikę generatorów będzie można migrować osobno, pod osłoną testów.

Wymagany jest Node.js 20 lub nowszy. Testy uruchamia polecenie:

```bash
npm test
```

## Szybki podgląd na Chromebooku
Otwórz plik `index.html` w Chrome. To wersja podglądowa działająca bez Apps Script.

## Wersja Apps Script
Pliki są w katalogu `apps-script/`:
- `Code.gs`
- `Index.html`

1. Utwórz projekt Google Apps Script na koncie firmowym.
2. Wklej zawartość `Code.gs`.
3. Dodaj plik HTML o nazwie `Index` i wklej `Index.html`.
4. Uzupełnij `GENERATOR_URLS` adresami wdrożeń generatorów.
5. Wdróż jako aplikację internetową.

## GitHub
Po rozpakowaniu prześlij **zawartość folderu** do prywatnego repozytorium przez `Add file → Upload files`.

## Bezpieczeństwo
Nie dodawaj do repozytorium prawdziwych umów, danych klientów, PESEL/NIP, kluczy, tokenów ani plików z poświadczeniami.
