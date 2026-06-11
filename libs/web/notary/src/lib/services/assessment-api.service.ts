import { Injectable } from '@angular/core';

export type Status = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';

export interface Assessment {
  id: string;
  applicantName: string;
  status: Status;
  address: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotaryAssessmentApiService {
  async getAssessments(): Promise<Assessment[]> {
    // TODO: заменить URL на реальный эндпоинт
    const response = await fetch('/api/notary/assessments');
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status}`);
    }
    
    return response.json();
  }
}