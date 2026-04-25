import { Component } from '@angular/core';
import { AuditMonitoringPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-monitoring',
  imports: [AuditMonitoringPage],
  template: '<lib-audit-monitoring-page mode="admin" />',
})
export class Monitoring {}
