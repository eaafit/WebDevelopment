import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DocumentType } from '@notary-portal/api-contracts';
import { debounceTime } from 'rxjs';
import { EstimationFormSessionService } from '../../estimation-form/estimation-form-session.service';
import { NewOrderFormApiService } from './new-order-form-api.service';
import { NewOrderFormDraftService } from './new-order-form-draft.service';
import {
  INITIAL_CONFIRM_VALUE,
  INITIAL_INHERITANCE_VALUE,
  INITIAL_PROPERTY_VALUE,
  ORDER_FORM_STEPS,
  type NewOrderDocumentRow,
  type NewOrderFormValues,
  type NewOrderInheritanceData,
  type NewOrderPropertyData,
  type OrderFormStep,
} from './new-order-form.models';
import { StepConfirm } from './steps/step-confirm/step-confirm';
import { StepDocuments } from './steps/step-documents/step-documents';
import { StepInheritance } from './steps/step-inheritance/step-inheritance';
import { StepProperty } from './steps/step-property/step-property';
import { fileRequiredValidator, fileValidator } from './new-order-form.validators';

@Component({
  selector: 'lib-new-order-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    StepInheritance,
    StepProperty,
    StepDocuments,
    StepConfirm,
  ],
  templateUrl: './new-order-form.html',
  styleUrl: './new-order-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrderForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(EstimationFormSessionService);
  private readonly api = inject(NewOrderFormApiService);
  private readonly draftService = inject(NewOrderFormDraftService);

  readonly currentStep = signal<OrderFormStep>(1);
  readonly steps = ORDER_FORM_STEPS;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly showValidationErrors = signal(false);
  readonly submittedAssessmentId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isSuccess = computed(() => Boolean(this.submittedAssessmentId()));
  readonly isFirstStep = computed(() => this.currentStep() === 1);
  readonly isLastStep = computed(() => this.currentStep() === 4);

  readonly orderForm = this.fb.nonNullable.group({
    inheritance: this.fb.nonNullable.group({
      deceasedFullName: ['', [Validators.required, Validators.minLength(3)]],
      deathDate: ['', [Validators.required, validYearValidator]],
      notary: [''],
      inheritanceCaseNumber: ['', Validators.required],
    }),
    property: this.fb.nonNullable.group({
      propertyType: ['', Validators.required],
      cityId: ['', trimmedRequiredValidator],
      districtId: [''],
      address: ['', [trimmedRequiredValidator, Validators.minLength(5)]],
      area: ['', [trimmedRequiredValidator, positiveNumberValidator]],
      cadastralNumber: [''],
      description: [''],
    }),
    documents: this.fb.array<FormGroup>([this.createDocumentGroup()], minArrayLengthValidator(1)),
    confirm: this.fb.nonNullable.group({
      dataAccuracyConfirmed: [INITIAL_CONFIRM_VALUE.dataAccuracyConfirmed, Validators.requiredTrue],
      personalDataConsent: [INITIAL_CONFIRM_VALUE.personalDataConsent, Validators.requiredTrue],
    }),
  });

  private userId = '';

  get inheritanceGroup(): FormGroup {
    return this.orderForm.controls.inheritance;
  }

  get propertyGroup(): FormGroup {
    return this.orderForm.controls.property;
  }

  get documentsArray(): FormArray<FormGroup> {
    return this.orderForm.controls.documents;
  }

  get confirmGroup(): FormGroup {
    return this.orderForm.controls.confirm;
  }

  get inheritanceSummary(): NewOrderInheritanceData {
    return this.inheritanceGroup.getRawValue() as NewOrderInheritanceData;
  }

  get propertySummary(): NewOrderPropertyData {
    return this.propertyGroup.getRawValue() as NewOrderPropertyData;
  }

  get documentsSummary(): NewOrderDocumentRow[] {
    return this.documentsArray.controls.map((group) => ({
      documentType: `${group.get('documentType')?.value ?? ''}`,
      fileName: `${group.get('fileName')?.value ?? ''}`,
    }));
  }

  async ngOnInit(): Promise<void> {
    try {
      this.userId = await this.sessionService.ensureUserId();
      this.restoreDraft();
      this.setupDraftAutosave();
    } catch (error) {
      this.loadError.set(extractErrorMessage(error, 'Не удалось загрузить форму подачи заявки.'));
    } finally {
      this.loading.set(false);
    }
  }

  isStepActive(step: OrderFormStep): boolean {
    return this.currentStep() === step;
  }

  isStepCompleted(step: OrderFormStep): boolean {
    return this.currentStep() > step;
  }

  goBack(): void {
    if (this.isFirstStep()) {
      return;
    }

    this.showValidationErrors.set(false);
    this.submitError.set(null);
    this.currentStep.update((step) => (step - 1) as OrderFormStep);
    this.persistDraft();
  }

  goNext(): void {
    this.showValidationErrors.set(true);
    this.submitError.set(null);

    const step = this.currentStep();
    if (step === 1 && this.inheritanceGroup.invalid) {
      this.inheritanceGroup.markAllAsTouched();
      return;
    }

    if (step === 2 && this.propertyGroup.invalid) {
      this.propertyGroup.markAllAsTouched();
      return;
    }

    if (step === 3 && this.documentsArray.invalid) {
      this.documentsArray.markAllAsTouched();
      this.documentsArray.controls.forEach((group) => group.markAllAsTouched());
      return;
    }

    if (step === 4) {
      return;
    }

    this.showValidationErrors.set(false);
    this.currentStep.update((current) => (current + 1) as OrderFormStep);
    this.persistDraft();
  }

  async submit(): Promise<void> {
    this.showValidationErrors.set(true);
    this.submitError.set(null);
    this.confirmGroup.markAllAsTouched();

    if (this.orderForm.invalid) {
      if (this.inheritanceGroup.invalid) {
        this.currentStep.set(1);
        this.inheritanceGroup.markAllAsTouched();
      } else if (this.propertyGroup.invalid) {
        this.currentStep.set(2);
        this.propertyGroup.markAllAsTouched();
      } else if (this.documentsArray.invalid) {
        this.currentStep.set(3);
        this.documentsArray.markAllAsTouched();
      }
      return;
    }

    this.submitting.set(true);

    try {
      const formValues = this.toFormValues();
      const resolvedProperty = await this.api.resolvePropertyGeography(formValues.property);
      this.propertyGroup.patchValue(resolvedProperty);
      const assessment = await this.api.createAssessment(this.userId, {
        ...formValues,
        property: resolvedProperty,
      });

      for (const [index, group] of this.documentsArray.controls.entries()) {
        const file = group.get('file')?.value as File | null;
        const documentType = Number(group.get('documentType')?.value) as DocumentType;
        const fileContent = file ? await fileToUint8Array(file) : new Uint8Array();
        await this.api.createDocumentMock({
          assessmentId: assessment.id,
          fileName: file?.name ?? group.get('fileName')?.value ?? `document-${index + 1}`,
          fileType: file?.type || 'application/octet-stream',
          documentType,
          uploadedById: this.userId,
          fileContent,
        });
      }

      this.draftService.clear(this.userId);
      this.submittedAssessmentId.set(assessment.id);
    } catch (error) {
      this.submitError.set(
        extractErrorMessage(error, 'Не удалось отправить заявку. Попробуйте ещё раз.'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private setupDraftAutosave(): void {
    this.orderForm.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistDraft());
  }

  private restoreDraft(): void {
    const draft = this.draftService.load(this.userId);
    if (!draft) {
      return;
    }

    this.currentStep.set(draft.currentStep);
    this.inheritanceGroup.patchValue({
      ...INITIAL_INHERITANCE_VALUE,
      ...draft.form.inheritance,
    });
    this.propertyGroup.patchValue({
      ...INITIAL_PROPERTY_VALUE,
      ...draft.form.property,
    });

    this.confirmGroup.patchValue({
      ...INITIAL_CONFIRM_VALUE,
      ...draft.form.confirm,
    });

    this.documentsArray.clear();
    if (draft.form.documents.length) {
      draft.form.documents.forEach((document) => {
        this.documentsArray.push(
          this.createDocumentGroup({
            documentType: document.documentType,
            fileName: document.fileName,
          }),
        );
      });
    } else {
      this.documentsArray.push(this.createDocumentGroup());
    }
  }

  private persistDraft(): void {
    if (!this.userId || this.isSuccess()) {
      return;
    }

    this.draftService.save(this.userId, {
      currentStep: this.currentStep(),
      form: this.toFormValues(),
    });
  }

  private toFormValues(): NewOrderFormValues {
    return {
      inheritance: this.inheritanceGroup.getRawValue() as NewOrderInheritanceData,
      property: this.propertyGroup.getRawValue() as NewOrderPropertyData,
      documents: this.documentsSummary,
      confirm: this.confirmGroup.getRawValue(),
    };
  }

  private createDocumentGroup(initial?: Partial<NewOrderDocumentRow>): FormGroup {
    return this.fb.nonNullable.group({
      documentType: [initial?.documentType ?? '', Validators.required],
      fileName: [initial?.fileName ?? ''],
      file: [null as File | null, [fileRequiredValidator, fileValidator]],
    });
  }
}

function trimmedRequiredValidator(control: AbstractControl): Record<string, true> | null {
  const value = `${control.value ?? ''}`.trim();
  return value ? null : { required: true };
}

function positiveNumberValidator(control: AbstractControl): Record<string, true> | null {
  const value = `${control.value ?? ''}`.trim();
  if (!value) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? null : { positive: true };
}

function minArrayLengthValidator(minLength: number): ValidatorFn {
  return (control: AbstractControl): Record<string, true> | null => {
    if (!(control instanceof FormArray)) {
      return null;
    }

    return control.length >= minLength ? null : { minLength: true };
  };
}

function validYearValidator(control: AbstractControl): Record<string, true> | null {
  const value = control.value;
  if (!value) return null;

  const date = new Date(value);
  const currentYear = new Date().getFullYear();

  if (date.getFullYear() < 1900 || date.getFullYear() > currentYear) {
    return { invalidYear: true };
  }

  return null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) {
    return fallback;
  }

  if (message.includes('real_estate_object.city_id')) {
    return 'Выберите адрес из подсказок ФИАС на первом шаге формы.';
  }

  return message;
}

async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
