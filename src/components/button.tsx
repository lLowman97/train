import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
};

export function Button({ title, variant = 'primary', busy = false, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const textColor = primary ? theme.background : theme.text;

  return (
    <Pressable
      {...rest}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.backgroundElement },
        (pressed || disabled || busy) && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText type="smallBold" style={{ color: textColor }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  dimmed: {
    opacity: 0.6,
  },
});
