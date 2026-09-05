import { of } from 'rxjs';
import { HydrusApiService } from './hydrus-api.service';
import { HydrusTagsService } from './hydrus-tags.service';
import { HydrusVersionService } from './hydrus-version.service';

describe('HydrusTagsService', () => {
  let service: HydrusTagsService;
  let api: jasmine.SpyObj<HydrusApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<HydrusApiService>('HydrusApiService', ['addTags', 'searchTags']);
    api.addTags.and.returnValue(of(undefined));
    api.searchTags.and.returnValue(of({tags: [{value: 'series:test', count: 1}]}));
    const versionService = jasmine.createSpyObj<HydrusVersionService>('HydrusVersionService', ['isAtLeastVersion']);
    versionService.isAtLeastVersion.and.returnValue(of(false));
    service = new HydrusTagsService(api, versionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('replaces a local tag in one API request', () => {
    service.replaceTagOnLocalService('hash', 'old:tag', 'new:tag', 'service-key');

    expect(api.addTags).toHaveBeenCalledOnceWith({
      hash: 'hash',
      service_keys_to_actions_to_tags: {
        'service-key': {
          0: ['new:tag'],
          1: ['old:tag']
        }
      }
    });
  });

  it('requests autocomplete results using the selected display type', () => {
    service.searchTags('ser', 'storage').subscribe();

    expect(api.searchTags).toHaveBeenCalledOnceWith({
      search: 'ser',
      tag_display_type: 'storage'
    });
  });
});
