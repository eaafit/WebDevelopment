import { Component, output } from '@angular/core';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.css',
})
export class PaymentHistoryComponent {
  navigate = output<'landing' | 'payment-history'>();
}
