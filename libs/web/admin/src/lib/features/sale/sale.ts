import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Discount {
  id: number;
  name: string;
  percentage: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  description: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent {
  discounts: Discount[] = [
    {
      id: 1,
      name: 'Скидка новым клиентам',
      percentage: 10,
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      isActive: true,
      description: 'Для всех новых клиентов при первой сделке',
      minOrderAmount: 1000,
      maxDiscountAmount: 5000,
    },
    // остальные скидки добавь по аналогии
  ];

  // все методы как в plan (create, edit, save, delete, фильтрация, сортировка, пагинация)
  // просто скопировать из plan заменив plans на discounts, TariffPlan на Discount
}
