import { Component, inject, signal } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { Document } from '../services/document.service';
import { Assessment, AssessmentStatus } from '../../../../../../../shared/api-contracts/src';
import { DocumentApiService } from '../../../../../../applicant/src/lib/features/estimation-form/document-api.service'
import { AssessmentDocumentModel } from '../../../../../../applicant/src/lib/features/estimation-form/estimation-form.models';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'lib-new',
  imports: [],
  templateUrl: './new.html',
  styleUrl: './new.scss',
})
export class New {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);
  private readonly documentApiService = inject(DocumentApiService)
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  fileToUpload: File | null = null;
  selectedFile: File | null = null;
  doc = signal<Document | null>(null)
  assesments: Assessment[] = [];
  selectedAssesmentID = signal('')
  fileRes = signal<AssessmentDocumentModel | null>(null)

  async ngOnInit() {
    try {
      const data = await this.assessmentService.listAssessments(AssessmentStatus.IN_PROGRESS, { page: 1, limit: 1000 });
      this.assesments = data.assesments;

      // Устанавливаем первую заявку как выбранную по умолчанию
      if (this.assesments.length > 0) {
        this.selectedAssesmentID.set(this.assesments[0].id);
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  }

  onAssesmentChange(event: any) {
    this.selectedAssesmentID.set(event.target.value)
  }

  async onSubmit() {
    const fileRes = this.fileRes();
    const fileBlob = this.selectedFile;

    // Если файла нет в памяти, редирект смысла не имеет, просто выходим
    if (!fileRes || !fileBlob) {
      console.error('Файл не выбран или не загружен');
      return;
    }

    try {
      // Читаем содержимое файла в массив байтов (Uint8Array)
      const fileContent = new Uint8Array(await fileBlob.arrayBuffer());

      // Передаем контент 5-м параметром (как того требует бэкенд)
      await this.documentService.createDocument(
        this.selectedAssesmentID(),
        fileRes.fileName,
        fileRes.fileType,
        '', // userId
        fileContent // <--- ТЕПЕРЬ ОШИБКА 400 ИСЧЕЗНЕТ
      );

      console.log('Документ успешно создан');
    } catch (err) {
      // Если всё равно упадет (например, сервер выключен), мы поймаем ошибку здесь
      console.error('Ошибка при сохранении, но мы всё равно уходим на список:', err);
    } finally {
      // Код в finally выполняется ВСЕГДА: и при успехе, и при ошибке
      this.router.navigate(['../'], { relativeTo: this.route });
    }
  }

  async onDocumentUpload(event: any) {
    const file = event.target!.files[0];
    if (!file) return;

    this.selectedFile = file;

    const res = await this.documentApiService.uploadDocument({
      assessmentId: this.selectedAssesmentID(),
      file: file,
      group: 'documents'
    });
    this.fileRes.set(res);
  }

  async removeDoc() {
    const currentFile = this.fileRes();
    if (currentFile?.id) {
      try {
        await this.documentApiService.deleteDocument(currentFile.id);
      } catch (error) {
        console.error('Ошибка при удалении:', error);
      }
    }
    this.fileRes.set(null);
    this.doc.set(null);
  }
}
