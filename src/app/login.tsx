import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'register';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Supabase returns English messages; show the common ones in German.
function translateAuthError(message: string) {
  if (message.includes('Invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (message.includes('User already registered')) return 'Für diese E-Mail gibt es schon ein Konto.';
  if (message.includes('Email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if (message.includes('Password should be')) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
  if (message.includes('valid email') || message.includes('invalid format')) {
    return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  }
  return message;
}

export default function LoginScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function register() {
    const name = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setError('Benutzername: 3–20 Zeichen, nur Kleinbuchstaben, Zahlen und _.');
      return;
    }
    const { data: available, error: rpcError } = await supabase.rpc('username_available', {
      name,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!available) {
      setError('Dieser Benutzername ist schon vergeben.');
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: name } },
    });
    if (signUpError) {
      setError(translateAuthError(signUpError.message));
    } else if (!data.session) {
      // Email confirmation is switched on in Supabase.
      setInfo('Fast geschafft! Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, und melde dich dann an.');
      setMode('login');
    }
  }

  async function login() {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) setError(translateAuthError(signInError.message));
  }

  async function submit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await (isRegister ? register() : login());
    } finally {
      setBusy(false);
    }
  }

  const inputProps: TextInputProps = {
    style: [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }],
    placeholderTextColor: theme.textSecondary,
    autoCapitalize: 'none',
    autoCorrect: false,
    editable: !busy,
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="title" themeColor="accent">
              train
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {isRegister ? 'Neues Konto erstellen' : 'Willkommen zurück'}
            </ThemedText>

            <ThemedView style={styles.form}>
              {isRegister && (
                <TextInput
                  {...inputProps}
                  placeholder="Benutzername"
                  value={username}
                  onChangeText={setUsername}
                  textContentType="username"
                />
              )}
              <TextInput
                {...inputProps}
                placeholder="E-Mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
              <TextInput
                {...inputProps}
                placeholder="Passwort"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={isRegister ? 'newPassword' : 'password'}
                onSubmitEditing={submit}
              />

              {error && (
                <ThemedText type="small" themeColor="danger">
                  {error}
                </ThemedText>
              )}
              {info && (
                <ThemedText type="small" themeColor="accent">
                  {info}
                </ThemedText>
              )}

              <Pressable
                onPress={submit}
                disabled={busy}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.accent },
                  (pressed || busy) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    {isRegister ? 'Registrieren' : 'Anmelden'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(isRegister ? 'login' : 'register');
                  setError(null);
                  setInfo(null);
                }}
                disabled={busy}
                style={styles.switch}>
                <ThemedText type="small" themeColor="textSecondary">
                  {isRegister ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderRadius: Spacing.three,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  switch: {
    alignItems: 'center',
    padding: Spacing.two,
  },
});
