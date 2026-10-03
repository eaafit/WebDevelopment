export interface DownloadTextFileOptions {
  fileName: string;
  content: string;
  mimeType?: string;
  addUtf8Bom?: boolean;
  revokeDelayMs?: number;
}

const DEFAULT_MIME_TYPE = 'text/plain;charset=utf-8';
const DEFAULT_REVOKE_DELAY_MS = 60_000;

export function downloadTextFile(options: DownloadTextFileOptions): void {
  const fileName = options.fileName.trim();
  const content = options.content;

  if (!fileName) {
    throw new Error('Download file name is required');
  }
  if (!content.trim()) {
    throw new Error('Download content is empty');
  }
  if (typeof URL.createObjectURL !== 'function') {
    throw new Error('File download is not supported in this browser');
  }

  const blob = new Blob([`${options.addUtf8Bom ? '\uFEFF' : ''}${content}`], {
    type: options.mimeType ?? DEFAULT_MIME_TYPE,
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    const dispatched = link.dispatchEvent(event);
    if (!dispatched) {
      link.click();
    }
  } finally {
    link.remove();
    setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      options.revokeDelayMs ?? DEFAULT_REVOKE_DELAY_MS,
    );
  }
}

export function downloadCsvFile(fileName: string, csvContent: string): void {
  downloadTextFile({
    fileName,
    content: csvContent,
    mimeType: 'text/csv;charset=utf-8',
    addUtf8Bom: true,
  });
}
