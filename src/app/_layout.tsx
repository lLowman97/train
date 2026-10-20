import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ActiveWorkoutProvider } from '@/lib/active-workout';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <ActiveWorkoutProvider>
          <RootNavigator />
          <AnimatedSplashOverlay />
        </ActiveWorkoutProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();

  // The splash overlay stays on top while the stored session is loaded.
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="plan-import"
          options={{ headerShown: true, title: 'Plan importieren', presentation: 'modal' }}
        />
        <Stack.Screen
          name="plan/[id]"
          options={{ headerShown: true, title: 'Plan', headerBackTitle: 'Pläne' }}
        />
        <Stack.Screen
          name="workout"
          options={{ headerShown: true, title: 'Training', headerBackTitle: 'Heute' }}
        />
        <Stack.Screen
          name="exercise-picker"
          options={{ headerShown: true, title: 'Übung wählen', presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
