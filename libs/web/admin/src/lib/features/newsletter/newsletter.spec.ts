import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NewsletterApiService } from './newsletter-api.service';
import { NewsletterSelectionService } from './newsletter-selection.service';
import { NewsletterNew } from './newsletter-new';
import { Newsletter } from './newsletter';
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

  beforeEach(async () => {
    jest.clearAllMocks();
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
      imports: [Newsletter, NewsletterNew],
      providers: [
        provideRouter([]),
        NewsletterSelectionService,
        { provide: NewsletterApiService, useValue: api },
      ],
    }).compileComponents();
  });

  it('renders subscribers and applies filters through API', async () => {
    const fixture = TestBed.createComponent(Newsletter);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('notary@example.com');
    expect(fixture.nativeElement.textContent).toContain('old@example.com');

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = 'notary@example.com';
    input.dispatchEvent(new Event('input'));
    const applyButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Применить')) as HTMLButtonElement;
    applyButton.click();
    await settle(fixture);

    expect(api.listSubscribers).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'notary@example.com' }),
    );
  });

  it('keeps selected subscribers for the new campaign route', async () => {
    const listFixture = TestBed.createComponent(Newsletter);
    await settle(listFixture);

    const firstCheckbox: HTMLInputElement = listFixture.nativeElement.querySelector(
      'tbody input[type="checkbox"]',
    );
    firstCheckbox.click();
    await settle(listFixture);

    const newFixture = TestBed.createComponent(NewsletterNew);
    await settle(newFixture);

    expect(newFixture.nativeElement.textContent).toContain('Сейчас выбрано адресов: 1');
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
