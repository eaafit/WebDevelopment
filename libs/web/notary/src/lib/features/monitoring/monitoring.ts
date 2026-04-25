import { Component } from '@angular/core';
import { AuditMonitoringPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-notary-monitoring',
  imports: [AuditMonitoringPage],
  template: '<lib-audit-monitoring-page mode="notary" />',
})
export class Monitoring {}
