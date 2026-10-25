import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface UploadedFile {
  name: string;
  size: string;
  isPreviewable: boolean;
  previewUrl?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  filesList: UploadedFile[] = [];
  isDragOver = false;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFileSelected(event: any) {
    if (event.target.files) {
      this.handleFiles(event.target.files);
    }
  }

  handleFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        alert(`Ошибка! Файл "${file.name}" имеет неверный формат. Разрешены только PDF и картинки.`);
        continue;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`Ошибка! Файл "${file.name}" превышает 10 МБ.`);
        continue;
      }

      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' МБ';

      const newFile: UploadedFile = {
        name: file.name,
        size: fileSizeMb,
        isPreviewable: isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined
      };

      this.filesList.push(newFile);
    }
  }

  deleteFile(index: number) {
    this.filesList.splice(index, 1);
  }
}
