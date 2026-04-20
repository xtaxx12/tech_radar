import { StyleSheet, Text, View } from 'react-native';
import { scoreColor, theme } from '../lib/theme';

type Props = {
  score: number;
  size?: number;
};

/**
 * Círculo "donut" con el score al centro. No usa SVG: dos <View> anidados,
 * el externo con borde grueso de color según el score, el interno sólido
 * con el número. Evita agregar react-native-svg (nativo, requiere rebuild).
 */
export function ScoreBadge({ score, size = 52 }: Props) {
  const color = scoreColor(score);
  const borderWidth = Math.max(3, Math.round(size / 14));

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color
        }
      ]}
    >
      <Text style={[styles.value, { color, fontSize: Math.round(size * 0.4) }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 16, 32, 0.6)'
  },
  value: {
    fontFamily: theme.fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.5
  }
});
