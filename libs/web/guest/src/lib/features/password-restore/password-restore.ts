import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS, UserRole } from '../auth/role.enum';

@Component({
  selector: 'lib-password-restore',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './password-restore.html',
  styleUrl: './password-restore.scss',
})
export class PasswordRestore {
  readonly roleLabels = ROLE_LABELS;
  readonly roleOptions = [UserRole.Applicant, UserRole.Notary, UserRole.Admin];

  selectedRole = UserRole.Applicant;
  contact = '';
  isSubmitting = false;
  requestSent = false;
  sentTo = '';
  sentRole = UserRole.Applicant;

  selectRole(role: UserRole): void {
    this.selectedRole = role;
  }

  onContactInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    this.contact = this.formatContactInput(input.value, event);
  }

  onSubmit(): void {
    const contact = this.contact.trim();

    if (!contact || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.requestSent = false;

    globalThis.setTimeout(() => {
      this.sentTo = contact;
      this.sentRole = this.selectedRole;
      this.requestSent = true;
      this.isSubmitting = false;
    }, 800);
  }

  private formatContactInput(value: string, event: Event): string {
    if (!value) {
      return '';
    }

    if (/[a-zA-Zа-яА-ЯёЁ@]/.test(value)) {
      return value;
    }

    let numbers = value.replace(/\D/g, '');

    if (!numbers) {
      return value === '+' ? value : '';
    }

    const inputEvent = event as InputEvent;
    if (inputEvent.inputType === 'deleteContentBackward') {
      return value;
    }

    if (['7', '8', '9'].includes(numbers[0] ?? '')) {
      if (numbers[0] === '9') {
        numbers = `7${numbers}`;
      }

      let formatted = numbers[0] === '8' ? '8' : '+7';

      if (numbers.length > 1) {
        formatted += ` (${numbers.substring(1, 4)}`;
      }

      if (numbers.length >= 5) {
        formatted += `) ${numbers.substring(4, 7)}`;
      }

      if (numbers.length >= 8) {
        formatted += `-${numbers.substring(7, 9)}`;
      }

      if (numbers.length >= 10) {
        formatted += `-${numbers.substring(9, 11)}`;
      }

      return formatted;
    }

    return `+${numbers.substring(0, 15)}`;
  }
}
