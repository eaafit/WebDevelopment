import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, from, switchMap } from 'rxjs';
import { AssessmentApiService } from '../../../../estimation-form/assessment-api.service';
import type { FiasAddressSuggestion } from '../../../../estimation-form/estimation-form.models';
import { ORDER_PROPERTY_TYPE_OPTIONS } from '../../new-order-form.models';

@Component({
  selector: 'lib-step-property',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-property.html',
  styleUrl: './step-property.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepProperty implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly assessmentApi = inject(AssessmentApiService);

  @Input({ required: true }) group!: FormGroup;
  @Input() showValidationErrors = false;

  readonly propertyTypeOptions = ORDER_PROPERTY_TYPE_OPTIONS;
  readonly addressSuggestions = signal<FiasAddressSuggestion[]>([]);
  readonly addressSuggestLoading = signal(false);
  readonly addressLookupError = signal<string | null>(null);

  private selectedFiasAddressFullName = '';

  ngOnInit(): void {
    this.selectedFiasAddressFullName = this.group.get('cityId')?.value
      ? `${this.group.get('address')?.value ?? ''}`.trim()
      : '';

    this.group
      .get('address')
      ?.valueChanges.pipe(
        filter((address) => {
          const normalizedAddress = `${address ?? ''}`.trim();
          return (
            !this.selectedFiasAddressFullName || normalizedAddress !== this.selectedFiasAddressFullName
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.group.patchValue({ cityId: '', districtId: '' }, { emitEvent: false });
        this.selectedFiasAddressFullName = '';
      });

    this.group
      .get('address')
      ?.valueChanges.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => from(this.loadFiasAddressHints(`${query ?? ''}`))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  isInvalid(controlName: string): boolean {
    const control = this.group.get(controlName);
    return Boolean(control && control.invalid && (control.touched || this.showValidationErrors));
  }

  isAddressInvalid(): boolean {
    return this.isInvalid('address') || this.isInvalid('cityId');
  }

  async onSelectAddressSuggestion(suggestion: FiasAddressSuggestion): Promise<void> {
    this.addressLookupError.set(null);
    this.addressSuggestLoading.set(true);

    try {
      const selectedAddress = await this.assessmentApi.getFiasAddressItemById(suggestion.objectId);
      this.selectedFiasAddressFullName = selectedAddress.fullName;
      this.group.patchValue({
        cityId: selectedAddress.cityId,
        districtId: selectedAddress.districtId,
        address: selectedAddress.fullName,
        cadastralNumber:
          `${this.group.get('cadastralNumber')?.value ?? ''}`.trim() || selectedAddress.cadastralNumber,
      });
      this.group.get('cityId')?.updateValueAndValidity();
      this.addressSuggestions.set([]);
    } catch (error) {
      this.addressLookupError.set(
        error instanceof Error ? error.message : 'Не удалось получить выбранный адрес из ФИАС.',
      );
    } finally {
      this.addressSuggestLoading.set(false);
    }
  }

  private async loadFiasAddressHints(query: string): Promise<void> {
    const normalizedQuery = query.trim();
    this.addressLookupError.set(null);

    if (normalizedQuery.length < 3 || normalizedQuery === this.selectedFiasAddressFullName) {
      this.addressSuggestions.set([]);
      this.addressSuggestLoading.set(false);
      return;
    }

    this.addressSuggestLoading.set(true);

    try {
      const hints = await this.assessmentApi.getFiasAddressHints(normalizedQuery);
      this.addressSuggestions.set(hints);
    } catch (error) {
      this.addressSuggestions.set([]);
      this.addressLookupError.set(
        error instanceof Error ? error.message : 'Не удалось получить подсказки ФИАС.',
      );
    } finally {
      this.addressSuggestLoading.set(false);
    }
  }
}
