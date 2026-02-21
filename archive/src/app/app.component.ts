import { Component } from '@angular/core';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { PaymentHistoryComponent } from './payment-history/payment-history.component';
import { LoginComponent } from './features/auth/login/login.component';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LoginComponent, LandingPageComponent, PaymentHistoryComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  currentView: 'landing' | 'payment-history' = 'landing';

  constructor(readonly authService: AuthService) {}
}
