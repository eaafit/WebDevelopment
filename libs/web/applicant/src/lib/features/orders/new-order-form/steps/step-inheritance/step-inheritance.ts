import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'lib-step-inheritance',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-inheritance.html',
  styleUrl: './step-inheritance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepInheritance {
  @Input({ required: true }) group!: FormGroup;
  @Input() showValidationErrors = false;

  readonly maxDate = new Date().toISOString().split('T')[0];

  isInvalid(controlName: string): boolean {
    const control = this.group.get(controlName);
    return Boolean(control && control.invalid && (control.touched || this.showValidationErrors));
  }

  getErrorMessage(controlName: string): string {
    const control = this.group.get(controlName);
    if (!control) return '';

    if (control.errors?.['required']) {
      const fieldNames: Record<string, string> = {
        deceasedFullName: 'ФИО наследодателя',
        deathDate: 'Дата смерти',
        inheritanceCaseNumber: 'Номер наследственного дела',
      };
      return `Поле "${fieldNames[controlName] || controlName}" обязательно для заполнения`;
    }

    if (control.errors?.['invalidYear']) {
      return 'Укажите корректную дату (год от 1900 до текущего)';
    }

    return '';
  }
}
