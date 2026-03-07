import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { RequestPrice } from './request_price';

describe('RequestPrice', () => {
  let component: RequestPrice;
  let fixture: ComponentFixture<RequestPrice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestPrice, CommonModule, ReactiveFormsModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestPrice);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Инициализация ──────────────────────────────────────────────────────────

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    expect(component.form).toBeTruthy();
    expect(component.form.get('notaryCity')?.value).toBe('');
    expect(component.form.get('notaryFio')?.value).toBe('');
    expect(component.form.get('propertyAddress')?.value).toBe('');
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

  // ── Автоподстановка данных нотариуса ──────────────────────────────────────

  it('should autofill office number and address on onNotaryFioChange()', () => {
    const notary = component.notaries[0];
    component.form.patchValue({ notaryFio: notary.fio });
    component.onNotaryFioChange();
    expect(component.form.get('notaryOfficeNumber')?.value).toBe(notary.officeNumber);
    expect(component.form.get('notaryOfficeAddress')?.value).toBe(notary.officeAddress);
  });

  it('should clear office fields if notary not found', () => {
    component.form.patchValue({ notaryFio: 'Несуществующий Нотариус' });
    component.onNotaryFioChange();
    expect(component.form.get('notaryOfficeNumber')?.value).toBe('');
    expect(component.form.get('notaryOfficeAddress')?.value).toBe('');
  });

  // ── Автоподстановка данных компании ───────────────────────────────────────

  it('should autofill company address on onCompanyChange()', () => {
    const company = component.companies[0];
    component.form.patchValue({ companyName: company.name });
    component.onCompanyChange();
    expect(component.form.get('companyAddress')?.value).toBe(company.address);
  });

  it('should clear company address if company not found', () => {
    component.form.patchValue({ companyName: 'Несуществующая компания' });
    component.onCompanyChange();
    expect(component.form.get('companyAddress')?.value).toBe('');
  });

  // ── PDF ────────────────────────────────────────────────────────────────────

  it('should set selectedPdfName on file selection', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: dataTransfer.files });

    const event = { target: input } as unknown as Event;
    component.onPdfSelected(event);

    expect(component.selectedPdfName).toBe('test.pdf');
  });

  it('should set selectedPdfName to null when no file selected', () => {
    const input = document.createElement('input');
    input.type = 'file';
    const event = { target: input } as unknown as Event;
    component.onPdfSelected(event);
    expect(component.selectedPdfName).toBeNull();
  });

  // ── Исходящий номер ───────────────────────────────────────────────────────

  it('should regenerate outgoing number on regenerateOutgoing()', () => {
    const before = component.outgoingDisplay();
    // небольшая задержка не нужна — просто вызываем
    component.regenerateOutgoing();
    // формат должен совпасть
    expect(component.outgoingDisplay()).toMatch(/NR-\d{4}-\d{6} от \d{2}\.\d{2}\.\d{4}/);
  });

  // ── Текст запроса ─────────────────────────────────────────────────────────

  it('should build requestText containing notary city and fio', () => {
    component.form.patchValue({ notaryCity: 'Москва', notaryFio: 'Иванов Иван Иванович' });
    // valueChanges запустит buildRequestText автоматически
    expect(component.requestText).toContain('Москва');
    expect(component.requestText).toContain('Иванов Иван Иванович');
  });

  it('should build requestText containing property address', () => {
    component.form.patchValue({ propertyAddress: 'г. Москва, ул. Садовая, д. 5, кв. 10' });
    expect(component.requestText).toContain('г. Москва, ул. Садовая, д. 5, кв. 10');
  });

  it('should build requestText containing cadastral number', () => {
    component.form.patchValue({ cadastralNumber: '77:01:0004012:1234' });
    expect(component.requestText).toContain('77:01:0004012:1234');
  });

  it('should build requestText containing report due date', () => {
    component.form.patchValue({ reportDueDate: '2025-12-31' });
    expect(component.requestText).toContain('2025-12-31');
  });

  it('should include placeholder when notaryFio is empty', () => {
    component.form.patchValue({ notaryFio: '' });
    expect(component.requestText).toContain('{Фамилия И.О.}');
  });

  it('should include pdf name in requestText when file is selected', () => {
    component.selectedPdfName = 'договор.pdf';
    component.form.patchValue({ notarialAction: 'дарение' }); // тригер valueChanges
    expect(component.requestText).toContain('договор.pdf');
  });

  // ── Валидация формы ───────────────────────────────────────────────────────

  it('should be invalid when required fields are empty', () => {
    expect(component.form.invalid).toBeTrue();
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
    expect(component.form.valid).toBeTrue();
  });

  it('should mark all as touched on submit when form is invalid', () => {
    spyOn(component.form, 'markAllAsTouched');
    component.onSubmit();
    expect(component.form.markAllAsTouched).toHaveBeenCalled();
  });
});
