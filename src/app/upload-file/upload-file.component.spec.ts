import { FormControl, FormGroup } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { HydrusAddFileStatus } from '../hydrus-upload.service';
import { HydrusSearchTags } from '../hydrus-tags';
import {
  UploadFileComponent,
  canTagUploadedFile,
  tagsForUploadedFile,
  uploadTagServiceValidator
} from './upload-file.component';

describe('UploadFileComponent', () => {
  let component: UploadFileComponent;

  beforeEach(() => {
    component = Object.create(UploadFileComponent.prototype);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds every selected folder file to the upload queue and resets the picker', () => {
    const files = [new File(['one'], 'one.jpg'), new File(['two'], 'two.png')];
    const addFiles = jasmine.createSpy('addFiles');
    (component as any).fileInput = {addFiles};
    const input = {files, value: 'chosen-folder'} as unknown as HTMLInputElement;

    component.addFolder({target: input} as unknown as Event);

    expect(addFiles).toHaveBeenCalledOnceWith(files);
    expect(input.value).toBe('');
  });

  it('uploads a file and applies the configured tags to its returned hash', async () => {
    const file = new File(['image'], 'picture.png');
    component.uploadForm = new FormGroup({
      fileInput: new FormControl([file], {nonNullable: true}),
      tags: new FormControl<HydrusSearchTags>(['series:test'], {nonNullable: true}),
      tagServiceKey: new FormControl('service-key', {nonNullable: true}),
      addFilenameTag: new FormControl(true, {nonNullable: true})
    }, {validators: uploadTagServiceValidator});
    const addFile = jasmine.createSpy('addFile').and.returnValue(of(new HttpResponse({
      body: {
        status: HydrusAddFileStatus.STATUS_SUCCESSFUL_AND_NEW,
        hash: 'uploaded-hash',
        note: 'imported'
      }
    })));
    const addTagsToService = jasmine.createSpy('addTagsToService').and.returnValue(of(undefined));
    const removeFile = jasmine.createSpy('removeFile');
    (component as any).uploadService = {addFile};
    (component as any).tagsService = {addTagsToService};
    (component as any).snackbar = {open: jasmine.createSpy('open')};
    (component as any).errorService = {handleHydrusError: jasmine.createSpy('handleHydrusError')};
    (component as any).state = {set: jasmine.createSpy('set')};
    (component as any).fileInput = {removeFile};

    await component.handleUpload();

    expect(addFile).toHaveBeenCalledOnceWith(file);
    expect(addTagsToService).toHaveBeenCalledOnceWith(
      'uploaded-hash',
      ['series:test', 'filename:picture.png'],
      'service-key'
    );
    expect(removeFile).toHaveBeenCalledOnceWith(file);
  });
});

describe('upload tagging', () => {
  function taggingForm(tags: Array<string | string[]>, tagServiceKey = '', addFilenameTag = false) {
    return new FormGroup({
      tags: new FormControl(tags, {nonNullable: true}),
      tagServiceKey: new FormControl(tagServiceKey, {nonNullable: true}),
      addFilenameTag: new FormControl(addFilenameTag, {nonNullable: true})
    }, {validators: uploadTagServiceValidator});
  }

  it('requires a tag service when ordinary or filename tags are requested', () => {
    expect(taggingForm(['series:test']).hasError('uploadTagServiceRequired')).toBeTrue();
    expect(taggingForm([], '', true).hasError('uploadTagServiceRequired')).toBeTrue();
    expect(taggingForm(['series:test'], 'service-key').valid).toBeTrue();
    expect(taggingForm([]).valid).toBeTrue();
  });

  it('deduplicates ordinary tags and adds a filename tag to new files', () => {
    const file = new File(['image'], 'picture.png');

    expect(tagsForUploadedFile(
      ['series:test', 'series:test', ['ignored-or-tag']],
      file,
      true,
      HydrusAddFileStatus.STATUS_SUCCESSFUL_AND_NEW
    )).toEqual(['series:test', 'filename:picture.png']);
  });

  it('keeps ordinary tags but omits filename tags for already-known files', () => {
    const file = new File(['image'], 'picture.png');

    expect(tagsForUploadedFile(
      ['creator:example'],
      file,
      true,
      HydrusAddFileStatus.STATUS_SUCCESSFUL_BUT_REDUNDANT
    )).toEqual(['creator:example']);
    expect(canTagUploadedFile(HydrusAddFileStatus.STATUS_SUCCESSFUL_BUT_REDUNDANT)).toBeTrue();
    expect(canTagUploadedFile(HydrusAddFileStatus.STATUS_ERROR)).toBeFalse();
  });
});
