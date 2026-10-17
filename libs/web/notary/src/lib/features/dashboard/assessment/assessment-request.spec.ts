import { TestBed } from '@angular/core/testing';
import { AssessmentRequest } from './assessment-request';

describe('Assessment request workflow', () => {
  afterEach(() => jest.useRealTimers());

  it('requires confirmation, recalculates urgency and stops the simulation on destruction', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', {
      assessment: { id: '1', address: 'Москва', status: 'New' },
    });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.confirm();
    expect(component.step()).toBe('parameters');
    component.form.patchValue({ urgency: 'urgent', confirmed: true });
    expect(component.price).toBe(4500);
    expect(component.days).toBe(2);
    component.confirm();
    expect(component.step()).toBe('confirmation');
    component.submit();
    component.submit();
    jest.advanceTimersByTime(3000);
    expect(component.stage()).toBe(1);
    fixture.destroy();
    jest.advanceTimersByTime(12000);
    expect(component.stage()).toBe(1);
  });

  it('does not submit a completed assessment', () => {
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', { assessment: { id: '1', status: 'Completed' } });
    const component = fixture.componentInstance;
    component.form.controls.confirmed.setValue(true);
    component.confirm();
    expect(component.step()).toBe('parameters');
    fixture.destroy();
  });
  it('проверяет длину комментария и заново требует подтверждение после возврата', () => {
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', {
      assessment: { id: '1', address: 'Москва', status: 'New' },
    });
    const component = fixture.componentInstance;
    component.form.patchValue({ comment: 'а'.repeat(1001), confirmed: true });
    component.confirm();
    expect(component.step()).toBe('parameters');
    component.form.patchValue({ comment: '', model: 'extended', urgency: 'urgent' });
    expect(component.price).toBe(7500);
    component.confirm();
    expect(component.step()).toBe('confirmation');
    component.back();
    expect(component.form.controls.confirmed.value).toBe(false);
    component.confirm();
    expect(component.step()).toBe('parameters');
    fixture.destroy();
  });

  it('доходит до последнего этапа и останавливает таймер', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', {
      assessment: { id: '1', address: 'Москва', status: 'New' },
    });
    const component = fixture.componentInstance;
    component.form.controls.confirmed.setValue(true);
    component.confirm();
    component.submit();
    jest.advanceTimersByTime(9000);
    expect(component.stage()).toBe(3);
    expect(component.dates()).toHaveLength(4);
    jest.advanceTimersByTime(12000);
    expect(component.stage()).toBe(3);
    fixture.destroy();
  });
});
