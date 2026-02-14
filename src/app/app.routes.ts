import { Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { PaymentHistoryComponent } from './payment-history/payment-history.component';

export const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'payment-history', component: PaymentHistoryComponent },
];
