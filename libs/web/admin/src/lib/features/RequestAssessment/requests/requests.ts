import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AssessmentItem {
  id: string;
  userId: string;
  applicantName: string;
  status: 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';
  address: string;
  description: string;
  estimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'lib-requests',
  imports: [CommonModule, FormsModule],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class RequestsComponent implements OnInit {
  assessments: AssessmentItem[] = [];
  filteredAssessments: AssessmentItem[] = [];
  paginatedAssessments: AssessmentItem[] = [];

  searchTerm = '';
  statusFilter = '';

  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  pages: number[] = [];

  showView = false;
  selectedAssessment: AssessmentItem | null = null;

  showCancelModal = false;
  assessmentToCancel: AssessmentItem | null = null;
  cancelReason = '';
  cancelReasonError = '';

  showVerifyModal = false;
  assessmentToVerify: AssessmentItem | null = null;
  notaryId = '';
  notaryIdError = '';

  readonly statusLabels: Record<string, string> = {
    New: 'Новая',
    Verified: 'Подтверждена',
    InProgress: 'В работе',
    Completed: 'Завершена',
    Cancelled: 'Отменена',
  };

  readonly statusBadgeClasses: Record<string, string> = {
    New: 'badge-primary',
    Verified: 'badge-info',
    InProgress: 'badge-warning',
    Completed: 'badge-success',
    Cancelled: 'badge-danger',
  };

  ngOnInit(): void {
    this.initializeData();
    this.applyFilters();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private initializeData(): void {
    if (!localStorage.getItem('assessments')) {
      const testData: AssessmentItem[] = [
        {
          id: this.generateUUID(),
          userId: 'user-001',
          applicantName: 'Иванов Иван Иванович',
          status: 'New',
          address: 'г. Москва, ул. Тверская, д. 12, кв. 45',
          description: 'Оценка жилого помещения для ипотечного кредитования',
          estimatedValue: '',
          createdAt: '2024-03-01T10:00:00',
          updatedAt: '2024-03-01T10:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-002',
          applicantName: 'Петрова Мария Сергеевна',
          status: 'Verified',
          address: 'г. Санкт-Петербург, Невский пр., д. 78, кв. 3',
          description: 'Оценка коммерческой недвижимости для продажи',
          estimatedValue: '',
          createdAt: '2024-03-05T14:30:00',
          updatedAt: '2024-03-06T09:15:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-003',
          applicantName: 'Сидоров Алексей Петрович',
          status: 'InProgress',
          address: 'г. Казань, ул. Баумана, д. 33',
          description: 'Оценка земельного участка под строительство',
          estimatedValue: '4500000',
          createdAt: '2024-02-20T11:45:00',
          updatedAt: '2024-03-10T16:20:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-004',
          applicantName: 'Козлова Елена Викторовна',
          status: 'Completed',
          address: 'г. Екатеринбург, ул. Ленина, д. 5, кв. 12',
          description: 'Оценка квартиры для наследственного дела',
          estimatedValue: '3200000',
          createdAt: '2024-02-10T09:00:00',
          updatedAt: '2024-03-01T14:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-005',
          applicantName: 'Новиков Дмитрий Александрович',
          status: 'Cancelled',
          address: 'г. Новосибирск, ул. Красный пр., д. 100',
          description: 'Оценка нежилого помещения',
          estimatedValue: '',
          createdAt: '2024-02-15T16:30:00',
          updatedAt: '2024-02-18T10:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-006',
          applicantName: 'Васильева Ольга Михайловна',
          status: 'New',
          address: 'г. Нижний Новгород, ул. Горького, д. 22, кв. 8',
          description: 'Оценка жилого дома для раздела имущества',
          estimatedValue: '',
          createdAt: '2024-03-12T08:15:00',
          updatedAt: '2024-03-12T08:15:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-007',
          applicantName: 'Морозов Сергей Владимирович',
          status: 'InProgress',
          address: 'г. Краснодар, ул. Красная, д. 55',
          description: 'Оценка гаражного помещения',
          estimatedValue: '1800000',
          createdAt: '2024-03-08T13:00:00',
          updatedAt: '2024-03-11T11:30:00',
        },
      ];
      localStorage.setItem('assessments', JSON.stringify(testData));
    }

    this.assessments = JSON.parse(localStorage.getItem('assessments') ?? '[]');
  }

  private saveToStorage(): void {
    localStorage.setItem('assessments', JSON.stringify(this.assessments));
  }

  // ========== ФИЛЬТРАЦИЯ И СОРТИРОВКА ==========

  applyFilters(): void {
    let result = [...this.assessments];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.address.toLowerCase().includes(term) ||
          a.applicantName.toLowerCase().includes(term) ||
          a.id.toLowerCase().includes(term),
      );
    }

    if (this.statusFilter) {
      result = result.filter((a) => a.status === this.statusFilter);
    }

    if (this.sortColumn) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (this.sortColumn) {
          case 'address':
            cmp = a.address.localeCompare(b.address, 'ru');
            break;
          case 'applicantName':
            cmp = a.applicantName.localeCompare(b.applicantName, 'ru');
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
          case 'createdAt':
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'estimatedValue': {
            const va = parseFloat(a.estimatedValue) || 0;
            const vb = parseFloat(b.estimatedValue) || 0;
            cmp = va - vb;
            break;
          }
        }
        return this.sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    this.filteredAssessments = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIndicator(column: string): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredAssessments.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedAssessments = this.filteredAssessments.slice(start, start + this.itemsPerPage);
    this.buildPages();
  }

  private buildPages(): void {
    this.pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      if (
        i === 1 ||
        i === this.totalPages ||
        (i >= this.currentPage - 1 && i <= this.currentPage + 1)
      ) {
        this.pages.push(i);
      } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
        this.pages.push(-1);
      }
    }
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  // ========== ХЕЛПЕРЫ ==========

  getShortId(id: string): string {
    return id.substring(0, 8);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatValue(value: string): string {
    if (!value) return 'Не определена';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    return this.statusBadgeClasses[status] || 'badge-primary';
  }

  // ========== НАВИГАЦИЯ ==========

  viewAssessment(item: AssessmentItem): void {
    this.selectedAssessment = item;
    this.showView = true;
  }

  closeView(): void {
    this.selectedAssessment = null;
    this.showView = false;
  }

  // ========== ОТМЕНА ЗАЯВКИ ==========

  openCancelModal(item: AssessmentItem): void {
    this.assessmentToCancel = item;
    this.cancelReason = '';
    this.cancelReasonError = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.assessmentToCancel = null;
    this.cancelReason = '';
    this.cancelReasonError = '';
  }

  confirmCancel(): void {
    if (!this.cancelReason.trim()) {
      this.cancelReasonError = 'Укажите причину отмены';
      return;
    }
    if (!this.assessmentToCancel) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToCancel?.id);
    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'Cancelled',
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeCancelModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }

  // ========== ВЗЯТЬ В РАБОТУ ==========

  openVerifyModal(item: AssessmentItem): void {
    this.assessmentToVerify = item;
    this.notaryId = '';
    this.notaryIdError = '';
    this.showVerifyModal = true;
  }

  closeVerifyModal(): void {
    this.showVerifyModal = false;
    this.assessmentToVerify = null;
    this.notaryId = '';
    this.notaryIdError = '';
  }

  confirmVerify(): void {
    if (!this.notaryId.trim()) {
      this.notaryIdError = 'Укажите ID нотариуса';
      return;
    }
    if (!this.assessmentToVerify) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToVerify?.id);
    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'Verified',
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeVerifyModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }
}
