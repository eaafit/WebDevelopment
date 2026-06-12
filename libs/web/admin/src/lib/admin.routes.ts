import { Route } from '@angular/router';
import { Admin } from './admin/admin';
import { PlaceholderPageRoute } from '@notary-portal/ui';
import { Payments } from './features/payments/payments';
import { PaymentFormComponent } from './features/payments/payment-form.component';
import { PlansListComponent } from './features/plans/plans-list/plans-list';
import { PromoCodesComponent } from './features/promo-codes/promo-codes';
import { SubscriptionsListComponent } from './features/subscriptions/subscriptions-list/subscriptions-list';

const placeholder = (title: string, features: string[]): Partial<Route> => ({
  component: PlaceholderPageRoute,
  data: { title, features },
});

export const adminRoutes: Route[] = [
  {
    path: '',
    component: Admin,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.AdminDashboard),
      } as Route,
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/RequestAssessment/RequestAssessment').then((m) => m.RequestAssessment),
      },
      {
        path: 'orders/statuses',
        ...placeholder('\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043c\u0438', [
          '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u043e\u0432 \u0437\u0430\u043a\u0430\u0437\u043e\u0432',
          '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u043e\u0432 \u043c\u0435\u0436\u0434\u0443 \u044d\u0442\u0430\u043f\u0430\u043c\u0438',
        ]),
      } as Route,
      {
        path: 'orders/queue',
        ...placeholder('\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u043e\u0446\u0435\u043d\u043e\u043a', [
          '\u0421\u043f\u0438\u0441\u043e\u043a \u0437\u0430\u044f\u0432\u043e\u043a, \u043e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0445 \u043e\u0446\u0435\u043d\u043a\u0438',
          '\u0420\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u043f\u043e \u043d\u043e\u0442\u0430\u0440\u0438\u0443\u0441\u0430\u043c',
        ]),
      } as Route,
      {
        path: 'orders/moderation',
        ...placeholder('\u0420\u0443\u0447\u043d\u0430\u044f \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f', [
          '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0438 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u0441\u043f\u043e\u0440\u043d\u044b\u0445 \u0437\u0430\u044f\u0432\u043e\u043a',
          '\u0420\u0443\u0447\u043d\u044b\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u0438\u0440\u043e\u0432\u043a\u0438',
        ]),
      } as Route,
      {
        path: 'order-status-history',
        loadComponent: () =>
          import('./features/order-status-history/order-status-history').then(
            (m) => m.OrderStatusHistory,
          ),
      },
      {
        path: 'payments/new',
        component: PaymentFormComponent,
      },
      {
        path: 'payments/:id/edit',
        component: PaymentFormComponent,
      },
      {
        path: 'payments',
        component: Payments,
      },
      {
        path: 'subscriptions',
        component: SubscriptionsListComponent,
      },
      {
        path: 'plans',
        component: PlansListComponent,
      },
      {
        path: 'discounts',
        loadComponent: () => import('./features/sale/sale').then((m) => m.SaleComponent),
      } as Route,
      {
        path: 'promocodes',
        component: PromoCodesComponent,
      },
      {
        path: 'files',
        ...placeholder('\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u0444\u0430\u0439\u043b\u043e\u0432', [
          '\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u044b\u0445 \u0444\u0430\u0439\u043b\u043e\u0432',
          '\u0421\u0442\u0430\u0442\u0443\u0441\u044b \u00ab\u043f\u0440\u0438\u043d\u044f\u0442\u043e/\u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435\u00bb',
        ]),
      } as Route,
      {
        path: 'newsletter/new',
        loadComponent: () =>
          import('./features/newsletter/newsletter-new').then((m) => m.NewsletterNew),
      },
      {
        path: 'newsletter/history',
        loadComponent: () =>
          import('./features/newsletter/newsletter-list/newsletter-list').then(
            (m) => m.NewsletterListComponent,
          ),
      },
      {
        path: 'newsletter',
        loadComponent: () => import('./features/newsletter/newsletter').then((m) => m.Newsletter),
      },
      {
        path: 'monitoring',
        loadComponent: () => import('./features/monitoring/monitoring').then((m) => m.Monitoring),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.AdminNotifications),
      },
      {
        path: 'statistics',
        ...placeholder('\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430', [
          '\u041c\u0435\u0442\u0440\u0438\u043a\u0438 (\u043a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044f/\u0432\u0440\u0435\u043c\u044f)',
          '\u041e\u0442\u0447\u0451\u0442\u044b',
          '\u0412\u044b\u0433\u0440\u0443\u0437\u043a\u0438',
        ]),
      } as Route,
      {
        path: 'geography',
        loadComponent: () => import('./features/geography/geography').then((m) => m.Geography),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/smtp-settings/smtp-settings').then((m) => m.SmtpSettings),
      },
      {
        path: 'bitrix/config',
        loadComponent: () =>
          import('./features/bitrix/bitrix-config.component').then((m) => m.BitrixConfigComponent),
      },
      {
        path: 'bitrix/sync',
        loadComponent: () =>
          import('./features/bitrix/bitrix-sync.component').then((m) => m.BitrixSyncComponent),
      },
    ],
  },
];
