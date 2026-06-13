import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { AssessmentStatus } from '@notary-portal/api-contracts';
import { TokenStore } from '../../rpc/token-store';

// Минимально необходимый набор полей заявки для формы заказа копии.
interface AssessmentOption {
  id: string;
  description?: string;
  address?: string;
  userId?: string;
  applicantId?: string;
  clientId?: string;
}

@Component({
  selector: 'lib-new',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new.html',
  styleUrl: './new.scss',
})
export class New implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tokenStore = inject(TokenStore);

  // Список типов документов строго по ТЗ (по возрастанию цены)
  readonly documentTypes = [
    { value: 1, label: 'Выписка' },          // 150 ₽
    { value: 2, label: 'Нотариальный акт' }, // 300 ₽
    { value: 3, label: 'Отчёт об оценке' }   // 500 ₽
  ];

  // Цены из mock-требований
  private readonly documentPrices: Record<number, number> = {
    1: 150,  // Выписка
    2: 300,  // Нотариальный акт
    3: 500   // Отчёт об оценке
  };

  selectedDocType = signal<number>(1);
  selectedAssesmentID = signal<string>('');
  assesments = signal<AssessmentOption[]>([]);
  isSubmitting = signal<boolean>(false);
  comment = signal<string>('');
  selectedFile: File | null = null;

  // ─── Поиск заявки (typeahead) ────────────────────────────────────────
  searchQuery = signal<string>('');
  showSuggestions = signal<boolean>(false);

  // Отфильтрованный список заявок по строке поиска (по описанию/адресу/ID).
  readonly filteredAssessments = computed<AssessmentOption[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.assesments();
    if (!query) return all.slice(0, 50);
    return all
      .filter((a) => this.assessmentLabel(a).toLowerCase().includes(query) || a.id.toLowerCase().includes(query))
      .slice(0, 50);
  });

  readonly price = computed(() => {
    const type = this.selectedDocType();
    return this.documentPrices[type] || 0;
  });

  ngOnInit(): void {
    this.loadActiveAssessments();
  }

  // Человекочитаемая подпись заявки для дропдауна.
  assessmentLabel(a: AssessmentOption): string {
    return a.description || a.address || `Заявка #${a.id}`;
  }

  goBackToList() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.goBackToList();
    }
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.goBackToList();
    }
  }

  removeDoc() {
    this.selectedFile = null;
  }

  async loadActiveAssessments() {
    try {
      const data = await this.assessmentService.listAssessments(AssessmentStatus.IN_PROGRESS, { page: 1, limit: 1000 });
      if (data && data.assesments && data.assesments.length > 0) {
        this.assesments.set(data.assesments as AssessmentOption[]);
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  }

  // ─── Обработчики typeahead ───────────────────────────────────────────
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.showSuggestions.set(true);
    // Сбрасываем выбор, если текст больше не соответствует выбранной заявке.
    const selected = this.assesments().find((a) => a.id === this.selectedAssesmentID());
    if (!selected || this.assessmentLabel(selected) !== value) {
      this.selectedAssesmentID.set('');
    }
  }

  onSearchFocus(): void {
    this.showSuggestions.set(true);
  }

  selectAssessment(a: AssessmentOption): void {
    this.selectedAssesmentID.set(a.id);
    this.searchQuery.set(this.assessmentLabel(a));
    this.showSuggestions.set(false);
  }

  onDocumentUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.selectedFile = file;
  }

  getCurrentUserId(): string {
    // uploaded_by_id обязан совпадать с аутентифицированным пользователем
    // (бэкенд отклоняет иное). Заказ создаёт текущий заявитель, поэтому берём
    // его id из TokenStore, а не владельца выбранной заявки.
    return this.tokenStore.user()?.id ?? '';
  }

  async onSubmit() {
    if (!this.selectedFile) return;

    try {
      this.isSubmitting.set(true);

      // Создаём заказ копии (статус по умолчанию — «Ожидает оплаты»).
      // Оплата перенесена на карточку заказа (Copy), здесь оплата не инициируется.
      await this.documentService.createDocument(
        this.selectedAssesmentID(),
        this.selectedFile.name,
        this.selectedFile.type || 'application/octet-stream',
        this.getCurrentUserId(),
        new Uint8Array(await this.selectedFile.arrayBuffer()),
        { comment: this.comment(), price: this.price() },
      );

      // Возврат к списку — оплатить заказ можно из его карточки.
      this.router.navigate(['../'], { relativeTo: this.route });
    } catch (err) {
      console.error('Ошибка при создании заказа копии:', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
