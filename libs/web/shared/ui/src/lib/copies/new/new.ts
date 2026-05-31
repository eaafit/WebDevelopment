import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import {
  AssessmentStatus,
  DocumentType,
  PaymentService,
  PaymentType,
} from '@notary-portal/api-contracts';
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';

@Component({
  selector: 'lib-new',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new.html',
  styleUrl: './new.scss',
})
export class New implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  
  // Создаем клиент для работы с платежами напрямую через gRPC
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  // Список типов документов строго по ТЗ (по возрастанию цены)
  readonly documentTypes = [
    { value: 1, label: 'Выписка' },          // 150 ₽
    { value: 2, label: 'Нотариальный акт' }, // 300 ₽
    { value: 3, label: 'Отчёт об оценке' }   // 500 ₽
  ];

  // Цены из mock-требований
  private readonly documentPrices: Record<number, number> = {
    1: 150,  // Выписка
    2: 300,  // Нотариальный акт
    3: 500   // Отчёт об оценке
  };

  selectedDocType = signal<number>(1);
  selectedAssesmentID = signal<string>('');
  assesments = signal<any[]>([]);
  isSubmitting = signal<boolean>(false);
  comment = signal<string>('');
  selectedFile: File | null = null;

  readonly price = computed(() => {
    const type = this.selectedDocType();
    return this.documentPrices[type] || 0;
  });

  ngOnInit(): void {
    this.loadActiveAssessments();
  }

  goBackToList() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  removeDoc() {
    this.selectedFile = null;
  }

  async loadActiveAssessments() {
    try {
      const data = await this.assessmentService.listAssessments(AssessmentStatus.IN_PROGRESS, { page: 1, limit: 1000 });
      if (data && data.assesments && data.assesments.length > 0) {
        this.assesments.set(data.assesments);
        this.selectedAssesmentID.set(data.assesments[0].id);
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  }

  onDocumentUpload(event: any) {
    const file = event.target!.files[0];
    if (file) this.selectedFile = file;
  }

  getCurrentUserId(): string {
    const currentAssesment = this.assesments().find(a => a.id === this.selectedAssesmentID());
    
    // Пытаемся взять userId или applicantId или clientId из объекта заявки
    return currentAssesment?.userId || 
           (currentAssesment as any)?.applicantId || 
           (currentAssesment as any)?.clientId || 
           '00000000-0000-0000-0000-000000000000';
  }
  
  async onSubmit() {
    if (!this.selectedFile) return;

    try {
      this.isSubmitting.set(true);
      
      // 1. Сначала загружаем документ
      await this.documentService.createDocument({
        assessmentId: this.selectedAssesmentID(),
        fileName: this.selectedFile.name,
        fileType: this.selectedFile.type || 'application/octet-stream',
        uploadedById: this.getCurrentUserId(),
        documentType: DocumentType.OTHER,
        fileContent: new Uint8Array(await this.selectedFile.arrayBuffer()),
      });

      // 2. Создаем запрос на оплату с правильной ценой и реальным ID юзера
      const paymentResponse = await this.paymentClient.createPayment({
        userId: this.getCurrentUserId(),
        amount: this.price().toString(), 
        type: PaymentType.DOCUMENT_COPY, 
        targetId: this.selectedAssesmentID(), 
        paymentProvider: 'yookassa' 
      });

      // 3. Редирект на оплату
      if (paymentResponse.paymentUrl) {
        window.location.href = paymentResponse.paymentUrl;
      } else {
        this.router.navigate(['../'], { relativeTo: this.route });
      }

    } catch (err) {
      console.error('Ошибка при сохранении или создании платежа:', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
