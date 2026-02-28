import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type Notary = {
  city: string;
  fio: string;
  officeNumber: string;
  officeAddress: string;
};

type Company = {
  name: string;
  address: string;
};

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
  selector: 'web-request-price',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './request_price.html',
  styleUrl: './request_price.scss',
})
export class RequestPrice {
  // Демо-списки (можешь расширить)
  readonly cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'];

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
  ];

  readonly companies: Company[] = [
    { name: 'ООО "ОценкаПрофи"', address: 'г. Москва, ул. Мясницкая, д. 15' },
    { name: 'АО "Эксперт-Оценка"', address: 'г. Санкт-Петербург, ул. Рубинштейна, д. 9' },
    { name: 'ООО "Рынок и Стоимость"', address: 'г. Казань, ул. Баумана, д. 3' },
  ];

  readonly propertyTypes = [
    'Квартира',
    'Комната',
    'Жилой дом',
    'Земельный участок',
    'Нежилое помещение',
  ];

  // Исходящий номер/дата
  private readonly outgoingNumber = signal<string>(randomOutgoingNumber());
  private readonly outgoingDate = signal<string>(formatDate(new Date()));
  readonly outgoingDisplay = computed(() => `${this.outgoingNumber()} от ${this.outgoingDate()}`);

  // PDF
  selectedPdfName: string | null = null;

  // Фильтр нотариусов по городу
  filteredNotaries: Notary[] = [];

  // Reactive form
  readonly form = this.fb.group({
    notaryCity: ['', Validators.required],
    notaryFio: ['', Validators.required],
    notaryOfficeNumber: [{ value: '', disabled: false }],
    notaryOfficeAddress: [{ value: '', disabled: false }],

    companyName: ['', Validators.required],
    companyAddress: [{ value: '', disabled: false }],

    propertyAddress: ['', Validators.required],
    cadastralNumber: ['', Validators.required],
    propertyType: ['', Validators.required],

    docRequisites: ['', Validators.required],

    notarialAction: ['', Validators.required],
    valuationDate: ['', Validators.required],
    reportDueDate: ['', Validators.required],

    specialConditions: [''],
    extraNotes: [''],
  });

  // Текст запроса (превью)
  requestText = '';

  constructor(private readonly fb: FormBuilder) {
    this.filteredNotaries = [];
    this.buildRequestText();

    // Автообновление превью
    this.form.valueChanges.subscribe(() => this.buildRequestText());
  }

  regenerateOutgoing(): void {
    this.outgoingNumber.set(randomOutgoingNumber());
    this.outgoingDate.set(formatDate(new Date()));
    this.buildRequestText();
  }

  onNotaryCityChange(): void {
    const city = this.form.get('notaryCity')?.value || '';
    this.filteredNotaries = this.notaries.filter((n) => n.city === city);

    // Сброс нотариуса при смене города
    this.form.patchValue(
      { notaryFio: '', notaryOfficeNumber: '', notaryOfficeAddress: '' },
      { emitEvent: false },
    );

    this.buildRequestText();
  }

  onNotaryFioChange(): void {
    const fio = this.form.get('notaryFio')?.value || '';
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
    const name = this.form.get('companyName')?.value || '';
    const found = this.companies.find((c) => c.name === name);

    this.form.patchValue({ companyAddress: found?.address ?? '' }, { emitEvent: false });
    this.buildRequestText();
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.selectedPdfName = file ? file.name : null;
    this.buildRequestText();
  }

  onSubmit(): void {
    this.buildRequestText();
    // можно убрать alert, но пусть пока будет понятно, что сработало

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

  private buildRequestText(): void {
    const v = this.form.getRawValue();

    const notaryCity = v.notaryCity || '{Город}';
    const notaryFio = v.notaryFio || '{ФИО нотариуса}';
    const officeNumber = v.notaryOfficeNumber || '{Номер конторы}';
    const officeAddress = v.notaryOfficeAddress || '{Адрес нотариуса}';

    const companyName = v.companyName || '{Название компании}';
    const companyAddress = v.companyAddress || '{Адрес компании}';

    const propertyAddress = v.propertyAddress || '{Адрес объекта недвижимости}';
    const cadastralNumber = v.cadastralNumber || '{Кадастровый номер}';
    const propertyType = v.propertyType || '{Вид объекта}';

    const docRequisites = v.docRequisites || '{Реквизиты документа}';

    const notarialAction = v.notarialAction || '{Нотариальное действие}';
    const valuationDate = v.valuationDate || '{Дата оценки}';
    const reportDueDate = v.reportDueDate || '{Дата окончания срока}';

    const special = v.specialConditions?.trim() ? v.specialConditions : '—';
    const extra = v.extraNotes?.trim() ? v.extraNotes : '—';

    const outgoingNumber = this.outgoingNumber();
    const outgoingDate = this.outgoingDate();

    this.requestText = `Нотариальный запрос о проведении оценки рыночной стоимости объекта недвижимости
От: Нотариус города ${notaryCity} ${notaryFio}, нотариальная контора № ${officeNumber}, расположенная по адресу: ${officeAddress}
Исх. №: ${outgoingNumber}
Дата: ${outgoingDate}

Кому: Руководителю
Оценочной компании "${companyName}"
${companyAddress}

Запрос

На основании необходимости совершения нотариального действия (${notarialAction}) прошу Вас провести оценку рыночной стоимости объекта недвижимости и предоставить письменный отчет об оценке.

Параметры объекта для оценки:
Адрес объекта: ${propertyAddress}
Кадастровый номер: ${cadastralNumber}
Вид объекта: ${propertyType}
Правоустанавливающие документы: ${docRequisites}
Цель проведения оценки: ${notarialAction}
Дата, на которую требуется определить стоимость: ${valuationDate}
Особые условия/характеристики: ${special}
Дополнительные комментарии: ${extra}

Срок предоставления отчета: до ${reportDueDate}.

Приложение:
- Документ (PDF): ${this.selectedPdfName ?? 'не выбран'}.
- Копия технического паспорта/плана БТИ.
- Выписка из ЕГРН.
`;
  }
}
