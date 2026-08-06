# Aneks 25a — Zmniejszenie rat wewnętrznych po zmianie harmonogramu (w budowie)

Ten folder czeka na:

1. **`template.docx`** — wgraj go tutaj przez GitHuba: `src/annexes/25a/template.docx`.
   Placeholdery powinny być w tym samym stylu co w Aneksie 25
   (`{{RATA_01_KWOTA}}`, `{{RATA_01_TERMIN}}`, `{{NOWA_CENA}}` itd. —
   zobacz `src/annexes/25/manifest.json` dla pełnej listy).
2. Decyzję: czy terminy/kwoty oryginalnych rat (dla umów 2/4/13-ratowych)
   konsultant wpisuje ręcznie w formularzu, czy mają być odczytywane
   automatycznie z PDF-u.
3. Przykład realnej umowy z wariantem **4 rat**, żeby dograć strukturę
   harmonogramu (na razie mam potwierdzone tylko 2 raty — rok 1 z góry +
   rok 2 rozbijany na 12 miesięcznych rat, oraz 13 rat — rok 1 z góry + rok
   2 już miesięcznie).

`manifest.json`, `generator.js`, `validator.js`, `index.js` oraz podłączenie
do `catalog.js` / `availability.js` (sekcja „Po zmianie harmonogramu”) celowo
jeszcze nie istnieją — dopiszę je, gdy powyższe będzie ustalone, żeby nie
wystawić w aplikacji niedokończonej/niepoprawnej funkcji.
