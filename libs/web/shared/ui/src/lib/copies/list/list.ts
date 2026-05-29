import { Component, computed, inject, Input, OnInit, signal, DestroyRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentService, Document, PageInfo } from '../services/document.service';
import { AssessmentService } from '../services/assesment.service';
import { DocumentRow } from './document-row/document-row';
import { Pagination } from './pagination/pagination';

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
  private readonly destroyRef = inject(DestroyRef);

  readonly rawDocuments = signal<Document[]>([]);
  readonly page = signal<number>(1);
  
  // ⚙️ Теперь лимит — это реактивный сигнал со значением по умолчанию 9
  readonly limit = signal<number>(9);

  readonly loading = signal(true);

  @Input() role: 'applicant' | 'notary' = 'applicant';

  readonly draftFilters = signal<DocumentFilters>({ ...DEFAULT_FILTERS });
  readonly appliedFilters = signal<DocumentFilters>({ ...DEFAULT_FILTERS });

  // Глобальный фильтр по всему массиву данных
  readonly filteredDocuments = computed(() => {
    const docs = this.rawDocuments();
    const filters = this.appliedFilters();

    let result = docs;

    if (filters.fileName.trim()) {
      const searchName = filters.fileName.toLowerCase().trim();
      result = result.filter(doc => 
        doc.fileName && doc.fileName.toLowerCase().includes(searchName)
      );
    }

    if (filters.dateFrom) {
      const fromTimestamp = Math.floor(Date.parse(filters.dateFrom) / 1000);
      result = result.filter(doc => {
        const docSeconds = doc.uploadedAt?.seconds ? Number(doc.uploadedAt.seconds) : 0;
        return docSeconds >= fromTimestamp;
      });
    }

    if (filters.dateTo) {
      const toTimestamp = Math.floor(Date.parse(filters.dateTo) / 1000) + 86399;
      result = result.filter(doc => {
        const docSeconds = doc.uploadedAt?.seconds ? Number(doc.uploadedAt.seconds) : 0;
        return docSeconds <= toTimestamp;
      });
    }

    return result;
  });

  // Пагинация: теперь динамически подстраивается под значение лимита `this.limit()`
  readonly documents = computed(() => {
    const start = (this.page() - 1) * this.limit();
    const end = start + this.limit();
    return this.filteredDocuments().slice(start, end);
  });

  // Подсчет страниц теперь тоже зависит от динамического лимита
  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredDocuments().length / this.limit()) || 1;
  });

  // Эмуляция метаданных для компонента пагинации
  readonly pageInfo = computed<PageInfo>(() => ({
    totalItems: this.filteredDocuments().length,
    totalPages: this.totalPages(),
    currentPage: this.page(),
    perPage: this.limit()
  }));

  readonly hasPrev = computed(() => this.page() > 1 && !this.loading());
  readonly hasNext = computed(() => this.page() < this.totalPages() && !this.loading());

  constructor() {
    toObservable(this.draftFilters)
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((filters) => {
        const prevAssessmentId = this.appliedFilters().assessmentId;
        this.appliedFilters.set(filters);
        this.page.set(1);

        if (filters.assessmentId !== prevAssessmentId || this.rawDocuments().length === 0) {
          this.fetchDocuments();
        }
      });
  }

  ngOnInit() {
    const routeRole = this.route.snapshot.data['role'];
    if (routeRole) this.role = routeRole;

    this.goToPrev = this.goToPrev.bind(this);
    this.goToNext = this.goToNext.bind(this);
  }

  updateFilter<K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]): void {
    this.draftFilters.update((filters) => ({ ...filters, [key]: value }));
  }

  // 🔄 Метод для изменения количества отображаемых элементов
  changeLimit(newLimit: number): void {
    this.limit.set(newLimit);
    this.page.set(1); // Обязательно сбрасываем на первую страницу
  }

  fetchDocuments() {
    this.loading.set(true);
    const filters = this.appliedFilters();
    const assessmentIdParam = filters.assessmentId.trim() || undefined;

    this.documentService.listDocumentsByAssessment(assessmentIdParam, { 
      page: 1, 
      limit: 1000 
    })
    .then((data) => {
      this.rawDocuments.set(data.documents || []);
      this.page.set(1);
    })
    .catch((err) => {
      console.error('Ошибка при получении документов:', err);
      this.rawDocuments.set([]);
    })
    .finally(() => this.loading.set(false));
  }

  goToPrev() {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
    }
  }

  goToNext() {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
    }
  }

  navigateToNew(): void {
    this.router.navigate(['new'], { relativeTo: this.route });
  }
}