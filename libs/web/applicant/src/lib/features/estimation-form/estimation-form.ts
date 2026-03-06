import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';

type UploadGroup = 'documents' | 'photos' | 'additional';
type RequiredUploadGroup = Exclude<UploadGroup, 'additional'>;
type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FileCategory = 'image' | 'pdf' | 'word' | 'spreadsheet' | 'other';

interface ImagePreviewState {
  fileKey: string;
  fileName: string;
  objectUrl: string;
}

@Component({
  selector: 'lib-estimation-form',
  standalone: true,
  imports: [],
  templateUrl: './estimation-form.html',
  styleUrl: './estimation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimationForm implements OnDestroy {
  private readonly router = inject(Router);
  private readonly objectUrls = new Map<string, string>();
  showValidationErrors = false;
  validationErrorMessage = '';
  documentFiles: ReadonlyArray<File> = [];
  photoFiles: ReadonlyArray<File> = [];
  additionalFiles: ReadonlyArray<File> = [];
  imagePreviewState: ImagePreviewState | null = null;

  onSubmit(event: Event, form: HTMLFormElement): void {
    event.preventDefault();
    this.showValidationErrors = true;
    this.validationErrorMessage = '';

    const firstInvalidControl = form.querySelector<FormControlElement>(
      'input:invalid, select:invalid, textarea:invalid',
    );
    if (firstInvalidControl) {
      this.validationErrorMessage = this.buildValidationErrorMessage(form, firstInvalidControl);
      firstInvalidControl.focus();
      return;
    }

    const missingRequiredUploadGroup = this.getFirstMissingRequiredUploadGroup();
    if (missingRequiredUploadGroup) {
      this.validationErrorMessage = this.buildUploadValidationErrorMessage(
        missingRequiredUploadGroup,
      );
      this.focusUploadInput(form, missingRequiredUploadGroup);
      return;
    }

    void this.router.navigate(['/applicant/assessment/status']);
  }

  onFilesSelected(event: Event, group: UploadGroup): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedFiles = inputElement.files ? Array.from(inputElement.files) : [];
    if (!selectedFiles.length) {
      return;
    }

    const nextFiles = this.mergeFiles(this.getFiles(group), selectedFiles);
    this.setFiles(group, nextFiles);
    this.syncFileInput(inputElement, nextFiles);
  }

  removeFile(inputElement: HTMLInputElement, group: UploadGroup, fileIndex: number): void {
    const files = this.getFiles(group);
    const removedFile = files[fileIndex];
    const nextFiles = files.filter((_, index) => index !== fileIndex);

    if (removedFile) {
      this.closeImagePreviewIfOpen(removedFile);
      this.releaseObjectUrl(removedFile);
    }

    this.setFiles(group, nextFiles);
    this.syncFileInput(inputElement, nextFiles);
  }

  hasFiles(group: UploadGroup): boolean {
    return this.getFiles(group).length > 0;
  }

  isRequiredUploadMissing(group: RequiredUploadGroup): boolean {
    return !this.hasFiles(group);
  }

  formatFileSize(bytes: number): string {
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} КБ`;
    }

    const megabytes = kilobytes / 1024;
    return `${megabytes.toFixed(1)} МБ`;
  }

  formatFileCount(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastDigit === 1 && lastTwoDigits !== 11) {
      return `${count} файл`;
    }

    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
      return `${count} файла`;
    }

    return `${count} файлов`;
  }

  isImageFile(file: File): boolean {
    const extension = this.getFileExtension(file.name);
    return (
      file.type.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'svg'].includes(extension)
    );
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

  getFileCategoryLabel(file: File): string {
    const category = this.getFileCategory(file);
    if (category === 'image') {
      return 'Изображение';
    }

    if (category === 'pdf') {
      return 'PDF';
    }

    if (category === 'word') {
      return 'DOC';
    }

    if (category === 'spreadsheet') {
      return 'XLS';
    }

    const extension = this.getFileExtension(file.name);
    return extension ? extension.toUpperCase() : 'FILE';
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
    if (!objectUrl || typeof document === 'undefined') {
      return;
    }

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    link.rel = 'noopener';
    link.click();
  }

  openImagePreview(file: File): void {
    const objectUrl = this.ensureObjectUrl(file);
    if (!objectUrl) {
      return;
    }

    this.imagePreviewState = {
      fileKey: this.buildFileKey(file),
      fileName: file.name,
      objectUrl,
    };
  }

  closeImagePreview(): void {
    this.imagePreviewState = null;
  }

  @HostListener('document:keydown.escape')
  onEscapeKeydown(): void {
    this.closeImagePreview();
  }

  ngOnDestroy(): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
      return;
    }

    for (const objectUrl of this.objectUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }

    this.objectUrls.clear();
  }

  private buildValidationErrorMessage(form: HTMLFormElement, control: FormControlElement): string {
    const labelText = this.getControlLabel(form, control);
    const browserMessage = control.validationMessage;

    if (labelText) {
      return `${labelText}: ${browserMessage}`;
    }

    return browserMessage;
  }

  private getFiles(group: UploadGroup): ReadonlyArray<File> {
    if (group === 'documents') {
      return this.documentFiles;
    }

    if (group === 'photos') {
      return this.photoFiles;
    }

    return this.additionalFiles;
  }

  private setFiles(group: UploadGroup, files: ReadonlyArray<File>): void {
    if (group === 'documents') {
      this.documentFiles = files;
      return;
    }

    if (group === 'photos') {
      this.photoFiles = files;
      return;
    }

    this.additionalFiles = files;
  }

  private mergeFiles(
    existingFiles: ReadonlyArray<File>,
    selectedFiles: ReadonlyArray<File>,
  ): ReadonlyArray<File> {
    const nextFiles = new Map<string, File>();

    for (const file of [...existingFiles, ...selectedFiles]) {
      nextFiles.set(this.buildFileKey(file), file);
    }

    return Array.from(nextFiles.values());
  }

  private getFirstMissingRequiredUploadGroup(): RequiredUploadGroup | null {
    if (!this.hasFiles('documents')) {
      return 'documents';
    }

    if (!this.hasFiles('photos')) {
      return 'photos';
    }

    return null;
  }

  private buildUploadValidationErrorMessage(group: RequiredUploadGroup): string {
    if (group === 'documents') {
      return 'Сканы и документы: загрузите хотя бы один документ или скан.';
    }

    return 'Фото объекта: загрузите хотя бы одно фото объекта.';
  }

  private focusUploadInput(form: HTMLFormElement, group: RequiredUploadGroup): void {
    const uploadInput = form.querySelector<HTMLInputElement>(`#${this.getUploadInputId(group)}`);
    uploadInput?.focus();
  }

  private syncFileInput(inputElement: HTMLInputElement, files: ReadonlyArray<File>): void {
    if (!files.length) {
      inputElement.value = '';
      return;
    }

    if (typeof DataTransfer === 'undefined') {
      return;
    }

    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    inputElement.files = dataTransfer.files;
  }

  private openFileInBrowser(file: File): void {
    const objectUrl = this.ensureObjectUrl(file);
    if (!objectUrl || typeof window === 'undefined') {
      return;
    }

    const previewWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!previewWindow) {
      this.downloadFile(file);
    }
  }

  private ensureObjectUrl(file: File): string | null {
    const fileKey = this.buildFileKey(file);
    const cachedUrl = this.objectUrls.get(fileKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null;
    }

    const objectUrl = URL.createObjectURL(file);
    this.objectUrls.set(fileKey, objectUrl);
    return objectUrl;
  }

  private releaseObjectUrl(file: File): void {
    const fileKey = this.buildFileKey(file);
    const objectUrl = this.objectUrls.get(fileKey);

    if (!objectUrl) {
      return;
    }

    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }

    this.objectUrls.delete(fileKey);
  }

  private closeImagePreviewIfOpen(file: File): void {
    if (this.imagePreviewState?.fileKey === this.buildFileKey(file)) {
      this.closeImagePreview();
    }
  }

  private getControlLabel(form: HTMLFormElement, control: FormControlElement): string {
    if (control.id) {
      const boundLabel = form.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`);
      if (boundLabel) {
        return this.normalizeLabelText(boundLabel.textContent);
      }
    }

    return this.normalizeLabelText(control.closest('label')?.textContent);
  }

  private normalizeLabelText(labelText: string | null | undefined): string {
    return labelText?.replace(/\*/g, '').replace(/\s+/g, ' ').trim() ?? '';
  }

  private getUploadInputId(group: RequiredUploadGroup): string {
    return group === 'documents' ? 'documentFiles' : 'photoFiles';
  }

  private buildFileKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private getFileCategory(file: File): FileCategory {
    const extension = this.getFileExtension(file.name);

    if (this.isImageFile(file)) {
      return 'image';
    }

    if (this.isPdfFile(file)) {
      return 'pdf';
    }

    if (
      extension === 'doc' ||
      extension === 'docx' ||
      file.type.includes('word') ||
      file.type.includes('officedocument.wordprocessingml')
    ) {
      return 'word';
    }

    if (
      extension === 'xls' ||
      extension === 'xlsx' ||
      file.type.includes('sheet') ||
      file.type.includes('excel')
    ) {
      return 'spreadsheet';
    }

    return 'other';
  }

  private isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || this.getFileExtension(file.name) === 'pdf';
  }

  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }
}
