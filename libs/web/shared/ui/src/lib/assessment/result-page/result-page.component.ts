import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ResultValueCardComponent } from '../result-value-card/result-value-card';
import { MarketComparisonComponent } from '../market-comparison/market-comparison';
import { Assessment, Report, CalculationFactor, Comment } from '../models/assessment.interface';

@Component({
  selector: 'lib-result-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ResultValueCardComponent,
    MarketComparisonComponent
  ],
  templateUrl: './result-page.component.html',
  styleUrls: ['./result-page.component.scss']
})
export class ResultPageComponent implements OnInit {
  assessmentId: string | null = null;
  assessment?: Assessment;
  reports: Report[] = [];
  comments: Comment[] = [];
  calculationFactors: CalculationFactor[] = [];
  showCalculationDetails = false;
  commentForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.commentForm = this.fb.group({
      text: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit() {
  this.assessmentId = this.route.snapshot.paramMap.get('id') || 'mock-123';

  this.loadAssessment();
  this.loadMockReports();
  this.loadMockComments();
  this.loadCalculationFactors();
}

  loadAssessment() {
    // TODO: Replace with actual API call
    // const assessment = await this.assessmentService.getAssessment({ id: this.assessmentId });

    // Mock assessment data
    this.assessment = {
      id: this.assessmentId!,
      finalEstimatedValue: 5500000,
      address: 'г. Москва, ул. Примерная, д. 123, кв. 45',
      propertyType: 'Квартира',
      area: 45.5,
      assessmentDate: new Date(),
      propertyCondition: 'Хорошее',
      floor: '5',
      totalFloors: 9,
      buildYear: 2015
    };
  }

  loadMockReports() {
    // TODO: Replace with actual API call when ReportService is available
    this.reports = [
      {
        id: '1',
        assessmentId: this.assessmentId!,
        name: 'Отчёт об оценке недвижимости',
        status: 'Signed',
        createdAt: new Date(),
        downloadUrl: '/mock/report-1.pdf'
      },
      {
        id: '2',
        assessmentId: this.assessmentId!,
        name: 'Рыночный анализ',
        status: 'Draft',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  loadMockComments() {
    this.comments = [
      {
        id: '1',
        author: 'Нотариус Иванов А.А.',
        text: 'Оценка проведена в соответствии с требованиями законодательства.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        isAdmin: true
      },
      {
        id: '2',
        author: 'Оценщик Петров Б.В.',
        text: 'Использован сравнительный подход к оценке.',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        id: '3',
        author: 'Нотариус Иванов А.А.',
        text: 'Рекомендую запросить дополнительные документы.',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        isAdmin: true
      }
    ];
  }

  loadCalculationFactors() {
    this.calculationFactors = [
      {
        factor: 'Площадь',
        value: '45.5 кв. м',
        weight: 0.35,
        contribution: 350000
      },
      {
        factor: 'Состояние',
        value: 'Хорошее',
        weight: 0.20,
        contribution: 250000
      },
      {
        factor: 'Этаж',
        value: '5/9',
        weight: 0.10,
        contribution: -50000
      },
      {
        factor: 'Инфраструктура',
        value: 'Развитая',
        weight: 0.15,
        contribution: 180000
      },
      {
        factor: 'Год постройки',
        value: '2015',
        weight: 0.20,
        contribution: 120000
      }
    ];
  }

  toggleCalculationDetails() {
    this.showCalculationDetails = !this.showCalculationDetails;
  }

  downloadReport(report: Report) {
    if (report.downloadUrl) {
      // TODO: Implement actual download logic
      window.open(report.downloadUrl, '_blank');
    }
  }

  requestOfficialCopy() {
    // TODO: Navigate to copies page (Имамов's task)
    console.log('Navigate to /applicant/copies');
    // this.router.navigate(['/applicant/copies']);
  }

  addComment() {
    if (this.commentForm.valid) {
      const newComment: Comment = {
        id: Date.now().toString(),
        author: 'Вы',
        text: this.commentForm.value.text,
        createdAt: new Date()
      };

      this.comments.unshift(newComment);
      this.commentForm.reset();
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
}
