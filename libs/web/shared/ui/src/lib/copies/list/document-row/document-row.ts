import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { createClient } from '@connectrpc/connect';
import { PaymentService, PaymentType } from '@notary-portal/api-contracts';
import { Document } from '../../services/document.service';
import { mapCopyStatus, resolveCopyPrice } from '../../services/document-status';
import { RPC_TRANSPORT } from '../../../rpc/rpc-transport';
import { TokenStore } from '../../../rpc/token-store';

@Component({
  selector: 'lib-document-row',
  imports: [CommonModule],
  templateUrl: './document-row.html',
  styleUrl: './document-row.scss',
})
export class DocumentRow {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tokenStore = inject(TokenStore);
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  document = input.required<Document>()
  // Статус заказа копии (Document.status), не статус заявки.
  status = input<number | undefined>();

  // Сообщаем списку об успешной оплате, чтобы он перезагрузил данные (статус → «Оплачено»).
  readonly paid = output<void>();

  readonly isProcessing = signal<boolean>(false);

  // Единый маппинг статуса в лейбл/цвет/доступность скачивания.
  readonly statusView = computed(() => mapCopyStatus(this.status() ?? this.document().status));

  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  private readonly timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  uploaded = computed(() => {
    const doc = this.document();
    if (doc?.uploadedAt?.seconds) {
      const parsedDate = new Date(Number(doc.uploadedAt.seconds) * 1000);
      
      if (!isNaN(parsedDate.getTime())) {
        return {
          date: this.dateFormatter.format(parsedDate).replace(/\s?г\.$/, ''),
          time: this.timeFormatter.format(parsedDate)
        };
      }
    }
    return null;
  });

  navigateToDocumentPage(): void {
    this.router.navigate([this.document().id], { relativeTo: this.route });
  }

  // Оплата прямо из строки списка. Только createPayment (статус PAID ставит бэк
  // billing), targetId = id заказа, прайс-фолбэк + гард. Клик не открывает деталь.
  async payForDocument(event: Event): Promise<void> {
    event.stopPropagation();
    const doc = this.document();
    if (this.isProcessing()) return;

    const amount = resolveCopyPrice(doc.price);
    if (amount <= 0) {
      console.error('Некорректная сумма копии');
      return;
    }

    try {
      this.isProcessing.set(true);
      await this.paymentClient.createPayment({
        userId: this.tokenStore.user()?.id ?? doc.uploadedById,
        amount: amount.toString(),
        type: PaymentType.DOCUMENT_COPY,
        targetId: doc.id,
        paymentProvider: 'yookassa',
      });
      this.paid.emit();
    } catch (err) {
      console.error('Ошибка оплаты копии:', err);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
