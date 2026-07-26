export function isPdfFile(file) {
  if (!file) return false;

  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

export function bindPdfFileUpload({ input, dropzone, handlePdfFile }) {
  const preventBrowserFileOpen = event => {
    event.preventDefault();
    event.stopPropagation();
  };

  input.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) handlePdfFile(file);

    // A cleared value makes selecting the same file fire `change` again.
    event.target.value = '';
  });

  dropzone.addEventListener('dragover', event => {
    preventBrowserFileOpen(event);
    dropzone.classList.add('drag');
  });

  dropzone.addEventListener('dragenter', event => {
    preventBrowserFileOpen(event);
    dropzone.classList.add('drag');
  });

  dropzone.addEventListener('dragleave', event => {
    preventBrowserFileOpen(event);
    dropzone.classList.remove('drag');
  });

  dropzone.addEventListener('drop', event => {
    preventBrowserFileOpen(event);
    dropzone.classList.remove('drag');
    const file = event.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  });
}
