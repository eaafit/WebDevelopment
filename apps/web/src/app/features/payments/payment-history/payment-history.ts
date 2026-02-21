import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-history.html',
  styleUrl: './payment-history.css',
})
export class PaymentHistory {
  navigate = output<'landing' | 'payment-history'>();
}
