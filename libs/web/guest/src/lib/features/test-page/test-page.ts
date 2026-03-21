import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'lib-test-page',
  imports: [RouterLink],
  templateUrl: './test-page.html',
  styleUrl: './test-page.scss',
})
export class TestPage {}
