import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'lib-assessment-status',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './assessment-status.html',
  styleUrl: './assessment-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentStatus {}
