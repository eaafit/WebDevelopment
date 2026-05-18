import { Component, computed, input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Document } from '../../services/document.service';


@Component({
  selector: 'document-row',
  imports: [CommonModule],
  templateUrl: './document-row.html',
  styleUrl: './document-row.scss',
})
export class DocumentRow {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }
  document = input.required<Document>()

  // Используем computed для реактивности
  uploaded = computed(() => {
    const doc = this.document();
    // Безопасно проверяем наличие всех вложенных полей
    if (doc?.uploadedAt?.seconds) {
      return new Date(Number(doc.uploadedAt.seconds) * 1000).toDateString();
    }
    return '-';
  });

  navigateToDocumentPage(): void {
    this.router.navigate([this.document().id], { relativeTo: this.route });
  }

}