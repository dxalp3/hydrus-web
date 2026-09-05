import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HydrusAddURLResponse, HydrusURLInfo } from './hydrus-url';
import { AddUrlOptions, HydrusUrlService } from './hydrus-url.service';

export type HydrusUrlDownloadStatus = 'classifying' | 'submitting' | 'accepted' | 'error';

export interface HydrusUrlDownloadJob {
  id: string;
  url: string;
  status: HydrusUrlDownloadStatus;
  createdAt: number;
  destinationPageName?: string;
  showDestinationPage: boolean;
  info?: HydrusURLInfo;
  response?: HydrusAddURLResponse;
  error?: string;
}

export interface HydrusUrlDownloadBatchResult {
  total: number;
  accepted: number;
  failed: number;
}

@Injectable({
  providedIn: 'root'
})
export class HydrusUrlDownloadManagerService {

  private nextJobID = 1;
  private readonly jobsState = signal<HydrusUrlDownloadJob[]>([]);

  readonly jobs = this.jobsState.asReadonly();
  readonly activeCount = computed(() => this.jobsState().filter(job =>
    job.status === 'classifying' || job.status === 'submitting'
  ).length);

  constructor(private urlService: HydrusUrlService) { }

  async queueUrls(urls: string[], options: AddUrlOptions = {}): Promise<HydrusUrlDownloadBatchResult> {
    const uniqueURLs = Array.from(new Set(urls.map(url => url.trim()).filter(Boolean)));
    const jobs = uniqueURLs.map(url => this.createJob(url, options));
    this.jobsState.update(existing => [...jobs, ...existing].slice(0, 200));

    let nextIndex = 0;
    const worker = async () => {
      while(nextIndex < jobs.length) {
        const job = jobs[nextIndex++];
        await this.submitJob(job.id);
      }
    };
    await Promise.all(Array.from({length: Math.min(4, jobs.length)}, () => worker()));

    const finalJobs = this.jobsState();
    const accepted = jobs.filter(job => finalJobs.find(current => current.id === job.id)?.status === 'accepted').length;
    return {
      total: jobs.length,
      accepted,
      failed: jobs.length - accepted
    };
  }

  async retry(jobID: string) {
    const job = this.jobsState().find(candidate => candidate.id === jobID);
    if(!job) {
      return false;
    }
    this.updateJob(jobID, {
      status: 'classifying',
      error: undefined,
      response: undefined
    });
    await this.submitJob(jobID);
    return this.jobsState().find(candidate => candidate.id === jobID)?.status === 'accepted';
  }

  remove(jobID: string) {
    this.jobsState.update(jobs => jobs.filter(job => job.id !== jobID));
  }

  clearFinished() {
    this.jobsState.update(jobs => jobs.filter(job =>
      job.status === 'classifying' || job.status === 'submitting'
    ));
  }

  private createJob(url: string, options: AddUrlOptions): HydrusUrlDownloadJob {
    return {
      id: `url-download-${Date.now()}-${this.nextJobID++}`,
      url,
      status: 'classifying',
      createdAt: Date.now(),
      destinationPageName: options.destination_page_name || undefined,
      showDestinationPage: options.show_destination_page ?? false
    };
  }

  private async submitJob(jobID: string) {
    const initialJob = this.jobsState().find(job => job.id === jobID);
    if(!initialJob) {
      return;
    }

    try {
      const info = await firstValueFrom(this.urlService.getUrlInfo(initialJob.url));
      this.updateJob(jobID, {info});
    } catch {
      // Classification is useful UI metadata, but Hydrus may still accept the URL.
    }

    const job = this.jobsState().find(candidate => candidate.id === jobID);
    if(!job) {
      return;
    }
    this.updateJob(jobID, {status: 'submitting'});

    const options: AddUrlOptions = {
      show_destination_page: job.showDestinationPage
    };
    if(job.destinationPageName) {
      options.destination_page_name = job.destinationPageName;
    }

    try {
      const response = await firstValueFrom(this.urlService.addUrl(job.url, options));
      this.updateJob(jobID, {status: 'accepted', response});
    } catch (error) {
      this.updateJob(jobID, {status: 'error', error: this.errorText(error)});
    }
  }

  private updateJob(jobID: string, changes: Partial<HydrusUrlDownloadJob>) {
    this.jobsState.update(jobs => jobs.map(job => job.id === jobID ? {...job, ...changes} : job));
  }

  private errorText(error: unknown) {
    if(error && typeof error === 'object') {
      const responseError = (error as {error?: unknown}).error;
      if(responseError && typeof responseError === 'object' && 'error' in responseError) {
        return String((responseError as {error: unknown}).error).split('\n')[0];
      }
      if(typeof responseError === 'string') {
        return responseError;
      }
      if('message' in error) {
        return String((error as {message: unknown}).message);
      }
    }
    return 'Hydrus rejected the URL';
  }
}
