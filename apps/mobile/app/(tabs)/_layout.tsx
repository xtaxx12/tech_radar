import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { UserAvatar } from '../../components/UserAvatar';
import { useAuth } from '../../lib/auth';
import { theme } from '../../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'unauthenticated') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          color: theme.colors.textPrimary,
          fontWeight: '700',
          fontFamily: theme.fonts.semibold
        },
        headerShadowVisible: false,
        headerRight: () => <UserAvatar />,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.medium,
          fontSize: 11,
          letterSpacing: 0.2
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        sceneStyle: { backgroundColor: theme.colors.background }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'radio' : 'radio-outline'} color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'star' : 'star-outline'} color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat IA',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'sparkles' : 'sparkles-outline'} color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}
