import assert from 'node:assert/strict';
import test from 'node:test';
import { extractContractData } from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';

test('aneks 26 oblicza sześć pól z rzeczywistego kształtu currentContract parsera', () => {
  const pdfText = `
    UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
    DANE NABYWCY Imię i nazwisko: Test Testowy Adres: Testowa 1 PESEL: 00000000000
    SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450
    Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
    ZAWARTOŚĆ KURSU spotkania z Lektorem Polskim, English Expert, Native Speaker WARUNKI PŁATNOŚCI
    Całkowita cena kursu wynosi 11 250,00 zł brutto`;
  const currentContract = extractContractData(pdfText);

  assert.equal(currentContract.agreementNumber, 'EL/JF/811/192956/3/9/2025');

  assert.deepEqual(
    {
      coursePrice: currentContract.coursePrice,
      lessonCount: currentContract.lessonCount,
      monthlyInstallment: currentContract.monthlyInstallment,
      agreementDate: currentContract.agreementDate
    },
    { coursePrice: 11250, lessonCount: 450, monthlyInstallment: 468.75, agreementDate: '03.09.2025' }
  );

  const { values } = prepareAnnex26(currentContract, {
    newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456'
  });

  assert.equal(values.DATA_ZAWARCIA_UMOWY, '03.09.2025');
  assert.equal(values.DATA_UMOWY_KREDYTU, '03.09.2025');

  assert.deepEqual({
    NOWA_LICZBA_LEKCJI: values.NOWA_LICZBA_LEKCJI,
    NOWA_CENA: values.NOWA_CENA,
    NOWA_SREDNIA_RATA: values.NOWA_SREDNIA_RATA,
    KWOTA_KREDYTU: values.KWOTA_KREDYTU,
    SPLACONO_DO_DNIA_ANEKSU: values.SPLACONO_DO_DNIA_ANEKSU,
    KWOTA_DO_ZWROTU_BANKOWI: values.KWOTA_DO_ZWROTU_BANKOWI
  }, {
    NOWA_LICZBA_LEKCJI: '414',
    NOWA_CENA: '10356,25 zł',
    NOWA_SREDNIA_RATA: '431,51 zł',
    KWOTA_KREDYTU: '11250,00 zł',
    SPLACONO_DO_DNIA_ANEKSU: '5156,25 zł',
    KWOTA_DO_ZWROTU_BANKOWI: '893,75 zł'
  });

  const withoutRedundantInstallment = { ...currentContract, monthlyInstallment: undefined };
  assert.equal(
    prepareAnnex26(withoutRedundantInstallment, {
      newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456'
    }).values.NOWA_CENA,
    '10356,25 zł'
  );
});

test('aneks 26 zgłasza błąd, gdy numer umowy nie zawiera poprawnej daty', t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'info', () => {});
  const currentContract = extractContractData(`
    UMOWA ELASTYCZNA nr EL/JF/811/192956/31/2/2025
    DANE NABYWCY Imię i nazwisko: Test Testowy Adres: Testowa 1 PESEL: 00000000000
    SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450
    Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
    ZAWARTOŚĆ KURSU spotkania z Lektorem Polskim, English Expert, Native Speaker WARUNKI PŁATNOŚCI
    Całkowita cena kursu wynosi 11 250,00 zł brutto`);

  assert.equal(currentContract.agreementDate, undefined);
  assert.throws(() => prepareAnnex26(currentContract, {
    newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456'
  }), /Nie odczytano prawidłowej daty zawarcia umowy z numeru umowy/);
});

test('aneks 26 przekazuje nazwę firmy i NIP przez istniejące placeholdery', () => {
  const currentContract = extractContractData(`
    UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
    DANE NABYWCY FIRMA: Agnieszka Paprotna ADRES: Żerkówek 28 NIP: 6922453948
    SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450
    Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
    ZAWARTOŚĆ KURSU spotkania z Lektorem Polskim, English Expert, Native Speaker WARUNKI PŁATNOŚCI
    Całkowita cena kursu wynosi 11 250,00 zł brutto`);
  const { values } = prepareAnnex26(currentContract, {
    newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456'
  });

  assert.equal(values.IMIE_NAZWISKO, 'Agnieszka Paprotna');
  assert.equal(values.PESEL, '6922453948');
});

test('sama etykieta firmy nie ustawia rodzaju, a brak NIP zgłasza czytelny błąd', () => {
  const currentContract = extractContractData(`
    UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
    DANE NABYWCY FIRMA: Agnieszka Paprotna ADRES: Żerkówek 28
    SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450
    Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
    ZAWARTOŚĆ KURSU spotkania z Lektorem Polskim WARUNKI PŁATNOŚCI
    Całkowita cena kursu wynosi 11 250,00 zł brutto`);

  assert.equal(currentContract.customerType, undefined);
  assert.throws(() => prepareAnnex26(currentContract, {
    newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456'
  }), /Nie odczytano NIP firmy\./);
});
