import { Redirect } from 'expo-router';

/** "/" (where sign-in lands) opens Today; M3 reads `startPage` of me/settings here. */
export default function Index() {
  return <Redirect href="/today" />;
}
