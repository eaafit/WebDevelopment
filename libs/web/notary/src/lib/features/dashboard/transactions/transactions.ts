import { Component } from '@angular/core';
import { TransactionTable } from '@notary-portal/ui';

@Component({
  selector: 'lib-transactions',
  imports: [TransactionTable],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions {}
