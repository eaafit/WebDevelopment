import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'lib-subscription-plan',
  imports: [],
  templateUrl: './subscription-plan.html',
  styleUrl: './subscription-plan.scss',
})
export class SubscriptionPlan implements OnInit {
  tariff = 'Нотариус PRO';
  price = 2990;
  validUntil = '31.07.2026';

  constructor(private router: Router) {}

  ngOnInit() {}

  goToCheckout() {
    this.router.navigate(['/notary/subscription/checkout']);
  }
}