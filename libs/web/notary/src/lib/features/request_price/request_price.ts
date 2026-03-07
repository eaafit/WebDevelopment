import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Notary {
  fio: string;
  city: string;
  officeNumber: string;
  officeAddress: string;
}

interface Company {
  name: string;
  address: string;
}

@Component({
  selector: 'lib-request-price',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './request_price.html',
  styleUrl: './request_price.scss',
})
export class RequestPrice implements OnInit {
  form!: FormGroup;
  requestText = '';
  selectedPdfName = '';
  outgoingDisplay = '';

  cities: string[] = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'];

  notaries: Notary[] = [
    {
      fio: 'Иванов Иван Иванович',
      city: 'Москва',
      officeNumber: '1',
      officeAddress: 'г. Москва, ул. Ленина, 1',
    },
    {
      fio: 'Петрова Анна Сергеевна',
      city: 'Москва',
      officeNumber: '2',
      officeAddress: 'г. Москва, ул. Мира, 5',
    },
    {
      fio: 'Сидоров Алексей Петрович',
      city: 'Санкт-Петербург',
      officeNumber: '3',
      officeAddress: 'г. СПб, Невский пр., 10',
    },
  ];

  filteredNotaries: Notary[] = [];

  companies: Company[] = [
    { name: 'ООО «Оценка Плюс»', address: 'г. Москва, ул. Тверская, 20' },
    { name: 'АО «РосОценка»', address: 'г. Москва, ул. Арбат, 15' },
    { name: 'ИП Кузнецов А.В.', address: 'г. СПб, ул. Садовая, 3' },
  ];

  propertyTypes: string[] = [
    'Квартира',
    'Жилой дом',
    'Земельный участок',
    'Коммерческая недвижимость',
    'Гараж',
    'Иное',
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      notaryCity: [''],
      notaryFio: [''],
      notaryOfficeNumber: [''],
      notaryOfficeAddress: [''],
      companyName: [''],
      companyAddress: [''],
      propertyAddress: [''],
      cadastralNumber: [''],
      propertyType: [''],
      specialConditions: [''],
      docRequisites: [''],
      notarialAction: [''],
      valuationDate: [''],
      reportDueDate: [''],
      extraNotes: [''],
    });

    this.generateOutgoing();

    this.form.valueChanges.subscribe(() => this.buildRequestText());
  }

  onNotaryCityChange(): void {
    const city = this.form.get('notaryCity')?.value;
    this.filteredNotaries = this.notaries.filter((n) => n.city === city);
    this.form.patchValue({ notaryFio: '', notaryOfficeNumber: '', notaryOfficeAddress: '' });
  }

  onNotaryFioChange(): void {
    const fio = this.form.get('notaryFio')?.value;
    const notary = this.notaries.find((n) => n.fio === fio);
    if (notary) {
      this.form.patchValue({
        notaryOfficeNumber: notary.officeNumber,
        notaryOfficeAddress: notary.officeAddress,
      });
    }
  }

  onCompanyChange(): void {
    const name = this.form.get('companyName')?.value;
    const company = this.companies.find((c) => c.name === name);
    this.form.patchValue({ companyAddress: company?.address ?? '' });
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPdfName = input.files?.[0]?.name ?? '';
  }

  generateOutgoing(): void {
    const num = Math.floor(Math.random() * 900) + 100;
    const today = new Date().toLocaleDateString('ru-RU');
    this.outgoingDisplay = `Исх. №${num} от ${today}`;
  }

  regenerateOutgoing(): void {
    this.generateOutgoing();
  }

  onSubmit(): void {
    this.buildRequestText();
  }

  buildRequestText(): void {
    const v = this.form.value;
    if (!v.notaryFio && !v.propertyAddress) {
      this.requestText = 'Заполните форму для предпросмотра запроса...';
      return;
    }

    this.requestText = `
${this.outgoingDisplay}

Руководителю оценочной компании
${v.companyName || '_______________'}
${v.companyAddress || ''}

От нотариуса: ${v.notaryFio || '_______________'}
Нотариальная контора №${v.notaryOfficeNumber || '___'}
Адрес: ${v.notaryOfficeAddress || '_______________'}

ЗАПРОС НА ПРОВЕДЕНИЕ ОЦЕНКИ НЕДВИЖИМОСТИ

Прошу провести оценку следующего объекта недвижимости:

Адрес объекта: ${v.propertyAddress || '_______________'}
Кадастровый номер: ${v.cadastralNumber || '_______________'}
Вид объекта: ${v.propertyType || '_______________'}
${v.specialConditions ? 'Особые условия: ' + v.specialConditions : ''}

Реквизиты правоустанавливающего документа:
${v.docRequisites || '_______________'}

Цель оценки (нотариальное действие): ${v.notarialAction || '_______________'}
Дата определения стоимости: ${v.valuationDate || '_______________'}
Срок предоставления отчёта: ${v.reportDueDate || '_______________'}
${v.extraNotes ? '\nДополнительно: ' + v.extraNotes : ''}

С уважением,
${v.notaryFio || '_______________'}
    `.trim();
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.requestText);
  }
}
