import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-estimation-form',
  standalone: true,
  imports: [],
  templateUrl: './estimation-form.html',
  styleUrl: './estimation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimationForm {}
