import { Component, computed, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Assessment, AssessmentStatus, PaymentService, PaymentType } from '../../../../../../../shared/api-contracts/src';
import { Document } from '../services/document.service';
import { CommonModule } from '@angular/common';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { createClient } from '@connectrpc/connect';

@Component({
  selector: 'lib-copy',
  imports: [CommonModule],
  templateUrl: './copy.html',
  styleUrl: './copy.scss',
})
export class Copy implements OnInit, OnDestroy {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  id: string | null = null;
  
  doc = signal<Document | null>(null);
  assesment = signal<Assessment | null>(null);
  timer = signal<number>(0);
  
  hasError = signal<boolean>(false);
  private timerId: any = null;

  async payForDocument(event: Event) {
    event.stopPropagation();
    const currentDoc = this.doc();
    if (!currentDoc) return;

    try {
      // Определяем сумму в зависимости от типа документа
      const amount = (currentDoc as any).documentType === 1 ? 150 : 300;

      const paymentResponse = await this.paymentClient.createPayment({
        userId: currentDoc.uploadedById,
        amount: amount.toString(),
        type: PaymentType.DOCUMENT_COPY,
        targetId: currentDoc.assessmentId,
      });

      if (paymentResponse.paymentUrl) {
        window.location.href = paymentResponse.paymentUrl;
      }
    } catch (error) {
      console.error('Ошибка при создании платежа на странице копии:', error);
    }
  }
  
  // Имя файла без встроенного комментария
  displayFileName = computed(() => {
    const rawName = this.doc()?.fileName || '';
    if (!rawName.includes('__skip__')) return rawName;
    
    const parts = rawName.split('__skip__');
    const extIndex = parts[1].lastIndexOf('.');
    const ext = extIndex !== -1 ? parts[1].substring(extIndex) : '';
    return parts[0] + ext;
  });

  // Вырезанный комментарий
  extractedComment = computed(() => {
    const rawName = this.doc()?.fileName || '';
    if (!rawName.includes('__skip__')) return '';
    
    const parts = rawName.split('__skip__');
    const commentWithExt = parts[1];
    const extIndex = commentWithExt.lastIndexOf('.');
    return extIndex !== -1 ? commentWithExt.substring(0, extIndex) : commentWithExt;
  });
  
  createDate = computed(() => {
    const currentDoc = this.doc();
    if (currentDoc === null || !currentDoc.uploadedAt?.seconds) {
      return "";
    }
    return new Date(Number(currentDoc.uploadedAt.seconds) * 1000).toLocaleDateString();
  });

  constructor() { }

  // Хелпер считает минуты, привязываясь строго к дате загрузки ДОКУМЕНТА (bigint)
  private calculateMinutesLeft(uploadedAtSeconds: bigint): number {
    const deadlineRangeInSeconds = 24 * 60 * 60; // 1 день дедлайна
    const secDiff = Number(uploadedAtSeconds) + deadlineRangeInSeconds - (Date.now() / 1000);
    return secDiff > 0 ? Math.floor(secDiff / 60) : 0;
  }

  // Метод для редиректа обратно в список при клике на свободную область
  goBackToList(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  // Маппинг реальных статусов в mock-статусы по ТЗ
  getMappedStatus(status: number | undefined): string {
    if (status === undefined) return 'pending';
    
    // Предполагаем стандартную структуру: 1 - создан, 4 - завершен
    if (status === 1) return 'pending';      // Желтый
    if (status === 4) return 'ready';        // Зеленый
    if (status === 5) return 'delivered';    // Серый (если будет выдано)
    
    return 'processing'; // все промежуточные статусы (2, 3) — Синий
  }

  // Получение русского текста для бейджа
  getStatusText(status: number | undefined): string {
    const mapped = this.getMappedStatus(status);
    const texts: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'processing': 'В обработке',
      'ready': 'Готово',
      'delivered': 'Выдано'
    };
    return texts[mapped] || 'В обработке';
  }
  
  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id === null) throw new Error('No id!');

    try {
      const fetchedDoc = await this.documentService.getDocument(this.id);
      
      if (!fetchedDoc || (fetchedDoc as any).error) {
        this.hasError.set(true);
        return;
      }

      this.doc.set(fetchedDoc);

      if (fetchedDoc) {
        const fetchedAssessment = await this.assessmentService.getAssessment(fetchedDoc.assessmentId);
        this.assesment.set(fetchedAssessment);

        if (fetchedAssessment.status === AssessmentStatus.COMPLETED) return;

        // Первый точный расчёт таймера от даты документа
        if (fetchedDoc.uploadedAt?.seconds) {
          this.timer.set(this.calculateMinutesLeft(fetchedDoc.uploadedAt.seconds));
        }

        // Интервал для проверки статуса на бэкенде и синхронизации времени
        this.timerId = setInterval(async () => {
          const currentDoc = this.doc();
          if (!currentDoc) return clearInterval(this.timerId);

          try {
            const updatedAssessment = await this.assessmentService.getAssessment(currentDoc.assessmentId);
            this.assesment.set(updatedAssessment);
            
            if (updatedAssessment.status === AssessmentStatus.COMPLETED) {
              clearInterval(this.timerId);
              return;
            }

            // Каждую минуту пересчитываем остаток от Date.now()
            if (currentDoc.uploadedAt?.seconds) {
              this.timer.set(this.calculateMinutesLeft(currentDoc.uploadedAt.seconds));
            }
          } catch (timerErr) {
            console.error('Ошибка обновления таймера:', timerErr);
          }
        }, 60_000);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      this.hasError.set(true);
    }
  }

  // Вычищаем интервал из памяти при уходе со страницы
  ngOnDestroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }
}