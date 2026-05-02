import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AbstractControl } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { TokenStore } from '@notary-portal/ui';
import { AssessmentApiService } from './assessment-api.service';
import { DocumentApiService } from './document-api.service';
import { EstimationFormLocalDraftService } from './estimation-form-local-draft.service';
import { EstimationFormSessionService } from './estimation-form-session.service';
import { EstimationForm } from './estimation-form';

describe('EstimationForm', () => {
  let component: EstimationForm;
  let fixture: ComponentFixture<EstimationForm>;
  let router: Router;
  let navigateSpy: jest.SpiedFunction<Router['navigate']>;
  let getFiasAddressHintsMock: jest.Mock;
  let getFiasAddressItemByIdMock: jest.Mock;
  let findLatestDraftMock: jest.Mock;
  let createDraftMock: jest.Mock;
  let updateDraftMock: jest.Mock;
  let localDraftClearMock: jest.Mock;
  let localDraftMarkCompletedMock: jest.Mock;
  let localDraftIsCompletedMock: jest.Mock;

  beforeEach(async () => {
    getFiasAddressHintsMock = jest.fn().mockResolvedValue([
      {
        objectId: '6600000100000000000000002',
        objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002',
        fullName: 'Свердловская обл, г Екатеринбург, ул Ленина, д 10',
        objectLevelId: 10,
        addressType: 2,
        cityId: 'city-1',
        districtId: 'district-1',
      },
    ]);
    getFiasAddressItemByIdMock = jest.fn().mockResolvedValue({
      objectId: '6600000100000000000000002',
      objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002',
      fullName: 'Свердловская обл, г Екатеринбург, ул Ленина, д 10',
      objectLevelId: 10,
      addressType: 2,
      cityId: 'city-1',
      districtId: 'district-1',
      cadastralNumber: '660000000002',
    });
    findLatestDraftMock = jest.fn().mockResolvedValue(null);
    createDraftMock = jest.fn().mockResolvedValue({
      id: 'assessment-1',
      status: 1,
      updatedAt: '2026-04-04T10:00:00.000Z',
      form: {
        fiasObjectId: '6600000100000000000000002',
        fiasObjectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002',
        cityId: 'city-1',
        districtId: '',
        address: 'Екатеринбург, ул. Ленина, д. 10',
        cadastralNumber: '',
        area: '54.6',
        objectType: '1',
        rooms: '',
        floorsTotal: '9',
        floor: '',
        condition: '2',
        yearBuilt: '',
        wallMaterial: '',
        elevatorType: '',
        hasBalconyOrLoggia: false,
        landCategory: '',
        permittedUse: '',
        utilities: '',
        description: '',
      },
    });
    updateDraftMock = jest.fn().mockImplementation((_assessmentId, form) =>
      Promise.resolve({
        ...(createDraftMock.mock.results[0]?.value ?? {
          id: 'assessment-1',
          status: 1,
          updatedAt: '2026-04-04T10:05:00.000Z',
        }),
        form,
      }),
    );
    localDraftClearMock = jest.fn();
    localDraftMarkCompletedMock = jest.fn();
    localDraftIsCompletedMock = jest.fn().mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [EstimationForm],
      providers: [
        provideRouter([]),
        {
          provide: AssessmentApiService,
          useValue: {
            getFiasAddressHints: getFiasAddressHintsMock,
            getFiasAddressItemById: getFiasAddressItemByIdMock,
            findLatestDraft: findLatestDraftMock,
            getAssessment: jest.fn(),
            createDraft: createDraftMock,
            updateDraft: updateDraftMock,
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'seed-user-000@seed.local',
              fullName: 'Заявитель 1',
              role: 1,
              phoneNumber: '+79990000000',
              isActive: true,
            }),
          },
        },
        {
          provide: DocumentApiService,
          useValue: {
            listDocumentsByAssessment: jest.fn().mockResolvedValue([]),
            uploadDocument: jest.fn().mockResolvedValue({
              id: 'document-1',
              fileName: 'document.pdf',
              fileType: 'application/pdf',
              fileSize: 4,
              previewUrl: '/api/documents/document-1/content?mode=preview',
              downloadUrl: '/api/documents/document-1/content?mode=download',
              version: 1,
              uploadedAt: '2026-04-04T10:00:00.000Z',
              kind: 'document',
            }),
            deleteDocument: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EstimationFormSessionService,
          useValue: {
            ensureUserId: jest.fn().mockResolvedValue('user-1'),
          },
        },
        {
          provide: EstimationFormLocalDraftService,
          useValue: {
            load: jest.fn().mockReturnValue(null),
            save: jest.fn(),
            clear: localDraftClearMock,
            markCompleted: localDraftMarkCompletedMock,
            isCompleted: localDraftIsCompletedMock,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstimationForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load FIAS address hints after address input', async () => {
    component.formControls.address.setValue('Екатеринбург Ленина');

    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(getFiasAddressHintsMock).toHaveBeenCalledWith('Екатеринбург Ленина');
    expect(component.addressSuggestions()).toHaveLength(1);
  });

  it('should fill hidden geography fields from selected FIAS address', async () => {
    const suggestion = {
      objectId: '6600000100000000000000002',
      objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002',
      fullName: 'Свердловская обл, г Екатеринбург, ул Ленина, д 10',
      objectLevelId: 10,
      addressType: 2,
      cityId: 'city-1',
      districtId: 'district-1',
    };

    await component.onSelectAddressSuggestion(suggestion);

    expect(getFiasAddressItemByIdMock).toHaveBeenCalledWith('6600000100000000000000002');
    expect(component.formControls.address.value).toBe(
      'Свердловская обл, г Екатеринбург, ул Ленина, д 10',
    );
    expect(component.formControls.cityId.value).toBe('city-1');
    expect(component.formControls.districtId.value).toBe('district-1');
    expect(component.formControls.cadastralNumber.value).toBe('660000000002');
  });

  it('should submit and navigate to status when required fields are filled', async () => {
    fillRequiredFields(component);
    attachRequiredUploads(component);

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(createDraftMock).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/assessment/status'], {
      queryParams: { assessmentId: 'assessment-1' },
    });
    expect(localDraftMarkCompletedMock).toHaveBeenCalledWith('user-1', 'assessment-1');
    expect(localDraftClearMock).toHaveBeenCalledWith('user-1');
    expect(component.assessmentId()).toBeNull();
    expect(component.formControls.address.value).toBe('');
    expect(component.validationErrorMessage).toBe('');
  });

  it('should autosave draft when required fields are filled', async () => {
    fillRequiredFields(component);

    await (component as unknown as { handleAutosave(): Promise<void> }).handleAutosave();

    expect(createDraftMock).toHaveBeenCalled();
  });

  it('should make land plot specific fields optional', async () => {
    component.formControls.objectType.setValue('5');
    component.formControls.cityId.setValue('city-1');
    component.formControls.address.setValue('Екатеринбург, ул. Ленина, д. 10');
    component.formControls.area.setValue('120');
    component.formControls.floorsTotal.setValue('');
    component.formControls.condition.setValue('');

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isLandPlotSelected()).toBe(true);
    expect(component.formControls.floorsTotal.valid).toBe(true);
    expect(component.formControls.condition.valid).toBe(true);
  });

  it('should limit cadastral number input to 12 digits', () => {
    component.formControls.cadastralNumber.setValue('12-34 abc 567890123');

    expect(component.formControls.cadastralNumber.value).toBe('123456789012');
    expect(component.formControls.cadastralNumber.valid).toBe(true);
  });

  it('should mark cadastral number invalid when it has fewer than 12 digits', () => {
    component.formControls.cadastralNumber.setValue('12345678901');

    expect(component.formControls.cadastralNumber.hasError('cadastralNumber')).toBe(true);
  });

  it('should reject zero, negative and too large area values by object type', () => {
    expectInvalidValues(component.formControls.area, ['0', '-1']);

    component.formControls.objectType.setValue('1');
    component.formControls.area.setValue('1000.01');
    expect(component.formControls.area.invalid).toBe(true);

    component.formControls.objectType.setValue('3');
    component.formControls.area.setValue('1000.01');
    expect(component.formControls.area.invalid).toBe(true);

    component.formControls.objectType.setValue('4');
    component.formControls.area.setValue('2000');
    expect(component.formControls.area.valid).toBe(true);
    component.formControls.area.setValue('2000.01');
    expect(component.formControls.area.invalid).toBe(true);

    component.formControls.objectType.setValue('2');
    component.formControls.area.setValue('2000');
    expect(component.formControls.area.valid).toBe(true);

    component.formControls.objectType.setValue('6');
    component.formControls.area.setValue('2000.01');
    expect(component.formControls.area.invalid).toBe(true);
  });

  it('should show a top form error for area range validation', async () => {
    fillRequiredFields(component);
    component.formControls.objectType.setValue('2');
    component.formControls.area.setValue('3600');

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(component.formControls.area.hasError('range')).toBe(true);
    expect(component.validationErrorMessage).toBe('Проверьте заполнение полей формы.');
  });

  it('should show a top form error for floors total range validation', async () => {
    fillRequiredFields(component);
    component.formControls.floorsTotal.setValue('1000');

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(component.formControls.floorsTotal.hasError('range')).toBe(true);
    expect(component.validationErrorMessage).toBe('Проверьте заполнение полей формы.');
  });

  it('should show a top form error for year built range validation', async () => {
    fillRequiredFields(component);
    component.formControls.yearBuilt.setValue(String(new Date().getFullYear() + 2));

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(component.formControls.yearBuilt.hasError('range')).toBe(true);
    expect(component.validationErrorMessage).toBe('Проверьте заполнение полей формы.');
  });

  it('should prioritize required fields in the top form error', async () => {
    fillRequiredFields(component);
    component.formControls.address.setValue('');

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(component.formControls.address.hasError('required')).toBe(true);
    expect(component.validationErrorMessage).toBe(
      'Заполните обязательные поля перед отправкой заявки.',
    );
  });

  it('should reject negative and too large room counts', () => {
    component.formControls.objectType.setValue('1');

    expectInvalidValues(component.formControls.rooms, ['-1', '21']);

    component.formControls.objectType.setValue('2');
    component.formControls.rooms.setValue('51');

    expect(component.formControls.rooms.invalid).toBe(true);
  });

  it('should reject zero and too large floors total values', () => {
    expectInvalidValues(component.formControls.floorsTotal, ['0', '101']);
  });

  it('should reject floor greater than floors total', () => {
    component.formControls.floorsTotal.setValue('9');
    component.formControls.floor.setValue('10');

    expect(component.formControls.floor.hasError('floorAboveTotal')).toBe(true);
  });

  it('should reject year built greater than next year', () => {
    component.formControls.yearBuilt.setValue(String(new Date().getFullYear() + 2));

    expect(component.formControls.yearBuilt.invalid).toBe(true);
  });
});

function fillRequiredFields(component: EstimationForm): void {
  component.formControls.fiasObjectId.setValue('6600000100000000000000002');
  component.formControls.fiasObjectGuid.setValue('b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002');
  component.formControls.cityId.setValue('city-1');
  component.formControls.address.setValue('Екатеринбург, ул. Ленина, д. 10');
  component.formControls.area.setValue('54.6');
  component.formControls.objectType.setValue('1');
  component.formControls.floorsTotal.setValue('9');
  component.formControls.condition.setValue('2');
}

function attachRequiredUploads(component: EstimationForm): void {
  component.documentFiles = [createMockFile('document.pdf', 'application/pdf')];
  component.photoFiles = [createMockFile('photo.jpg', 'image/jpeg')];
}

function createMockFile(name: string, type: string): File {
  return new File(['mock'], name, { type });
}

function getFormElement(fixture: ComponentFixture<EstimationForm>): HTMLFormElement {
  return fixture.nativeElement.querySelector('form') as HTMLFormElement;
}

function expectInvalidValues(control: AbstractControl<string>, values: string[]): void {
  for (const value of values) {
    control.setValue(value);
    expect(control.invalid).toBe(true);
  }
}
