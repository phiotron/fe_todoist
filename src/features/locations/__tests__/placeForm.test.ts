import { coordinateText, parseCoordinate, validatePlace, type PlaceFormValues } from '../placeForm';

const VALID: PlaceFormValues = { name: '  Văn phòng ', latitude: '10.7769', longitude: '106,7009', radius: '200' };

describe('validatePlace', () => {
  it('builds the request: trimmed name, comma or dot decimals, integer radius', () => {
    expect(validatePlace(VALID)).toEqual({
      request: { name: 'Văn phòng', latitude: 10.7769, longitude: 106.7009, radius: 200 },
    });
  });

  it('accepts the edges of every range', () => {
    expect('request' in validatePlace({ name: 'A', latitude: '-90', longitude: '180', radius: '100' })).toBe(true);
    expect('request' in validatePlace({ name: 'A', latitude: '90', longitude: '-180', radius: '5000' })).toBe(true);
  });

  it.each([
    [{ name: '   ' }, 'name', 'reminders.places.invalidName'],
    [{ name: 'x'.repeat(101) }, 'name', 'reminders.places.invalidName'],
    [{ latitude: '90.5' }, 'latitude', 'reminders.places.invalidLatitude'],
    [{ latitude: '' }, 'latitude', 'reminders.places.invalidLatitude'],
    [{ latitude: 'abc' }, 'latitude', 'reminders.places.invalidLatitude'],
    [{ longitude: '-181' }, 'longitude', 'reminders.places.invalidLongitude'],
    [{ radius: '99' }, 'radius', 'reminders.places.invalidRadius'],
    [{ radius: '5001' }, 'radius', 'reminders.places.invalidRadius'],
    [{ radius: '150.5' }, 'radius', 'reminders.places.invalidRadius'],
    [{ radius: '' }, 'radius', 'reminders.places.invalidRadius'],
  ])('rejects %j with %s', (patch, field, key) => {
    const result = validatePlace({ ...VALID, ...patch });

    expect('errors' in result && (result.errors as Record<string, string>)[field]).toBe(key);
  });

  it('reports every wrong field at once', () => {
    const result = validatePlace({ name: '', latitude: 'x', longitude: 'y', radius: '1' });

    expect('errors' in result && Object.keys(result.errors).sort()).toEqual(['latitude', 'longitude', 'name', 'radius']);
  });

  it('reads coordinates typed with a comma and rounds shown ones to 6 decimals', () => {
    expect(parseCoordinate(' 10,5 ')).toBe(10.5);
    expect(Number.isNaN(parseCoordinate(''))).toBe(true);
    expect(coordinateText(10.123456789)).toBe('10.123457');
  });
});
