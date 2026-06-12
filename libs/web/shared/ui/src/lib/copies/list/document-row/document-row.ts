import { Component, computed, inject, input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Document } from '../../services/document.service';
import { mapCopyStatus } from '../../services/document-status';

@Component({
  selector: 'lib-document-row',
  imports: [CommonModule],
  templateUrl: './document-row.html',
  styleUrl: './document-row.scss',
})
export class DocumentRow {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  document = input.required<Document>()
  // Статус заказа копии (Document.status), не статус заявки.
  status = input<number | undefined>();

  // Единый маппинг статуса в лейбл/цвет/доступность скачивания.
  readonly statusView = computed(() => mapCopyStatus(this.status() ?? this.document().status));

  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  private readonly timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  uploaded = computed(() => {
    const doc = this.document();
    if (doc?.uploadedAt?.seconds) {
      const parsedDate = new Date(Number(doc.uploadedAt.seconds) * 1000);
      
      if (!isNaN(parsedDate.getTime())) {
        return {
          date: this.dateFormatter.format(parsedDate).replace(/\s?г\.$/, ''),
          time: this.timeFormatter.format(parsedDate)
        };
      }
    }
    return null;
  });

  navigateToDocumentPage(): void {
    this.router.navigate([this.document().id], { relativeTo: this.route });
  }
}
