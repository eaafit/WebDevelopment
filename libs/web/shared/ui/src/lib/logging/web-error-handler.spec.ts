import { TestBed } from '@angular/core/testing';
import { WebErrorHandler } from './web-error-handler';
import { WebLoggerService } from './web-logger.service';

describe('WebErrorHandler', () => {
  let handler: WebErrorHandler;
  let mockLogger: jest.Mocked<WebLoggerService>;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    } as unknown as jest.Mocked<WebLoggerService>;

    TestBed.configureTestingModule({
      providers: [WebErrorHandler, { provide: WebLoggerService, useValue: mockLogger }],
    });

    handler = TestBed.inject(WebErrorHandler);
  });

  it('sends unhandled errors to the logger', () => {
    const error = new Error('boom');

    handler.handleError(error);

    expect(mockLogger.error).toHaveBeenCalledWith('Unhandled application error', { error });
  });

  it('does not throw for weird unknown error input', () => {
    expect(() => handler.handleError(Object.create(null))).not.toThrow();
  });

  it('does not throw if logging itself fails', () => {
    mockLogger.error.mockImplementation(() => {
      throw new Error('logger failed');
    });

    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
  });
});
