import { Component, computed, inject, Input, OnInit, signal, DestroyRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { DocumentService, Document, PageInfo } from '../services/document.service';
import { AssessmentService } from '../services/assesment.service';
import { DocumentRow } from './document-row/document-row';
import { Pagination } from './pagination/pagination';

// 1. Описываем интерфейс наших фильтров
export interface DocumentFilters {
  fileName: string;
  assessmentId: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: DocumentFilters = {
  fileName: '',
  assessmentId: '',
  dateFrom: '',
  dateTo: '',
};

@Component({
  selector: 'lib-list',
  imports: [CommonModule, DocumentRow, Pagination],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly documentService = inject(DocumentService);
  private readonly destroyRef = inject(DestroyRef); // Нужен для отписки

  page = signal<number>(1);
  private readonly limit = 9;

  documents = signal<Document[]>([]);
  loading = signal(true);
  pageInfo = signal<PageInfo>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    perPage: 9
  });

  @Input() role: 'applicant' | 'notary' = 'applicant';

  // 2. Добавляем сигналы для фильтров
  readonly draftFilters = signal<DocumentFilters>({ ...DEFAULT_FILTERS });
  readonly appliedFilters = signal<DocumentFilters>({ ...DEFAULT_FILTERS });

  constructor() {
    // 3. Настраиваем реактивное применение фильтров
    toObservable(this.draftFilters)
      .pipe(
        debounceTime(300), // Ждем 300мс после последнего ввода
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)), // Проверяем, изменились ли данные
      )
      .subscribe((filters) => {
        this.appliedFilters.set(filters);
        this.page.set(1); // Сбрасываем пагинацию на первую страницу
        this.fetchDocuments(1); // Запрашиваем новые данные
      });
  }

  ngOnInit() {
    const routeRole = this.route.snapshot.data['role'];
    if (routeRole) this.role = routeRole;
    
    this.fetchDocuments();

    this.documents.set([{
      assessmentId: '12',
      id: 'qwe',
      fileName: 'test',
      fileType: 'png',
      version: 1,
      uploadedById: Date().toString(),
      downloadUrl: 'qweasd'
    }]);

    this.goToPrev = this.goToPrev.bind(this);
    this.goToNext = this.goToNext.bind(this);
  }

  updateFilter<K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]): void {
    this.draftFilters.update((filters) => ({ ...filters, [key]: value }));
  }

  fetchDocuments(page = 1) {
    this.loading.set(true);
    const filters = this.appliedFilters();
    const assessmentIdParam = filters.assessmentId.trim() || undefined;

    this.documentService.listDocumentsByAssessment(assessmentIdParam, { 
      page, 
      limit: this.limit,
      fileName: filters.fileName || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined
    })
    .then((data) => {
      this.documents.set(data.documents);
      if (data.meta) this.pageInfo.set(data.meta);
      this.page.set(data.meta?.currentPage ?? page);
    })
    .catch(() => {})
    .finally(() => this.loading.set(false));
  }

  hasPrev = computed(() => this.page() > 1 && !this.loading());

  hasNext = computed(() => {
    const totalPages = this.pageInfo()?.totalPages;
    return Boolean(totalPages && this.page() < totalPages && !this.loading());
  });

  goToPrev() {
    if (this.page() > 1) this.fetchDocuments(this.page() - 1);
  }

  goToNext() {
    const lastPage = this.pageInfo()?.totalPages;
    if (!lastPage || this.page() >= lastPage) return;
    this.fetchDocuments(this.page() + 1);
  }

  navigateToNew(): void {
    this.router.navigate(['new'], { relativeTo: this.route });
  }
}