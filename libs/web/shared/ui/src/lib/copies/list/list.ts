import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DocumentService, Document, PageInfo } from '../services/document.service';
import { AssessmentService } from '../services/assesment.service';
import { DocumentRow } from './document-row/document-row';
import { Pagination } from './pagination/pagination';

@Component({
  selector: 'lib-list',
  imports: [CommonModule, DocumentRow, Pagination],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }
  private readonly documentService = inject(DocumentService);
  page = signal<number>(1)
  private readonly limit = 9

  documents = signal<Document[]>([])
  loading = signal(true)
  pageInfo = signal<PageInfo>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    perPage: 9
  })
  @Input() role: 'applicant' | 'notary' = 'applicant';

  ngOnInit(
  ) {
    const routeRole = this.route.snapshot.data['role'];
    if (routeRole) this.role = routeRole;
    
    this.fetchDocuments()
    this.documents.set([{
      assessmentId: '12',
      id: 'qwe',
      fileName: 'test',
      fileType: 'png',
      version: 1,
      uploadedById: Date().toString(),
      downloadUrl: 'qweasd'
    }])
    this.pageInfo.set({
      totalItems: 10,
      totalPages: 3,
      currentPage: 1,
      perPage: 9
    })

    this.goToPrev = this.goToPrev.bind(this);
    this.goToNext = this.goToNext.bind(this);
  }

  fetchDocuments(page = 1) {
    this.loading.set(true)
    this.documentService.listDocumentsByAssessment(undefined, { page, limit: this.limit }).then((data) => {
      this.documents.set(data.documents);
      data.meta && this.pageInfo.set(data.meta)
      this.page.set(data.meta?.currentPage ?? page)
    }).catch(() => {
    }).finally(() => this.loading.set(false))
  }


  hasPrev = computed(() => this.page() > 1 && !this.loading());

  hasNext = computed(() => {
    const totalPages = this.pageInfo()?.totalPages
    return Boolean(totalPages && this.page() < totalPages && !this.loading())
  })

  goToPrev() {
    if (this.page() > 1) this.fetchDocuments(this.page() - 1)
  }

  goToNext() {
    const lastPage = this.pageInfo()?.totalPages
    if (!lastPage || this.page() >= lastPage) return
    this.fetchDocuments(this.page() + 1)
  }

  navigateToNew(): void {
    this.router.navigate(['new'], { relativeTo: this.route });
  }
}