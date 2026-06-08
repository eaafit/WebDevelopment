import { downloadCsvFile, downloadTextFile } from './text-download';

describe('downloadTextFile', () => {
  let createObjectUrlMock: jest.Mock;
  let revokeObjectUrlMock: jest.Mock;
  let dispatchSpy: jest.SpyInstance;
  let clickSpy: jest.SpyInstance;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    jest.useFakeTimers();
    createObjectUrlMock = jest.fn().mockReturnValue('blob:download-url');
    revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    dispatchSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'dispatchEvent')
      .mockImplementation(() => true);
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    dispatchSpy.mockRestore();
    clickSpy.mockRestore();

    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
    } else {
      delete (URL as Partial<typeof URL>).createObjectURL;
    }

    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      delete (URL as Partial<typeof URL>).revokeObjectURL;
    }
  });

  it('creates a hidden anchor, dispatches a click event and revokes the blob url later', () => {
    downloadTextFile({
      fileName: 'audit-events.csv',
      content: 'id;event\naudit-1;assessment.created',
      mimeType: 'text/csv;charset=utf-8',
      addUtf8Bom: true,
      revokeDelayMs: 1200,
    });

    expect(createObjectUrlMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(MouseEvent));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(document.body.querySelector('a[download="audit-events.csv"]')).toBeNull();

    jest.advanceTimersByTime(1199);
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:download-url');
  });

  it('falls back to direct click when dispatchEvent is cancelled', () => {
    dispatchSpy.mockImplementationOnce(() => false);

    downloadTextFile({
      fileName: 'payments.csv',
      content: 'id;status\npayment-1;completed',
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(MouseEvent));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when file name is blank', () => {
    expect(() =>
      downloadTextFile({
        fileName: '   ',
        content: 'id;status\npayment-1;completed',
      }),
    ).toThrow('Download file name is required');
    expect(createObjectUrlMock).not.toHaveBeenCalled();
  });

  it('throws a clear error when content is blank', () => {
    expect(() =>
      downloadTextFile({
        fileName: 'payments.csv',
        content: ' \n\t ',
      }),
    ).toThrow('Download content is empty');
    expect(createObjectUrlMock).not.toHaveBeenCalled();
  });

  it('throws a clear error when blob downloads are unsupported', () => {
    delete (URL as Partial<typeof URL>).createObjectURL;

    expect(() =>
      downloadTextFile({
        fileName: 'payments.csv',
        content: 'id;status\npayment-1;completed',
      }),
    ).toThrow('File download is not supported in this browser');
  });

  it('uses csv defaults for downloadCsvFile', () => {
    downloadCsvFile('payments.csv', 'id;status\npayment-1;completed');

    const blob = createObjectUrlMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(MouseEvent));
  });
});
