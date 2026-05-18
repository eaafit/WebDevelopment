import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { ActivatedRoute } from '@angular/router';
import { Assessment, AssessmentStatus } from '../../../../../../../shared/api-contracts/src';
import { Document } from '../services/document.service';


@Component({
  selector: 'lib-copy',
  imports: [],
  templateUrl: './copy.html',
  styleUrl: './copy.scss',
})
export class Copy implements OnInit {
  private readonly assessmentService = inject(AssessmentService);
  private readonly documentService = inject(DocumentService);

  id: string | null = null;
  doc: Document | null = null;
  assesment: Assessment | null = null;
  timer = signal(0)
  createDate = computed(() => {
    if (this.doc === null) {
      return ""
    }
    return new Date(Number(this.doc!.uploadedAt!.seconds))
  })

  constructor(private route: ActivatedRoute) { }


  async ngOnInit(
  ) {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id === null) throw new Error('No id!')

    this.doc = await this.documentService.getDocument(this.id)
    this.assesment = await this.assessmentService.getAssessment(this.doc.assessmentId)
    if (this.assesment.status === AssessmentStatus.COMPLETED) return
    if (!this.assesment.createdAt?.seconds) {
      this.timer.set(0)
    } else {
      const deadlineRange = 10 * 24 * 60
      const secDiff = Number(this.assesment.createdAt.seconds) + deadlineRange - Date.now() / 1000
      this.timer.set(Math.floor(secDiff / 60))
    }

    const timerId = setInterval(async () => {
      this.assesment = await this.assessmentService.getAssessment(this.doc!.assessmentId)
      if (this.assesment.status === AssessmentStatus.COMPLETED) return clearInterval(timerId)
      this.timer.set(this.timer() - 1)
    }, 60_000)
  }
}

