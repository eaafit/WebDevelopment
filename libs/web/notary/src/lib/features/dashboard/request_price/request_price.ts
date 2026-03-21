import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Notary {
  city: string;
  fio: string;
  officeNumber: string;
  officeAddress: string;
}

interface Company {
  name: string;
  address: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function randomOutgoingNumber(): string {
  const year = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 900000) + 100000;
  return `NR-${year}-${rnd}`;
}

@Component({
  selector: 'lib-request-price',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './request_price.html',
  styleUrl: './request_price.scss',
})
export class RequestPrice {
  private readonly fb = inject(FormBuilder);

  // ── Справочники ────────────────────────────────────────────────────────────

  readonly cities: string[] = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'];

  readonly notaries: Notary[] = [
    {
      city: 'Москва',
      fio: 'Иванов Иван Иванович',
      officeNumber: '12',
      officeAddress: 'г. Москва, ул. Тверская, д. 10',
    },
    {
      city: 'Москва',
      fio: 'Петров Пётр Петрович',
      officeNumber: '48',
      officeAddress: 'г. Москва, ул. Арбат, д. 7',
    },
    {
      city: 'Санкт-Петербург',
      fio: 'Сидорова Анна Сергеевна',
      officeNumber: '5',
      officeAddress: 'г. Санкт-Петербург, Невский пр., д. 25',
    },
    {
      city: 'Казань',
      fio: 'Нуриев Рустам Ильдарович',
      officeNumber: '9',
      officeAddress: 'г. Казань, ул. Баумана, д. 18',
    },
    {
      city: 'Екатеринбург',
      fio: 'Белова Татьяна Викторовна',
      officeNumber: '3',
      officeAddress: 'г. Екатеринбург, ул. Ленина, д. 52',
    },
  ];

  readonly companies: Company[] = [
    { name: 'ООО "ОценкаПрофи"', address: 'г. Москва, ул. Мясницкая, д. 15' },
    { name: 'АО "Эксперт-Оценка"', address: 'г. Санкт-Петербург, ул. Рубинштейна, д. 9' },
    { name: 'ООО "Рынок и Стоимость"', address: 'г. Казань, ул. Баумана, д. 3' },
    { name: 'ИП Кузнецов А.В.', address: 'г. Екатеринбург, ул. Малышева, д. 101' },
  ];

  readonly propertyTypes: string[] = [
    'Квартира',
    'Комната',
    'Жилой дом',
    'Земельный участок',
    'Нежилое помещение',
  ];

  // ── Исходящий номер / дата ─────────────────────────────────────────────────

  private readonly _outgoingNumber = signal<string>(randomOutgoingNumber());
  private readonly _outgoingDate = signal<string>(formatDate(new Date()));
  readonly outgoingDisplay = computed(() => `${this._outgoingNumber()} от ${this._outgoingDate()}`);

  // ── Состояние ─────────────────────────────────────────────────────────────

  selectedPdfName: string | null = null;
  filteredNotaries: Notary[] = [];
  requestText = '';

  // ── Форма (через inject — fb уже доступен на уровне поля) ─────────────────

  readonly form = this.fb.group({
    notaryCity: ['', Validators.required],
    notaryFio: ['', Validators.required],
    notaryOfficeNumber: [''],
    notaryOfficeAddress: [''],
    companyName: ['', Validators.required],
    companyAddress: [''],
    propertyAddress: ['', Validators.required],
    cadastralNumber: ['', Validators.required],
    propertyType: ['', Validators.required],
    specialConditions: [''],
    docRequisites: ['', Validators.required],
    notarialAction: ['', Validators.required],
    valuationDate: ['', Validators.required],
    reportDueDate: ['', Validators.required],
    extraNotes: [''],
  });

  constructor() {
    this.buildRequestText();
    this.form.valueChanges.subscribe(() => this.buildRequestText());
  }

  // ── Обработчики событий ────────────────────────────────────────────────────

  regenerateOutgoing(): void {
    this._outgoingNumber.set(randomOutgoingNumber());
    this._outgoingDate.set(formatDate(new Date()));
    this.buildRequestText();
  }

  onNotaryCityChange(): void {
    const city = this.form.get('notaryCity')?.value ?? '';
    this.filteredNotaries = this.notaries.filter((n) => n.city === city);
    this.form.patchValue(
      { notaryFio: '', notaryOfficeNumber: '', notaryOfficeAddress: '' },
      { emitEvent: false },
    );
    this.buildRequestText();
  }

  onNotaryFioChange(): void {
    const fio = this.form.get('notaryFio')?.value ?? '';
    const found = this.notaries.find((n) => n.fio === fio);
    this.form.patchValue(
      {
        notaryOfficeNumber: found?.officeNumber ?? '',
        notaryOfficeAddress: found?.officeAddress ?? '',
      },
      { emitEvent: false },
    );
    this.buildRequestText();
  }

  onCompanyChange(): void {
    const name = this.form.get('companyName')?.value ?? '';
    const found = this.companies.find((c) => c.name === name);
    this.form.patchValue({ companyAddress: found?.address ?? '' }, { emitEvent: false });
    this.buildRequestText();
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPdfName = input.files?.[0]?.name ?? null;
    this.buildRequestText();
  }

  onSubmit(): void {
    this.buildRequestText();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    alert('Запрос сформирован. Скопируйте текст из блока предпросмотра.');
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.requestText);
      alert('Текст запроса скопирован!');
    } catch {
      alert('Не удалось скопировать. Выделите текст вручную.');
    }
  }

  // ── Построение текста запроса ──────────────────────────────────────────────

  private buildRequestText(): void {
    const v = this.form.getRawValue();

    const notaryCity = v.notaryCity || '{Город}';
    const notaryFio = v.notaryFio || '{Фамилия И.О.}';
    const officeNumber = v.notaryOfficeNumber || '{Номер}';
    const officeAddress = v.notaryOfficeAddress || '{Адрес нотариуса}';
    const companyName = v.companyName || '{Название компании}';
    const companyAddress = v.companyAddress || '{Адрес компании}';
    const propertyAddress = v.propertyAddress || '{Адрес объекта недвижимости}';
    const cadastralNumber = v.cadastralNumber || '{Кадастровый номер}';
    const propertyType =
      v.propertyType ||
      '{Вид объекта (например: квартира, жилой дом, земельный участок, нежилое помещение)}';
    const docRequisites =
      v.docRequisites ||
      '{Реквизиты документа, подтверждающего право собственности (вид, номер, дата, кем выдан)}';
    const notarialAction =
      v.notarialAction ||
      '{Цель оценки (например: для заключения договора дарения, для вступления в наследство)}';
    const valuationDate = v.valuationDate || '{Дата оценки}';
    const reportDueDate = v.reportDueDate || '{Дата окончания срока}';
    const special = v.specialConditions?.trim() || '—';
    const extra = v.extraNotes?.trim() || '—';

    this.requestText = `Нотариальный запрос о проведении оценки рыночной стоимости объекта недвижимости
От: Нотариус города ${notaryCity} ${notaryFio}, нотариальная контора № ${officeNumber}, расположенная по адресу: ${officeAddress}
Исх. №: ${this._outgoingNumber()}
Дата: ${this._outgoingDate()}

Кому: Руководителю
Оценочной компании "${companyName}"
${companyAddress}

Запрос

На основании необходимости совершения нотариального действия (${notarialAction}) и в соответствии со статьей 47 "Основ законодательства Российской Федерации о нотариате", прошу Вас провести оценку рыночной стоимости объекта недвижимости и предоставить в мою адрес письменный отчет об оценке, соответствующий требованиям Федерального закона от 29.07.1998 № 135-ФЗ "Об оценочной деятельности в Российской Федерации" и Федеральных стандартов оценки (ФСО).

Параметры объекта для оценки:

Адрес объекта: ${propertyAddress}
Кадастровый номер: ${cadastralNumber}
Вид объекта: ${propertyType}
Правоустанавливающие документы: ${docRequisites}
Цель проведения оценки: ${notarialAction}
Дата, на которую требуется определить стоимость: ${valuationDate}
Особые условия/характеристики: ${special}
Дополнительные комментарии: ${extra}

Отчет об оценке должен быть представлен на бумажном носителе, подписан и заверен печатью оценщика, с приложением копии квалификационного аттестата оценщика.

Срок предоставления отчета: до ${reportDueDate}.

Приложение:
- Документ (PDF): ${this.selectedPdfName ?? 'не выбран'}.
- Копия технического паспорта/плана БТИ.
- Выписка из ЕГРН.`;
  }
}
