import { COMMON_TIME_ZONES, filterTimeZones, timeZoneOptions } from '../timeZones';

describe('timeZoneOptions', () => {
  it('contains the common zones, sorted, without duplicates', () => {
    const options = timeZoneOptions('Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh');
    expect(options).toEqual([...new Set(COMMON_TIME_ZONES)].sort((a, b) => a.localeCompare(b)));
    expect(options).toContain('Asia/Ho_Chi_Minh');
    expect(options).toContain('UTC');
  });

  it('always offers the account zone and the device zone', () => {
    const options = timeZoneOptions('America/Lima', 'Pacific/Fiji');
    expect(options).toContain('America/Lima');
    expect(options).toContain('Pacific/Fiji');
    expect(timeZoneOptions('America/Lima', null)).toContain('America/Lima');
  });
});

describe('filterTimeZones', () => {
  const zones = ['Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'Europe/London'];

  it('returns every zone for an empty query', () => {
    expect(filterTimeZones(zones, '   ')).toEqual(zones);
  });

  it('matches case-insensitively, spaces or underscores, every word', () => {
    expect(filterTimeZones(zones, 'TOKYO')).toEqual(['Asia/Tokyo']);
    expect(filterTimeZones(zones, 'ho chi')).toEqual(['Asia/Ho_Chi_Minh']);
    expect(filterTimeZones(zones, 'ho_chi')).toEqual(['Asia/Ho_Chi_Minh']);
    expect(filterTimeZones(zones, 'asia minh')).toEqual(['Asia/Ho_Chi_Minh']);
    expect(filterTimeZones(zones, 'paris')).toEqual([]);
  });
});
