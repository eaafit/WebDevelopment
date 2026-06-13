import { type AbstractControl } from '@angular/forms';
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from './new-order-form.models';

export function fileRequiredValidator(control: AbstractControl): Record<string, true> | null {
  return control.value instanceof File ? null : { required: true };
}

export function fileValidator(control: AbstractControl): Record<string, true> | null {
  const file = control.value as File | null;
  if (!(file instanceof File)) {
    return null;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
    return { fileType: true };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { fileSize: true };
  }

  return null;
}
