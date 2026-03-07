import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideRpcTransport, TokenStore } from '@notary-portal/ui';
import { AuthService } from '@notary-portal/guest';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideRpcTransport({
      getToken:  () => inject(TokenStore).getAccessToken(),
      refresh:   () => inject(AuthService).refresh(),
      loginPath: '/auth',
    }),
  ],
};
