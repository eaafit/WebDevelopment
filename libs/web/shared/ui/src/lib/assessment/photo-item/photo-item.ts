import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadedFile } from '../models/uploaded-file.model';
import { DocumentType } from '@notary-portal/api-contracts';

@Component({
  selector: 'lib-photo-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-item.html',
  styleUrls: ['./photo-item.scss'],
})
export class PhotoItemComponent {
  @Input() file!: UploadedFile;

  @Output() remove = new EventEmitter<void>();
  @Output() typeChange = new EventEmitter<DocumentType>();

  types = Object.values(DocumentType);

  isImage() {
    return this.file.file.type.startsWith('image/');
  }

  dragStart(event: DragEvent) {
    event.dataTransfer?.setData('text/plain', 'dragging');
  }
}
