import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phoneNumber: string;
  role: 'Applicant' | 'Notary' | 'Admin';
  subscriptionPlan: 'Basic' | 'Premium' | 'Enterprise';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type UserFilterColumn =
  | 'fullName'
  | 'email'
  | 'phoneNumber'
  | 'role'
  | 'isActive'
  | 'createdAt'
  | 'actions';

@Component({
  selector: 'lib-request-assessment',
  imports: [CommonModule, FormsModule],
  templateUrl: './RequestAssessment.html',
  styleUrl: './RequestAssessment.scss',
})
export class RequestAssessment implements OnInit, OnDestroy {
  currentView: 'list' | 'detail' = 'list';

  users: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];

  searchTerm = '';
  private searchSubject$ = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly headerColumns: { key: UserFilterColumn; label: string }[] = [
    { key: 'fullName', label: 'ФИО' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Телефон' },
    { key: 'role', label: 'Роль' },
    { key: 'isActive', label: 'Статус' },
    { key: 'createdAt', label: 'Дата регистрации' },
    { key: 'actions', label: 'Действия' },
  ];

  activeFilterColumn: UserFilterColumn | null = null;
  columnSelectedValues: Record<UserFilterColumn, string[]> = {
    fullName: [],
    email: [],
    phoneNumber: [],
    role: [],
    isActive: [],
    createdAt: [],
    actions: [],
  };
  currentSortColumn: UserFilterColumn | null = null;
  currentSortDirection: '' | 'asc' | 'desc' = '';
  filterSearch = '';
  filterSortDraft: '' | 'asc' | 'desc' = '';
  filterSelectedDraft = new Set<string>();

  currentPage = 1;
  usersPerPage = 10;
  totalPages = 0;
  pages: number[] = [];

  selectedUser: User | null = null;

  showUserModal = false;
  isEditing = false;
  formData: Partial<User> = {};
  formErrors: Record<string, string> = {};

  showDeleteModal = false;
  userToDelete: User | null = null;

  readonly roleLabels: Record<string, string> = {
    Applicant: 'Заявитель',
    Notary: 'Нотариус',
    Admin: 'Администратор',
  };

  readonly roleBadgeClasses: Record<string, string> = {
    Applicant: 'badge-primary',
    Notary: 'badge-warning',
    Admin: 'badge-info',
  };

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject$.pipe(debounceTime(300)).subscribe(() => {
      this.applyFilters();
    });
    this.initializeData();
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchSubject$.next(value);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private initializeData(): void {
    const existing = localStorage.getItem('users');
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.length > 0 && parsed[0].fullName !== undefined) {
        localStorage.removeItem('users');
      }
    }

    if (!localStorage.getItem('users')) {
      const testUsers: User[] = [
        {
          id: this.generateUUID(),
          firstName: 'Иван',
          lastName: 'Иванов',
          middleName: 'Иванович',
          email: 'ivanov@example.com',
          phoneNumber: '+7 (999) 123-45-67',
          role: 'Applicant',
          subscriptionPlan: 'Basic',
          isActive: true,
          createdAt: '2024-01-15T10:30:00',
          updatedAt: '2024-01-15T10:30:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Мария',
          lastName: 'Петрова',
          middleName: 'Сергеевна',
          email: 'petrova@example.com',
          phoneNumber: '+7 (999) 234-56-78',
          role: 'Notary',
          subscriptionPlan: 'Premium',
          isActive: true,
          createdAt: '2024-01-20T14:20:00',
          updatedAt: '2024-02-01T09:15:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Алексей',
          lastName: 'Сидоров',
          middleName: 'Петрович',
          email: 'sidorov@example.com',
          phoneNumber: '+7 (999) 345-67-89',
          role: 'Admin',
          subscriptionPlan: 'Enterprise',
          isActive: true,
          createdAt: '2024-02-01T11:45:00',
          updatedAt: '2024-02-01T11:45:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Елена',
          lastName: 'Козлова',
          middleName: 'Викторовна',
          email: 'kozlova@example.com',
          phoneNumber: '+7 (999) 456-78-90',
          role: 'Applicant',
          subscriptionPlan: 'Basic',
          isActive: false,
          createdAt: '2024-02-05T16:00:00',
          updatedAt: '2024-02-10T12:30:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Дмитрий',
          lastName: 'Новиков',
          middleName: 'Александрович',
          email: 'novikov@example.com',
          phoneNumber: '+7 (999) 567-89-01',
          role: 'Notary',
          subscriptionPlan: 'Premium',
          isActive: true,
          createdAt: '2024-02-08T09:15:00',
          updatedAt: '2024-02-08T09:15:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Ольга',
          lastName: 'Васильева',
          middleName: 'Михайловна',
          email: 'vasilieva@example.com',
          phoneNumber: '+7 (999) 678-90-12',
          role: 'Applicant',
          subscriptionPlan: 'Enterprise',
          isActive: true,
          createdAt: '2024-02-12T13:45:00',
          updatedAt: '2024-02-12T13:45:00',
        },
        {
          id: this.generateUUID(),
          firstName: 'Сергей',
          lastName: 'Морозов',
          middleName: 'Владимирович',
          email: 'morozov@example.com',
          phoneNumber: '+7 (999) 789-01-23',
          role: 'Notary',
          subscriptionPlan: 'Basic',
          isActive: false,
          createdAt: '2024-02-15T10:00:00',
          updatedAt: '2024-02-20T15:20:00',
        },
      ];
      localStorage.setItem('users', JSON.stringify(testUsers));
    }

    this.users = JSON.parse(localStorage.getItem('users') ?? '[]');
  }

  private saveToStorage(): void {
    localStorage.setItem('users', JSON.stringify(this.users));
  }

  // ========== ФИЛЬТРАЦИЯ И ПАГИНАЦИЯ ==========

  applyFilters(): void {
    let result = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          this.getFullName(u).toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
      );
    }

    result = result.filter((u) => this.matchesColumnFilters(u));
    result.sort((a, b) => this.compareByActiveSort(a, b));

    this.filteredUsers = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  // ========== COLUMN FILTER ==========

  toggleColumnFilter(column: UserFilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) {
      this.activeFilterColumn = null;
      return;
    }
    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);
  }

  closeColumnFilter(): void {
    this.activeFilterColumn = null;
  }

  setDraftSort(direction: 'asc' | 'desc'): void {
    this.filterSortDraft = direction;
  }

  clearCurrentColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    this.columnSelectedValues[this.activeFilterColumn] = [];
    if (this.currentSortColumn === this.activeFilterColumn) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
      this.filterSortDraft = '';
    }
    this.filterSearch = '';
    this.filterSelectedDraft = new Set(this.getUniqueColumnValues(this.activeFilterColumn));
    this.currentPage = 1;
  }

  get filterValues(): string[] {
    if (!this.activeFilterColumn) return [];
    const all = this.getUniqueColumnValues(this.activeFilterColumn);
    const term = this.filterSearch.trim().toLowerCase();
    if (!term) return all;
    return all.filter((v) => v.toLowerCase().includes(term));
  }

  isValueChecked(value: string): boolean {
    return this.filterSelectedDraft.has(value);
  }

  get isAllChecked(): boolean {
    const values = this.filterValues;
    if (!values.length) return false;
    return values.every((v) => this.filterSelectedDraft.has(v));
  }

  onToggleAllChange(event: Event): void {
    const checked = !!(event.target as HTMLInputElement | null)?.checked;
    for (const v of this.filterValues) {
      if (checked) this.filterSelectedDraft.add(v);
      else this.filterSelectedDraft.delete(v);
    }
  }

  onToggleValueChange(value: string, event: Event): void {
    const checked = !!(event.target as HTMLInputElement | null)?.checked;
    if (checked) this.filterSelectedDraft.add(value);
    else this.filterSelectedDraft.delete(value);
  }

  applyColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    const column = this.activeFilterColumn;
    const allValues = this.getUniqueColumnValues(column);
    const selected = allValues.filter((v) => this.filterSelectedDraft.has(v));
    this.columnSelectedValues[column] = selected.length === allValues.length ? [] : selected;
    if (this.filterSortDraft) {
      this.currentSortColumn = column;
      this.currentSortDirection = this.filterSortDraft;
    } else if (this.currentSortColumn === column) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
    }
    this.closeColumnFilter();
    this.applyFilters();
  }

  cancelColumnFilter(): void {
    this.closeColumnFilter();
  }

  isSortDraftActive(direction: 'asc' | 'desc'): boolean {
    return this.filterSortDraft === direction;
  }

  getCellValue(user: User, column: UserFilterColumn): string {
    switch (column) {
      case 'fullName':
        return this.getFullName(user);
      case 'email':
        return user.email;
      case 'phoneNumber':
        return user.phoneNumber;
      case 'role':
        return this.getRoleLabel(user.role);
      case 'isActive':
        return user.isActive ? 'Активен' : 'Заблокирован';
      case 'createdAt':
        return this.formatDate(user.createdAt);
      case 'actions':
        return '';
      default:
        return '';
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeColumnFilter();
  }

  private matchesColumnFilters(user: User): boolean {
    for (const col of this.headerColumns.map((c) => c.key)) {
      const selected = this.columnSelectedValues[col];
      if (!selected.length) continue;
      const value = this.getCellValue(user, col);
      if (!selected.includes(value)) return false;
    }
    return true;
  }

  private getUniqueColumnValues(column: UserFilterColumn): string[] {
    const values = new Set<string>();
    for (const user of this.users) {
      values.add(this.getCellValue(user, column));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(a: User, b: User): number {
    if (!this.currentSortColumn || !this.currentSortDirection) return 0;
    const left = this.getCellValue(a, this.currentSortColumn);
    const right = this.getCellValue(b, this.currentSortColumn);
    const result = left.localeCompare(right, 'ru', { numeric: true });
    return this.currentSortDirection === 'asc' ? result : -result;
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
    const start = (this.currentPage - 1) * this.usersPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, start + this.usersPerPage);
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

  getFullName(user: User): string {
    return `${user.lastName} ${user.firstName} ${user.middleName}`;
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

  getRoleLabel(role: string): string {
    return this.roleLabels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    return this.roleBadgeClasses[role] || 'badge-primary';
  }

  // ========== НАВИГАЦИЯ ==========

  viewUser(user: User): void {
    this.selectedUser = user;
    this.currentView = 'detail';
  }

  backToList(): void {
    this.selectedUser = null;
    this.currentView = 'list';
  }

  // ========== СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ==========

  openCreateModal(): void {
    this.isEditing = false;
    this.formData = { isActive: true };
    this.formErrors = {};
    this.showUserModal = true;
  }

  openEditModal(user: User): void {
    this.isEditing = true;
    this.formData = { ...user };
    this.formErrors = {};
    this.showUserModal = true;
  }

  editFromView(): void {
    if (this.selectedUser) {
      this.openEditModal(this.selectedUser);
    }
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.formErrors = {};
  }

  saveUser(): void {
    if (!this.validateForm()) return;

    if (this.isEditing && this.formData.id) {
      const index = this.users.findIndex((u) => u.id === this.formData.id);
      if (index !== -1) {
        this.users[index] = {
          ...this.users[index],
          ...(this.formData as User),
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      const newUser: User = {
        id: this.generateUUID(),
        firstName: this.formData.firstName || '',
        lastName: this.formData.lastName || '',
        middleName: this.formData.middleName || '',
        email: this.formData.email || '',
        phoneNumber: this.formData.phoneNumber || '',
        role: (this.formData.role as User['role']) || 'Applicant',
        subscriptionPlan: (this.formData.subscriptionPlan as User['subscriptionPlan']) || 'Basic',
        isActive: this.formData.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.push(newUser);
    }

    this.saveToStorage();
    this.closeUserModal();
    this.applyFilters();
    this.currentView = 'list';
  }

  // ========== УДАЛЕНИЕ ==========

  openDeleteModal(user: User): void {
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  deleteFromView(): void {
    if (this.selectedUser) {
      this.openDeleteModal(this.selectedUser);
    }
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;
    const deleteId = this.userToDelete?.id;
    this.users = this.users.filter((u) => u.id !== deleteId);
    this.saveToStorage();
    this.closeDeleteModal();
    this.applyFilters();
    this.currentView = 'list';
    this.selectedUser = null;
  }

  // ========== ВАЛИДАЦИЯ ==========

  private validateForm(): boolean {
    this.formErrors = {};
    let valid = true;

    if (!this.formData.lastName?.trim()) {
      this.formErrors['lastName'] = 'Поле обязательно для заполнения';
      valid = false;
    }
    if (!this.formData.firstName?.trim()) {
      this.formErrors['firstName'] = 'Поле обязательно для заполнения';
      valid = false;
    }
    if (!this.formData.middleName?.trim()) {
      this.formErrors['middleName'] = 'Поле обязательно для заполнения';
      valid = false;
    }

    const email = this.formData.email?.trim() || '';
    if (!email) {
      this.formErrors['email'] = 'Поле обязательно для заполнения';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.formErrors['email'] = 'Введите корректный email';
      valid = false;
    } else {
      const duplicate = this.users.find((u) => u.email === email && u.id !== this.formData.id);
      if (duplicate) {
        this.formErrors['email'] = 'Пользователь с таким email уже существует';
        valid = false;
      }
    }

    if (!this.formData.phoneNumber?.trim()) {
      this.formErrors['phoneNumber'] = 'Поле обязательно для заполнения';
      valid = false;
    }
    if (!this.formData.role) {
      this.formErrors['role'] = 'Выберите роль';
      valid = false;
    }
    if (!this.formData.subscriptionPlan) {
      this.formErrors['subscriptionPlan'] = 'Выберите план подписки';
      valid = false;
    }

    return valid;
  }

  onStatusToggle(): void {
    this.formData.isActive = !this.formData.isActive;
  }
}
