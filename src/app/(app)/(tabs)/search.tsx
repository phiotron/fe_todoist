import { SearchScreen } from '../../../features/search/SearchScreen';

/** Always routable (Browse → search icon); on the tab bar only when in navTabs (M3). */
export default function SearchRoute() {
  return <SearchScreen />;
}
