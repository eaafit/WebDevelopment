import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'pagination',
  imports: [CommonModule],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  hasPrev = input.required<boolean>();
  hasNext = input.required<boolean>();
  current = input.required<number>();
  totalPages = input.required<number>();
  goToPrev = input.required<() => void>();
  goToNext = input.required<() => void>();

  // ⚙️ Новые параметры для настройки лимита страниц
  pageSize = input.required<number>();
  pageSizeChange = output<number>();

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSizeChange.emit(Number(select.value));
  }
}