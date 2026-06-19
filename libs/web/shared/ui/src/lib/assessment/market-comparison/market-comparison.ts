import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Assessment } from '../models/assessment.interface';

interface MarketData {
  averagePricePerSquareMeter: number;
  averageTotalPrice: number;
}

@Component({
  selector: 'lib-market-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market-comparison.html',
  styleUrls: ['./market-comparison.scss']
})
export class MarketComparisonComponent implements OnInit {
  @Input() assessment?: Assessment;

  marketData: MarketData = {
    averagePricePerSquareMeter: 0,
    averageTotalPrice: 0
  };

  pricePerSquareMeter = 0;
  pricePerSquareMeterDeviation = 0;
  priceDeviation = 0;

  ngOnInit() {
    if (this.assessment) {
      this.pricePerSquareMeter = this.assessment.finalEstimatedValue / this.assessment.area;
      this.marketData.averagePricePerSquareMeter = this.pricePerSquareMeter * (1 + (Math.random() * 0.1 - 0.05));
      this.marketData.averageTotalPrice = this.marketData.averagePricePerSquareMeter * this.assessment.area;
      this.calculateDeviations();
    }
  }

  calculateDeviations() {
    this.pricePerSquareMeterDeviation = ((this.pricePerSquareMeter - this.marketData.averagePricePerSquareMeter) / this.marketData.averagePricePerSquareMeter) * 100;
    this.priceDeviation = ((this.assessment!.finalEstimatedValue - this.marketData.averageTotalPrice) / this.marketData.averageTotalPrice) * 100;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatDeviation(value: number): string {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  }
}
