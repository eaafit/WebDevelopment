import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusTimelineComponent } from './status-timeline';
// Импорт StatusHistoryEntry больше не нужен, удаляем

describe('StatusTimelineComponent', () => {
  let component: StatusTimelineComponent;
  let fixture: ComponentFixture<StatusTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusTimelineComponent);
    component = fixture.componentInstance;
    // Входной параметр теперь currentStatus (обязательный)
    component.currentStatus = 'pending';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Проверяем, что отображается 5 этапов (а не 2)
  it('should render 5 timeline stages', () => {
    const stages = fixture.nativeElement.querySelectorAll('.timeline-stage');
    expect(stages.length).toBe(5);
  });

  // Проверяем, что для статуса 'pending' первый кружок получает класс 'current'
  it('should apply "current" class to the active stage for status "pending"', () => {
    component.currentStatus = 'pending';
    fixture.detectChanges();
    const circles = fixture.nativeElement.querySelectorAll('.stage-circle');
    expect(circles[0].classList).toContain('current');
    expect(circles[1].classList).not.toContain('current');
    expect(circles[2].classList).not.toContain('current');
    expect(circles[3].classList).not.toContain('current');
    expect(circles[4].classList).not.toContain('current');
  });

  // Проверяем, что для статуса 'in_progress' первые два кружка получают 'completed', третий — 'current'
  it('should mark previous stages as "completed" for status "in_progress"', () => {
    component.currentStatus = 'in_progress';
    fixture.detectChanges();
    const circles = fixture.nativeElement.querySelectorAll('.stage-circle');
    expect(circles[0].classList).toContain('completed');
    expect(circles[1].classList).toContain('completed');
    expect(circles[2].classList).toContain('current');
    expect(circles[3].classList).not.toContain('completed');
    expect(circles[3].classList).not.toContain('current');
    expect(circles[4].classList).not.toContain('completed');
    expect(circles[4].classList).not.toContain('current');
  });

  // Проверяем, что для статуса 'completed' все кружки имеют класс 'completed'
  it('should mark all stages as completed when status is "completed"', () => {
    component.currentStatus = 'completed';
    fixture.detectChanges();
    const circles = fixture.nativeElement.querySelectorAll('.stage-circle');
    for (let i = 0; i < circles.length; i++) {
      expect(circles[i].classList).toContain('completed');
    }
    // По желанию можно проверить, что последний кружок также 'current' (если нужно)
    expect(circles[4].classList).toContain('current');
  });
});
