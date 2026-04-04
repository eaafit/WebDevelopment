import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RequestPrice, AssessmentItem } from './request_price';

describe('RequestPrice', () => {
  let component: RequestPrice;
  let fixture: ComponentFixture<RequestPrice>;
  let httpMock: HttpTestingController;

  const mockItem: AssessmentItem = {
    assessment: {
      id: '1',
      status: 'New',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
      address: 'Москва, Тверская ул., д. 10, кв. 5',
      estimatedValue: 8500000,
    },
    realEstate: {
      id: 're1',
      city: 'Москва',
      district: 'Центральный',
      address: 'Москва, Тверская ул., д. 10, кв. 5',
      area: 54.6,
      objectType: 'Apartment',
      roomsCount: 2,
      floorsTotal: 9,
      floor: 5,
      condition: 'Good',
      yearBuilt: 1985,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestPrice, CommonModule, ReactiveFormsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestPrice);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Сбрасываем HTTP-запрос при инициализации
    const req = httpMock.expectOne('/api/notary/assessments');
    req.flush([mockItem]);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  // ── Инициализация ──────────────────────────────────────────────────────────

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should start on list view', () => {
    expect(component.view()).toBe('list');
  });

  it('should generate outgoing number on init', () => {
    expect(component.outgoingDisplay()).toMatch(/NR-\d{4}-\d{6} от \d{2}\.\d{2}\.\d{4}/);
  });

  it('should start with empty filteredNotaries', () => {
    expect(component.filteredNotaries).toEqual([]);
  });

  it('should start with null selectedPdfName', () => {
    expect(component.selectedPdfName).toBeNull();
  });

  it('should start with form hidden (isFormVisible = false)', () => {
    expect(component.isFormVisible).toBe(false);
  });

  // ── Список заявок ──────────────────────────────────────────────────────────

  it('should load assessments on init', () => {
    expect(component.assessments().length).toBe(1);
    expect(component.isLoadingAssessments()).toBe(false);
  });

  it('should filter assessments by search query', () => {
    component.onSearchInput({ target: { value: 'Москва' } } as unknown as Event);
    expect(
      component
        .filteredAssessments()
        .every(
          (i) =>
            i.assessment.address.toLowerCase().includes('москва') ||
            i.realEstate.city.toLowerCase().includes('москва'),
        ),
    ).toBe(true);
  });

  it('should filter assessments by status', () => {
    component.onStatusFilterChange({ target: { value: 'New' } } as unknown as Event);
    expect(component.filteredAssessments().every((i) => i.assessment.status === 'New')).toBe(true);
  });

  it('should filter assessments by type', () => {
    component.onTypeFilterChange({ target: { value: 'Apartment' } } as unknown as Event);
    expect(
      component.filteredAssessments().every((i) => i.realEstate.objectType === 'Apartment'),
    ).toBe(true);
  });

  it('should clear filters', () => {
    component.onSearchInput({ target: { value: 'test' } } as unknown as Event);
    component.clearFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.statusFilter()).toBe('');
    expect(component.typeFilter()).toBe('');
  });

  it('should sort by address ascending then descending', () => {
    component.sortBy('address');
    expect(component.sortField()).toBe('address');
    expect(component.sortDir()).toBe('asc');
    component.sortBy('address');
    expect(component.sortDir()).toBe('desc');
  });

  // ── Модалка удаления ───────────────────────────────────────────────────────

  it('should open and close delete modal', () => {
    component.openDeleteModal(mockItem);
    expect(component.deleteTarget()).toBe(mockItem);
    component.closeDeleteModal();
    expect(component.deleteTarget()).toBeNull();
  });

  it('should delete assessment from list', () => {
    component.openDeleteModal(mockItem);
    component.confirmDelete();
    httpMock.expectOne(`/api/notary/assessments/${mockItem.assessment.id}`).flush(null);
    fixture.detectChanges();
    expect(component.assessments().length).toBe(0);
  });

  // для обратной совместимости
  it('should expose isDeleteModalOpen()', () => {
    component.openDeleteModal(mockItem);
    expect(component.deleteTarget()).not.toBeNull();
    component.closeDeleteModal();
    expect(component.deleteTarget()).toBeNull();
  });

  // ── Переходы между видами ──────────────────────────────────────────────────

  it('should open add form and switch view to edit', () => {
    component.openAddForm();
    expect(component.view()).toBe('edit');
    expect(component.isEditMode).toBe(false);
    expect(component.editTitle).toBe('Новая заявка');
  });

  it('should open edit form with item data', () => {
    component.openEditForm(mockItem);
    expect(component.view()).toBe('edit');
    expect(component.isEditMode).toBe(true);
    expect(component.editTitle).toBe('Редактирование заявки');
    expect(component.editForm.get('address')?.value).toBe(mockItem.assessment.address);
    expect(component.editForm.get('area')?.value).toBe(mockItem.realEstate.area);
  });

  it('should open pdf form and prefill address', () => {
    component.openPdfForm(mockItem);
    expect(component.view()).toBe('pdf');
    expect(component.isFormVisible).toBe(true);
    expect(component.pdfItem()).toBe(mockItem);
    expect(component.form.get('propertyAddress')?.value).toBe(mockItem.assessment.address);
  });

  it('should selectAssessment (backward compatibility)', () => {
    component.selectAssessment(mockItem);
    expect(component.view()).toBe('pdf');
    expect(component.selectedAssessmentId()).toBe(mockItem.assessment.id);
  });

  it('should return to list on view.set list', () => {
    component.view.set('edit');
    component.view.set('list');
    expect(component.view()).toBe('list');
  });

  // ── Справочники ────────────────────────────────────────────────────────────

  it('should have cities list', () => {
    expect(component.cities.length).toBeGreaterThan(0);
  });

  it('should have notaries list', () => {
    expect(component.notaries.length).toBeGreaterThan(0);
  });

  it('should have companies list', () => {
    expect(component.companies.length).toBeGreaterThan(0);
  });

  it('should have propertyTypes list', () => {
    expect(component.propertyTypes).toContain('Квартира');
    expect(component.propertyTypes).toContain('Жилой дом');
    expect(component.propertyTypes).toContain('Земельный участок');
  });

  // ── Фильтрация нотариусов ──────────────────────────────────────────────────

  it('should filter notaries by city on onNotaryCityChange()', () => {
    component.form.patchValue({ notaryCity: 'Москва' });
    component.onNotaryCityChange();
    expect(component.filteredNotaries.length).toBeGreaterThan(0);
    component.filteredNotaries.forEach((n) => expect(n.city).toBe('Москва'));
  });

  it('should reset notary fields when city changes', () => {
    component.form.patchValue({ notaryFio: 'Иванов Иван Иванович', notaryOfficeNumber: '12' });
    component.form.patchValue({ notaryCity: 'Санкт-Петербург' });
    component.onNotaryCityChange();
    expect(component.form.get('notaryFio')?.value).toBe('');
    expect(component.form.get('notaryOfficeNumber')?.value).toBe('');
  });

  it('should return empty filteredNotaries for unknown city', () => {
    component.form.patchValue({ notaryCity: 'Неизвестный город' });
    component.onNotaryCityChange();
    expect(component.filteredNotaries).toEqual([]);
  });

  // ── Автоподстановка нотариуса ─────────────────────────────────────────────

  it('should autofill office on onNotaryFioChange()', () => {
    const notary = component.notaries[0];
    component.form.patchValue({ notaryFio: notary.fio });
    component.onNotaryFioChange();
    expect(component.form.get('notaryOfficeNumber')?.value).toBe(notary.officeNumber);
    expect(component.form.get('notaryOfficeAddress')?.value).toBe(notary.officeAddress);
  });

  it('should clear office fields if notary not found', () => {
    component.form.patchValue({ notaryFio: 'Несуществующий' });
    component.onNotaryFioChange();
    expect(component.form.get('notaryOfficeNumber')?.value).toBe('');
  });

  // ── Компания ──────────────────────────────────────────────────────────────

  it('should autofill company address on onCompanyChange()', () => {
    const company = component.companies[0];
    component.form.patchValue({ companyName: company.name });
    component.onCompanyChange();
    expect(component.form.get('companyAddress')?.value).toBe(company.address);
  });

  it('should clear company address if company not found', () => {
    component.form.patchValue({ companyName: 'Несуществующая' });
    component.onCompanyChange();
    expect(component.form.get('companyAddress')?.value).toBe('');
  });

  // ── PDF ───────────────────────────────────────────────────────────────────

  it('should set selectedPdfName on file selection', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: { 0: file, length: 1, item: () => file } });
    component.onPdfSelected({ target: input } as unknown as Event);
    expect(component.selectedPdfName).toBe('test.pdf');
  });

  it('should set selectedPdfName to null when no file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    component.onPdfSelected({ target: input } as unknown as Event);
    expect(component.selectedPdfName).toBeNull();
  });

  // ── Исходящий номер ───────────────────────────────────────────────────────

  it('should regenerate outgoing number', () => {
    component.regenerateOutgoing();
    expect(component.outgoingDisplay()).toMatch(/NR-\d{4}-\d{6} от \d{2}\.\d{2}\.\d{4}/);
  });

  // ── Текст запроса ─────────────────────────────────────────────────────────

  it('should build requestText with notary city and fio', () => {
    component.form.patchValue({ notaryCity: 'Москва', notaryFio: 'Иванов Иван Иванович' });
    expect(component.requestText).toContain('Москва');
    expect(component.requestText).toContain('Иванов Иван Иванович');
  });

  it('should include placeholder when notaryFio is empty', () => {
    component.form.patchValue({ notaryFio: '' });
    expect(component.requestText).toContain('{Фамилия И.О.}');
  });

  // ── Валидация PDF-формы ───────────────────────────────────────────────────

  it('should be invalid when required fields are empty', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('should be valid when all required fields are filled', () => {
    component.form.patchValue({
      notaryCity: 'Москва',
      notaryFio: 'Иванов Иван Иванович',
      companyName: 'ООО "ОценкаПрофи"',
      propertyAddress: 'г. Москва, ул. Садовая, д. 5',
      cadastralNumber: '77:01:0004012:1234',
      propertyType: 'Квартира',
      docRequisites: 'Выписка из ЕГРН № 123 от 01.01.2024',
      notarialAction: 'дарение',
      valuationDate: '2025-06-01',
      reportDueDate: '2025-07-01',
    });
    expect(component.form.valid).toBe(true);
  });

  it('should mark all as touched on submit when form is invalid', () => {
    const spy = jest.spyOn(component.form, 'markAllAsTouched');
    component.onSubmit();
    expect(spy).toHaveBeenCalled();
  });
});
