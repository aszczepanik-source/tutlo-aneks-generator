
const APP_NAME = 'Team Utrzymanie Generator';

// Wklej tutaj adresy wdrożeń generatorów 25 i 26.
// Przykład: 'https://script.google.com/macros/s/AKfycb.../exec'
const GENERATOR_URLS = {
  '11': '',
  '25': '',
  '26': '',
  '29': '',
  '29a': ''
};

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.generatorUrls = JSON.stringify(GENERATOR_URLS);
  return template
    .evaluate()
    .setTitle(APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
