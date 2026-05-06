import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

const { width: W, height: H } = Dimensions.get('window');

const CONF_COLORS = [
  '#fbbf24', '#f97316', '#ef4444', '#8b5cf6',
  '#3b82f6', '#10b981', '#ec4899', '#06b6d4',
];
const PIECES = 22;

interface Props {
  visible: boolean;
  dealTitle: string;
  onDone: () => void;
}

export function WinCelebration({ visible, dealTitle, onDone }: Props) {
  const overlay    = useRef(new Animated.Value(0)).current;
  const rocketY    = useRef(new Animated.Value(100)).current;
  const rocketSc   = useRef(new Animated.Value(0.4)).current;
  const textOp     = useRef(new Animated.Value(0)).current;
  const textSc     = useRef(new Animated.Value(0.6)).current;
  const hold       = useRef(new Animated.Value(0)).current;

  const pieces = useRef(
    Array.from({ length: PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const dist  = 80 + Math.random() * 130;
      return {
        x:  new Animated.Value(0),
        y:  new Animated.Value(0),
        op: new Animated.Value(0),
        ro: new Animated.Value(0),
        color: CONF_COLORS[i % CONF_COLORS.length],
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 8 + Math.random() * 8,
        isCircle: Math.random() > 0.5,
      };
    })
  ).current;

  useEffect(() => {
    if (!visible) return;

    overlay.setValue(0);
    rocketY.setValue(100);
    rocketSc.setValue(0.4);
    textOp.setValue(0);
    textSc.setValue(0.6);
    hold.setValue(0);
    pieces.forEach((p) => { p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); p.ro.setValue(0); });

    Animated.sequence([
      // 1. Fade in overlay
      Animated.timing(overlay, { toValue: 1, duration: 200, useNativeDriver: false }),

      // 2. Rocket launches
      Animated.parallel([
        Animated.spring(rocketY,  { toValue: -50, tension: 45, friction: 6, useNativeDriver: false }),
        Animated.spring(rocketSc, { toValue: 1.6, tension: 45, friction: 6, useNativeDriver: false }),
      ]),

      // 3. Confetti burst + text appears
      Animated.parallel([
        ...pieces.map((p) =>
          Animated.parallel([
            Animated.timing(p.x,  { toValue: p.tx, duration: 700, useNativeDriver: false }),
            Animated.timing(p.y,  { toValue: p.ty, duration: 700, useNativeDriver: false }),
            Animated.timing(p.ro, { toValue: 1, duration: 700, useNativeDriver: false }),
            Animated.sequence([
              Animated.timing(p.op, { toValue: 1, duration: 80,  useNativeDriver: false }),
              Animated.timing(p.op, { toValue: 0, duration: 500, delay: 150, useNativeDriver: false }),
            ]),
          ])
        ),
        Animated.spring(textSc, { toValue: 1, tension: 100, friction: 7, useNativeDriver: false }),
        Animated.timing(textOp, { toValue: 1, duration: 350, useNativeDriver: false }),
      ]),

      // 4. Hold
      Animated.timing(hold, { toValue: 1, duration: 1800, useNativeDriver: false }),

      // 5. Fade out
      Animated.timing(overlay, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start(() => onDone());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.overlay, { opacity: overlay }]} pointerEvents="none">
      {/* Confetti */}
      <View style={s.confOrigin}>
        {pieces.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              s.piece,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                backgroundColor: p.color,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: p.ro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '600deg'] }) },
                ],
                opacity: p.op,
              },
            ]}
          />
        ))}
      </View>

      {/* Rocket */}
      <Animated.Text
        style={[s.rocket, { transform: [{ translateY: rocketY }, { scale: rocketSc }] }]}
      >
        🚀
      </Animated.Text>

      {/* Message */}
      <Animated.View style={[s.textBox, { opacity: textOp, transform: [{ scale: textSc }] }]}>
        <Text style={s.emoji}>🎉</Text>
        <Text style={s.title}>Parabéns!</Text>
        <Text style={s.deal} numberOfLines={2}>{dealTitle}</Text>
        <Text style={s.sub}>Negociação marcada como ganha!</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  confOrigin: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: {
    position: 'absolute',
  },
  rocket: {
    fontSize: 72,
    textAlign: 'center',
    marginBottom: 8,
  },
  textBox: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 16,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 1,
  },
  deal: {
    fontSize: FONTS.xl,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 6,
    maxWidth: 320,
  },
  sub: {
    fontSize: FONTS.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
});
