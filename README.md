# Team Utrzymanie Generator — 1.0.1

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

Aneksy 11, 29 i 29a mają zaimplementowane obliczenia. Aneksy 25 i 26 pozostają
jawnie zablokowane, ponieważ dokumentacja nie zawiera reguł wystarczających do
wyliczenia wszystkich placeholderów; aplikacja nie zgaduje tych zasad.

Wymagany jest Node.js 20 lub nowszy. Testy uruchamia polecenie:

```bash
npm test
```

Pakiet lokalny buduje `npm run build`. Gotowy release zawiera klasyczny bundle JavaScript i można go uruchomić przez dwuklik na `index.html`, bez serwera lokalnego i Node.js. Instrukcje znajdują się w
[`docs/INSTRUKCJA_KONSULTANTA.md`](docs/INSTRUKCJA_KONSULTANTA.md) i
[`docs/WDROZENIE.md`](docs/WDROZENIE.md).

## Szybki podgląd na Chromebooku
Otwórz plik `index.html` w Chrome. Analiza PDF i generowanie DOCX odbywają się
lokalnie w przeglądarce.

## GitHub Pages

Włącz GitHub Pages ze źródłem **GitHub Actions**. Workflow buduje i publikuje
samowystarczalny frontend bez konfiguracji backendu.

## Bezpieczeństwo
Nie dodawaj do repozytorium prawdziwych umów, danych klientów, PESEL/NIP, kluczy, tokenów ani plików z poświadczeniami.
