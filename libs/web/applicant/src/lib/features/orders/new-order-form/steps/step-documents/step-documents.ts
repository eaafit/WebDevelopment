import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DOCUMENT_TYPE_OPTIONS, MAX_FILE_SIZE_BYTES } from '../../new-order-form.models';
import { fileRequiredValidator, fileValidator } from '../../new-order-form.validators';

interface ImagePreviewState {
  fileKey: string;
  fileName: string;
  previewUrl: string;
}

@Component({
  selector: 'lib-step-documents',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-documents.html',
  styleUrl: './step-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepDocuments {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) array!: FormArray<FormGroup>;
  @Input() showValidationErrors = false;

  readonly documentTypeOptions = DOCUMENT_TYPE_OPTIONS;
  readonly acceptedFileTypes = '.pdf,.jpg,.jpeg,.png';
  readonly maxFileSizeMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
  readonly imagePreviewState = signal<ImagePreviewState | null>(null);

  private readonly objectUrls = new Map<string, string>();

  isRowInvalid(index: number, controlName: string): boolean {
    const control = this.array.at(index)?.get(controlName);
    return Boolean(control && control.invalid && (control.touched || this.showValidationErrors));
  }

  isArrayInvalid(): boolean {
    return this.array.invalid && (this.array.touched || this.showValidationErrors);
  }

  addDocumentRow(): void {
    this.array.push(this.createDocumentGroup());
  }

  removeDocumentRow(index: number): void {
    if (this.array.length <= 1) {
      return;
    }

    this.array.removeAt(index);
  }

  removeUploadedFile(index: number): void {
    const group = this.array.at(index);
    if (group) {
      group.patchValue({
        isUploaded: false,
        file: null,
        fileName: '',
        previewUrl: '',
        downloadUrl: '',
      });
      group.get('file')?.setValidators([fileRequiredValidator, fileValidator]);
      group.get('file')?.updateValueAndValidity();
    }
  }

  isImageTypeFromUrl(url: string): boolean {
    if (!url) return false;
    const extension = this.getFileExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
  }

  openUploadedPreview(url: string): void {
    if (!url) return;
    this.imagePreviewState.set({
      fileKey: url,
      fileName: 'Загруженный файл',
      previewUrl: url,
    });
  }

  async openUploadedFile(url: string): Promise<void> {
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      // Clean up the objectUrl after a delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  openUploadedDownload(url: string, fileName: string): void {
    if (!url) return;
    this.downloadUrl(url, fileName);
  }

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.array.at(index);
    group?.patchValue({ file, fileName: file?.name ?? '', isUploaded: false });
    group?.get('file')?.markAsTouched();
    group?.get('fileName')?.updateValueAndValidity();
  }

  formatFileSize(bytes: number): string {
    const megabytes = bytes / (1024 * 1024);
    if (megabytes < 1) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }

    return `${megabytes.toFixed(1)} МБ`;
  }

  getFile(group: FormGroup): File | null {
    return (group.get('file')?.value as File | null) ?? null;
  }

  getFileCategoryLabel(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(extension)) {
      return 'IMG';
    }

    if (file.type === 'application/pdf' || extension === 'pdf') {
      return 'PDF';
    }

    return 'FILE';
  }

  isImageFile(file: File): boolean {
    return this.isImageType(file.type, file.name);
  }

  canPreviewFile(file: File): boolean {
    return this.isImageFile(file) || this.isPdfFile(file);
  }

  canOpenFile(file: File): boolean {
    return !this.isImageFile(file);
  }

  getFileObjectUrl(file: File): string {
    return this.ensureObjectUrl(file) ?? '';
  }

  previewFile(file: File): void {
    if (this.isImageFile(file)) {
      this.openImagePreview(file);
      return;
    }

    if (this.isPdfFile(file)) {
      this.openFileInBrowser(file);
    }
  }

  openFile(file: File): void {
    if (this.isImageFile(file)) {
      this.openImagePreview(file);
      return;
    }

    this.openFileInBrowser(file);
  }

  downloadFile(file: File): void {
    const objectUrl = this.ensureObjectUrl(file);
    if (!objectUrl) {
      return;
    }

    this.downloadUrl(objectUrl, file.name);
  }

  openImagePreview(file: File): void {
    const objectUrl = this.ensureObjectUrl(file);
    if (!objectUrl) {
      return;
    }

    this.imagePreviewState.set({
      fileKey: this.buildFileKey(file),
      fileName: file.name,
      previewUrl: objectUrl,
    });
  }

  closeImagePreview(): void {
    this.imagePreviewState.set(null);
  }

  private ensureObjectUrl(file: File): string | null {
    const fileKey = this.buildFileKey(file);
    const existingUrl = this.objectUrls.get(fileKey);
    if (existingUrl) {
      return existingUrl;
    }

    try {
      const url = URL.createObjectURL(file);
      this.objectUrls.set(fileKey, url);
      return url;
    } catch {
      return null;
    }
  }

  private buildFileKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private isImageType(type: string, fileName: string): boolean {
    if (type.startsWith('image/')) {
      return true;
    }

    const extension = this.getFileExtension(fileName);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
  }

  private isPdfType(type: string, fileName: string): boolean {
    if (type === 'application/pdf') {
      return true;
    }

    const extension = this.getFileExtension(fileName);
    return extension === 'pdf';
  }

  private isPdfFile(file: File): boolean {
    return this.isPdfType(file.type, file.name);
  }

  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  private downloadUrl(url: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private openFileInBrowser(file: File): void {
    const objectUrl = this.ensureObjectUrl(file);
    if (!objectUrl) {
      return;
    }

    window.open(objectUrl, '_blank');
  }

  private createDocumentGroup(): FormGroup {
    return this.fb.nonNullable.group({
      documentType: ['', Validators.required],
      fileName: [''],
      file: [null as File | null, [fileRequiredValidator, fileValidator]],
    });
  }
}
