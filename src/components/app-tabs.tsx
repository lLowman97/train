import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Heute</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="today" selectedColor={colors.accent} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="plaene">
        <NativeTabs.Trigger.Label>Pläne</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="list.bullet.clipboard"
          md="fitness_center"
          selectedColor={colors.accent}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="fortschritt">
        <NativeTabs.Trigger.Label>Fortschritt</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="chart.line.uptrend.xyaxis"
          md="show_chart"
          selectedColor={colors.accent}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="koerper">
        <NativeTabs.Trigger.Label>Körper</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="scalemass" md="monitor_weight" selectedColor={colors.accent} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="freunde">
        <NativeTabs.Trigger.Label>Freunde</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="group" selectedColor={colors.accent} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
