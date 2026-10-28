import type { ExternalBrowser } from '../lib/externalBrowser';

/** Records the pages the app opens in the browser; `failNext()` makes the next open() throw (no browser installed). */
export class FakeExternalBrowser implements ExternalBrowser {
  readonly opened: string[] = [];
  private failing = false;

  failNext(): void {
    this.failing = true;
  }

  async open(url: string): Promise<void> {
    if (this.failing) {
      this.failing = false;
      throw new Error('no browser');
    }
    this.opened.push(url);
  }

  /** The `state` query parameter of the last opened page. */
  lastState(): string {
    const url = new URL(this.opened[this.opened.length - 1]);
    const state = url.searchParams.get('state');
    if (!state) throw new Error('last page has no state');
    return state;
  }
}
