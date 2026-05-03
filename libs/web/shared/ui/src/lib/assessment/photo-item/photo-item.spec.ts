import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentType } from '@notary-portal/api-contracts';
import { PhotoItemComponent } from './photo-item';

describe('PhotoItem', () => {
  let component: PhotoItemComponent;
  let fixture: ComponentFixture<PhotoItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoItemComponent);
    component = fixture.componentInstance;

    component.file = {
      file: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
      preview: 'blob:test',
      type: DocumentType.PHOTO,
      quality: 'good',
    };

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
