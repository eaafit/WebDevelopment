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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DocumentType, type Assessment } from '@notary-portal/api-contracts';
import { debounceTime } from 'rxjs';
import { EstimationFormSessionService } from '../../estimation-form/estimation-form-session.service';
import { ApplicantOrdersApiService } from '../orders-api.service';
import { DocumentApiService } from '../../estimation-form/document-api.service';
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
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly ordersApi = inject(ApplicantOrdersApiService);
  private readonly documentApi = inject(DocumentApiService);

  readonly currentStep = signal<OrderFormStep>(1);
  readonly steps = ORDER_FORM_STEPS;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly showValidationErrors = signal(false);
  readonly submittedAssessmentId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly editingOrderId = signal<string | null>(null);

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
      rooms: ['', trimmedRequiredValidator],
      buildingFloors: ['', trimmedRequiredValidator],
      floor: ['', trimmedRequiredValidator],
      condition: ['', Validators.required],
      constructionYear: ['', [trimmedRequiredValidator, constructionYearValidator]],
      houseType: ['', Validators.required],
      elevator: ['', Validators.required],
      hasBalcony: [false],
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
      isUploaded: group.get('isUploaded')?.value as boolean,
    }));
  }

  async ngOnInit(): Promise<void> {
    try {
      this.userId = await this.sessionService.ensureUserId();
      const orderId = this.activatedRoute.snapshot.queryParamMap.get('orderId');
      if (orderId) {
        await this.loadExistingOrder(orderId);
      } else {
        this.restoreDraft();
      }
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

      const oldOrderId = this.editingOrderId();
      let assessment: Assessment;

      if (oldOrderId) {
        // Update existing assessment
        assessment = await this.api.updateAssessment(oldOrderId, {
          ...formValues,
          property: resolvedProperty,
        });
      } else {
        // Create new assessment
        assessment = await this.api.createAssessment(this.userId, {
          ...formValues,
          property: resolvedProperty,
        });
      }

      for (const [index, group] of this.documentsArray.controls.entries()) {
        const isUploaded = group.get('isUploaded')?.value as boolean;
        const file = group.get('file')?.value as File | null;
        const documentType = Number(group.get('documentType')?.value) as DocumentType;

        // Skip file upload if it was already uploaded and not changed
        if (isUploaded && !file) {
          continue;
        }

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

      // Clear editingOrderId after successful update
      if (oldOrderId) {
        this.editingOrderId.set(null);
      }
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
    const isUploaded = initial?.isUploaded ?? false;
    return this.fb.nonNullable.group({
      documentType: [initial?.documentType ?? '', Validators.required],
      fileName: [initial?.fileName ?? ''],
      file: [null as File | null, isUploaded ? [] : [fileRequiredValidator, fileValidator]],
      isUploaded: [isUploaded],
      previewUrl: [initial?.previewUrl ?? ''],
      downloadUrl: [initial?.downloadUrl ?? ''],
    });
  }

  private async loadExistingOrder(orderId: string): Promise<void> {
    try {
      const assessment = await this.ordersApi.getOrderById(orderId);
      const realEstateObject = assessment.realEstateObject;

      if (realEstateObject) {
        // Parse inheritance data from description
        const inheritanceData = this.parseInheritanceFromDescription(assessment.description || '');
        this.inheritanceGroup.patchValue(inheritanceData);

        // Parse property description to remove inheritance info
        const propertyDescription = this.extractPropertyDescription(assessment.description || '');

        this.propertyGroup.patchValue({
          propertyType: String(realEstateObject.objectType),
          cityId: realEstateObject.cityId,
          districtId: realEstateObject.districtId || '',
          address: realEstateObject.address,
          area: realEstateObject.area,
          cadastralNumber: realEstateObject.cadastralNumber || '',
          description: propertyDescription,
          rooms: realEstateObject.roomsCount ? String(realEstateObject.roomsCount) : '',
          buildingFloors: realEstateObject.floorsTotal ? String(realEstateObject.floorsTotal) : '',
          floor: realEstateObject.floor ? String(realEstateObject.floor) : '',
          condition: realEstateObject.condition
            ? this.mapConditionToString(realEstateObject.condition)
            : '',
          constructionYear: realEstateObject.yearBuilt ? String(realEstateObject.yearBuilt) : '',
          houseType: realEstateObject.wallMaterial
            ? this.mapWallMaterialToString(realEstateObject.wallMaterial)
            : '',
          elevator: realEstateObject.elevatorType
            ? this.mapElevatorTypeToString(realEstateObject.elevatorType)
            : '',
          hasBalcony: realEstateObject.hasBalconyOrLoggia || false,
        });
      }

      // Load documents for this assessment
      await this.loadDocumentsForOrder(orderId);

      // Store the original order ID for deletion after successful edit
      this.editingOrderId.set(orderId);
    } catch (error) {
      this.loadError.set(extractErrorMessage(error, 'Не удалось загрузить данные заявки.'));
      throw error;
    }
  }

  private async loadDocumentsForOrder(orderId: string): Promise<void> {
    try {
      const documents = await this.documentApi.listDocumentsByAssessment(orderId);

      this.documentsArray.clear();
      if (documents.length > 0) {
        documents.forEach((document) => {
          // Use the actual documentType from API if available, otherwise fallback to kind mapping
          const documentType =
            document.documentType !== undefined
              ? String(document.documentType)
              : String(this.mapKindToDocumentType(document.kind));

          this.documentsArray.push(
            this.createDocumentGroup({
              documentType,
              fileName: document.fileName,
              isUploaded: true, // Mark as already uploaded
              previewUrl: document.previewUrl,
              downloadUrl: document.downloadUrl,
            }),
          );
        });
      } else {
        this.documentsArray.push(this.createDocumentGroup());
      }
    } catch (error) {
      // If document loading fails, we still want to show the form with empty documents
      console.error('Failed to load documents:', error);
      this.documentsArray.clear();
      this.documentsArray.push(this.createDocumentGroup());
    }
  }

  private mapKindToDocumentType(kind: 'document' | 'photo' | 'additional'): DocumentType {
    // Reverse mapping from kind to DocumentType
    switch (kind) {
      case 'photo':
        return DocumentType.PHOTO;
      case 'additional':
        return DocumentType.ADDITIONAL;
      case 'document':
      default:
        return DocumentType.OTHER;
    }
  }

  private parseInheritanceFromDescription(description: string): Partial<NewOrderInheritanceData> {
    const deceasedMatch = description.match(/Наследодатель:\s*([^,]+)/);
    const deathDateMatch = description.match(/Дата смерти:\s*([^,]+)/);
    const caseNumberMatch = description.match(/Номер дела:\s*([^,]+)/);
    const notaryMatch = description.match(/Нотариус:\s*([^,.]+)/);

    return {
      deceasedFullName: deceasedMatch?.[1]?.trim() || '',
      deathDate: deathDateMatch?.[1]?.trim() || '',
      inheritanceCaseNumber: caseNumberMatch?.[1]?.trim() || '',
      notary: notaryMatch?.[1]?.trim() || '',
    };
  }

  private extractPropertyDescription(description: string): string {
    // Remove inheritance info (including notary) from description
    return description.replace(/\.?\s*Наследодатель:.*?(?=\.|$)/g, '').trim();
  }

  private mapConditionToString(condition: number): string {
    // Map RealEstateCondition enum to string values used in form
    // UNSPECIFIED=0, EXCELLENT=1, GOOD=2, SATISFACTORY=3, POOR=4
    const conditionMap: Record<number, string> = {
      0: 'new', // Map UNSPECIFIED to 'new' for new buildings
      1: 'good', // EXCELLENT
      2: 'satisfactory', // GOOD
      3: 'requires_repair', // SATISFACTORY
      4: 'emergency', // POOR
    };
    return conditionMap[condition] || '';
  }

  private mapWallMaterialToString(wallMaterial: number): string {
    // Map WallMaterial enum to string values used in form
    // UNSPECIFIED=0, BRICK=1, PANEL=2, BLOCK=3, MONOLITHIC=4, MONOLITHIC_BRICK=5, WOODEN=6, AERATED_CONCRETE=7
    const materialMap: Record<number, string> = {
      0: '', // UNSPECIFIED - leave empty
      1: 'brick',
      2: 'panel',
      3: 'block',
      4: 'monolithic',
      5: 'monolithic_brick',
      6: 'wooden',
      7: 'aerated_concrete',
    };
    return materialMap[wallMaterial] || '';
  }

  private mapElevatorTypeToString(elevatorType: number): string {
    // Map ElevatorType enum to string values used in form
    // UNSPECIFIED=0, NONE=1, CARGO=2, PASSENGER=3, PASSENGER_AND_CARGO=4
    const elevatorMap: Record<number, string> = {
      0: '', // UNSPECIFIED - leave empty
      1: 'none',
      2: 'freight',
      3: 'passenger',
      4: 'passenger_freight',
    };
    return elevatorMap[elevatorType] || '';
  }

  private async downloadFileFromUrl(url: string): Promise<{ content: Uint8Array; type: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const content = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return { content, type: contentType };
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

function constructionYearValidator(control: AbstractControl): Record<string, true> | null {
  const value = `${control.value ?? ''}`.trim();
  if (!value) {
    return null;
  }

  const year = Number(value);
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(year) || year < 1800 || year > currentYear) {
    return { invalidConstructionYear: true };
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
