import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusTimelineComponent } from './status-timeline';
import { StatusHistoryEntry } from '../models';

describe('StatusTimelineComponent', () => {
  let component: StatusTimelineComponent;
  let fixture: ComponentFixture<StatusTimelineComponent>;

  const mockHistory: StatusHistoryEntry[] = [
    { status: 'pending', date: new Date(), comment: 'Создан' },
    { status: 'in_progress', date: new Date(), comment: 'В обработке' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusTimelineComponent);
    component = fixture.componentInstance;
    component.history = mockHistory;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render timeline nodes', () => {
    const nodes = fixture.nativeElement.querySelectorAll('.timeline-node');
    expect(nodes.length).toBe(2);
  });
});
