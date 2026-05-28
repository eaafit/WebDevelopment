import { Component, inject, signal, OnInit } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { Document } from '../services/document.service';
import { Assessment, AssessmentStatus } from '../../../../../../../shared/api-contracts/src';
import { DocumentApiService } from '../../../../../../applicant/src/lib/features/estimation-form/document-api.service';
import { AssessmentDocumentModel } from '../../../../../../applicant/src/lib/features/estimation-form/estimation-form.models';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-new',
  imports: [CommonModule],
  templateUrl: './new.html',
  styleUrl: './new.scss',
})
export class New implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);
  private readonly documentApiService = inject(DocumentApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Храним выбранный файл локально в памяти браузера
  selectedFile: File | null = null;
  
  assesments = signal<Assessment[]>([]);
  selectedAssesmentID = signal<string>('');
  
  // Флаг загрузки, чтобы кнопка блокировалась во время отправки на сервер
  isSubmitting = signal<boolean>(false);

  async ngOnInit() {
    try {
      const data = await this.assessmentService.listAssessments(AssessmentStatus.IN_PROGRESS, { page: 1, limit: 1000 });
      
      if (data && data.assesments && data.assesments.length > 0) {
        this.assesments.set(data.assesments);
        this.selectedAssesmentID.set(data.assesments[0].id);
      } else {
        console.warn('Бэкенд вернул успешный ответ, но список заявок пуст.');
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
      this.selectedAssesmentID.set('123');
    }
  }

  onAssesmentChange(event: any) {
    const value = event.target.value;
    this.selectedAssesmentID.set(value);
  }

  // Метод теперь просто запоминает файл локально, ничего не отправляя на бэкенд!
  onDocumentUpload(event: any) {
    const file = event.target!.files[0];
    if (!file) return;

    this.selectedFile = file;
    console.log('Файл успешно выбран локально (готов к замене):', file.name);
  }

  // Вся отправка происходит здесь по кнопке "Сохранить документ"
  async onSubmit() {
  const fileBlob = this.selectedFile;

  if (!fileBlob) {
    console.error('Невозможно сохранить: файл не выбран');
    return;
  }

  try {
    this.isSubmitting.set(true);
    const currentAssessmentId = this.selectedAssesmentID();
    
    console.log('Отправка файла на сервер для заявки:', currentAssessmentId);
    
    const uploadedFileRes = await this.documentApiService.uploadDocument({
      assessmentId: currentAssessmentId,
      file: fileBlob,
      group: 'documents'
    });

    console.log('Файл успешно сохранен на бэкенде:', uploadedFileRes);

    this.router.navigate(['../'], { relativeTo: this.route });

  } catch (err) {
    console.error('Ошибка при сохранении документа:', err);
  } finally {
    this.isSubmitting.set(false);
  }
}
  removeDoc() {
    this.selectedFile = null;
    console.log('Локальный выбор сброшен');
  }

  goBackToList(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}