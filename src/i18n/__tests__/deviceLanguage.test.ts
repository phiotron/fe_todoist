describe('first start without saved settings', () => {
  it('uses English on an English device', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-localization', () => ({
        getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
        getCalendars: () => [],
      }));
      const fresh = require('../index') as typeof import('../index');
      expect(fresh.default.language).toBe('en');
    });
  });

  it('uses Vietnamese on a device whose language is not supported', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-localization', () => ({
        getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-FR' }],
        getCalendars: () => [],
      }));
      const fresh = require('../index') as typeof import('../index');
      expect(fresh.default.language).toBe('vi');
    });
  });
});
