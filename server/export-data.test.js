const { SKIP_COLLECTIONS, selectCollections } = require('./export-data');

describe('export-data', () => {
  test('ข้าม system.* เสมอ', () => {
    expect(selectCollections(['system.views', 'petitions'], [], SKIP_COLLECTIONS)).toEqual(['petitions']);
  });

  test('ข้าม collection log ที่ไม่มีค่าเชิงกู้คืน (auto-sync commit ทุกชั่วโมง)', () => {
    expect(SKIP_COLLECTIONS).toContain('apirequestlogs');
    expect(selectCollections(['apirequestlogs', 'apikeys'], [], SKIP_COLLECTIONS)).toEqual(['apikeys']);
  });

  test('--only ชนะทุกอย่าง (สั่งตรงๆ ให้ export ได้)', () => {
    expect(selectCollections(['apirequestlogs', 'apikeys'], ['apirequestlogs'], SKIP_COLLECTIONS))
      .toEqual(['apirequestlogs']);
  });
});
