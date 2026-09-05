import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DownloadJob, HydrusFileDownloadService } from '../hydrus-file-download.service';

@Component({
  selector: 'app-download-tray',
  templateUrl: './download-tray.component.html',
  styleUrls: ['./download-tray.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DownloadTrayComponent {

  jobs$ = this.downloadService.downloadJobs$;
  expanded = true;

  constructor(public downloadService: HydrusFileDownloadService) { }

  activeCount(jobs: DownloadJob[]) {
    return jobs.filter(job => job.status === 'running').length;
  }

  summary(jobs: DownloadJob[]) {
    const active = this.activeCount(jobs);
    if (active > 0) {
      return `${active} active download${active === 1 ? '' : 's'}`;
    }
    return `${jobs.length} finished download${jobs.length === 1 ? '' : 's'}`;
  }

  progress(job: DownloadJob) {
    return job.totalFiles > 0
      ? ((job.completedFiles + job.failedFiles) / job.totalFiles) * 100
      : 0;
  }

  statusLabel(job: DownloadJob) {
    switch (job.status) {
      case 'running': return 'Downloading';
      case 'completed': return 'Completed';
      case 'failed': return 'Finished with errors';
      case 'cancelled': return 'Stopped';
    }
  }
}
