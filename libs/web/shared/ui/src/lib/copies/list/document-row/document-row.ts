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
  status = input<number | undefined>();

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

  getMappedStatus(statusValue: number | undefined): string {
    if (statusValue === undefined) return 'pending';
    if (statusValue === 1) return 'pending';
    if (statusValue === 4) return 'ready';
    if (statusValue === 5) return 'delivered';
    return 'processing';
  }

  getStatusText(statusValue: number | undefined): string {
    const mapped = this.getMappedStatus(statusValue);
    const texts: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'processing': 'В обработке',
      'ready': 'Готово',
      'delivered': 'Выдано'
    };
    return texts[mapped] || 'В обработке';
  }
}