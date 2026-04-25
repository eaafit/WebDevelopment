import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type Plan = {
  title: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

@Component({
  selector: 'lib-landing-page',
  imports: [CommonModule],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage {
  isMobileMenuOpen = false;
  selectedPlanTitle = 'Старт';
  leadStatus = '';

  readonly benefits = [
    {
      title: 'Оценка без визита',
      description:
        'Заполняйте заявку онлайн и получайте результат без личного присутствия в офисе.',
    },
    {
      title: 'Прозрачные сроки',
      description: 'Фиксированные этапы выполнения с уведомлениями о каждом изменении статуса.',
    },
    {
      title: 'Юридическая точность',
      description: 'Шаблоны и проверки помогают подготовить документы к нотариальному процессу.',
    },
  ];

  readonly steps = [
    {
      title: 'Оставьте заявку',
      description: 'Гость заполняет короткую форму и выбирает удобный тариф с понятной стоимостью.',
    },
    {
      title: 'Получите консультацию',
      description: 'Менеджер связывается и помогает собрать минимальный пакет документов.',
    },
    {
      title: 'Запустите оценку',
      description:
        'После регистрации вы отслеживаете статус, оплачиваете услугу и скачиваете отчет.',
    },
  ];

  readonly plans: Plan[] = [
    {
      title: 'Старт',
      price: '2 900',
      period: 'за заявку',
      cta: 'Выбрать Старт',
      features: ['Проверка документов', 'Подсказки по заполнению', 'Email-уведомления'],
    },
    {
      title: 'Стандарт',
      price: '4 900',
      period: 'за заявку',
      cta: 'Выбрать Стандарт',
      features: ['Все из Старт', 'Приоритетная обработка', 'Поддержка в чате'],
    },
    {
      title: 'Эксперт',
      price: '7 900',
      period: 'за заявку',
      cta: 'Выбрать Эксперт',
      features: ['Все из Стандарт', 'Персональный консультант', 'Расширенный итоговый отчет'],
    },
  ];

  readonly faq: FaqItem[] = [
    {
      question: 'Можно ли начать без регистрации?',
      answer:
        'Да, гость может оставить контакты и запросить консультацию. Для продолжения и отслеживания статусов потребуется регистрация.',
    },
    {
      question: 'Сколько времени занимает оценка?',
      answer:
        'Средний срок 1-3 рабочих дня в зависимости от полноты документов и выбранного тарифа.',
    },
    {
      question: 'Какие документы нужны на старте?',
      answer:
        'Базово достаточно информации об объекте и документа, подтверждающего право владения. Точный список уточняется на консультации.',
    },
  ];

  readonly openedFaqIndexes = new Set<number>([0]);

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  selectPlan(planTitle: string): void {
    this.selectedPlanTitle = planTitle;
    this.leadStatus = `Выбран тариф: ${planTitle}. Это stub-действие для будущей интеграции оплаты.`;
  }

  toggleFaq(index: number): void {
    if (this.openedFaqIndexes.has(index)) {
      this.openedFaqIndexes.delete(index);
      return;
    }

    this.openedFaqIndexes.add(index);
  }

  isFaqOpen(index: number): boolean {
    return this.openedFaqIndexes.has(index);
  }

  submitLead(name: string, phone: string): void {
    if (!name.trim() || !phone.trim()) {
      this.leadStatus = 'Заполните имя и телефон, чтобы отправить заявку.';
      return;
    }

    this.leadStatus = `Спасибо, ${name}! Заявка принята. Мы перезвоним по номеру ${phone}. (stub)`;
  }
}
