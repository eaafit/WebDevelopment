import { TestBed } from '@angular/core/testing';
import { RequestPrice, AssessmentItem } from './assessment';
import { AssessmentReadApiService } from './assessment-read-api.service';

const item: AssessmentItem = {
  assessment: {
    id: 'a-1',
    address: 'Москва, Тверская, 10',
    status: 'New',
    createdAt: '',
    updatedAt: '',
  },
  realEstate: {
    id: 'r-1',
    address: 'Москва, Тверская, 10',
    city: 'Москва',
    objectType: 'Apartment',
    condition: 'Good',
  },
};

// Отложенный ответ позволяет проверить поведение при медленном API.
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('Страница оценки', () => {
  let component: RequestPrice;
  let api: { list: jest.Mock; get: jest.Mock };

  beforeEach(() => {
    api = {
      list: jest.fn().mockResolvedValue({ items: [item], totalPages: 3 }),
      get: jest.fn().mockResolvedValue(item),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AssessmentReadApiService, useValue: api }],
    });
    component = TestBed.createComponent(RequestPrice).componentInstance;
  });

  it('загружает список и подробности из API', async () => {
    await component.loadItems();
    expect(api.list).toHaveBeenCalledWith(1);
    expect(component.totalPages()).toBe(3);
    await component.openRequest(item);
    expect(api.get).toHaveBeenCalledWith('a-1');
    expect(component.selectedItem()).toEqual(item);
  });

  it('не выходит за границы страниц и загружает следующую', async () => {
    await component.loadItems();
    component.changePage(-1);
    expect(component.page()).toBe(1);
    component.changePage(1);
    expect(api.list).toHaveBeenLastCalledWith(2);
    await Promise.resolve();
    component.page.set(3);
    component.changePage(1);
    expect(component.page()).toBe(3);
  });

  it('показывает ошибку и позволяет повторить загрузку', async () => {
    api.list.mockRejectedValueOnce(new Error('network'));
    await component.loadItems();
    expect(component.error()).not.toBe('');
    expect(component.loading()).toBe(false);
    await component.loadItems();
    expect(component.error()).toBe('');
    expect(component.items()).toEqual([item]);
  });

  it('в деморежиме не вызывает API и ищет по адресу', async () => {
    component.setDemoMode(true);
    await Promise.resolve();
    component.search.set('  КАЗАНЬ  ');
    expect(component.filteredItems()).toHaveLength(1);
    await component.openRequest(component.filteredItems()[0]);
    expect(api.list).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(component.selectedItem()?.assessment.address).toContain('Казань');
  });

  it('запрещает запрос для завершённой заявки', async () => {
    await component.openRequest({
      ...item,
      assessment: { ...item.assessment, status: 'Completed' },
    });
    expect(api.get).not.toHaveBeenCalled();
    expect(component.selectedItem()).toBeNull();
  });

  it('не заменяет демоданные запоздалым ответом API', async () => {
    const response = pending<{ items: AssessmentItem[]; totalPages: number }>();
    api.list.mockReturnValueOnce(response.promise);
    const loading = component.loadItems();
    component.setDemoMode(true);
    response.resolve({ items: [item], totalPages: 99 });
    await loading;
    expect(component.items()[0].assessment.id).toBe('demo-1');
    expect(component.totalPages()).toBe(1);
  });

  it('не открывает устаревшую заявку после перезагрузки списка', async () => {
    const response = pending<AssessmentItem>();
    api.get.mockReturnValueOnce(response.promise);
    const opening = component.openRequest(item);
    await component.loadItems();
    response.resolve(item);
    await opening;
    expect(component.selectedItem()).toBeNull();
    expect(component.detailLoading()).toBe(false);
  });

  it('показывает ошибку получения подробностей', async () => {
    api.get.mockRejectedValueOnce(new Error('network'));
    await component.openRequest(item);
    expect(component.error()).toContain('Не удалось открыть');
    expect(component.detailLoading()).toBe(false);
  });
  it('показывает список в HTML и открывает форму по кнопке', async () => {
    const fixture = TestBed.createComponent(RequestPrice);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Москва, Тверская, 10');
    const button = element.querySelector<HTMLButtonElement>('button.primary');
    expect(button?.disabled).toBe(false);
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Запрос оценки с параметрами');
    const backButton = element.querySelector<HTMLButtonElement>('lib-assessment-request button');
    backButton?.click();
    fixture.detectChanges();
    expect(element.querySelector('lib-assessment-request')).toBeNull();
    expect(element.textContent).toContain('Заявки на оценку недвижимости');
    fixture.destroy();
  });
});
