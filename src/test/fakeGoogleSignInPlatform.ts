import type { GoogleSignInPlatform, GoogleSignInResult } from '../lib/googleSignIn';

/**
 * In-memory GoogleSignInPlatform for tests. `queue()` answers the next signIn() calls in order (the last answer
 * is repeated when the queue runs dry), `hold()` keeps the next call pending until the test resolves it.
 */
export class FakeGoogleSignInPlatform implements GoogleSignInPlatform {
  signInCalls = 0;
  private readonly answers: (GoogleSignInResult | Error)[] = [];
  private last: GoogleSignInResult | Error = { type: 'cancelled' };
  private held: ((result: GoogleSignInResult) => void) | null = null;
  private holdNext = false;

  queue(result: GoogleSignInResult): void {
    this.answers.push(result);
  }

  queueError(error: Error): void {
    this.answers.push(error);
  }

  /** The next signIn() waits; the returned function answers it. */
  hold(): (result: GoogleSignInResult) => void {
    this.holdNext = true;
    return (result) => this.held?.(result);
  }

  async signIn(): Promise<GoogleSignInResult> {
    this.signInCalls += 1;
    if (this.holdNext) {
      this.holdNext = false;
      return new Promise<GoogleSignInResult>((resolve) => {
        this.held = resolve;
      });
    }
    const next = this.answers.shift() ?? this.last;
    this.last = next;
    if (next instanceof Error) throw next;
    return next;
  }
}
