import { of, throwError } from 'rxjs';
import { HydrusUrlType } from './hydrus-url';
import { HydrusUrlDownloadManagerService } from './hydrus-url-download-manager.service';

describe('HydrusUrlDownloadManagerService', () => {
  let addUrl: jasmine.Spy;
  let getUrlInfo: jasmine.Spy;
  let manager: HydrusUrlDownloadManagerService;

  beforeEach(() => {
    getUrlInfo = jasmine.createSpy('getUrlInfo').and.returnValue(of({
      normalised_url: 'https://example.com/gallery',
      url_type: HydrusUrlType.Gallery,
      url_type_string: 'gallery url',
      match_name: 'Example gallery',
      can_parse: true
    }));
    addUrl = jasmine.createSpy('addUrl').and.returnValue(of({
      human_result_text: 'URL added successfully.',
      normalised_url: 'https://example.com/gallery'
    }));
    manager = new HydrusUrlDownloadManagerService({getUrlInfo, addUrl} as any);
  });

  it('classifies and submits gallery URLs through the compatible add URL endpoint', async () => {
    const result = await manager.queueUrls(['https://example.com/gallery'], {
      destination_page_name: 'Web downloads',
      show_destination_page: false
    });

    expect(result).toEqual({total: 1, accepted: 1, failed: 0});
    expect(manager.jobs()[0].info?.url_type).toBe(HydrusUrlType.Gallery);
    expect(manager.jobs()[0].status).toBe('accepted');
    expect(addUrl).toHaveBeenCalledOnceWith('https://example.com/gallery', {
      destination_page_name: 'Web downloads',
      show_destination_page: false
    });
  });

  it('still submits when URL classification is unavailable', async () => {
    getUrlInfo.and.returnValue(throwError(() => new Error('Not classified')));

    const result = await manager.queueUrls(['https://example.com/file.jpg']);

    expect(result.accepted).toBe(1);
    expect(addUrl).toHaveBeenCalled();
  });

  it('retains rejected URLs with an actionable error status', async () => {
    addUrl.and.returnValue(throwError(() => ({error: {error: 'No parser found\nTraceback'}})));

    const result = await manager.queueUrls(['https://example.com/bad']);

    expect(result.failed).toBe(1);
    expect(manager.jobs()[0].status).toBe('error');
    expect(manager.jobs()[0].error).toBe('No parser found');
  });
});
