import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

type UploadGroup = 'documents' | 'photos' | 'additional';

@Component({
  selector: 'lib-estimation-form',
  standalone: true,
  imports: [],
  templateUrl: './estimation-form.html',
  styleUrl: './estimation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimationForm {
  private readonly router = inject(Router);
  showValidationErrors = false;
  validationErrorMessage = '';

  onSubmit(
    event: Event,
    form: HTMLFormElement,
    isConfirmCorrectChecked: boolean,
    isConfirmProcessingChecked: boolean,
  ): void {
    event.preventDefault();
    this.showValidationErrors = true;
    this.validationErrorMessage = '';

    if (!form.checkValidity()) {
      const firstInvalidControl = form.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(':invalid');

      if (firstInvalidControl) {
        this.validationErrorMessage = this.buildValidationErrorMessage(form, firstInvalidControl);
        firstInvalidControl.focus();
      }

      return;
    }

    if (!isConfirmCorrectChecked || !isConfirmProcessingChecked) {
      return;
    }

    void this.router.navigate(['/applicant/assessment/status']);
  }

  documentFiles: ReadonlyArray<File> = [];
  photoFiles: ReadonlyArray<File> = [];
  additionalFiles: ReadonlyArray<File> = [];

  onFilesSelected(event: Event, group: UploadGroup): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedFiles = inputElement.files ? Array.from(inputElement.files) : [];

    if (group === 'documents') {
      this.documentFiles = selectedFiles;
      return;
    }

    if (group === 'photos') {
      this.photoFiles = selectedFiles;
      return;
    }

    this.additionalFiles = selectedFiles;
  }

  formatFileSize(bytes: number): string {
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} КБ`;
    }

    const megabytes = kilobytes / 1024;
    return `${megabytes.toFixed(1)} МБ`;
  }

  private buildValidationErrorMessage(
    form: HTMLFormElement,
    control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ): string {
    const labelText = this.getControlLabel(form, control.id);
    const browserMessage = control.validationMessage;

    if (labelText) {
      return `${labelText}: ${browserMessage}`;
    }

    return browserMessage;
  }

  private getControlLabel(form: HTMLFormElement, controlId: string): string {
    if (!controlId) {
      return '';
    }

    const labelElement = form.querySelector<HTMLLabelElement>(`label[for="${controlId}"]`);
    if (!labelElement) {
      return '';
    }

    const normalizedText = labelElement.textContent?.replace('*', '').trim() ?? '';
    return normalizedText;
  }
}
