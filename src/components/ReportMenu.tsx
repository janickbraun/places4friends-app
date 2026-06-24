import { Alert } from 'react-native';
import { Flag } from 'lucide-react-native';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import { reportActivity } from '@/lib/reports';

/**
 * "⋮" menu with a single "Melden" action, shown on every post. Reused by the feed,
 * profile pages and the map detail sheet. Renders nothing for signed-out viewers.
 */
export function ReportMenu({
  activityId,
  reporterId,
  iconSize,
  iconColor,
}: {
  activityId: string;
  reporterId: string | null;
  iconSize?: number;
  iconColor?: string;
}) {
  if (!reporterId) return null;

  const confirmReport = () => {
    Alert.alert('Beitrag melden?', 'Dieser Beitrag wird zur Überprüfung an unser Team gemeldet.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Melden',
        style: 'destructive',
        onPress: async () => {
          const { error } = await reportActivity(activityId, reporterId);
          Alert.alert(
            error ? 'Fehler' : 'Danke',
            error
              ? 'Der Beitrag konnte nicht gemeldet werden. Bitte versuche es erneut.'
              : 'Der Beitrag wurde gemeldet. Unser Team wird ihn überprüfen.',
          );
        },
      },
    ]);
  };

  return (
    <PopoverMenu
      iconSize={iconSize}
      iconColor={iconColor}
      items={[{ label: 'Melden', icon: Flag, destructive: true, onPress: confirmReport }]}
    />
  );
}
