import { Component, input } from '@angular/core';
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
}