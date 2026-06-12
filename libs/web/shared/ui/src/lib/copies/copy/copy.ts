import { Component, computed, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Assessment,
  DocumentStatus,
  PaymentService,
  PaymentType,
} from '@notary-portal/api-contracts';
import { Document } from '../services/document.service';
import { mapCopyStatus, resolveCopyPrice } from '../services/document-status';
import { CommonModule } from '@angular/common';
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { TokenStore } from '../../rpc/token-store';

// Карточка заказа копии. Для заявителя — оплата и получение, для нотариуса —
// обработка заказа (взять в работу, приложить готовый скан, отметить готовым).
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
  private readonly tokenStore = inject(TokenStore);
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  id: string | null = null;
  role: 'applicant' | 'notary' = 'applicant';

  doc = signal<Document | null>(null);
  assesment = signal<Assessment | null>(null);

  hasError = signal<boolean>(false);
  busy = signal<boolean>(false);
  selectedScan: File | null = null;

  private pollId: ReturnType<typeof setInterval> | null = null;

  // Статус заказа из собственного поля Document.status.
  readonly statusView = computed(() => mapCopyStatus(this.doc()?.status));

  // Удобные предикаты статуса для шаблона.
  readonly isPendingPayment = computed(() => this.doc()?.status === DocumentStatus.PENDING_PAYMENT);
  readonly isPaid = computed(() => this.doc()?.status === DocumentStatus.PAID);
  readonly isInProgress = computed(() => this.doc()?.status === DocumentStatus.IN_PROGRESS);
  readonly isReady = computed(() => this.doc()?.status === DocumentStatus.READY);

  readonly isNotary = computed(() => this.role === 'notary');
  readonly isApplicant = computed(() => this.role === 'applicant');

  // Тип/название копии выводим из её стоимости (150/300/500 ₽).
  readonly typeLabel = computed(() => {
    switch (this.doc()?.price) {
      case 150:
        return 'Выписка';
      case 300:
        return 'Нотариальный акт';
      case 500:
        return 'Отчёт об оценке';
      default:
        return 'Копия документа';
    }
  });

  createDate = computed(() => {
    const currentDoc = this.doc();
    if (currentDoc === null || !currentDoc.uploadedAt?.seconds) {
      return '';
    }
    return new Date(Number(currentDoc.uploadedAt.seconds) * 1000).toLocaleDateString();
  });

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    this.role = this.route.snapshot.data['role'] === 'notary' ? 'notary' : 'applicant';
    if (this.id === null) throw new Error('No id!');

    await this.loadDoc();

    // Периодически обновляем заказ, чтобы заявитель видел смену статуса нотариусом.
    this.pollId = setInterval(() => {
      void this.loadDoc(true);
    }, 30_000);
  }

  ngOnDestroy() {
    if (this.pollId !== null) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  private async loadDoc(silent = false): Promise<void> {
    if (this.id === null) return;
    try {
      const fetchedDoc = await this.documentService.getDocument(this.id);
      this.doc.set(fetchedDoc);

      // Связанная заявка — контекст для нотариуса (адрес, описание, заявитель).
      if (fetchedDoc?.assessmentId && this.assesment() === null) {
        try {
          this.assesment.set(await this.assessmentService.getAssessment(fetchedDoc.assessmentId));
        } catch (assessmentErr) {
          console.warn('Не удалось загрузить связанную заявку:', assessmentErr);
        }
      }
    } catch (error) {
      if (!silent) {
        console.error('Ошибка загрузки данных:', error);
        this.hasError.set(true);
      }
    }
  }

  // ─── Действия заявителя ──────────────────────────────────────────────

  // Оплата копии: только createPayment. Статус PAID выставляет бэкенд billing при
  // создании DocumentCopy-платежа (targetId = id заказа), поэтому клиент НЕ зовёт
  // нотариус-онли updateDocumentStatus (иначе 403 на чужих/сид-копиях).
  async payForCopy(): Promise<void> {
    const currentDoc = this.doc();
    if (!currentDoc || this.busy()) return;

    const amount = resolveCopyPrice(currentDoc.price);
    if (amount <= 0) {
      console.error('Некорректная сумма копии');
      return;
    }

    try {
      this.busy.set(true);
      // paymentProvider не задаём — берётся из конфига бэкенда (PAYMENT_PROVIDER).
      await this.paymentClient.createPayment({
        userId: this.tokenStore.user()?.id ?? currentDoc.uploadedById,
        amount: amount.toString(),
        type: PaymentType.DOCUMENT_COPY,
        targetId: currentDoc.id,
      });
      await this.loadDoc();
    } catch (err) {
      console.error('Ошибка оплаты копии:', err);
    } finally {
      this.busy.set(false);
    }
  }

  // Заявитель подтверждает получение готовой копии.
  async markDelivered(): Promise<void> {
    await this.changeStatus(DocumentStatus.DELIVERED);
  }

  // ─── Действия нотариуса ──────────────────────────────────────────────

  // Нотариус берёт оплаченный заказ в работу.
  async takeInWork(): Promise<void> {
    await this.changeStatus(DocumentStatus.IN_PROGRESS);
  }

  onScanUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedScan = input.files?.[0] ?? null;
  }

  // Нотариус прикладывает готовую копию к ЭТОМУ заказу (result-файл) и отмечает
  // заказ готовым. Новый Document при этом НЕ создаётся (иначе появлялся лишний
  // платный заказ); скачивание готовой копии резолвится на версию нотариуса.
  async markReady(): Promise<void> {
    const currentDoc = this.doc();
    if (!currentDoc || this.busy()) return;

    try {
      this.busy.set(true);
      if (this.selectedScan) {
        // uploadCopyResult сам переводит заказ в READY на бэке.
        await this.documentService.uploadCopyResult(currentDoc.id, this.selectedScan);
        this.selectedScan = null;
      } else {
        await this.documentService.updateDocumentStatus(currentDoc.id, DocumentStatus.READY);
      }
      await this.loadDoc();
    } catch (err) {
      console.error('Ошибка при завершении заказа:', err);
    } finally {
      this.busy.set(false);
    }
  }

  // Переход в связанную заявку (её документы) — для нотариуса.
  goToAssessment(): void {
    const assessmentId = this.doc()?.assessmentId;
    if (assessmentId) {
      this.router.navigate(['/notary/copies'], { queryParams: { assessmentId } });
    }
  }

  private async changeStatus(status: number): Promise<void> {
    const currentDoc = this.doc();
    if (!currentDoc || this.busy()) return;
    try {
      this.busy.set(true);
      await this.documentService.updateDocumentStatus(currentDoc.id, status);
      await this.loadDoc();
    } catch (err) {
      console.error('Ошибка смены статуса заказа:', err);
    } finally {
      this.busy.set(false);
    }
  }

  // ─── Навигация / закрытие ────────────────────────────────────────────

  goBackToList(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.goBackToList();
    }
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.goBackToList();
    }
  }
}
