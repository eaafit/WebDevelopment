import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Transaction {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  amount: number;
  fee: number;
  status: 'completed' | 'pending' | 'failed';
  statusText: string;
}

@Component({
  selector: 'lib-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions {
  transactions: Transaction[] = [
    {
      id: 5001,
      date: '2025-03-15',
      sender: 'ООО "Ромашка"',
      recipient: 'ИП Иванов',
      amount: 12500,
      fee: 125,
      status: 'completed',
      statusText: 'Успешно',
    },
    {
      id: 5002,
      date: '2025-03-14',
      sender: 'Петров В.К.',
      recipient: 'Сидорова Е.М.',
      amount: 5400.5,
      fee: 54,
      status: 'pending',
      statusText: 'В обработке',
    },
    {
      id: 5003,
      date: '2025-03-13',
      sender: 'ООО "ТехноСервис"',
      recipient: 'ООО "Ромашка"',
      amount: 8700.75,
      fee: 87,
      status: 'failed',
      statusText: 'Ошибка',
    },
  ];

  searchTerm = '';
  statusFilter: '' | Transaction['status'] = '';

  // Текущая дата в формате YYYY-MM-DD, чтобы запретить выбор будущей даты.
  readonly today: string = new Date().toISOString().split('T')[0];

  // Количество записей на одной странице. Если нужно больше/меньше строк - меняем только это число.
  pageSize = 7;
  currentPage = 1;

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;
  currentTransaction: Transaction = this.resetTransaction();

  constructor(private router: Router) {}

  get filteredTransactions(): Transaction[] {
    const term = this.searchTerm.trim().toLowerCase();
    const status = this.statusFilter;

    return this.transactions.filter((t) => {
      const matchesStatus = !status || t.status === status;
      const matchesTerm =
        !term || t.sender.toLowerCase().includes(term) || t.id.toString().includes(term);

      return matchesStatus && matchesTerm;
    });
  }

  // Массив транзакций, ограниченный текущей страницей.
  get paginatedTransactions(): Transaction[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredTransactions.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTransactions.length / this.pageSize));
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

  private resetTransaction(): Transaction {
    return {
      id: 0,
      date: this.today,
      sender: '',
      recipient: '',
      amount: 0,
      fee: 0,
      status: 'pending',
      statusText: 'В обработке',
    };
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.currentTransaction = this.resetTransaction();
    this.currentTransaction.id = Math.max(...this.transactions.map((t) => t.id), 0) + 1;
    this.isCreateEditModalOpen = true;
  }

  openEditModal(tx: Transaction): void {
    this.isEditMode = true;
    this.currentTransaction = { ...tx };
    this.isCreateEditModalOpen = true;
  }

  openViewModal(tx: Transaction): void {
    this.currentTransaction = { ...tx };
    this.isViewModalOpen = true;
  }

  openDeleteModal(tx: Transaction): void {
    this.currentTransaction = { ...tx };
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

  saveTransaction(): void {
    this.currentTransaction.statusText = this.getStatusText(this.currentTransaction.status);
    if (this.isEditMode) {
      const index = this.transactions.findIndex((t) => t.id === this.currentTransaction.id);
      if (index !== -1) this.transactions[index] = { ...this.currentTransaction };
    } else {
      this.transactions.push({ ...this.currentTransaction });
    }
    this.closeModals();
  }

  deleteTransaction(): void {
    this.transactions = this.transactions.filter((t) => t.id !== this.currentTransaction.id);
    this.closeModals();
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'completed':
        return 'Успешно';
      case 'pending':
        return 'В обработке';
      case 'failed':
        return 'Ошибка';
      default:
        return '';
    }
  }

  goToPayments(): void {
    this.router.navigate(['/admin', 'payments']);
  }
}
