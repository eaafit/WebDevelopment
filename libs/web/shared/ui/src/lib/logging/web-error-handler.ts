import { ErrorHandler, inject, Injectable } from '@angular/core';
import { WebLoggerService } from './web-logger.service';

@Injectable()
export class WebErrorHandler implements ErrorHandler {
  private readonly logger = inject(WebLoggerService);

  handleError(error: unknown): void {
    try {
      this.logger.error('Unhandled application error', { error });
    } catch {
      // Logging must never break Angular's global error path.
    }
  }
}
