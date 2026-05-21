import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { ActivatedRoute } from '@angular/router';
import { Assessment, AssessmentStatus } from '../../../../../../../shared/api-contracts/src';
import { Document } from '../services/document.service';
import { CommonModule } from '@angular/common'; // Импортируем CommonModule для шаблона

@Component({
  selector: 'lib-copy',
  imports: [CommonModule], // Убедись, что CommonModule здесь
  templateUrl: './copy.html',
  styleUrl: './copy.scss',
})
export class Copy implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);

  id: string | null = null;
  
  doc = signal<Document | null>(null);
  assesment = signal<Assessment | null>(null);
  timer = signal(0);
  
  // Флаг для отслеживания ошибок бэкенда
  hasError = signal<boolean>(false);

  createDate = computed(() => {
    const currentDoc = this.doc();
    if (currentDoc === null || !currentDoc.uploadedAt?.seconds) {
      return "";
    }
    return new Date(Number(currentDoc.uploadedAt.seconds) * 1000).toLocaleDateString();
  });

  constructor(private route: ActivatedRoute) { }

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id === null) throw new Error('No id!');

    try {
      const fetchedDoc = await this.documentService.getDocument(this.id);
      
      // Если бэкенд вернул null или структуру с ошибкой (вместо документа)
      if (!fetchedDoc || (fetchedDoc as any).error) {
        this.hasError.set(true);
        return;
      }

      this.doc.set(fetchedDoc);

      if (fetchedDoc) {
        const fetchedAssessment = await this.assessmentService.getAssessment(fetchedDoc.assessmentId);
        this.assesment.set(fetchedAssessment);

        if (fetchedAssessment.status === AssessmentStatus.COMPLETED) return;

        if (!fetchedAssessment.createdAt?.seconds) {
          this.timer.set(0);
        } else {
          const deadlineRange = 10 * 24 * 60;
          const secDiff = Number(fetchedAssessment.createdAt.seconds) + deadlineRange - Date.now() / 1000;
          this.timer.set(Math.floor(secDiff / 60));
        }

        const timerId = setInterval(async () => {
          const currentDoc = this.doc();
          if (!currentDoc) return clearInterval(timerId);

          try {
            const updatedAssessment = await this.assessmentService.getAssessment(currentDoc.assessmentId);
            this.assesment.set(updatedAssessment);
            
            if (updatedAssessment.status === AssessmentStatus.COMPLETED) {
              clearInterval(timerId);
            } else {
              this.timer.set(this.timer() - 1);
            }
          } catch (timerErr) {
            console.error('Ошибка обновления таймера:', timerErr);
          }
        }, 60_000);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      this.hasError.set(true); // Включаем состояние ошибки в интерфейсе
    }
  }
}