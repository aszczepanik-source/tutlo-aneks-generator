export async function extractPdfText(file, pdfjs = globalThis.pdfjsLib) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map(item => item.str).join(' '));
  }
  const rawText = pages.join('\n').trim();
  if (!rawText) throw new Error('Nie udało się odczytać tekstu z PDF.');
  return rawText;
}
