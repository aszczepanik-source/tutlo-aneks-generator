# Konfiguracja firmowego Google Apps Script

## Szablony i folder Drive

1. Na współdzielonym dysku firmowym utwórz folder docelowy. Skopiuj jego identyfikator z adresu (fragment po `/folders/`) do `CONFIG.DRIVE_FOLDER_ID` w `apps-scirpt/Code.gs`.
2. Wgraj niezmienione `template.docx` aneksów 11, 29 i 29a, otwórz każdy jako Dokument Google i zapisz przekonwertowaną kopię. Treści prawnej nie edytuj.
3. Wpisz identyfikatory Dokumentów Google w `CONFIG.TEMPLATE_IDS`. Konto wykonujące skrypt musi mieć prawo odczytu szablonów i zapisu w folderze.

## Pierwsze wdrożenie i aktualizacja

1. Utwórz jeden firmowy projekt Apps Script i wklej `apps-scirpt/Code.gs`.
2. W **Wdróż → Nowe wdrożenie → Aplikacja internetowa** ustaw wykonywanie jako właściciel i dostęp wyłącznie dla właściwej domeny/grupy Workspace.
3. Autoryzuj Dokumenty i Dysk, wdróż, a adres kończący się `/exec` wpisz w źródłowym `config.js` przed wykonaniem `npm run build`. Build umieszcza konfigurację w klasycznym bundle `dist/app.js`.
4. Przy aktualizacji wklej nowy kod, wybierz **Zarządzaj wdrożeniami → Edytuj → Nowa wersja → Wdróż**. Zachowaj adres `/exec`, sprawdź numer wersji odpowiedzi GET i wykonaj próbny aneks syntetyczny.

## Test dwóch konsultantów

1. Dwie osoby otwierają własne rozpakowane kopie w Chrome i wybierają syntetyczne dane z różnymi numerami umów.
2. Obie klikają generowanie w tym samym momencie.
3. Sprawdź, że powstały dwa dokumenty, każdy przycisk **Otwórz aneks** prowadzi do właściwego dokumentu, dane nie są zamienione, a ponowne szybkie kliknięcie nie tworzy kopii.

## Blokady MVP

Aneksy 25 i 26 są jawnie zablokowane. Dokumentacja nie określa dla 25 nowej ceny, liczby lekcji, średniej raty ani harmonogramu; dla 26 dodatkowo kwoty spłaconej i zwrotu bankowi. Samo wskazanie, że bank i rachunek wpisuje konsultant, nie wystarcza do legalnego wyliczenia pozostałych pól.
