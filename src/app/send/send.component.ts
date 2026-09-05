import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, debounceTime, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AddUrlOptions, HydrusUrlService } from '../hydrus-url.service';
import { HydrusFilesService } from '../hydrus-files.service';
import { SettingsService } from '../settings.service';
import { ErrorService } from '../error.service';
import { SaucenaoService, SaucenaoResults } from '../saucenao.service';
import { HydrusUrlDownloadJob, HydrusUrlDownloadManagerService } from '../hydrus-url-download-manager.service';

// Used only to pull a URL out of Android/iOS share-target text.
// eslint-disable-next-line max-len
const sharedTextUrlRegex = /https?:\/\/[-a-zA-Z0-9^\p{L}\p{C}\u00a1-\uffff@:%_\+.~#?&//=]+/u;

function isWebURL(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseHydrusURLInput(value: string) {
  return Array.from(new Set((value ?? '')
    .split(/\r?\n/)
    .map(url => url.trim())
    .filter(url => url.length > 0)
  ));
}

export const hydrusURLListValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const urls = parseHydrusURLInput(control.value);
  if(urls.length === 0) {
    return {required: true};
  }
  return urls.every(isWebURL) ? null : {urlList: true};
};

@Component({
  selector: 'app-send',
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.scss']
})
export class SendComponent implements OnInit {

  public saucenaoLoading = false;
  public submitting = false;

  constructor(
    private urlService: HydrusUrlService,
    private route: ActivatedRoute,
    private snackbar: MatSnackBar,
    private router: Router,
    public saucenaoService: SaucenaoService,
    private fileService: HydrusFilesService,
    public settings: SettingsService,
    private errorService: ErrorService,
    public downloadManager: HydrusUrlDownloadManagerService
  ) { }

  sendForm = new FormGroup({
    sendUrls: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, hydrusURLListValidator]
    }),
    destPageName: new FormControl(this.settings.appSettings.sendDefaultPage, {nonNullable: true}),
    showDestinationPage: new FormControl(false, {nonNullable: true})
  });

  get sendUrls() {
    return this.sendForm.controls.sendUrls;
  }

  saucenaoResults: SaucenaoResults[];

  readonly inputURLs$ = this.sendUrls.valueChanges.pipe(
    startWith(this.sendUrls.value),
    map(value => parseHydrusURLInput(value)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  readonly currentUrlInfo$ = this.inputURLs$.pipe(
    debounceTime(200),
    switchMap(urls => urls.length === 1 && isWebURL(urls[0]) ? this.urlService.getUrlInfo(urls[0]).pipe(
      catchError(() => of(null))
    ) : of(null)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  readonly currentUrlFiles$ = this.inputURLs$.pipe(
    debounceTime(200),
    switchMap(urls => urls.length === 1 && isWebURL(urls[0]) ? this.urlService.getUrlFiles(urls[0]).pipe(
      catchError(() => of(null))
    ) : of(null)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  readonly currentUrlBasicFileInfo$ = this.currentUrlFiles$.pipe(
    map(result => result ? result.url_file_statuses.filter(file => file.status === 2).map(file => file.hash) : []),
    switchMap(hashes => hashes.length > 0 ? this.fileService.getBasicFilesByHash(hashes) : of(null))
  );

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      if(params.has('url')) {
        this.setUrlValueFromQuery(params.get('url'));
        return;
      }

      const sharedText = ['text', 'title']
        .map(parameter => params.get(parameter))
        .find(value => !!value && sharedTextUrlRegex.test(value));
      const matchedURL = sharedText?.match(sharedTextUrlRegex)?.[0];
      if(matchedURL) {
        this.setUrlValueFromQuery(matchedURL);
      }
    });
  }

  setUrlValueFromQuery(url: string) {
    this.sendUrls.setValue(this.fixDiscordURL(url));
    this.sendUrls.markAsTouched();
  }

  clearInput() {
    this.sendUrls.setValue('');
    this.sendUrls.markAsUntouched();
    this.saucenaoResults = null;
    this.router.navigate(['/send'], {replaceUrl: true});
  }

  async send(url: string, reset = false) {
    return this.queueURLs([this.fixDiscordURL(url)], reset);
  }

  async onSubmit() {
    if(this.sendForm.invalid || this.submitting) {
      return;
    }
    await this.queueURLs(parseHydrusURLInput(this.sendUrls.value), this.settings.appSettings.sendResetFormAfterSend);
  }

  async retry(job: HydrusUrlDownloadJob) {
    const accepted = await this.downloadManager.retry(job.id);
    this.snackbar.open(accepted ? 'URL accepted by Hydrus' : 'Hydrus rejected the URL', undefined, {duration: 3000});
  }

  saucenaoLookup() {
    const url = this.singleInputURL();
    if(!url) {
      return;
    }
    this.saucenaoLoading = true;
    this.saucenaoResults = null;
    this.saucenaoService.search({url}).subscribe(
      results => {
        this.saucenaoLoading = false;
        this.saucenaoResults = results;
      },
      error => {
        this.saucenaoLoading = false;
        this.errorService.handleHttpError(error);
      });
  }

  singleInputURL() {
    const urls = parseHydrusURLInput(this.sendUrls.value);
    return urls.length === 1 && isWebURL(urls[0]) ? urls[0] : undefined;
  }

  private async queueURLs(urls: string[], reset: boolean) {
    this.submitting = true;
    try {
      const result = await this.downloadManager.queueUrls(urls.map(url => this.fixDiscordURL(url)), this.downloadOptions());
      const message = result.failed === 0
        ? `${result.accepted} URL${result.accepted === 1 ? '' : 's'} accepted by Hydrus`
        : `${result.accepted} accepted, ${result.failed} failed`;
      this.snackbar.open(message, undefined, {duration: 5000});
      if(reset && result.failed === 0) {
        this.clearInput();
      }
      return result;
    } catch (error) {
      this.errorService.handleHydrusError(error, 'Error submitting URLs');
      return undefined;
    } finally {
      this.submitting = false;
    }
  }

  private downloadOptions(): AddUrlOptions {
    const options: AddUrlOptions = {
      show_destination_page: this.sendForm.controls.showDestinationPage.value
    };
    const destinationPageName = this.sendForm.controls.destPageName.value.trim();
    if(destinationPageName) {
      options.destination_page_name = destinationPageName;
    }
    return options;
  }

  private fixDiscordURL(url: string) {
    return this.settings.appSettings.sendFixDiscordUrls
      ? url.replace('https://media.discordapp.net', 'https://cdn.discordapp.com')
      : url;
  }
}
