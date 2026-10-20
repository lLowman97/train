import { Pressable, StyleSheet } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function HeuteScreen() {
  const { session } = useSession();
  const username = session?.user.user_metadata.username as string | undefined;

  return (
    <ScreenPlaceholder
      title="Heute"
      subtitle={username ? `Hi @${username}, dein Training für heute.` : 'Dein Training für heute.'}
      planned={[
        'Heutiger Trainingstag aus dem Wochenkalender',
        'Training starten mit Werten vom letzten gleichen Training',
        'Kurzstatistik der aktuellen Woche',
      ]}>
      {/* Temporary until the profile screen exists. */}
      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.button}>
          <ThemedText type="small" themeColor="textSecondary">
            Abmelden
          </ThemedText>
        </ThemedView>
      </Pressable>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
