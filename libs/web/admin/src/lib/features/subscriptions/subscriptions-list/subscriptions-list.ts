import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { SubscriptionPlan } from '@notary-portal/api-contracts';
import {
  AdminSubscriptionsService,
  AdminSubscriptionRow,
} from '../../../services/admin-subscriptions.service';

@Component({
  selector: 'lib-subscriptions-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscriptions-list.html',
  styleUrl: './subscriptions-list.scss',
})
export class SubscriptionsListComponent implements OnInit {
  private readonly subsApi = inject(AdminSubscriptionsService);

  readonly loading = signal(false);
  readonly rows = signal<AdminSubscriptionRow[]>([]);
  readonly error = signal<string | null>(null);

  readonly SubscriptionPlan = SubscriptionPlan;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.subsApi.list({ take: 100 }).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Не удалось загрузить подписки');
      },
    });
  }

  cancel(row: AdminSubscriptionRow): void {
    const prev = this.rows();

    this.rows.set(
      prev.map((r) => (r.id === row.id ? { ...r, status: 'Cancelled', isActive: false } : r)),
    );

    this.subsApi.cancel(row.id).subscribe({
      next: () => {
        console.log(`Subscription ${row.id} successfully cancelled`);
      },
      error: (err) => {
        this.rows.set(prev);
        this.error.set(err?.message ?? 'Ошибка при отмене подписки');
      },
    });
  }
}
