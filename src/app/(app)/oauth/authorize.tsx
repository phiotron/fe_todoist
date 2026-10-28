import { useLocalSearchParams } from 'expo-router';
import { OAuthAuthorizeScreen } from '../../../features/oauth/OAuthAuthorizeScreen';

/** Deep link taskly://oauth/authorize?client_id=…&redirect_uri=…&scope=…&state=…&code_challenge=…&code_challenge_method=S256 */
export default function OAuthAuthorizeRoute() {
  return <OAuthAuthorizeScreen params={useLocalSearchParams()} />;
}
