import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TokenStore } from '@notary-portal/ui';
import { AssessmentApiService } from './assessment-api.service';
import { EstimationFormLocalDraftService } from './estimation-form-local-draft.service';
import { EstimationForm } from './estimation-form';

describe('EstimationForm', () => {
  let component: EstimationForm;
  let fixture: ComponentFixture<EstimationForm>;
  let router: Router;
  let navigateSpy: jest.SpiedFunction<Router['navigate']>;
  let listCitiesMock: jest.Mock;
  let listDistrictsMock: jest.Mock;
  let findLatestDraftMock: jest.Mock;
  let createDraftMock: jest.Mock;
  let updateDraftMock: jest.Mock;

  beforeEach(async () => {
    listCitiesMock = jest.fn().mockResolvedValue([
      { id: 'city-1', name: 'Екатеринбург' },
      { id: 'city-2', name: 'Москва' },
    ]);
    listDistrictsMock = jest
      .fn()
      .mockResolvedValue([{ id: 'district-1', cityId: 'city-1', name: 'Ленинский' }]);
    findLatestDraftMock = jest.fn().mockResolvedValue(null);
    createDraftMock = jest.fn().mockResolvedValue({
      id: 'assessment-1',
      status: 1,
      updatedAt: '2026-04-04T10:00:00.000Z',
      form: {
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

    await TestBed.configureTestingModule({
      imports: [EstimationForm],
      providers: [
        provideRouter([]),
        {
          provide: AssessmentApiService,
          useValue: {
            listCities: listCitiesMock,
            listDistricts: listDistrictsMock,
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
          provide: EstimationFormLocalDraftService,
          useValue: {
            load: jest.fn().mockReturnValue(null),
            save: jest.fn(),
            clear: jest.fn(),
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

  it('should load cities on init', () => {
    expect(listCitiesMock).toHaveBeenCalled();
    expect(component.cities()).toEqual([
      { id: 'city-1', name: 'Екатеринбург' },
      { id: 'city-2', name: 'Москва' },
    ]);
  });

  it('should submit and navigate to status when required fields are filled', async () => {
    fillRequiredFields(component);
    attachRequiredUploads(component);

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(createDraftMock).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/assessment/status']);
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
});

function fillRequiredFields(component: EstimationForm): void {
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
