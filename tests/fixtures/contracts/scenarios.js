const account='12 3456 7890 1234 5678 9012 3456';
const base=({type='flexible',payment='credit',customer='person',variant=''})=>`UMOWA ${type==='flexible'?'ELASTYCZNY KURS JĘZYKOWY':'Z LIMITEM nr lekcji; zasady korzystania z lekcji'} nr EL/JF/811/192956/3/9/2025
DANE NABYWCY ${customer==='person'?'IMIĘ I NAZWISKO: Jan Testowy ADRES: Testowa 1 PESEL: 12345678901':'FIRMA: Test sp. z o.o. ADRES: Firmowa 2 NIP: 1234567890'}
SPECYFIKACJA KURSU Data rozpoczęcia kursu: 01.09.2025 Liczba Lekcji Indywidualnych: 192 Maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania: 24 ZAWARTOŚĆ KURSU Lektorem Polskim, English Expert, Native Speaker WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9 576,00 zł brutto. ${payment==='credit'?'Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego':`rachunek bankowy Tutlo: mBank S.A. ${account}. ${variant}`}`;
export const scenarios=[
 ['flexible-credit-person',base({})],['flexible-credit-company',base({customer:'company'})],
 ['flexible-internal-24-person',base({payment:'internal',variant:'pierwsza rata, kolejnych 23 rat'})],
 ['flexible-internal-24-company',base({payment:'internal',customer:'company',variant:'24 równych rat'})],
 ['flexible-internal-2',base({payment:'internal',variant:'płatność następuje w 2 równych ratach'})],
 ['flexible-internal-13',base({payment:'internal',variant:'pierwszy rok płatny z góry, drugi rok w 12 ratach; 13 płatności'})],
 ['flexible-internal-4',base({payment:'internal',variant:'płatność następuje w 4 równych ratach'})],
 ['limit-credit',base({type:'limit'})],['limit-internal',base({type:'limit',payment:'internal',variant:'24 równych rat'})]
];
