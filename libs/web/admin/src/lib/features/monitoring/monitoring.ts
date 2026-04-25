import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditMonitoringPage } from '@notary-portal/ui';
import { AuditByEntity } from './audit-by-entity/audit-by-entity';
import { SecurityEvents } from './security-events/security-events';

type MonitoringTab = 'all-events' | 'by-user-order' | 'security-events';

@Component({
  selector: 'lib-monitoring',
  imports: [CommonModule, AuditMonitoringPage, AuditByEntity, SecurityEvents],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Monitoring {
  readonly activeTab = signal<MonitoringTab>('all-events');

  setActiveTab(tab: MonitoringTab): void {
    this.activeTab.set(tab);
  }
}
