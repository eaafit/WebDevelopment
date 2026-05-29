import { Component, inject, signal, OnInit } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { AssessmentStatus } from '@notary-portal/api-contracts'; // Проверьте путь импорта
import { DocumentApiService } from '../../../../../../applicant/src/lib/features/estimation-form/document-api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Добавляем для работы с комментариями

@Component({
  selector: 'lib-new',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new.html',
  styleUrl: './new.scss',
})
export class New implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentApiService = inject(DocumentApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Список типов документов из proto
  readonly documentTypes = [
    { value: 1, label: 'Паспорт' },
    { value: 2, label: 'Свидетельство о праве собственности' },
    { value: 3, label: 'Технический план' },
    { value: 4, label: 'Кадастровый паспорт' },
    { value: 5, label: 'Фотография' },
    { value: 7, label: 'Дополнительный документ (основание)' },
    { value: 6, label: 'Прочее' },
  ];

  selectedFile: File | null = null;
  assesments = signal<any[]>([]);
  
  // Поля формы
  selectedAssesmentID = signal<string>('');
  selectedDocType = signal<number>(1); // По умолчанию "Паспорт"
  comment = signal<string>('');
  
  isSubmitting = signal<boolean>(false);

  async ngOnInit() {
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

  async onSubmit() {
    if (!this.selectedFile) return;

    try {
      this.isSubmitting.set(true);
      
      // Отправляем файл вместе с типом документа
      // Примечание: если ваш API uploadDocument не принимает тип или комментарий, 
      // они просто логируются или расширяются в контрактах позже.
      await this.documentApiService.uploadDocument({
        assessmentId: this.selectedAssesmentID(),
        file: this.selectedFile,
        group: 'documents',
        documentType: this.selectedDocType(), // Добавили тип
        metadata: { comment: this.comment() }  // Передаем комментарий в метаданных, если поддерживается
      } as any);

      this.router.navigate(['../'], { relativeTo: this.route });
    } catch (err) {
      console.error('Ошибка при сохранении:', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  removeDoc() { this.selectedFile = null; }
  goBackToList() { this.router.navigate(['../'], { relativeTo: this.route }); }
}