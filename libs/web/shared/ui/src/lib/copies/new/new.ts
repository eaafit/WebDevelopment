import { Component, inject, signal, OnInit } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { Document } from '../services/document.service';
import { Assessment, AssessmentStatus } from '../../../../../../../shared/api-contracts/src';
import { DocumentApiService } from '../../../../../../applicant/src/lib/features/estimation-form/document-api.service';
import { AssessmentDocumentModel } from '../../../../../../applicant/src/lib/features/estimation-form/estimation-form.models';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common'; // Обязательно для @for и директив в standalone

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

  fileToUpload: File | null = null;
  selectedFile: File | null = null;
  doc = signal<Document | null>(null);
  
  // Переводим список заявок на сигнал, чтобы Angular гарантированно обновлял @for
  assesments = signal<Assessment[]>([]);
  selectedAssesmentID = signal<string>('');
  fileRes = signal<AssessmentDocumentModel | null>(null);

  async ngOnInit() {
    try {
      const data = await this.assessmentService.listAssessments(AssessmentStatus.IN_PROGRESS, { page: 1, limit: 1000 });
      
      if (data && data.assesments && data.assesments.length > 0) {
        this.assesments.set(data.assesments);
        // Сразу жестко выставляем ID первой заявки из списка
        this.selectedAssesmentID.set(data.assesments[0].id);
        console.log('Заявки успешно загружены:', data.assesments);
      } else {
        console.warn('Бэкенд вернул успешный ответ, но список заявок пуст.');
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок с бэкенда. Селектор упал в фоллбек:', error);
      // На всякий случай оставляем дефолтный ID для фоллбека, чтобы не слать пустую строку
      this.selectedAssesmentID.set('123');
    }
  }

  onAssesmentChange(event: any) {
    const value = event.target.value;
    this.selectedAssesmentID.set(value);
    console.log('Пользователь выбрал заявку с ID:', value);
  }

  async onDocumentUpload(event: any) {
    const file = event.target!.files[0];
    if (!file) return;

    this.selectedFile = file;
    
    const currentAssessmentId = this.selectedAssesmentID();
    console.log('Отправка файла на сервер для заявки:', currentAssessmentId);

    try {
      const res = await this.documentApiService.uploadDocument({
        assessmentId: currentAssessmentId,
        file: file,
        group: 'documents'
      });
      this.fileRes.set(res);
      console.log('Файл успешно предзагружен:', res);
    } catch (err) {
      console.error('Ошибка при предварительной загрузке файла:', err);
    }
  }

  async onSubmit() {
    const fileRes = this.fileRes();
    const fileBlob = this.selectedFile;

    if (!fileRes || !fileBlob) {
      console.error('Невозможно сохранить: файл отсутствует в памяти');
      return;
    }

    try {
      const fileContent = new Uint8Array(await fileBlob.arrayBuffer());

      await this.documentService.createDocument(
        this.selectedAssesmentID(),
        fileRes.fileName,
        fileRes.fileType,
        '', // userId
        fileContent
      );

      console.log('Документ окончательно привязан и сохранен');
    } catch (err) {
      console.error('Ошибка при финальном сохранении документа:', err);
    } finally {
      this.router.navigate(['../'], { relativeTo: this.route });
    }
  }

  async removeDoc() {
    const currentFile = this.fileRes();
    if (currentFile?.id) {
      try {
        await this.documentApiService.deleteDocument(currentFile.id);
      } catch (error) {
        console.error('Ошибка при удалении файла:', error);
      }
    }
    this.fileRes.set(null);
    this.doc.set(null);
  }
}