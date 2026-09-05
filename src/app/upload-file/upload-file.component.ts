import { Component, ViewChild } from '@angular/core';
import { AbstractControl, FormGroup, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { HydrusAddFileStatus, HydrusUploadService } from '../hydrus-upload.service';
import { tap, lastValueFrom, map } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpEventType } from '@angular/common/http';
import { SettingsService } from '../settings.service';
import { HydrusTagsService } from '../hydrus-tags.service';
import { ErrorService } from '../error.service';
import { FileValidators, NgxFileDragDropComponent } from '../../lib/ngx-file-drag-drop';
import { RxState } from '@rx-angular/state';
import { HydrusServicesService } from '../hydrus-services.service';
import { getLocalTagServices } from '../hydrus-services';
import { HydrusSearchTags, isSingleTag } from '../hydrus-tags';

interface UploadStatus {
  uploading: boolean;
  filename: string | null;
  percent: number;
  upBytes: number | null;
  totalBytes: number | null;
}

export const uploadTagServiceValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const tags = control.get('tags')?.value as HydrusSearchTags | null;
  const addFilenameTag = !!control.get('addFilenameTag')?.value;
  const tagServiceKey = control.get('tagServiceKey')?.value as string | null;
  return ((tags?.length ?? 0) > 0 || addFilenameTag) && !tagServiceKey?.trim()
    ? {uploadTagServiceRequired: true}
    : null;
};

export function tagsForUploadedFile(
  tags: HydrusSearchTags,
  file: File,
  addFilenameTag: boolean,
  status: HydrusAddFileStatus
) {
  const uploadTags = tags
    .filter(isSingleTag)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  if(addFilenameTag && status === HydrusAddFileStatus.STATUS_SUCCESSFUL_AND_NEW) {
    uploadTags.push(`filename:${file.name}`);
  }
  return Array.from(new Set(uploadTags));
}

export function canTagUploadedFile(status: HydrusAddFileStatus) {
  return status === HydrusAddFileStatus.STATUS_SUCCESSFUL_AND_NEW
    || status === HydrusAddFileStatus.STATUS_SUCCESSFUL_BUT_REDUNDANT;
}

@Component({
  selector: 'app-upload-file',
  templateUrl: './upload-file.component.html',
  styleUrls: ['./upload-file.component.scss'],
  providers: [RxState]
})
export class UploadFileComponent {

  constructor(
    private uploadService: HydrusUploadService,
    private snackbar: MatSnackBar,
    private settings: SettingsService,
    private tagsService: HydrusTagsService,
    private errorService: ErrorService,
    private state: RxState<UploadStatus>,
    private hydrusServices: HydrusServicesService
  ) {
    state.set({ uploading: false, percent: 0 })
  }

  @ViewChild('fileInput') fileInput!: NgxFileDragDropComponent;

  uploadForm = new FormGroup({
    fileInput: new FormControl<File[]>([], {
      nonNullable: true,
      validators: [FileValidators.required]
    }),
    tags: new FormControl<HydrusSearchTags>([], {nonNullable: true}),
    tagServiceKey: new FormControl(this.settings.appSettings.uploadFilenameTagService ?? '', {nonNullable: true}),
    addFilenameTag: new FormControl(!!this.settings.appSettings.uploadFilenameTagService, {nonNullable: true})
  }, {validators: uploadTagServiceValidator});

  readonly tagServices$ = this.hydrusServices.hydrusServicesArray$.pipe(
    map(services => getLocalTagServices(services))
  );

  readonly uploading$ = this.state.select('uploading');
  readonly percentUploaded$ = this.state.select('percent')
  readonly uploadFilename$ = this.state.select('filename')
  readonly upBytes$ = this.state.select('upBytes')
  readonly totalBytes$ = this.state.select('totalBytes')

  onSubmit() {
    this.handleUpload();
  }

  addFolder(event: Event) {
    const input = event.target as HTMLInputElement;
    if(input.files?.length) {
      this.fileInput.addFiles(input.files);
    }
    input.value = '';
  }

  get queuedFileCount() {
    return this.uploadForm.controls.fileInput.value.length;
  }

  async handleUpload() {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    const uploadOptions = this.uploadForm.getRawValue();
    if (uploadOptions.fileInput.length > 0) {
      this.state.set({uploading: true})
      for (const file of uploadOptions.fileInput) {
        try {
          this.state.set({filename: file.webkitRelativePath || file.name})
          const response = await lastValueFrom(this.uploadService.addFile(file).pipe(
            tap(event => {
              if (event.type === HttpEventType.UploadProgress) {

                const percent = event.total ? 100 * event.loaded / event.total : 0;
                this.state.set({percent, upBytes: event.loaded, totalBytes: event.total})
              }
            })
          ))
          if(response.type === HttpEventType.Response) {
            if(!response.body) {
              throw Error('There was no response body!')
            }
            const tags = tagsForUploadedFile(
              uploadOptions.tags,
              file,
              uploadOptions.addFilenameTag,
              response.body.status
            );
            let taggingFailed = false;
            if(tags.length > 0 && canTagUploadedFile(response.body.status)) {
              try {
                await lastValueFrom(this.tagsService.addTagsToService(
                  response.body.hash,
                  tags,
                  uploadOptions.tagServiceKey
                ));
              } catch (error) {
                taggingFailed = true;
                this.errorService.handleHydrusError(error, 'File uploaded, but tags could not be applied');
              }
            }
            const message = response.body.status === HydrusAddFileStatus.STATUS_SUCCESSFUL_AND_NEW ? 'File Uploaded' : response.body?.note;
            if(!taggingFailed) {
              this.snackbar.open(tags.length > 0 && canTagUploadedFile(response.body.status)
                ? `${message} · ${tags.length} tag${tags.length === 1 ? '' : 's'} applied`
                : message, undefined, {
                duration: 5000
              });
            }
          }
        } catch (error) {
          this.errorService.handleHydrusError(error);
        } finally {
          this.fileInput.removeFile(file);
          this.state.set({filename: null, percent: 0, upBytes: 0, totalBytes: 0})
        }
      }
      this.state.set({uploading: false})
    }
  }

}
