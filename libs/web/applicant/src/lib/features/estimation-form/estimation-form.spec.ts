import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { EstimationForm } from './estimation-form';

describe('EstimationForm', () => {
  let component: EstimationForm;
  let fixture: ComponentFixture<EstimationForm>;
  let router: Router;
  let navigateSpy: jest.SpiedFunction<Router['navigate']>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimationForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EstimationForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit without additional files when required fields are filled', () => {
    fillRequiredFields(fixture, component);

    component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/assessment/status']);
    expect(component.validationErrorMessage).toBe('');
  });

  it('should block submission when required documents are missing', () => {
    fillRequiredFields(fixture, component, { includeDocuments: false });

    component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.validationErrorMessage).toContain('Сканы и документы');
  });

  it('should block submission when a required confirmation is missing', () => {
    fillRequiredFields(fixture, component, { confirmProcessing: false });

    component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.validationErrorMessage).toContain('Согласен(на) на обработку данных');
  });

  it('should block submission when correctness confirmation is missing', () => {
    fillRequiredFields(fixture, component, { confirmCorrect: false });

    component.onSubmit(new Event('submit'), getFormElement(fixture));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.validationErrorMessage).toContain('Подтверждаю, что данные введены корректно');
  });

  it('should append newly selected files instead of replacing the previous ones', () => {
    const inputElement = document.createElement('input');
    const passportFile = createFile('passport.pdf', 'application/pdf');
    const planFile = createFile('plan.pdf', 'application/pdf');

    setInputFiles(inputElement, [passportFile]);
    component.onFilesSelected(createFileSelectionEvent(inputElement), 'documents');

    setInputFiles(inputElement, [planFile]);
    component.onFilesSelected(createFileSelectionEvent(inputElement), 'documents');

    expect(component.documentFiles).toEqual([passportFile, planFile]);
  });

  it('should open consent modal from the processing agreement link', () => {
    const consentLink = fixture.nativeElement.querySelector(
      '#confirmProcessingLink',
    ) as HTMLButtonElement;

    consentLink.click();
    fixture.detectChanges();

    expect(component.isConsentModalOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('#consentDocumentTitle')?.textContent).toContain(
      'СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ',
    );
  });
});

function fillRequiredFields(
  fixture: ComponentFixture<EstimationForm>,
  component: EstimationForm,
  options: {
    includeDocuments?: boolean;
    includePhotos?: boolean;
    confirmCorrect?: boolean;
    confirmProcessing?: boolean;
  } = {},
): void {
  const nativeElement = fixture.nativeElement as HTMLElement;

  setControlValue(nativeElement, '#city', 'Москва');
  setControlValue(nativeElement, '#address', 'Москва, Тверская ул., д. 10');
  setControlValue(nativeElement, '#area', '54.6');
  setControlValue(nativeElement, '#objectType', 'Квартира');
  setControlValue(nativeElement, '#floorsTotal', '9');
  setControlValue(nativeElement, '#condition', 'Хорошее');
  setCheckboxState(nativeElement, '#confirmCorrect', options.confirmCorrect ?? true);
  setCheckboxState(nativeElement, '#confirmProcessing', options.confirmProcessing ?? true);

  component.documentFiles =
    options.includeDocuments === false ? [] : [createFile('passport.pdf', 'application/pdf')];
  component.photoFiles =
    options.includePhotos === false ? [] : [createFile('front.jpg', 'image/jpeg')];
  component.additionalFiles = [];

  fixture.detectChanges();
}

function getFormElement(fixture: ComponentFixture<EstimationForm>): HTMLFormElement {
  return fixture.nativeElement.querySelector('form') as HTMLFormElement;
}

function setControlValue(root: HTMLElement, selector: string, value: string): void {
  const control = root.querySelector(selector) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;

  control.value = value;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}

function setCheckboxState(root: HTMLElement, selector: string, checked: boolean): void {
  const control = root.querySelector(selector) as HTMLInputElement;

  control.checked = checked;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}

function createFile(name: string, type: string): File {
  return new File(['file-content'], name, { type });
}

function createFileSelectionEvent(inputElement: HTMLInputElement): Event {
  return { target: inputElement } as Event;
}

function setInputFiles(inputElement: HTMLInputElement, files: File[]): void {
  if (typeof DataTransfer !== 'undefined') {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    Object.defineProperty(inputElement, 'files', {
      configurable: true,
      value: dataTransfer.files,
    });
    return;
  }

  Object.defineProperty(inputElement, 'files', {
    configurable: true,
    value: files,
  });
}
