import { Component, computed, input, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Document } from '../../services/document.service';
// Добавляем импорты для gRPC платежей
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { PaymentService, PaymentType } from '@notary-portal/api-contracts';

@Component({
  selector: 'document-row',
  imports: [CommonModule],
  templateUrl: './document-row.html',
  styleUrl: './document-row.scss',
})
export class DocumentRow {
  // Инициализируем клиент платежей с помощью inject
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }

  document = input.required<Document>()
  status = input<number | undefined>();
  isProcessing = signal(false);

  displayFileName = computed(() => {
    const rawName = this.document().fileName || '';
    if (!rawName.includes('__skip__')) return rawName;
    
    const parts = rawName.split('__skip__');
    const extIndex = parts[1].lastIndexOf('.');
    const ext = extIndex !== -1 ? parts[1].substring(extIndex) : '';
    return parts[0] + ext;
  });

  extractedComment = computed(() => {
    const rawName = this.document().fileName || '';
    if (!rawName.includes('__skip__')) return '';
    
    const parts = rawName.split('__skip__');
    const commentWithExt = parts[1];
    const extIndex = commentWithExt.lastIndexOf('.');
    return extIndex !== -1 ? commentWithExt.substring(0, extIndex) : commentWithExt;
  });

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

  getMappedStatus(statusValue: number | undefined): string {
    if (statusValue === undefined) return 'pending';
    if (statusValue === 1) return 'pending';
    if (statusValue === 4) return 'ready';
    if (statusValue === 5) return 'delivered';
    return 'processing';
  }

  getStatusText(statusValue: number | undefined): string {
    const mapped = this.getMappedStatus(statusValue);
    const texts: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'processing': 'В обработке',
      'ready': 'Готово',
      'delivered': 'Выдано'
    };
    return texts[mapped] || 'В обработке';
  }

  async payForDocument(event: Event) {
    event.stopPropagation();
    
    // 1. Блокировка повторных нажатий
    if (this.isProcessing()) return;

    const doc = this.document();
    if (!doc) return;

    // Включаем "крутилку" или блокировку кнопки
    this.isProcessing.set(true);

    try {
      // Приводим к any, чтобы получить тип
      const docType = (doc as any).documentType;
      
      // Лог для отладки - посмотри в консоль, какой тип приходит
      console.log('Тип документа:', docType);

      const priceMap: Record<number, number> = {
        1: 150,
        2: 300,
        3: 500
      };

      const amount = priceMap[docType];

      // 2. БЕЗОПАСНАЯ ПРОВЕРКА: если цена не найдена, прерываем выполнение
      if (amount === undefined) {
        console.error('Ошибка: для типа документа', docType, 'цена не задана!');
        this.isProcessing.set(false); // Снимаем блокировку, чтобы пользователь мог нажать еще раз (если починит)
        return;
      }

      // Теперь мы уверены, что amount — это число, и .toString() отработает
      const paymentResponse = await this.paymentClient.createPayment({
        userId: doc.uploadedById,
        amount: amount.toString(), 
        type: PaymentType.DOCUMENT_COPY,
        targetId: doc.assessmentId,
        paymentProvider: 'yookassa'
      });

      if (paymentResponse.paymentUrl) {
        window.location.href = paymentResponse.paymentUrl;
      } else {
        // Если url не пришел, тоже разблокируем
        this.isProcessing.set(false);
      }
    } catch (error) {
      console.error('Ошибка при создании платежа из списка:', error);
      // Обязательно снимаем блокировку при ошибке
      this.isProcessing.set(false);
    }
  }
}