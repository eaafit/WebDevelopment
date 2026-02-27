import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-applicant',
  imports: [RouterModule],
  templateUrl: './applicant.html',
  styleUrl: './applicant.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Applicant {}
