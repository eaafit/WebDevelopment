import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  CONDITION_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  ELEVATOR_OPTIONS,
  HOUSE_TYPE_OPTIONS,
  ORDER_PROPERTY_TYPE_OPTIONS,
  type NewOrderDocumentRow,
  type NewOrderInheritanceData,
  type NewOrderPropertyData,
} from '../../new-order-form.models';

@Component({
  selector: 'lib-step-confirm',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-confirm.html',
  styleUrl: './step-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepConfirm {
  @Input({ required: true }) group!: FormGroup;
  @Input({ required: true }) inheritance!: NewOrderInheritanceData;
  @Input({ required: true }) property!: NewOrderPropertyData;
  @Input({ required: true }) documents: NewOrderDocumentRow[] = [];
  @Input() showValidationErrors = false;

  isInvalid(controlName: string): boolean {
    const control = this.group.get(controlName);
    return Boolean(control && control.invalid && (control.touched || this.showValidationErrors));
  }

  getPropertyTypeLabel(value: string): string {
    return ORDER_PROPERTY_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  getHouseTypeLabel(value: string): string {
    return HOUSE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  getConditionLabel(value: string): string {
    return CONDITION_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  getElevatorLabel(value: string): string {
    return ELEVATOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  getDocumentTypeLabel(value: string): string {
    return DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }
}
