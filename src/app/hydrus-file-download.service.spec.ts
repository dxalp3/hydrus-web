import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorService } from './error.service';
import { HydrusBasicFile } from './hydrus-file';
import { HydrusFileDownloadService } from './hydrus-file-download.service';
import { HydrusFilesService } from './hydrus-files.service';
import { HydrusVersionService } from './hydrus-version.service';
import { Observable, of } from 'rxjs';

describe('HydrusFileDownloadService', () => {
  let service: HydrusFileDownloadService;
  let snackbar: jasmine.SpyObj<MatSnackBar>;
  let filesService: jasmine.SpyObj<HydrusFilesService>;

  beforeEach(() => {
    snackbar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    snackbar.open.and.returnValue(jasmine.createSpyObj('MatSnackBarRef', ['dismiss']));
    filesService = jasmine.createSpyObj<HydrusFilesService>('HydrusFilesService', ['getFileAsFile']);

    service = new HydrusFileDownloadService(
      filesService,
      snackbar,
      jasmine.createSpyObj<HydrusVersionService>('HydrusVersionService', [], {hydrusVersion$: undefined}),
      jasmine.createSpyObj<ErrorService>('ErrorService', ['handleHydrusError'])
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('downloads every file in a bulk request', async () => {
    const files = [
      {file_id: 1},
      {file_id: 2},
      {file_id: 3}
    ] as HydrusBasicFile[];
    const saveFileBlob = spyOn<any>(service, 'saveFileBlob').and.resolveTo();

    await service.saveFiles(files);

    expect(saveFileBlob).toHaveBeenCalledTimes(3);
    expect(snackbar.open).toHaveBeenCalledWith('3 files downloaded', undefined, {duration: 2000});
  });

  it('writes bulk downloads into the selected directory', async () => {
    const file = new File(['data'], 'hash.jpg', {type: 'image/jpeg'});
    filesService.getFileAsFile.and.returnValue(of(file));
    const writable = jasmine.createSpyObj('FileSystemWritableFileStream', ['write', 'close']);
    writable.write.and.resolveTo();
    writable.close.and.resolveTo();
    const fileHandle = jasmine.createSpyObj('FileSystemFileHandle', ['createWritable']);
    fileHandle.createWritable.and.resolveTo(writable);
    const directory = jasmine.createSpyObj('FileSystemDirectoryHandle', ['getFileHandle']);
    directory.getFileHandle.and.resolveTo(fileHandle);

    await (service as any).saveFileBlob({file_id: 1}, directory);

    expect(directory.getFileHandle).toHaveBeenCalledWith('hash.jpg', {create: true});
    expect(writable.write).toHaveBeenCalledWith(file);
    expect(writable.close).toHaveBeenCalled();
  });

  it('creates every segment of a selection group download folder', async () => {
    const imagesDirectory = jasmine.createSpyObj<FileSystemDirectoryHandle>('imagesDirectory', ['getDirectoryHandle']);
    const projectDirectory = jasmine.createSpyObj<FileSystemDirectoryHandle>('projectDirectory', ['getDirectoryHandle']);
    const rootDirectory = jasmine.createSpyObj<FileSystemDirectoryHandle>('rootDirectory', ['getDirectoryHandle']);
    rootDirectory.getDirectoryHandle.and.resolveTo(projectDirectory);
    projectDirectory.getDirectoryHandle.and.resolveTo(imagesDirectory);

    const result = await service.resolveDownloadDirectory(rootDirectory, 'project/images');

    expect(rootDirectory.getDirectoryHandle).toHaveBeenCalledOnceWith('project', {create: true});
    expect(projectDirectory.getDirectoryHandle).toHaveBeenCalledOnceWith('images', {create: true});
    expect(result).toBe(imagesDirectory);
  });

  it('prompts for a directory before downloading a single file', async () => {
    const hfile = {file_id: 1} as HydrusBasicFile;
    const directory = jasmine.createSpyObj<FileSystemDirectoryHandle>('FileSystemDirectoryHandle', ['getFileHandle']);
    spyOn(service, 'chooseDownloadDirectory').and.resolveTo(directory);
    const saveFiles = spyOn(service, 'saveFiles').and.resolveTo();

    await service.saveFile(hfile);

    expect(service.chooseDownloadDirectory).toHaveBeenCalled();
    expect(saveFiles).toHaveBeenCalledOnceWith([hfile], directory);
  });

  it('does not download a single file when directory selection is cancelled', async () => {
    const hfile = {file_id: 1} as HydrusBasicFile;
    spyOn(service, 'chooseDownloadDirectory').and.resolveTo(null);
    const saveFiles = spyOn(service, 'saveFiles').and.resolveTo();
    const browserDownload = spyOn<any>(service, 'saveFileToBrowserDownloads').and.resolveTo();

    await service.saveFile(hfile);

    expect(saveFiles).not.toHaveBeenCalled();
    expect(browserDownload).not.toHaveBeenCalled();
  });

  it('stops the active API request and skips remaining files when cancelled', async () => {
    let requestCancelled = false;
    filesService.getFileAsFile.and.returnValue(new Observable<File>(() =>
      () => requestCancelled = true
    ));
    const files = [
      {file_id: 1, hash: 'one', ext: '.jpg'},
      {file_id: 2, hash: 'two', ext: '.jpg'}
    ] as HydrusBasicFile[];

    const download = service.saveFiles(files);
    const job = service.downloadJobs$.value[0];
    service.cancelDownload(job.id);
    await download;

    expect(requestCancelled).toBeTrue();
    expect(filesService.getFileAsFile).toHaveBeenCalledTimes(1);
    expect(service.downloadJobs$.value[0].status).toBe('cancelled');
    expect(service.downloadJobs$.value[0].completedFiles).toBe(0);
  });
});
