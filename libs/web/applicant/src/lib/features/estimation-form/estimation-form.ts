import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { RealEstateObjectType } from '@notary-portal/api-contracts';
import { TokenStore } from '@notary-portal/ui';
import { debounceTime, distinctUntilChanged, filter, from, startWith, switchMap } from 'rxjs';
import { applicantEmailJsClientConfig } from '../../config/applicant-emailjs.config';
import { AssessmentApiService } from './assessment-api.service';
import { EstimationFormLocalDraftService } from './estimation-form-local-draft.service';
import {
  CONDITION_OPTIONS,
  ELEVATOR_TYPE_OPTIONS,
  INITIAL_ESTIMATION_FORM_VALUE,
  OBJECT_TYPE_OPTIONS,
  WALL_MATERIAL_OPTIONS,
  type AssessmentDraftModel,
  type DistrictLookupOption,
  type EstimationFormDraftData,
  type LookupOption,
  type SelectOption,
} from './estimation-form.models';

type PersistReason = 'autosave' | 'submit';
type UploadGroup = 'documents' | 'photos' | 'additional';
type RequiredUploadGroup = Exclude<UploadGroup, 'additional'>;
type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FileCategory = 'image' | 'pdf' | 'word' | 'spreadsheet' | 'other';

interface AutosaveStatus {
  message: string;
  tone: 'neutral' | 'progress' | 'saved';
}

interface ImagePreviewState {
  fileKey: string;
  fileName: string;
  objectUrl: string;
}

const AUTOSAVE_DEBOUNCE_MS = 700;
const LAND_PLOT_OBJECT_TYPE = String(RealEstateObjectType.LAND_PLOT);

@Component({
  selector: 'lib-estimation-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './estimation-form.html',
  styleUrl: './estimation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimationForm implements OnDestroy {
  readonly estimationForm = inject(FormBuilder).nonNullable.group({
    cityId: ['', [trimmedRequiredValidator]],
    districtId: [''],
    address: ['', [trimmedRequiredValidator, Validators.minLength(8), Validators.maxLength(180)]],
    cadastralNumber: ['', [Validators.maxLength(64)]],
    area: ['', [trimmedRequiredValidator, decimalRangeValidator(1, 100000)]],
    objectType: ['', [trimmedRequiredValidator]],
    rooms: ['', [optionalIntegerRangeValidator(0, 50)]],
    floorsTotal: ['', [optionalIntegerRangeValidator(1, 200)]],
    floor: ['', [optionalIntegerRangeValidator(0, 200)]],
    condition: [''],
    yearBuilt: ['', [optionalIntegerRangeValidator(1700, 2100)]],
    wallMaterial: [''],
    elevatorType: [''],
    hasBalconyOrLoggia: false,
    landCategory: ['', [Validators.maxLength(150)]],
    permittedUse: ['', [Validators.maxLength(150)]],
    utilities: ['', [Validators.maxLength(500)]],
    description: ['', [Validators.maxLength(1000)]],
  });
  readonly formControls = this.estimationForm.controls;

  readonly cities = signal<LookupOption[]>([]);
  readonly districts = signal<DistrictLookupOption[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly draftSaving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly assessmentId = signal<string | null>(null);
  readonly lastDraftSavedAt = signal<string | null>(null);
  readonly userId = signal<string | null>(null);
  readonly isBusy = computed(() => this.loading() || this.saving() || this.draftSaving());
  readonly autosaveStatus = computed<AutosaveStatus>(() => {
    if (this.loading()) {
      return {
        message: 'Восстанавливаем черновик параметров объекта...',
        tone: 'progress',
      };
    }

    if (this.draftSaving()) {
      return {
        message: 'Изменения сохраняются автоматически...',
        tone: 'progress',
      };
    }

    const savedAt = this.lastDraftSavedAt();
    if (savedAt) {
      return {
        message: `Черновик сохранён ${new Date(savedAt).toLocaleString('ru-RU')}.`,
        tone: 'saved',
      };
    }

    if (this.assessmentId()) {
      return {
        message: 'Незавершённая заявка сохраняется автоматически.',
        tone: 'neutral',
      };
    }

    return {
      message: 'После заполнения обязательных полей черновик будет создан автоматически.',
      tone: 'neutral',
    };
  });
  readonly objectTypeOptions = OBJECT_TYPE_OPTIONS;
  readonly conditionOptions = CONDITION_OPTIONS;
  readonly wallMaterialOptions = WALL_MATERIAL_OPTIONS;
  readonly elevatorTypeOptions = ELEVATOR_TYPE_OPTIONS;
  showValidationErrors = false;
  validationErrorMessage = '';
  documentFiles: ReadonlyArray<File> = [];
  photoFiles: ReadonlyArray<File> = [];
  additionalFiles: ReadonlyArray<File> = [];
  imagePreviewState: ImagePreviewState | null = null;

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokenStore = inject(TokenStore);
  private readonly assessmentApi = inject(AssessmentApiService);
  private readonly localDraftService = inject(EstimationFormLocalDraftService);
  private readonly objectUrls = new Map<string, string>();
  private isApplyingDraft = false;
  private draftSavePromise: Promise<AssessmentDraftModel> | null = null;
  private autosaveQueuedAfterCurrentSave = false;

  constructor() {
    this.setupFormSubscriptions();
    this.applyConditionalValidators(this.formControls.objectType.value);
    void this.initialize();
  }

  async onSubmit(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    this.showValidationErrors = true;
    this.validationErrorMessage = '';
    this.saveError.set(null);
    this.estimationForm.markAllAsTouched();

    if (this.estimationForm.invalid) {
      const firstInvalidControl = form.querySelector<FormControlElement>(
        'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
      );
      if (firstInvalidControl) {
        this.validationErrorMessage = this.buildValidationErrorMessage(form, firstInvalidControl);
        firstInvalidControl.focus();
      }
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

    this.saving.set(true);

    try {
      await this.flushDraftSave('submit');
      await this.sendApplicantRequestEmailsIfConfigured();
      await this.router.navigate(['/applicant/assessment/status']);
    } catch (error) {
      console.error('Failed to submit estimation form', error);
      this.saveError.set(
        extractErrorMessage(error, 'Не удалось сохранить параметры объекта. Попробуйте ещё раз.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private buildRequestSummary(): string {
    const value = this.estimationForm.getRawValue();
    const toDisplayValue = (fieldValue: string): string => fieldValue.trim() || '—';
    const areaValue = value.area.trim();

    return [
      `Город: ${this.getSelectedCityName()}`,
      `Район: ${this.getSelectedDistrictName() || '—'}`,
      `Адрес: ${toDisplayValue(value.address)}`,
      `Площадь: ${areaValue ? `${areaValue} м²` : '—'}`,
      `Тип объекта: ${this.getOptionLabel(this.objectTypeOptions, value.objectType)}`,
      `Комнат: ${toDisplayValue(value.rooms)}`,
      `Этаж / этажность: ${toDisplayValue(value.floor)} / ${toDisplayValue(value.floorsTotal)}`,
      `Состояние: ${this.getOptionLabel(this.conditionOptions, value.condition)}`,
      `Год постройки: ${toDisplayValue(value.yearBuilt)}`,
      `Материал стен: ${this.getOptionLabel(this.wallMaterialOptions, value.wallMaterial)}`,
      `Лифт: ${this.getOptionLabel(this.elevatorTypeOptions, value.elevatorType)}`,
      `Описание: ${toDisplayValue(value.description)}`,
    ].join('\n');
  }

  private async sendApplicantRequestEmailsIfConfigured(): Promise<void> {
    const cfg = applicantEmailJsClientConfig;
    if (!cfg.publicKey || !cfg.serviceId) {
      return;
    }

    const requestSummary = this.buildRequestSummary();
    const submittedAt = new Date().toLocaleString('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const ordersUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/applicant/orders`
        : '/applicant/orders';
    const user = this.tokenStore.user();
    const applicantEmail = user?.email?.trim() ?? '';
    const fullName = user?.fullName?.trim() ?? 'Заявитель';

    try {
      const emailjs = (await import('@emailjs/browser')).default;
      emailjs.init(cfg.publicKey);

      if (cfg.templateApplicantSubmitted && applicantEmail) {
        await emailjs.send(
          cfg.serviceId,
          cfg.templateApplicantSubmitted,
          {
            to_email: applicantEmail,
            full_name: fullName,
            request_summary: requestSummary,
            submitted_at: submittedAt,
            app_name: cfg.appName,
            orders_url: ordersUrl,
          },
          cfg.publicKey,
        );
      }

      if (cfg.templateStaffNewRequest && cfg.staffNotifyToEmail.trim() && applicantEmail) {
        await emailjs.send(
          cfg.serviceId,
          cfg.templateStaffNewRequest,
          {
            to_email: cfg.staffNotifyToEmail.trim(),
            applicant_email: applicantEmail,
            full_name: fullName,
            request_summary: requestSummary,
            submitted_at: submittedAt,
            app_name: cfg.appName,
          },
          cfg.publicKey,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[EstimationForm] EmailJS:', msg);
    }
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

  ngOnDestroy(): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
      return;
    }

    for (const objectUrl of this.objectUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }

    this.objectUrls.clear();
  }

  isControlInvalid(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.showValidationErrors);
  }

  isLandPlotSelected(): boolean {
    return this.formControls.objectType.value === LAND_PLOT_OBJECT_TYPE;
  }

  getAddressSuggestions(): string[] {
    const cityName = this.getSelectedCityName();
    const districtName = this.getSelectedDistrictName();
    const cityPrefix = districtName ? `${cityName}, ${districtName}` : cityName;

    return [
      `${cityPrefix}, ул. Ленина, д. 10`,
      `${cityPrefix}, ул. Малышева, д. 16`,
      `${cityPrefix}, пр-т Мира, д. 25`,
      `${cityPrefix}, ул. Гагарина, д. 8`,
    ];
  }

  private setupFormSubscriptions(): void {
    this.formControls.objectType.valueChanges
      .pipe(startWith(this.formControls.objectType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((objectType) => this.applyConditionalValidators(objectType));

    this.formControls.cityId.valueChanges
      .pipe(
        distinctUntilChanged(),
        filter(() => !this.isApplyingDraft),
        switchMap((cityId) => from(this.loadDistrictsForCity(cityId))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.estimationForm.valueChanges
      .pipe(
        debounceTime(150),
        filter(() => !this.isApplyingDraft),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.persistLocalDraft();
        this.saveError.set(null);
      });

    this.estimationForm.valueChanges
      .pipe(
        debounceTime(AUTOSAVE_DEBOUNCE_MS),
        filter(() => !this.loading() && !this.isApplyingDraft),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.handleAutosave();
      });
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    let shouldAutosaveRestoredState = false;

    try {
      const cities = await this.assessmentApi.listCities();
      const userId = this.requireUserId();
      const localDraftSnapshot = this.localDraftService.load(userId);
      const localAssessmentId = localDraftSnapshot?.assessmentId?.trim() ?? '';

      this.userId.set(userId);
      this.cities.set(cities);

      if (localAssessmentId) {
        try {
          const draft = await this.assessmentApi.getAssessment(localAssessmentId);
          this.applyDraft(draft);
          shouldAutosaveRestoredState = this.applyLocalDraftSnapshot(localDraftSnapshot, draft);
          if (!shouldAutosaveRestoredState) {
            this.persistAssessmentSnapshot(draft);
          }
          await this.loadDistrictsForCity(
            this.formControls.cityId.value,
            this.formControls.districtId.value,
          );
          return;
        } catch (error) {
          console.error('Failed to restore estimation assessment from local snapshot', error);
          this.clearLocalDraft();
        }
      }

      if (localDraftSnapshot && !localDraftSnapshot.assessmentId) {
        this.patchDraftForm(localDraftSnapshot.form);
        await this.loadDistrictsForCity(
          this.formControls.cityId.value,
          this.formControls.districtId.value,
        );
        shouldAutosaveRestoredState = this.canPersistDraft();
        return;
      }

      const latestDraft = await this.assessmentApi.findLatestDraft(userId);
      if (latestDraft) {
        this.applyDraft(latestDraft);
        this.persistAssessmentSnapshot(latestDraft);
        await this.loadDistrictsForCity(
          this.formControls.cityId.value,
          this.formControls.districtId.value,
        );
      }
    } catch (error) {
      console.error('Failed to initialize estimation form', error);
      this.loadError.set(
        extractErrorMessage(error, 'Не удалось загрузить форму параметров оценки.'),
      );
    } finally {
      this.loading.set(false);

      if (shouldAutosaveRestoredState) {
        void this.handleAutosave();
      }
    }
  }

  private requireUserId(): string {
    const userId = this.tokenStore.user()?.id?.trim() ?? '';
    if (userId) {
      return userId;
    }

    void this.router.navigateByUrl('/auth');
    throw new Error('Сессия пользователя недоступна. Авторизуйтесь заново.');
  }

  private applyDraft(draft: AssessmentDraftModel): void {
    this.assessmentId.set(draft.id);
    this.lastDraftSavedAt.set(draft.updatedAt);
    this.patchDraftForm(draft.form);
  }

  private applyLocalDraftSnapshot(
    snapshot: {
      assessmentId: string | null;
      form: EstimationFormDraftData;
      updatedAt: string;
    } | null,
    draft: AssessmentDraftModel,
  ): boolean {
    if (!snapshot || snapshot.assessmentId !== draft.id) {
      return false;
    }

    if (!shouldRestoreLocalSnapshot(snapshot.updatedAt, draft.updatedAt)) {
      return false;
    }

    this.patchDraftForm(snapshot.form);
    this.lastDraftSavedAt.set(null);
    return true;
  }

  private patchDraftForm(formValue: EstimationFormDraftData): void {
    this.isApplyingDraft = true;

    this.estimationForm.patchValue(
      {
        ...INITIAL_ESTIMATION_FORM_VALUE,
        ...formValue,
      },
      { emitEvent: false },
    );

    this.applyConditionalValidators(this.formControls.objectType.value);
    this.isApplyingDraft = false;
  }

  private async handleAutosave(): Promise<void> {
    if (!this.canPersistDraft()) {
      return;
    }

    if (this.draftSavePromise) {
      this.autosaveQueuedAfterCurrentSave = true;
      return;
    }

    try {
      await this.executeDraftSave('autosave');
    } catch (error) {
      console.error('Failed to autosave estimation draft', error);
      this.saveError.set(
        extractErrorMessage(error, 'Не удалось автоматически сохранить изменения.'),
      );
    }
  }

  private async flushDraftSave(reason: PersistReason): Promise<AssessmentDraftModel> {
    if (!this.canPersistDraft()) {
      throw new Error(this.buildDraftRequirementsMessage());
    }

    if (this.draftSavePromise) {
      if (reason === 'autosave') {
        this.autosaveQueuedAfterCurrentSave = true;
        return this.draftSavePromise;
      }

      await this.draftSavePromise;
    }

    return this.executeDraftSave(reason);
  }

  private async executeDraftSave(reason: PersistReason): Promise<AssessmentDraftModel> {
    const currentAssessmentId = this.assessmentId();
    const userId = this.userId();
    if (!userId) {
      throw new Error('Не удалось определить пользователя текущей сессии.');
    }

    const formData = this.toDraftData();
    this.draftSaving.set(true);
    this.saveError.set(null);

    const savePromise = currentAssessmentId
      ? this.assessmentApi.updateDraft(currentAssessmentId, formData)
      : this.assessmentApi.createDraft(userId, formData);

    this.draftSavePromise = savePromise;

    try {
      const savedAssessment = await savePromise;
      this.assessmentId.set(savedAssessment.id);
      this.lastDraftSavedAt.set(savedAssessment.updatedAt ?? new Date().toISOString());
      this.persistAssessmentSnapshot(savedAssessment);

      return savedAssessment;
    } finally {
      if (this.draftSavePromise === savePromise) {
        this.draftSavePromise = null;
      }

      this.draftSaving.set(false);

      if (reason !== 'submit' && this.autosaveQueuedAfterCurrentSave) {
        this.autosaveQueuedAfterCurrentSave = false;
        void this.handleAutosave();
      }
    }
  }

  private persistLocalDraft(): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.localDraftService.save(userId, {
      assessmentId: this.assessmentId(),
      form: this.toDraftData(),
      updatedAt: new Date().toISOString(),
    });
  }

  private persistAssessmentSnapshot(draft: AssessmentDraftModel): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.localDraftService.save(userId, {
      assessmentId: draft.id,
      form: draft.form,
      updatedAt: draft.updatedAt ?? new Date().toISOString(),
    });
  }

  private clearLocalDraft(): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.localDraftService.clear(userId);
  }

  private canPersistDraft(): boolean {
    return (
      this.formControls.cityId.valid &&
      this.formControls.address.valid &&
      this.formControls.area.valid &&
      this.formControls.objectType.valid
    );
  }

  private buildDraftRequirementsMessage(): string {
    return 'Чтобы сохранить черновик, заполните город, адрес, площадь и тип объекта.';
  }

  private applyConditionalValidators(objectType: string): void {
    const isLandPlot = objectType === LAND_PLOT_OBJECT_TYPE;

    this.setControlValidators(
      this.formControls.floorsTotal,
      isLandPlot
        ? [optionalIntegerRangeValidator(1, 200)]
        : [trimmedRequiredValidator, optionalIntegerRangeValidator(1, 200)],
    );
    this.setControlValidators(
      this.formControls.condition,
      isLandPlot ? [] : [trimmedRequiredValidator],
    );

    if (!isLandPlot && !this.isApplyingDraft) {
      this.estimationForm.patchValue(
        {
          landCategory: '',
          permittedUse: '',
          utilities: '',
        },
        { emitEvent: false },
      );
    }

    if (isLandPlot && !this.isApplyingDraft) {
      this.formControls.hasBalconyOrLoggia.setValue(false, { emitEvent: false });
    }
  }

  private setControlValidators(control: AbstractControl, validators: ValidatorFn[]): void {
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private async loadDistrictsForCity(cityId: string, preferredDistrictId?: string): Promise<void> {
    if (!cityId.trim()) {
      this.districts.set([]);
      this.formControls.districtId.setValue('', { emitEvent: false });
      return;
    }

    const districts = await this.assessmentApi.listDistricts(cityId);
    this.districts.set(districts);

    const nextDistrictId = preferredDistrictId ?? this.formControls.districtId.value;
    if (nextDistrictId && districts.some((district) => district.id === nextDistrictId)) {
      this.formControls.districtId.setValue(nextDistrictId, { emitEvent: false });
      return;
    }

    this.formControls.districtId.setValue('', { emitEvent: false });
  }

  private toDraftData(): EstimationFormDraftData {
    const value = this.estimationForm.getRawValue();

    return {
      cityId: value.cityId,
      districtId: value.districtId,
      address: value.address,
      cadastralNumber: value.cadastralNumber,
      area: value.area,
      objectType: value.objectType,
      rooms: value.rooms,
      floorsTotal: value.floorsTotal,
      floor: value.floor,
      condition: value.condition,
      yearBuilt: value.yearBuilt,
      wallMaterial: value.wallMaterial,
      elevatorType: value.elevatorType,
      hasBalconyOrLoggia: value.hasBalconyOrLoggia,
      landCategory: value.landCategory,
      permittedUse: value.permittedUse,
      utilities: value.utilities,
      description: value.description,
    };
  }

  private buildValidationErrorMessage(form: HTMLFormElement, control: FormControlElement): string {
    const labelText = this.getControlLabel(form, control);
    const browserMessage = control.validationMessage || this.getReactiveValidationMessage(control);

    if (labelText && browserMessage) {
      return `${labelText}: ${browserMessage}`;
    }

    if (browserMessage) {
      return browserMessage;
    }

    return labelText;
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

    const ariaLabel = control.getAttribute('aria-label');
    if (ariaLabel) {
      return this.normalizeLabelText(ariaLabel);
    }

    return this.normalizeLabelText(control.closest('label')?.textContent);
  }

  private normalizeLabelText(labelText: string | null | undefined): string {
    return labelText?.replace(/\*/g, '').replace(/\s+/g, ' ').trim() ?? '';
  }

  private getReactiveValidationMessage(control: FormControlElement): string {
    const controlName = control.getAttribute('formControlName');
    if (!controlName) {
      return '';
    }

    const formControl = this.estimationForm.get(controlName);
    if (!formControl?.errors) {
      return '';
    }

    if (formControl.hasError('required')) {
      return 'поле обязательно для заполнения.';
    }

    if (formControl.hasError('minlength')) {
      return 'значение слишком короткое.';
    }

    if (formControl.hasError('maxlength')) {
      return 'значение превышает допустимую длину.';
    }

    if (formControl.hasError('decimal')) {
      return 'введите число в корректном формате.';
    }

    if (formControl.hasError('integer')) {
      return 'введите целое число.';
    }

    if (formControl.hasError('range')) {
      return 'значение вне допустимого диапазона.';
    }

    return '';
  }

  private getOptionLabel(options: ReadonlyArray<SelectOption>, value: string): string {
    if (!value.trim()) {
      return '—';
    }

    return options.find((option) => option.value === value)?.label ?? value;
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

  private getSelectedCityName(): string {
    return (
      this.cities().find((city) => city.id === this.formControls.cityId.value)?.name ??
      'Екатеринбург'
    );
  }

  private getSelectedDistrictName(): string {
    return (
      this.districts().find((district) => district.id === this.formControls.districtId.value)
        ?.name ?? ''
    );
  }
}

function trimmedRequiredValidator(control: AbstractControl): Record<string, true> | null {
  const value = `${control.value ?? ''}`.trim();
  return value ? null : { required: true };
}

function decimalRangeValidator(minimum: number, maximum: number): ValidatorFn {
  return (control: AbstractControl): Record<string, true> | null => {
    const value = `${control.value ?? ''}`.trim();
    if (!value) {
      return null;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      return { decimal: true };
    }

    const numericValue = Number(value);
    if (numericValue < minimum || numericValue > maximum) {
      return { range: true };
    }

    return null;
  };
}

function optionalIntegerRangeValidator(minimum: number, maximum: number): ValidatorFn {
  return (control: AbstractControl): Record<string, true> | null => {
    const value = `${control.value ?? ''}`.trim();
    if (!value) {
      return null;
    }

    if (!/^\d+$/.test(value)) {
      return { integer: true };
    }

    const numericValue = Number(value);
    if (numericValue < minimum || numericValue > maximum) {
      return { range: true };
    }

    return null;
  };
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'object' && error) {
    const maybeError = error as { rawMessage?: unknown; message?: unknown };

    if (typeof maybeError.rawMessage === 'string' && maybeError.rawMessage.trim()) {
      return maybeError.rawMessage.trim();
    }

    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message.trim();
    }
  }

  return fallback;
}

function shouldRestoreLocalSnapshot(
  localUpdatedAt: string | null | undefined,
  serverUpdatedAt: string | null,
): boolean {
  const localTimestamp = toTimestamp(localUpdatedAt);
  if (localTimestamp === null) {
    return false;
  }

  const serverTimestamp = toTimestamp(serverUpdatedAt);
  if (serverTimestamp === null) {
    return true;
  }

  return localTimestamp >= serverTimestamp;
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
