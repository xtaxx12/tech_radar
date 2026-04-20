import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { UserProfile } from '../../lib/types';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, options, setProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<UserProfile>) => {
    setSaving(true);
    await setProfile({ ...profile, ...patch });
    setSaving(false);
  };

  const toggleInterest = (interest: string) => {
    const next = profile.interests.includes(interest)
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest];
    return update({ interests: next });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userBlock}>
          <Text style={styles.eyebrow}>SESIÓN</Text>
          <Text style={styles.userName}>{user?.name ?? user?.email ?? 'Usuario'}</Text>
          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
        </View>

        <Field label="País">
          <ChipRow
            options={options?.countries ?? ['Ecuador', 'México', 'Perú', 'Colombia']}
            selected={profile.country}
            onSelect={(country) => update({ country })}
          />
        </Field>

        <Field label="Rol">
          <ChipRow
            options={options?.roles ?? ['frontend', 'backend', 'fullstack']}
            selected={profile.role}
            onSelect={(role) => update({ role })}
          />
        </Field>

        <Field label="Nivel">
          <ChipRow
            options={options?.levels ?? ['junior', 'mid', 'senior']}
            selected={profile.level}
            onSelect={(level) => update({ level })}
          />
        </Field>

        <Field label="Intereses">
          <View style={styles.chipRow}>
            {(options?.interests ?? ['ia', 'web', 'mobile', 'cloud']).map((interest) => {
              const active = profile.interests.includes(interest);
              return (
                <Pressable
                  key={interest}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{interest}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {saving ? <Text style={styles.savingText}>Guardando…</Text> : null}

        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable key={option} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(option)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.space(5), gap: theme.space(5) },
  userBlock: { gap: theme.space(1) },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  userName: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700' },
  userEmail: { color: theme.colors.muted, fontSize: 13 },
  field: { gap: theme.space(2) },
  label: { color: theme.colors.textSecondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) },
  chip: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  chipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: theme.colors.textPrimary, fontWeight: '600' },
  savingText: { color: theme.colors.muted, fontSize: 12 },
  logout: {
    marginTop: theme.space(4),
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    alignItems: 'center'
  },
  logoutText: { color: theme.colors.danger, fontWeight: '600' }
});
