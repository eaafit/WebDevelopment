import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AssessmentApiService } from './assessment-api.service';
import { DocumentApiService } from './document-api.service';
import { EstimationForm } from './estimation-form';
import { EstimationFormLocalDraftService } from './estimation-form-local-draft.service';
import { EstimationFormSessionService } from './estimation-form-session.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CITY_ID = 'city-1';
const DISTRICT_ID = 'district-1';

describe('EstimationForm', () => {
  let component: EstimationForm;
  let fixture: ComponentFixture<EstimationForm>;
  let router: Router;
  let navigateSpy: jest.SpiedFunction<Router['navigate']>;
  let route: {
    snapshot: {
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
  };
  let assessmentApi: {
    getAssessment: jest.Mock;
    findLatestDraft: jest.Mock;
    createDraft: jest.Mock;
    updateDraft: jest.Mock;
    listCities: jest.Mock;
    listDistricts: jest.Mock;
  };
  let documentApi: {
    listDocumentsByAssessment: jest.Mock;
    uploadDocument: jest.Mock;
    deleteDocument: jest.Mock;
  };
  let localDraftService: {
    load: jest.Mock;
    save: jest.Mock;
    clear: jest.Mock;
  };

  beforeEach(async () => {
    route = {
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };

    assessmentApi = {
      getAssessment: jest.fn(),
      findLatestDraft: jest.fn().mockResolvedValue(null),
      createDraft: jest.fn().mockResolvedValue(createDraftModel('assessment-1')),
      updateDraft: jest.fn().mockResolvedValue(createDraftModel('assessment-1')),
      listCities: jest.fn().mockResolvedValue([
        { id: CITY_ID, name: 'Екатеринбург' },
        { id: 'city-2', name: 'Москва' },
      ]),
      listDistricts: jest.fn().mockImplementation((cityId?: string) =>
        Promise.resolve(
          cityId
            ? [{ id: DISTRICT_ID, cityId: CITY_ID, name: 'Ленинский' }]
            : [{ id: DISTRICT_ID, cityId: CITY_ID, name: 'Ленинский' }],
        ),
      ),
    };

    documentApi = {
      listDocumentsByAssessment: jest.fn().mockResolvedValue([]),
      uploadDocument: jest.fn().mockResolvedValue(
        createStoredDocument('document-1', 'passport.pdf', 'document'),
      ),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
    };

    localDraftService = {
      load: jest.fn().mockReturnValue(null),
      save: jest.fn(),
      clear: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EstimationForm],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: route,
        },
        {
          provide: AssessmentApiService,
          useValue: assessmentApi,
        },
        {
          provide: DocumentApiService,
          useValue: documentApi,
        },
        {
          provide: EstimationFormSessionService,
          useValue: {
            ensureUserId: jest.fn().mockResolvedValue(USER_ID),
          },
        },
        {
          provide: EstimationFormLocalDraftService,
          useValue: localDraftService,
        },
      ],
    }).compileComponents();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(EstimationForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await settleFixture(fixture);
  }

  it('should create and load lookup data on init', async () => {
    await createComponent();

    expect(component).toBeTruthy();
    expect(assessmentApi.listCities).toHaveBeenCalled();
    expect(assessmentApi.listDistricts).toHaveBeenCalledWith();
    expect(component.cities()).toEqual([
      { id: CITY_ID, name: 'Екатеринбург' },
      { id: 'city-2', name: 'Москва' },
    ]);
  });

  it('should require documents and photos before submit', async () => {
    await createComponent();

    fillRequiredFields(component);
    component.formControls.confirmCorrect.setValue(true);
    component.formControls.confirmProcessing.setValue(true);

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(component.validationErrorMessage).toContain('Сканы и документы');
    expect(assessmentApi.createDraft).not.toHaveBeenCalled();
  });

  it('should submit, upload pending files and navigate to status', async () => {
    await createComponent();

    fillRequiredFields(component);
    component.formControls.confirmCorrect.setValue(true);
    component.formControls.confirmProcessing.setValue(true);
    component.documentFiles = [createUploadFile('passport.pdf', 'application/pdf')];
    component.photoFiles = [createUploadFile('front.jpg', 'image/jpeg')];
    component.additionalFiles = [createUploadFile('plan.xlsx', 'application/vnd.ms-excel')];

    await component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(assessmentApi.createDraft).toHaveBeenCalled();
    expect(documentApi.uploadDocument).toHaveBeenCalledTimes(3);
    expect(documentApi.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'assessment-1',
        group: 'documents',
      }),
    );
    expect(documentApi.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'assessment-1',
        group: 'photos',
      }),
    );
    expect(documentApi.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'assessment-1',
        group: 'additional',
      }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/assessment/status'], {
      queryParams: { assessmentId: 'assessment-1' },
    });
  });

  it('should render additional files as a separate section below documents and photos', async () => {
    await createComponent();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const documentSections = nativeElement.querySelector('.document-sections');
    const additionalInput = nativeElement.querySelector('#additionalFiles');

    expect(documentSections?.querySelector('#documentFiles')).toBeTruthy();
    expect(documentSections?.querySelector('#photoFiles')).toBeTruthy();
    expect(documentSections?.querySelector('#additionalFiles')).toBeNull();
    expect(additionalInput).toBeTruthy();
    expect(
      nativeElement.querySelector('.document-sections + .document-section #additionalFiles'),
    ).toBe(additionalInput);
  });

  it('should load stored documents for explicit assessment id in query params', async () => {
    route.snapshot.queryParamMap = convertToParamMap({ assessmentId: 'assessment-42' });
    assessmentApi.getAssessment.mockResolvedValue(
      createDraftModel('assessment-42', {
        cityId: CITY_ID,
        districtId: DISTRICT_ID,
        address: 'Екатеринбург, ул. Ленина, д. 10',
        area: '54.6',
        objectType: '1',
        floorsTotal: '9',
        condition: '2',
      }),
    );
    documentApi.listDocumentsByAssessment.mockResolvedValue([
      createStoredDocument('document-1', 'passport.pdf', 'document'),
      createStoredDocument('document-2', 'front.jpg', 'photo'),
      createStoredDocument('document-3', 'plan.xlsx', 'additional'),
    ]);

    await createComponent();

    expect(assessmentApi.getAssessment).toHaveBeenCalledWith('assessment-42');
    expect(documentApi.listDocumentsByAssessment).toHaveBeenCalledWith('assessment-42');
    expect(component.uploadedDocumentItems()).toHaveLength(1);
    expect(component.uploadedPhotoItems()).toHaveLength(1);
    expect(component.uploadedAdditionalItems()).toHaveLength(1);
  });

  it('should not restore seeded server draft when opening a new empty form', async () => {
    assessmentApi.findLatestDraft.mockResolvedValue(
      createDraftModel('assessment-seed', {
        description: 'Оценка объекта seed 1.',
      }),
    );

    await createComponent();

    expect(assessmentApi.findLatestDraft).not.toHaveBeenCalled();
    expect(component.formControls.description.value).toBe('');
    expect(component.assessmentId()).toBeNull();
  });

  it('should make floors and condition optional for land plot', async () => {
    await createComponent();

    component.formControls.objectType.setValue('5');
    component.formControls.cityId.setValue(CITY_ID);
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
  component.formControls.cityId.setValue(CITY_ID);
  component.formControls.districtId.setValue(DISTRICT_ID);
  component.formControls.address.setValue('Екатеринбург, ул. Ленина, д. 10');
  component.formControls.area.setValue('54.6');
  component.formControls.objectType.setValue('1');
  component.formControls.floorsTotal.setValue('9');
  component.formControls.condition.setValue('2');
}

function getFormElement(fixture: ComponentFixture<EstimationForm>): HTMLFormElement {
  return fixture.nativeElement.querySelector('form') as HTMLFormElement;
}

function createUploadFile(name: string, type: string): File {
  const file = new File(['test'], name, { type }) as File & {
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  file.arrayBuffer = async () => new TextEncoder().encode('test').buffer;
  return file;
}

async function settleFixture(fixture: ComponentFixture<EstimationForm>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
  await fixture.whenStable();
}

function createDraftModel(
  id: string,
  overrides: Partial<{
    cityId: string;
    districtId: string;
    address: string;
    cadastralNumber: string;
    area: string;
    objectType: string;
    rooms: string;
    floorsTotal: string;
    floor: string;
    condition: string;
    yearBuilt: string;
    wallMaterial: string;
    elevatorType: string;
    hasBalconyOrLoggia: boolean;
    landCategory: string;
    permittedUse: string;
    utilities: string;
    description: string;
  }> = {},
) {
  return {
    id,
    status: 1,
    updatedAt: '2026-04-04T10:00:00.000Z',
    form: {
      cityId: CITY_ID,
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
      ...overrides,
    },
  };
}

function createStoredDocument(
  id: string,
  fileName: string,
  kind: 'document' | 'photo' | 'additional',
) {
  return {
    id,
    fileName,
    fileType: kind === 'photo' ? 'image/jpeg' : 'application/pdf',
    filePath: `/uploads/${fileName}`,
    previewUrl: `http://localhost:3000/uploads/${fileName}`,
    downloadUrl: `http://localhost:3000/uploads/${fileName}`,
    version: 1,
    uploadedAt: '2026-04-04T10:00:00.000Z',
    kind,
  };
}
