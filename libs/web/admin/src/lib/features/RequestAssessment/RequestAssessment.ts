import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

@Component({
  selector: 'lib-request-assessment',
  imports: [CommonModule, FormsModule],
  templateUrl: './RequestAssessment.html',
  styleUrl: './RequestAssessment.scss',
})
export class RequestAssessment implements OnInit {
  currentView: 'list' | 'detail' = 'list';

  users: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];

  searchTerm = '';
  roleFilter = '';
  statusFilter = '';

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

    if (this.roleFilter) {
      result = result.filter((u) => u.role === this.roleFilter);
    }

    if (this.statusFilter) {
      const isActive = this.statusFilter === 'true';
      result = result.filter((u) => u.isActive === isActive);
    }

    this.filteredUsers = result;
    this.currentPage = 1;
    this.updatePagination();
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
