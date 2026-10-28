import { useLocalSearchParams } from 'expo-router';
import { TemplatePreviewScreen } from '../../../features/templates/TemplatePreviewScreen';

/** `id` = uuid of one of my templates, or `library:<key>` for a built-in one. */
export default function TemplatePreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TemplatePreviewScreen param={String(id)} />;
}
