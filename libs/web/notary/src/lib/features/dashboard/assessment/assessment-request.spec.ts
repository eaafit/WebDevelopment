import { TestBed } from '@angular/core/testing';
import { AssessmentRequest } from './assessment-request';

describe('Assessment request workflow', () => {
  afterEach(() => jest.useRealTimers());

  it('requires confirmation, recalculates urgency and stops the simulation on destruction', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', { assessment: { id: '1', address: 'Москва', status: 'New' } });
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
});
