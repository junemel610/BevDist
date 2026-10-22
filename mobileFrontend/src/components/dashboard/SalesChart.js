import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Path, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '../../styles/theme';
import { chartGeometry, formatPeso, formatAxis } from './chartGeometry';

export function SalesChart({ title, subtitle, data, variant = 'area' }) {
  const [showValues, setShowValues] = useState(false);
  const { left, right, top, bottom, ceiling, slot, points } = chartGeometry(data.map(item => item.value));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z` : '';
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.total}>{formatPeso(total)}</Text>
      <Text style={styles.caption}>Total for this sample period</Text>
      {data.length ? (
        <View accessible accessibilityRole="image" accessibilityLabel={`${title}. Total ${formatPeso(total)}. Use Show values for every data point.`}>
          <Svg width="100%" height={204} viewBox="0 0 360 204">
            {[0, 0.5, 1].map(ratio => {
              const y = bottom - ratio * (bottom - top);
              return (
                <React.Fragment key={ratio}>
                  <Line x1={left} y1={y} x2={right} y2={y} stroke={theme.colors.border} strokeDasharray="3 4" />
                  <SvgText x={left - 8} y={y + 4} textAnchor="end" fontSize={12} fill={theme.colors.textLight}>{formatAxis(ceiling * ratio)}</SvgText>
                </React.Fragment>
              );
            })}
            {variant === 'area' && <Path d={area} fill={theme.colors.primarySoft} />}
            {variant === 'area' && <Path d={line} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} />}
            {points.map((point, index) => (
              <React.Fragment key={data[index].label}>
                {variant === 'bar' ? (
                  <Rect x={point.x - slot * 0.27} y={point.y} width={slot * 0.54} height={bottom - point.y} rx={4} fill={theme.colors.primary} />
                ) : <Circle cx={point.x} cy={point.y} r={3.5} fill={theme.colors.primary} />}
                <SvgText x={point.x} y={bottom + 23} textAnchor="middle" fontSize={12} fill={theme.colors.textLight}>{data[index].label}</SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </View>
      ) : <Text style={styles.empty}>No sales recorded for this period.</Text>}
      {data.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${showValues ? 'Hide' : 'Show'} values for ${title}`} accessibilityState={{ expanded: showValues }} onPress={() => setShowValues(value => !value)} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <Text style={styles.toggleText}>{showValues ? 'Hide values' : 'Show values'}</Text>
          <MaterialIcons name={showValues ? 'expand-less' : 'expand-more'} size={20} color={theme.colors.primary} accessible={false} />
        </Pressable>
      )}
      {showValues && data.map(item => (
        <View key={item.label} style={styles.dataRow}>
          <Text style={styles.dataLabel}>{item.label}</Text>
          <Text style={styles.dataValue}>{formatPeso(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: theme.spacing.lg },
  title: { fontSize: theme.fontSize.base, fontWeight: '600', color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textLight, marginTop: 4 },
  total: { fontSize: theme.fontSize['2xl'], fontWeight: '700', color: theme.colors.primary, marginTop: 16 },
  caption: { fontSize: theme.fontSize.xs, color: theme.colors.textLight, marginTop: 4, marginBottom: 16 },
  toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingHorizontal: 8 },
  toggleText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.primary },
  pressed: { backgroundColor: theme.colors.primarySoft },
  dataRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  dataLabel: { color: theme.colors.textLight, fontSize: theme.fontSize.base },
  dataValue: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '600' },
  empty: { color: theme.colors.textLight, paddingVertical: 32, fontSize: theme.fontSize.base },
});
