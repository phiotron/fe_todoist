import { hitTest, type Rect } from '../dnd';

const rects = new Map<string, Rect>([
  ['column', { x: 0, y: 0, width: 300, height: 600 }],
  ['inner', { x: 20, y: 100, width: 100, height: 100 }],
  ['other', { x: 320, y: 0, width: 300, height: 600 }],
]);

describe('hitTest', () => {
  it('finds the smallest zone containing the point', () => {
    expect(hitTest(rects, 50, 150)).toBe('inner');
    expect(hitTest(rects, 50, 300)).toBe('column');
    expect(hitTest(rects, 400, 10)).toBe('other');
  });

  it('is null outside every zone and includes the edges', () => {
    expect(hitTest(rects, 310, 10)).toBeNull();
    expect(hitTest(rects, -1, 10)).toBeNull();
    expect(hitTest(rects, 300, 600)).toBe('column');
    expect(hitTest(new Map(), 1, 1)).toBeNull();
  });
});
