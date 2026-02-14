import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.css',
})
export class PaymentHistoryComponent {}
