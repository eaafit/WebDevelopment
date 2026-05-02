import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentType } from '@notary-portal/api-contracts';
import { UploadedFile } from '../models/uploaded-file.model';
import { PhotoItemComponent } from '../photo-item/photo-item';

@Component({
  selector: 'lib-assessment-upload-step',
  standalone: true,
  imports: [CommonModule, PhotoItemComponent],
  templateUrl: './upload-step.html',
  styleUrls: ['./upload-step.scss'],
})
export class AssessmentUploadStepComponent {
  @Input() assessmentId!: string;
  @Output() uploadComplete = new EventEmitter<void>();

  files = signal<UploadedFile[]>([]);

  readonly maxFiles = 30;
  readonly maxSize = 20 * 1024 * 1024;

  onFileSelect(event: any) {
    const selectedFiles: File[] = Array.from(event.target.files);
    this.addFiles(selectedFiles);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    this.addFiles(droppedFiles);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  addFiles(newFiles: File[]) {
    const current = this.files();

    for (const file of newFiles) {
      if (current.length >= this.maxFiles) break;

      if (!this.validateFile(file)) continue;

      const preview = URL.createObjectURL(file);

      const uploaded: UploadedFile = {
        file,
        preview,
        type: DocumentType.PHOTO,
        quality: this.getQuality(file),
      };

      current.push(uploaded);

      this.createDocument(uploaded);
    }

    this.files.set([...current]);
  }

  validateFile(file: File): boolean {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowed.includes(file.type) && file.size <= this.maxSize;
  }

  getQuality(file: File): 'good' | 'ok' | 'low' {
    if (file.size > 1024 * 1024) return 'good';
    if (file.size > 200 * 1024) return 'ok';
    return 'low';
  }

  removeFile(index: number) {
    const updated = this.files().filter((_, i) => i !== index);
    this.files.set(updated);
  }

  updateType(index: number, type: DocumentType) {
    const updated = [...this.files()];
    updated[index].type = type;
    this.files.set(updated);
  }

  async createDocument(file: UploadedFile) {
    // TODO: заменить на реальный сервис
    const mockId = Math.random().toString(36).substring(2);
    file.documentId = mockId;
  }
}
