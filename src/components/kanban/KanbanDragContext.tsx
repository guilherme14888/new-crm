import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useDealStore } from '../../stores/dealStore';
import { useContactStore } from '../../stores/contactStore';
import { useUIStore } from '../../stores/uiStore';
import { KanbanCard } from './KanbanCard';
import { Deal } from '../../types/models';

const FLOATING_CARD_WIDTH = 260;

interface ColumnBounds {
  x: number;
  width: number;
  stageId: string;
  getLiveBounds?: () => { x: number; width: number } | null;
}

interface DragContextValue {
  registerColumn: (bounds: ColumnBounds) => void;
  onDragStart: (dealId: string, absX: number, absY: number, localX: number, localY: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (dealId: string, x: number, y: number) => void;
  dragTargetStageId: string | null;
  dragTargetStage: string | null;
}

const DragContext = createContext<DragContextValue | null>(null);

/** Hook que acessa o contexto de drag-and-drop do Kanban; lança erro se usado fora do KanbanDragProvider. */
export function useDragContext() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDragContext must be inside KanbanDragProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
  contactIdForDeal: (dealId: string) => string;
}

/** Provedor que orquestra o arrastar-e-soltar de cartões entre colunas do Kanban e renderiza o cartão flutuante durante o arraste. */
export function KanbanDragProvider({ children, contactIdForDeal }: Props) {
  const columns = useRef<ColumnBounds[]>([]);
  const [dragTargetStageId, setDragTargetStageId] = useState<string | null>(null);
  const [draggingInfo, setDraggingInfo] = useState<{ deal: Deal; contactName: string } | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabOffsetX = useSharedValue(FLOATING_CARD_WIDTH / 2);
  const grabOffsetY = useSharedValue(44);
  const containerRef = useRef<View>(null);
  const containerOffset = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });

  const moveDeal = useDealStore((s) => s.moveDeal);
  const setDragging = useUIStore((s) => s.setDragging);
  const contacts = useContactStore((s) => s.contacts);

  const dealsByStageIdRef = useRef(useDealStore.getState().dealsByStageId());
  useEffect(() => {
    return useDealStore.subscribe((state) => {
      dealsByStageIdRef.current = state.dealsByStageId();
    });
  }, []);

  // Registra ou atualiza os limites de uma coluna usados para detectar o alvo do arraste.
  const registerColumn = useCallback((bounds: ColumnBounds) => {
    const idx = columns.current.findIndex((c) => c.stageId === bounds.stageId);
    if (idx >= 0) columns.current[idx] = bounds;
    else columns.current.push(bounds);
  }, []);

  // Detecta sobre qual etapa (coluna) está a coordenada X atual do arraste.
  const detectStageId = useCallback((x: number): string | null => {
    for (const col of columns.current) {
      const live = col.getLiveBounds?.();
      const cx = live?.x ?? col.x;
      const cw = live?.width ?? col.width;
      if (x >= cx && x <= cx + cw) return col.stageId;
    }
    return null;
  }, []);

  // Dispara feedback háptico (início do arraste ou sucesso do drop) em plataformas nativas.
  const triggerHaptics = useCallback(async (type: 'start' | 'success') => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    if (type === 'start') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Inicia o arraste: posiciona o cartão flutuante, marca a negociação como em arraste e captura seus dados.
  const onDragStart = useCallback((dealId: string, x: number, y: number, localX: number, localY: number) => {
    dragX.value = x;
    dragY.value = y;
    lastPos.current = { x, y };
    grabOffsetX.value = localX;
    grabOffsetY.value = localY;
    setDragging(dealId);
    triggerHaptics('start');
    setDragTargetStageId(detectStageId(x));

    const allDeals = Object.values(dealsByStageIdRef.current).flat();
    const deal = allDeals.find((d) => d.id === dealId)
      ?? useDealStore.getState().deals.find((d) => d.id === dealId);
    if (deal) {
      const contact = contacts.find((c) => c.id === deal.contactId);
      const contactName = contact ? `${contact.firstName} ${contact.lastName}` : '—';
      setDraggingInfo({ deal, contactName });
    }
  }, [detectStageId, setDragging, triggerHaptics, contacts, grabOffsetX, grabOffsetY]);

  // Atualiza a posição do cartão flutuante e a coluna-alvo conforme o movimento do arraste.
  const onDragMove = useCallback((x: number, y: number) => {
    dragX.value = x;
    dragY.value = y;
    lastPos.current = { x, y };
    setDragTargetStageId(detectStageId(x));
  }, [detectStageId]);

  // Finaliza o arraste: detecta a coluna de destino e move a negociação para a nova etapa, se mudou.
  const onDragEnd = useCallback(
    async (dealId: string, x: number, _y: number) => {
      // On some platforms gesture-handler reports stale absolute coords on onEnd.
      // Use the last position we tracked during onDragMove as the source of truth.
      const finalX = lastPos.current.x || x;

      setDragging(null);
      setDraggingInfo(null);

      const targetStageId = detectStageId(finalX);
      if (!targetStageId) { setDragTargetStageId(null); return; }

      // Pull the latest deal from the store rather than from the cached grouping ref,
      // because the ref may not have been refreshed yet between drag start and drop.
      const currentDeal =
        useDealStore.getState().deals.find((d) => d.id === dealId)
        ?? Object.values(dealsByStageIdRef.current).flat().find((d) => d.id === dealId);

      if (!currentDeal) { setDragTargetStageId(null); return; }

      const currentStageId = currentDeal.stageId || currentDeal.stage;
      if (currentStageId === targetStageId) {
        setDragTargetStageId(null);
        return;
      }

      const dealsByStageId = dealsByStageIdRef.current;
      const targetDeals = dealsByStageId[targetStageId] ?? [];
      const newOrder = targetDeals.length > 0
        ? targetDeals[targetDeals.length - 1].stageOrder + 1
        : 1;

      const contactId = contactIdForDeal(dealId);
      await moveDeal(dealId, targetStageId as never, newOrder, contactId, targetStageId);
      triggerHaptics('success');
      setDragTargetStageId(null);
    },
    [detectStageId, moveDeal, contactIdForDeal, setDragging, triggerHaptics]
  );

  const floatingStyle = useAnimatedStyle(() => {
    // On web: absoluteX/Y are viewport coords, position:fixed is also viewport-relative → no offset needed
    // On native: use container-relative absolute positioning
    if (Platform.OS === 'web') {
      return {
        position: 'fixed' as any,
        left: dragX.value - grabOffsetX.value,
        top: dragY.value - grabOffsetY.value,
        width: FLOATING_CARD_WIDTH,
        zIndex: 9999,
      };
    }
    return {
      position: 'absolute',
      left: dragX.value - containerOffset.current.x - grabOffsetX.value,
      top: dragY.value - containerOffset.current.y - grabOffsetY.value,
      width: FLOATING_CARD_WIDTH,
      zIndex: 9999,
    };
  });

  // Mede o deslocamento do contêiner na tela para posicionar corretamente o cartão flutuante em plataformas nativas.
  const measureContainer = useCallback(() => {
    containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      containerOffset.current = { x: pageX, y: pageY };
    });
  }, []);

  return (
    <DragContext.Provider value={{
      registerColumn,
      onDragStart,
      onDragMove,
      onDragEnd,
      dragTargetStageId,
      dragTargetStage: dragTargetStageId,
    }}>
      <View ref={containerRef} style={{ flex: 1 }} onLayout={measureContainer}>
        {children}
        {draggingInfo && (
          <Animated.View style={floatingStyle} pointerEvents="none">
            <KanbanCard
              deal={draggingInfo.deal}
              contactName={draggingInfo.contactName}
              isFloating
            />
          </Animated.View>
        )}
      </View>
    </DragContext.Provider>
  );
}
