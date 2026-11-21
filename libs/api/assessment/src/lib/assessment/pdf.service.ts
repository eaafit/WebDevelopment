import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'node:path';

const FONT_FILE = path.join(process.cwd(), 'assets', 'fonts', 'arial.ttf');
const TITLE = 'Отчёт об оценке недвижимости';
const BLUE = '#1e3a8a';

interface ReportData {
  assessmentId: string;
  marketValue: number;
  valueMin: number;
  valueMax: number;
  confidenceLevel: string;
  valuationMethod: string;
  comment: string;
}

@Injectable()
export class PdfService {
  generateReport(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('main', FONT_FILE);
      doc.font('main');

      const w = doc.page.width - 100;
      const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

      // Шапка
      doc.rect(0, 0, doc.page.width, 100).fill(BLUE);
      doc.fillColor('white').fontSize(24).text(TITLE, 50, 38, { width: w, align: 'center' });

      // Основные данные
      doc.fillColor('black').fontSize(12);
      doc.text(`Номер заявки: ${data.assessmentId}`, 50, 130);
      doc.text(`Дата формирования: ${new Date().toLocaleString('ru-RU')}`);

      // Рамка с ценой
      const boxTop = doc.y + 25;
      doc.rect(50, boxTop, w, 80).lineWidth(2).strokeColor(BLUE).stroke();
      doc.fontSize(14).fillColor(BLUE)
        .text('Итоговая рыночная стоимость', 50, boxTop + 15, { width: w, align: 'center' });
      doc.fontSize(26).fillColor('#15803d')
        .text(rub(data.marketValue), 50, boxTop + 40, { width: w, align: 'center' });

      // Детали
      doc.fillColor('black').fontSize(12);
      doc.text(`Диапазон стоимости: от ${rub(data.valueMin)} до ${rub(data.valueMax)}`, 50, boxTop + 110);
      doc.moveDown();
      doc.text(`Уровень достоверности: ${data.confidenceLevel}%`);
      doc.moveDown();
      doc.text(`Метод оценки: ${data.valuationMethod || '—'}`);
      doc.moveDown(2);

      // Комментарий
      doc.fontSize(14).fillColor(BLUE).text('Комментарий нотариуса:');
      doc.fontSize(12).fillColor('black').text(data.comment || 'Нет комментариев');

      doc.end();
    });
  }
}
