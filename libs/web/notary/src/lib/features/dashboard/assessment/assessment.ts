import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AssessmentReadApiService } from './assessment-read-api.service';
import { AssessmentRequest } from './assessment-request';

// Типы описывают данные заявки. Их также использует сервис API.
export type AssessmentStatus =
  | 'New'
  | 'Verified'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'
  | 'Unknown';
export type ObjectType =
  | 'Apartment'
  | 'House'
  | 'Room'
  | 'Apartments'
  | 'LandPlot'
  | 'CommercialProperty'
  | 'Other'
  | 'Unknown';
export interface AssessmentItem {
  assessment: {
    id: string;
    status: AssessmentStatus;
    address: string;
    createdAt: string;
    updatedAt: string;
    description?: string;
    estimatedValue?: number;
  };
  realEstate: RealEstateObject;
}
export interface RealEstateObject {
  id: string;
  city: string;
  address: string;
  objectType: ObjectType;
  condition: 'Excellent' | 'Good' | 'Satisfactory' | 'Poor' | 'Unknown';
  area?: number;
  district?: string;
  roomsCount?: number;
  floor?: number;
  floorsTotal?: number;
  yearBuilt?: number;
  wallMaterial?: string;
  elevatorType?: string;
  description?: string;
}

// Учебные заявки позволяют показать лабу 4 без обращения к API.
const DEMO_ITEMS: AssessmentItem[] = [
  {
    assessment: {
      id: 'demo-1',
      status: 'New',
      address: 'Москва, ул. Тверская, 10',
      createdAt: '',
      updatedAt: '',
    },
    realEstate: {
      id: 'object-1',
      city: 'Москва',
      address: 'Москва, ул. Тверская, 10',
      objectType: 'Apartment',
      area: 54,
      condition: 'Good',
    },
  },
  {
    assessment: {
      id: 'demo-2',
      status: 'Verified',
      address: 'Казань, ул. Баумана, 5',
      createdAt: '',
      updatedAt: '',
    },
    realEstate: {
      id: 'object-2',
      city: 'Казань',
      address: 'Казань, ул. Баумана, 5',
      objectType: 'House',
      area: 120,
      condition: 'Good',
    },
  },
  {
    assessment: {
      id: 'demo-3',
      status: 'Completed',
      address: 'Екатеринбург, ул. Малышева, 16',
      createdAt: '',
      updatedAt: '',
    },
    realEstate: {
      id: 'object-3',
      city: 'Екатеринбург',
      address: 'Екатеринбург, ул. Малышева, 16',
      objectType: 'Apartment',
      area: 42,
      condition: 'Good',
    },
  },
];

@Component({
  selector: 'lib-request-price',
  standalone: true,
  imports: [CommonModule, AssessmentRequest],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class RequestPrice implements OnInit {
  private readonly api = inject(AssessmentReadApiService);
  // Номер загрузки защищает от запоздалых ответов после смены страницы или режима.
  private loadNumber = 0;

  readonly demoMode = signal(false);
  readonly items = signal<AssessmentItem[]>([]);
  readonly selectedItem = signal<AssessmentItem | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly search = signal('');

  readonly statusLabels: Record<AssessmentStatus, string> = {
    New: 'Новая',
    Verified: 'Проверена',
    InProgress: 'В работе',
    Completed: 'Завершена',
    Cancelled: 'Отменена',
    Unknown: 'Неизвестен',
  };

  // Поиск выполняется по уже загруженной странице.
  readonly filteredItems = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.items().filter((item) => item.assessment.address.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    void this.loadItems();
  }

  setDemoMode(enabled: boolean): void {
    this.demoMode.set(enabled);
    this.page.set(1);
    this.search.set('');
    void this.loadItems();
  }

  async loadItems(): Promise<void> {
    const currentLoad = ++this.loadNumber;
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    try {
      const result = this.demoMode()
        ? { items: DEMO_ITEMS, totalPages: 1 }
        : await this.api.list(this.page());
      if (currentLoad !== this.loadNumber) return;
      this.items.set(result.items);
      this.totalPages.set(result.totalPages);
    } catch {
      if (currentLoad === this.loadNumber) {
        this.error.set('Не удалось загрузить заявки. Проверьте вход и запущен ли сервер.');
      }
    } finally {
      if (currentLoad === this.loadNumber) this.loading.set(false);
    }
  }

  changePage(direction: number): void {
    const nextPage = this.page() + direction;
    if (this.loading() || this.detailLoading() || nextPage < 1 || nextPage > this.totalPages())
      return;
    this.page.set(nextPage);
    void this.loadItems();
  }

  canRequest(item: AssessmentItem): boolean {
    return ['New', 'Verified', 'InProgress'].includes(item.assessment.status);
  }

  async openRequest(item: AssessmentItem): Promise<void> {
    if (this.loading() || this.detailLoading() || !this.canRequest(item)) return;
    const currentLoad = this.loadNumber;
    this.detailLoading.set(true);
    this.error.set('');
    try {
      // В API-режиме получаем свежие данные выбранной заявки по её id.
      const selected = this.demoMode() ? item : await this.api.get(item.assessment.id);
      if (currentLoad === this.loadNumber) this.selectedItem.set(selected);
    } catch {
      if (currentLoad === this.loadNumber)
        this.error.set('Не удалось открыть заявку. Попробуйте ещё раз.');
    } finally {
      this.detailLoading.set(false);
    }
  }
}
