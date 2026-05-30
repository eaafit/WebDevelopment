import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Copy } from './copy';

describe('Copy', () => {
  let component: Copy;
  let fixture: ComponentFixture<Copy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Copy],
    }).compileComponents();

    fixture = TestBed.createComponent(Copy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
