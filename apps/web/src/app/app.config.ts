import {
  ApplicationConfig,
  Injector,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideRpcTransport, provideWebLogging, TokenStore } from '@notary-portal/ui';
import { AuthService } from '@notary-portal/guest';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideWebLogging(),
    provideRpcTransport(() => {
      const injector = inject(Injector);
      const tokenStore = injector.get(TokenStore);

      return {
        getToken: () => tokenStore.getAccessToken(),
        refresh: () => injector.get(AuthService).refresh(),
        loginPath: '/auth',
      };
    }),
  ],
};
