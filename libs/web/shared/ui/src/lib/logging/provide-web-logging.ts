import { ErrorHandler, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  WEB_LOGGING_OPTIONS,
  resolveWebLoggingOptions,
  type WebLoggingOptions,
} from './web-logging.models';
import { WebErrorHandler } from './web-error-handler';
import { WebLoggerService } from './web-logger.service';

export function provideWebLogging(options: WebLoggingOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: WEB_LOGGING_OPTIONS,
      useFactory: () => resolveWebLoggingOptions(options),
    },
    WebLoggerService,
    {
      provide: ErrorHandler,
      useClass: WebErrorHandler,
    },
  ]);
}
