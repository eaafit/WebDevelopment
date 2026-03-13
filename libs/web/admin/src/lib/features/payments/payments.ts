import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';

interface Payment {
  id: number;
  date: string;
  payer: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  statusText: string;
}

@Component({
  selector: 'lib-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  @ViewChild('paymentForm') paymentForm?: NgForm;

  payments: Payment[] = [
    {
      id: 1001,
      date: '2025-03-02',
      payer: 'ООО "Ромашка"',
      amount: 12500.0,
      status: 'completed',
      statusText: 'Завершён',
    },
    {
      id: 1002,
      date: '2025-03-05',
      payer: 'ИП Иванов А.А.',
      amount: 5400.5,
      status: 'pending',
      statusText: 'В обработке',
    },
    {
      id: 1003,
      date: '2025-03-13',
      payer: 'Петров В.К.',
      amount: 3200.0,
      status: 'failed',
      statusText: 'Ошибка',
    },
    {
      id: 1004,
      date: '2025-03-12',
      payer: 'ООО "ТехноСервис"',
      amount: 8700.75,
      status: 'completed',
      statusText: 'Завершён',
    },
    {
      id: 1005,
      date: '2025-03-11',
      payer: 'Сидорова Е.М.',
      amount: 2100.0,
      status: 'pending',
      statusText: 'В обработке',
    },
    {
      id: 1006,
      date: '2025-03-10',
      payer: 'Былой Е.М.',
      amount: 21000.0,
      status: 'completed',
      statusText: 'Завершён',
    },
    {
      id: 1007,
      date: '2025-03-09',
      payer: 'Елесей Е.М.',
      amount: 2500.0,
      status: 'failed',
      statusText: 'Ошибка',
    },
  ];

  searchTerm = '';
  statusFilter: '' | Payment['status'] = '';

  fee = 0;

  // Текущая дата в формате YYYY-MM-DD, чтобы запретить выбор будущей даты.
  readonly today: string = new Date().toISOString().split('T')[0];

  // Количество записей на одной странице. Если нужно больше/меньше строк - меняем только это число.
  pageSize = 7;
  currentPage = 1;

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;
  currentPayment: Payment = this.resetPayment();

  constructor(private router: Router) {}

  get filteredPayments(): Payment[] {
    const term = this.searchTerm.trim().toLowerCase();
    const status = this.statusFilter;

    return this.payments.filter((p) => {
      const matchesStatus = !status || p.status === status;
      const matchesTerm =
        !term || p.payer.toLowerCase().includes(term) || p.id.toString().includes(term);

      return matchesStatus && matchesTerm;
    });
  }

  // Массив платежей, ограниченный текущей страницей.
  get paginatedPayments(): Payment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredPayments.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPayments.length / this.pageSize));
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
    // При изменении фильтров всегда возвращаемся на первую страницу.
    this.currentPage = 1;
  }

  private resetPayment(): Payment {
    return {
      id: 0,
      date: this.today,
      payer: '',
      amount: 0,
      status: 'pending',
      statusText: 'В обработке',
    };
  }

  openCreateModal(): void {
    this.closeModals();
    this.isEditMode = false;
    this.paymentForm?.resetForm();
    this.currentPayment = this.resetPayment();
    this.currentPayment.id = Math.max(...this.payments.map((p) => p.id), 0) + 1;
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

  private getStatusText(status: string): string {
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

  goToTransactions(payment?: Payment): void {
    const extras = payment ? { queryParams: { paymentId: payment.id } } : undefined;

    this.router.navigate(['/admin', 'transactions'], extras);
  }
}
