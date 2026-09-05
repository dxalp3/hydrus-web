import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { hydrusURLListValidator, parseHydrusURLInput, SendComponent } from './send.component';

describe('SendComponent', () => {
  it('parses, trims, and deduplicates one URL per line', () => {
    expect(parseHydrusURLInput([
      ' https://example.com/one.jpg ',
      '',
      'https://example.com/two.png',
      'https://example.com/one.jpg'
    ].join('\n'))).toEqual([
      'https://example.com/one.jpg',
      'https://example.com/two.png'
    ]);
  });

  it('rejects a batch containing a malformed URL', () => {
    const control = new FormControl('https://example.com/one.jpg\nnot a url');

    expect(hydrusURLListValidator(control)).toEqual({urlList: true});
  });

  it('submits a mixed batch through the download manager', async () => {
    const queueUrls = jasmine.createSpy('queueUrls').and.resolveTo({total: 2, accepted: 2, failed: 0});
    const component = new SendComponent(
      {getUrlInfo: () => of(null), getUrlFiles: () => of(null)} as any,
      {} as any,
      {open: jasmine.createSpy('open')} as any,
      {navigate: jasmine.createSpy('navigate')} as any,
      {canSaucenao: false} as any,
      {} as any,
      {appSettings: {
        sendDefaultPage: 'Web downloads',
        sendResetFormAfterSend: false,
        sendFixDiscordUrls: false
      }} as any,
      {} as any,
      {queueUrls} as any
    );
    component.sendUrls.setValue('https://example.com/gallery\nhttps://example.com/thread/123');

    await component.onSubmit();

    expect(queueUrls).toHaveBeenCalledOnceWith([
      'https://example.com/gallery',
      'https://example.com/thread/123'
    ], {
      destination_page_name: 'Web downloads',
      show_destination_page: false
    });
  });
});
