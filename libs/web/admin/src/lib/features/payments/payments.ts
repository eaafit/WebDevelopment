import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';

interface Payment {
  id: string;
  paymentDate: string;
  payer: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  statusText: string;
  type: 'subscription' | 'assessment' | 'documentCopy';
  typeText: string;
  subscriptionId: string | null;
  assessmentId: string | null;
  paymentMethod: string;
  transactionId: string;
  attachmentFileName: string;
  attachmentFileUrl: string;
}

type SortKey =
  | 'paymentDate'
  | 'payer'
  | 'amount'
  | 'status'
  | 'type'
  | 'paymentMethod'
  | 'assessmentId'
  | 'subscriptionId'
  | 'transactionId'
  | 'attachmentFileName'
  | 'attachmentFileUrl'
  | 'id';

interface ColumnState {
  key: keyof Payment | 'actions';
  label: string;
  visible: boolean;
  width?: number;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

@Component({
  selector: 'lib-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments implements OnDestroy {
  @ViewChild('paymentForm') paymentForm?: NgForm;

  payments: Payment[] = [
    {
      id: 'PMT-1001',
      paymentDate: '2025-03-02',
      payer: 'ООО "Ромашка"',
      amount: 12500.0,
      status: 'completed',
      statusText: 'Завершён',
      type: 'subscription',
      typeText: 'Подписка',
      subscriptionId: '7e2a1b8f-1f2e-4f3c-9d8c-0f14f0ed2b21',
      assessmentId: null,
      paymentMethod: 'Банковская карта',
      transactionId: 'TXN-981245',
      attachmentFileName: 'receipt_1001.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1002',
      paymentDate: '2025-03-05',
      payer: 'ИП Иванов А.А.',
      amount: 5400.5,
      status: 'pending',
      statusText: 'В обработке',
      type: 'assessment',
      typeText: 'Заявка',
      subscriptionId: null,
      assessmentId: 'd6c1e5b0-7d41-4b12-9f0e-4a1fce2845d2',
      paymentMethod: 'СБП',
      transactionId: 'TXN-981672',
      attachmentFileName: 'receipt_1002.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1003',
      paymentDate: '2025-03-13',
      payer: 'Петров В.К.',
      amount: 3200.0,
      status: 'failed',
      statusText: 'Ошибка',
      type: 'documentCopy',
      typeText: 'Копия документа',
      subscriptionId: null,
      assessmentId: '2a8b2b3d-5f9a-4c1b-9c0b-1a05c0db9f3f',
      paymentMethod: 'Карта',
      transactionId: 'TXN-981990',
      attachmentFileName: 'receipt_1003.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1004',
      paymentDate: '2025-03-12',
      payer: 'ООО "ТехноСервис"',
      amount: 8700.75,
      status: 'completed',
      statusText: 'Завершён',
      type: 'assessment',
      typeText: 'Заявка',
      subscriptionId: null,
      assessmentId: 'e13b6a99-2a0b-4b6f-9c90-dad1b33f0b8d',
      paymentMethod: 'Банковская карта',
      transactionId: 'TXN-982110',
      attachmentFileName: 'receipt_1004.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1005',
      paymentDate: '2025-03-11',
      payer: 'Сидорова Е.М.',
      amount: 2100.0,
      status: 'pending',
      statusText: 'В обработке',
      type: 'subscription',
      typeText: 'Подписка',
      subscriptionId: '1a3c0f99-0f02-4e57-a9f4-0ab7e6a6a1d4',
      assessmentId: null,
      paymentMethod: 'ЮMoney',
      transactionId: 'TXN-982301',
      attachmentFileName: 'receipt_1005.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1006',
      paymentDate: '2025-03-10',
      payer: 'Былой Е.М.',
      amount: 21000.0,
      status: 'completed',
      statusText: 'Завершён',
      type: 'assessment',
      typeText: 'Заявка',
      subscriptionId: null,
      assessmentId: 'f7b9c1a5-7237-4b09-a1e0-8d4f1a284c19',
      paymentMethod: 'Банковская карта',
      transactionId: 'TXN-982412',
      attachmentFileName: 'receipt_1006.pdf',
      attachmentFileUrl: '#',
    },
    {
      id: 'PMT-1007',
      paymentDate: '2025-03-09',
      payer: 'Елесей Е.М.',
      amount: 2500.0,
      status: 'failed',
      statusText: 'Ошибка',
      type: 'documentCopy',
      typeText: 'Копия документа',
      subscriptionId: null,
      assessmentId: '9fbb4d57-4ae5-4892-9be1-2e0c11b266d2',
      paymentMethod: 'СБП',
      transactionId: 'TXN-982512',
      attachmentFileName: 'receipt_1007.pdf',
      attachmentFileUrl: '#',
    },
  ];

  columns: ColumnState[] = [
    { key: 'id', label: 'ID', visible: true, width: 110, sortable: true },
    { key: 'paymentDate', label: 'Дата платежа', visible: true, width: 140, sortable: true },
    { key: 'payer', label: 'Плательщик', visible: true, width: 200, sortable: true },
    { key: 'type', label: 'Тип', visible: true, width: 150, sortable: true },
    { key: 'amount', label: 'Сумма', visible: true, width: 130, sortable: true, align: 'right' },
    { key: 'status', label: 'Статус', visible: true, width: 140, sortable: true },
    { key: 'paymentMethod', label: 'Метод оплаты', visible: true, width: 170, sortable: true },
    { key: 'assessmentId', label: 'Заявка', visible: true, width: 220, sortable: true },
    { key: 'subscriptionId', label: 'Подписка', visible: false, width: 220, sortable: true },
    { key: 'transactionId', label: 'TransactionId', visible: true, width: 170, sortable: true },
    { key: 'attachmentFileName', label: 'Чек', visible: true, width: 180, sortable: true },
    { key: 'attachmentFileUrl', label: 'Ссылка на чек', visible: true, width: 180, sortable: true },
    { key: 'actions', label: 'Действия', visible: true, width: 150, align: 'center' },
  ];

  searchTerm = '';
  statusFilter: '' | Payment['status'] = '';
  typeFilter: '' | Payment['type'] = '';
  dateFrom = '';
  dateTo = '';

  sortKey: SortKey = 'paymentDate';
  sortDir: 'asc' | 'desc' = 'desc';

  fee = 0;
  readonly today: string = new Date().toISOString().split('T')[0];

  pageSize = 7;
  currentPage = 1;

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;
  showColumnsPanel = false;

  currentPayment: Payment = this.resetPayment();

  private router = inject(Router);

  private resizing: {
    key: ColumnState['key'];
    startX: number;
    startWidth: number;
  } | null = null;

  private handleResizeMove = (event: MouseEvent): void => {
    if (!this.resizing) return;
    const delta = event.clientX - this.resizing.startX;
    const nextWidth = Math.max(90, this.resizing.startWidth + delta);
    const column = this.columns.find((col) => col.key === this.resizing?.key);
    if (column) column.width = nextWidth;
  };

  private handleResizeEnd = (): void => {
    if (!this.resizing) return;
    this.resizing = null;
    window.removeEventListener('mousemove', this.handleResizeMove);
    window.removeEventListener('mouseup', this.handleResizeEnd);
  };

  ngOnDestroy(): void {
    this.handleResizeEnd();
  }

  get visibleColumns(): ColumnState[] {
    return this.columns.filter((column) => column.visible);
  }

  get filteredPayments(): Payment[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.payments.filter((p) => {
      const matchesStatus = !this.statusFilter || p.status === this.statusFilter;
      const matchesType = !this.typeFilter || p.type === this.typeFilter;
      const matchesTerm =
        !term ||
        p.payer.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        p.transactionId.toLowerCase().includes(term);
      const matchesFrom = !this.dateFrom || p.paymentDate >= this.dateFrom;
      const matchesTo = !this.dateTo || p.paymentDate <= this.dateTo;

      return matchesStatus && matchesType && matchesTerm && matchesFrom && matchesTo;
    });
  }

  get sortedPayments(): Payment[] {
    const payments = [...this.filteredPayments];
    const key = this.sortKey;
    const dir = this.sortDir === 'asc' ? 1 : -1;

    payments.sort((a, b) => {
      const aValue = this.getSortValue(a, key);
      const bValue = this.getSortValue(b, key);
      if (aValue > bValue) return dir;
      if (aValue < bValue) return -dir;
      return 0;
    });

    return payments;
  }

  get paginatedPayments(): Payment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.sortedPayments.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedPayments.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage(): void {
    this.setPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage + 1);
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
  }

  toggleColumnsPanel(): void {
    this.showColumnsPanel = !this.showColumnsPanel;
  }

  toggleColumn(column: ColumnState): void {
    column.visible = !column.visible;
  }

  startResize(event: MouseEvent, key: ColumnState['key']): void {
    event.preventDefault();
    event.stopPropagation();
    const column = this.columns.find((col) => col.key === key);
    if (!column) return;
    this.resizing = {
      key,
      startX: event.clientX,
      startWidth: column.width ?? 120,
    };
    window.addEventListener('mousemove', this.handleResizeMove);
    window.addEventListener('mouseup', this.handleResizeEnd);
  }

  sortBy(column: ColumnState): void {
    if (!column.sortable || column.key === 'actions') return;
    const key = column.key as SortKey;
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.sortKey = key;
    this.sortDir = 'asc';
  }

  getSortIcon(column: ColumnState): string {
    if (column.key !== this.sortKey) return 'las la-sort';
    return this.sortDir === 'asc' ? 'las la-sort-up' : 'las la-sort-down';
  }

  getColumnValue(payment: Payment, column: ColumnState): string | number | null {
    if (column.key === 'actions') return '';
    const key = column.key as keyof Payment;
    const value = payment[key];
    if (key === 'type') return payment.typeText;
    if (key === 'status') return payment.statusText;
    if (key === 'paymentDate') return new Date(payment.paymentDate).toLocaleDateString('ru-RU');
    if (key === 'amount') return payment.amount;
    if (value === null || value === undefined || value === '') return '—';
    return value as string | number;
  }

  openCreateModal(): void {
    this.closeModals();
    this.isEditMode = false;
    this.paymentForm?.resetForm();
    this.currentPayment = this.resetPayment();
    const nextId = Math.max(...this.payments.map((p) => Number(p.id.split('-')[1]) || 0), 0) + 1;
    this.currentPayment.id = `PMT-${nextId}`;
    this.fee = 0;
    this.isCreateEditModalOpen = true;
  }

  openEditModal(payment: Payment): void {
    this.closeModals();
    this.isEditMode = true;
    this.paymentForm?.resetForm();
    this.currentPayment = { ...payment };
    this.fee = 0;
    this.isCreateEditModalOpen = true;
  }

  openViewModal(payment: Payment): void {
    this.closeModals();
    this.currentPayment = { ...payment };
    this.isViewModalOpen = true;
  }

  openDeleteModal(payment: Payment): void {
    this.closeModals();
    this.currentPayment = { ...payment };
    this.isDeleteModalOpen = true;
  }

  closeModals(): void {
    this.isCreateEditModalOpen = false;
    this.isViewModalOpen = false;
    this.isDeleteModalOpen = false;
  }

  onModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModals();
    }
  }

  onBackdropKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModals();
    }
  }

  savePayment(): void {
    this.currentPayment.statusText = this.getStatusText(this.currentPayment.status);
    this.currentPayment.typeText = this.getTypeText(this.currentPayment.type);
    if (this.isEditMode) {
      const index = this.payments.findIndex((p) => p.id === this.currentPayment.id);
      if (index !== -1) this.payments[index] = { ...this.currentPayment };
    } else {
      this.payments.push({ ...this.currentPayment });
    }
    this.closeModals();
  }

  deletePayment(): void {
    this.payments = this.payments.filter((p) => p.id !== this.currentPayment.id);
    this.closeModals();
  }

  private getStatusText(status: Payment['status']): string {
    switch (status) {
      case 'completed':
        return 'Завершён';
      case 'pending':
        return 'В обработке';
      case 'failed':
        return 'Ошибка';
      default:
        return '';
    }
  }

  private getTypeText(type: Payment['type']): string {
    switch (type) {
      case 'subscription':
        return 'Подписка';
      case 'assessment':
        return 'Заявка';
      case 'documentCopy':
        return 'Копия документа';
      default:
        return '';
    }
  }

  private getSortValue(payment: Payment, key: SortKey): string | number {
    switch (key) {
      case 'paymentDate':
        return payment.paymentDate;
      case 'amount':
        return payment.amount;
      case 'status':
        return payment.statusText;
      case 'type':
        return payment.typeText;
      case 'assessmentId':
        return payment.assessmentId ?? '';
      case 'subscriptionId':
        return payment.subscriptionId ?? '';
      case 'attachmentFileName':
        return payment.attachmentFileName;
      case 'attachmentFileUrl':
        return payment.attachmentFileUrl;
      case 'transactionId':
        return payment.transactionId;
      case 'paymentMethod':
        return payment.paymentMethod;
      case 'payer':
        return payment.payer;
      default:
        return payment.id;
    }
  }

  private resetPayment(): Payment {
    return {
      id: '',
      paymentDate: this.today,
      payer: '',
      amount: 0,
      status: 'pending',
      statusText: 'В обработке',
      type: 'assessment',
      typeText: 'Заявка',
      subscriptionId: null,
      assessmentId: null,
      paymentMethod: '',
      transactionId: '',
      attachmentFileName: '',
      attachmentFileUrl: '',
    };
  }

  goToAssessment(payment?: Payment): void {
    const extras = payment?.assessmentId
      ? { queryParams: { id: payment.assessmentId } }
      : undefined;
    this.router.navigate(['/admin', 'orders'], extras);
  }

  goToTransactions(payment?: Payment): void {
    const extras = payment ? { queryParams: { paymentId: payment.id } } : undefined;
    this.router.navigate(['/admin', 'transactions'], extras);
  }
}
