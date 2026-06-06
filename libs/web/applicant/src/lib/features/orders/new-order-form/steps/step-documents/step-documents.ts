import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DOCUMENT_TYPE_OPTIONS, MAX_FILE_SIZE_BYTES } from '../../new-order-form.models';
import { fileRequiredValidator, fileValidator } from '../../new-order-form.validators';

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

  @Input({ required: true }) array!: FormArray<FormGroup>;
  @Input() showValidationErrors = false;

  readonly documentTypeOptions = DOCUMENT_TYPE_OPTIONS;
  readonly acceptedFileTypes = '.pdf,.jpg,.jpeg,.png';
  readonly maxFileSizeMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);

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

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.array.at(index);
    group?.patchValue({ file, fileName: file?.name ?? '' });
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

  private createDocumentGroup(): FormGroup {
    return this.fb.nonNullable.group({
      documentType: ['', Validators.required],
      fileName: [''],
      file: [null as File | null, [fileRequiredValidator, fileValidator]],
    });
  }
}
