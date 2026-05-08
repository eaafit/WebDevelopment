import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NewsletterApiService } from './newsletter-api.service';
import { NewsletterSentMessagesService } from './newsletter-sent-messages.service';
import { NewsletterSelectionService } from './newsletter-selection.service';
import { NewsletterNew } from './newsletter-new';
import { NewsletterListComponent } from './newsletter-list/newsletter-list';
import { NewsletterSenderProfileService } from './newsletter-sender-profile.service';
import type {
  NewsletterCampaignView,
  NewsletterSubscriberView,
} from './newsletter.models';

describe('Newsletter admin feature', () => {
  const subscribers: NewsletterSubscriberView[] = [
    {
      id: 'sub-1',
      userId: '11111111-1111-4111-a111-111111111111',
      email: 'notary@example.com',
      fullName: 'Нотариус Тестовый',
      role: 'notary',
      roleLabel: 'Нотариус',
      subscribedAt: '01.03.2026, 10:00',
      unsubscribedAt: '—',
      status: 'active',
      statusLabel: 'Активна',
    },
    {
      id: 'sub-2',
      userId: '22222222-2222-4222-a222-222222222222',
      email: 'old@example.com',
      fullName: 'Отписанный пользователь',
      role: 'applicant',
      roleLabel: 'Заявитель',
      subscribedAt: '01.03.2026, 10:00',
      unsubscribedAt: '10.03.2026, 10:00',
      status: 'unsubscribed',
      statusLabel: 'Отписан',
    },
  ];
  const campaigns: NewsletterCampaignView[] = [
    {
      id: 'campaign-1',
      createdAt: '02.03.2026, 12:00',
      completedAt: '02.03.2026, 12:01',
      subject: 'История рассылки',
      audienceLabel: 'Все активные подписчики',
      recipientsCount: 2,
      sentCount: 2,
      failedCount: 0,
      status: 'sent',
      statusLabel: 'Отправлена',
    },
  ];

  const api = {
    listSubscribers: jest.fn(),
    listCampaigns: jest.fn(),
    estimateAudience: jest.fn(),
    sendCampaign: jest.fn(),
  };
  const router = {
    navigate: jest.fn().mockResolvedValue(true),
  };
  const senderProfile = {
    getSenderProfile: jest.fn().mockResolvedValue({
      appName: 'Notary portal',
      fromEmail: 'noreply@test.local',
      host: 'smtp.ethereal.email',
      port: 2525,
      transport: 'smtp',
      configured: true,
      source: 'api',
    }),
  };
  const sentMessages = {
    listMessages: jest.fn().mockResolvedValue({
      configured: true,
      messages: [
        {
          id: 'sent-1',
          subject: 'Проверка SMTP',
          bodyText: 'Здравствуйте, Нотариус Тестовый!\n\nОсновной текст письма\n\n— Notary portal',
          bodyHtml: '<p>Основной текст письма</p>',
          sentAt: '2026-03-22T09:30:00.000Z',
          fromEmail: 'noreply@test.local',
          toEmail: 'notary@example.com',
          transport: 'smtp',
          previewUrl: 'https://ethereal.email/message/test-message',
        },
      ],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    router.navigate.mockResolvedValue(true);
    senderProfile.getSenderProfile.mockResolvedValue({
      appName: 'Notary portal',
      fromEmail: 'noreply@test.local',
      host: 'smtp.ethereal.email',
      port: 2525,
      transport: 'smtp',
      configured: true,
      source: 'api',
    });
    sentMessages.listMessages.mockResolvedValue({
      configured: true,
      messages: [
        {
          id: 'sent-1',
          subject: 'Проверка SMTP',
          bodyText: 'Здравствуйте, Нотариус Тестовый!\n\nОсновной текст письма\n\n— Notary portal',
          bodyHtml: '<p>Основной текст письма</p>',
          sentAt: '2026-03-22T09:30:00.000Z',
          fromEmail: 'noreply@test.local',
          toEmail: 'notary@example.com',
          transport: 'smtp',
          previewUrl: 'https://ethereal.email/message/test-message',
        },
      ],
    });
    api.listSubscribers.mockResolvedValue({
      subscribers,
      meta: { totalItems: 2, totalPages: 1, currentPage: 1, perPage: 10 },
    });
    api.listCampaigns.mockResolvedValue({
      campaigns,
      meta: { totalItems: 1, totalPages: 1, currentPage: 1, perPage: 10 },
    });
    api.estimateAudience.mockResolvedValue(1);
    api.sendCampaign.mockResolvedValue({
      ...campaigns[0],
      subject: 'Готовая рассылка',
      recipientsCount: 1,
      sentCount: 1,
    });

    await TestBed.configureTestingModule({
      imports: [NewsletterListComponent, NewsletterNew],
      providers: [
        { provide: Router, useValue: router },
        NewsletterSelectionService,
        { provide: NewsletterApiService, useValue: api },
        { provide: NewsletterSenderProfileService, useValue: senderProfile },
        { provide: NewsletterSentMessagesService, useValue: sentMessages },
      ],
    }).compileComponents();
  });

  it('renders sent messages from the mail API in the journal table', async () => {
    const fixture = TestBed.createComponent(NewsletterListComponent);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Журнал писем');
    expect(fixture.nativeElement.textContent).toContain('noreply@test.local');
    expect(fixture.nativeElement.textContent).toContain('Проверка SMTP');
    expect(fixture.nativeElement.textContent).toContain('Мартовское обновление тарифов');

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'sent';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Проверка SMTP');
  });

  it('opens message detail panel and repeats sending', async () => {
    const fixture = TestBed.createComponent(NewsletterListComponent);
    await settle(fixture);

    const firstRow: HTMLTableRowElement = fixture.nativeElement.querySelector(
      '.newsletter-table--campaigns tbody tr',
    );
    firstRow.click();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Детали письма');
    expect(fixture.nativeElement.textContent).toContain('notary@example.com');

    const repeatButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Отправить повторно')) as HTMLButtonElement;
    repeatButton.click();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Повторная отправка письма');
  });

  it('keeps checked recipients for Karlov newsletter form', async () => {
    const listFixture = TestBed.createComponent(NewsletterListComponent);
    await settle(listFixture);

    expect(listFixture.nativeElement.textContent).toContain('Получатели для новой рассылки');
    const firstCheckbox: HTMLInputElement = listFixture.nativeElement.querySelector(
      '.newsletter-table--subscribers tbody input[type="checkbox"]',
    );
    firstCheckbox.click();
    await settle(listFixture);

    const selectedButton = Array.from<HTMLButtonElement>(
      listFixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Использовать выбранных')) as HTMLButtonElement;
    selectedButton.click();
    await settle(listFixture);

    expect(router.navigate).toHaveBeenCalledWith(['/admin/newsletter/new']);

    const newFixture = TestBed.createComponent(NewsletterNew);
    await settle(newFixture);

    expect(newFixture.nativeElement.textContent).toContain('Выбрано: 1 адрес');
  });

  it('routes create button to Karlov newsletter form', async () => {
    const fixture = TestBed.createComponent(NewsletterListComponent);
    await settle(fixture);

    const createButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Создать рассылку')) as HTMLButtonElement;
    createButton.click();
    await settle(fixture);

    expect(router.navigate).toHaveBeenCalledWith(['/admin/newsletter/new']);
  });

  it('opens sanitized preview and confirmation before sending', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(NewsletterNew);
    await settle(fixture);
    const component = fixture.componentInstance as unknown as {
      updateSubject: (value: string) => void;
      updateBody: (value: string) => void;
      openPreview: () => void;
      openConfirm: () => Promise<void>;
      sendCampaign: () => Promise<void>;
    };

    component.updateSubject('Готовая рассылка');
    component.updateBody('<p>Текст <strong>письма</strong><img src=x onerror="alert(1)"></p>');
    component.openPreview();
    await settle(fixture);

    const preview: HTMLElement = fixture.nativeElement.querySelector('.newsletter-preview');
    expect(preview.innerHTML).toContain('<strong>письма</strong>');
    expect(preview.innerHTML).not.toContain('onerror');

    await component.openConfirm();
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Подтвердите отправку');

    await component.sendCampaign();
    await settle(fixture);

    expect(api.sendCampaign).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Кампания записана в историю');
    warnSpy.mockRestore();
  });

  it('shows API errors during send', async () => {
    api.sendCampaign.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const fixture = TestBed.createComponent(NewsletterNew);
    await settle(fixture);
    const component = fixture.componentInstance as unknown as {
      updateSubject: (value: string) => void;
      updateBody: (value: string) => void;
      sendCampaign: () => Promise<void>;
    };

    component.updateSubject('Готовая рассылка');
    component.updateBody('<p>Текст письма</p>');
    await component.sendCampaign();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('SMTP unavailable');
  });
});

async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}
