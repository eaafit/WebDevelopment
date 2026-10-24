import { TestBed } from '@angular/core/testing';
import { TokenStore } from '@notary-portal/ui';
import { AssessmentReadApiService } from './assessment-read-api.service';
describe('Assessment workspace API', () => {
  const fetchMock = jest.fn();
  const tokens = { getAccessToken: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
    tokens.getAccessToken.mockReturnValue('token');
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    TestBed.configureTestingModule({ providers: [{ provide: TokenStore, useValue: tokens }] });
  });
  it('authenticates and encodes list filters', async () => {
    await TestBed.inject(AssessmentReadApiService).list(2, { search: 'Москва & дом' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('%26');
    expect(options.headers.Authorization).toBe('Bearer token');
  });
  it('persists request with real POST and correct relation ID', async () => {
    await TestBed.inject(AssessmentReadApiService).submit('id-1', {
      model: 'extended',
      urgency: 'urgent',
      comment: '',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/assessment-workspace/id-1/request'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'extended', urgency: 'urgent', comment: '' }),
      }),
    );
  });
  it('shows API validation errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'Нельзя удалить' }) });
    await expect(TestBed.inject(AssessmentReadApiService).remove('id')).rejects.toThrow(
      'Нельзя удалить',
    );
  });
  it('rejects missing session before sending data', async () => {
    tokens.getAccessToken.mockReturnValue(null);
    await expect(TestBed.inject(AssessmentReadApiService).get('id')).rejects.toThrow(
      'Сессия истекла',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
