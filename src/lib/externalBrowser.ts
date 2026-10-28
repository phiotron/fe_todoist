import { Linking } from 'react-native';

/**
 * Opens a web page outside the app (Apple / Facebook sign-in, the Calendar consent page). The provider ends by redirecting to
 * a taskly:// deep link, which brings the user back (routes src/app/oauth/[provider].tsx and src/app/calendar/connected.tsx).
 * Tests install a fake instead of touching the system.
 */
export interface ExternalBrowser {
  open(url: string): Promise<void>;
}

const systemBrowser: ExternalBrowser = { open: (url) => Linking.openURL(url) };

let current: ExternalBrowser = systemBrowser;

export function setExternalBrowser(browser: ExternalBrowser | null): void {
  current = browser ?? systemBrowser;
}

/** true = the page was handed to the system. Never throws (no browser installed, blocked...). */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    await current.open(url);
    return true;
  } catch {
    return false;
  }
}
