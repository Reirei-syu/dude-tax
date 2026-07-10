import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeResizer,
  type Node,
  type NodeProps,
  type NodeTypes,
  type Viewport,
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EmployeeRosterCard } from '../cards/EmployeeRosterCard';
import { SalaryInputCard } from '../cards/SalaryInputCard';
import { TaxSummaryCard } from '../cards/TaxSummaryCard';
import { BonusOptimizerCard } from '../cards/BonusOptimizerCard';
import { InsightsCard } from '../cards/InsightsCard';
import { AllStaffTaxCard } from '../cards/AllStaffTaxCard';
import { useTaxStore } from '../../lib/store/useTaxStore';
import type { BoardNode } from '../../types';
import { DEFAULT_NODE_SIZE } from '../../lib/db/repository';

const MIN_W = 220;
const MIN_H = 160;
const MAX_W = 4000;
const MAX_H = 4000;

function roundPx(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(MIN_W, Math.round(n));
}

/**
 * 可缩放外壳：
 * - 不显示拖曳杆/手柄，仅扩大透明命中区
 * - 悬停边缘时由 CSS 切换 resize 光标
 */
function ResizableShell({ children }: { children: ReactNode }) {
  return (
    <div className="resizable-card-shell">
      <div className="resizable-card-body">{children}</div>
      <NodeResizer
        isVisible
        minWidth={MIN_W}
        minHeight={MIN_H}
        maxWidth={MAX_W}
        maxHeight={MAX_H}
        keepAspectRatio={false}
        autoScale
        handleClassName="tax-resize-handle"
        lineClassName="tax-resize-line"
        handleStyle={{
          width: 12,
          height: 12,
          opacity: 0,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        lineStyle={{
          borderWidth: 0,
          borderColor: 'transparent',
          opacity: 0,
          background: 'transparent',
        }}
      />
    </div>
  );
}

function RosterNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <EmployeeRosterCard fill />
    </ResizableShell>
  );
}
function SalaryNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <SalaryInputCard fill />
    </ResizableShell>
  );
}
function TaxNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <TaxSummaryCard fill />
    </ResizableShell>
  );
}
function BonusNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <BonusOptimizerCard fill />
    </ResizableShell>
  );
}
function InsightsNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <InsightsCard fill />
    </ResizableShell>
  );
}
function AllStaffTaxNode(_props: NodeProps) {
  return (
    <ResizableShell>
      <AllStaffTaxCard fill />
    </ResizableShell>
  );
}

const nodeTypes: NodeTypes = {
  roster: RosterNode,
  'salary-input': SalaryNode,
  'tax-summary': TaxNode,
  'bonus-optimizer': BonusNode,
  insights: InsightsNode,
  'all-staff-tax': AllStaffTaxNode,
};

function resolveSize(n: BoardNode): { width: number; height: number } {
  const def = DEFAULT_NODE_SIZE[n.type] ?? { width: 360, height: 360 };
  return {
    width: roundPx(n.width, def.width),
    height: roundPx(n.height, def.height),
  };
}

function toFlowNodes(board: BoardNode[]): Node[] {
  return board.map((n) => {
    const { width, height } = resolveSize(n);
    return {
      id: n.id,
      type: n.type,
      position: { ...n.position },
      data: { ...n.data },
      width,
      height,
      style: { width, height },
      selectable: true,
      draggable: true,
    };
  });
}

function flowToBoard(nodes: Node[]): BoardNode[] {
  return nodes.map((n) => {
    const type = (n.type ?? 'roster') as BoardNode['type'];
    const def = DEFAULT_NODE_SIZE[type] ?? { width: 360, height: 360 };
    const styleW =
      typeof n.style?.width === 'number'
        ? n.style.width
        : typeof n.style?.width === 'string'
          ? parseFloat(n.style.width)
          : undefined;
    const styleH =
      typeof n.style?.height === 'number'
        ? n.style.height
        : typeof n.style?.height === 'string'
          ? parseFloat(n.style.height)
          : undefined;
    const w = n.width ?? styleW ?? def.width;
    const h = n.height ?? styleH ?? def.height;
    return {
      id: n.id,
      type,
      position: n.position,
      width: Math.round(Number.isFinite(w) ? w : def.width),
      height: Math.round(Number.isFinite(h) ? h : def.height),
      data: (n.data ?? {}) as BoardNode['data'],
    };
  });
}

/** 结构键：仅 id+位置，尺寸回写不触发整表重置 */
function layoutStructureKey(nodes: BoardNode[]): string {
  return nodes
    .map((n) => `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`)
    .sort()
    .join('|');
}

export function TaxCanvas() {
  const boardLayout = useTaxStore((s) => s.boardLayout);
  const updateBoardNodes = useTaxStore((s) => s.updateBoardNodes);
  const updateBoardViewport = useTaxStore((s) => s.updateBoardViewport);

  const structureKey = useMemo(
    () => layoutStructureKey(boardLayout.nodes),
    [boardLayout.nodes],
  );

  const [nodes, setNodes] = useNodesState(toFlowNodes(boardLayout.nodes));
  const [edges] = useEdgesState([]);

  const resizingRef = useRef(false);
  const skipNextStoreSync = useRef(false);
  /** 空格按下：锁定为平移无限画布（即使鼠标在工作板上） */
  const [spacePan, setSpacePan] = useState(false);
  const savedViewport = boardLayout.viewport;
  const hasSavedViewport =
    !!savedViewport &&
    Number.isFinite(savedViewport.x) &&
    Number.isFinite(savedViewport.y) &&
    Number.isFinite(savedViewport.zoom);

  useEffect(() => {
    if (skipNextStoreSync.current) {
      skipNextStoreSync.current = false;
      return;
    }
    if (resizingRef.current) return;
    setNodes(toFlowNodes(boardLayout.nodes));
  }, [structureKey, boardLayout.nodes, setNodes]);

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return Boolean(t.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (isEditableTarget(e.target)) return;
      // 避免页面滚动，并进入画布平移模式
      e.preventDefault();
      if (!e.repeat) setSpacePan(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      setSpacePan(false);
    };
    const onBlur = () => setSpacePan(false);
    const onVisibility = () => {
      if (document.hidden) setSpacePan(false);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const persistLayout = useCallback(
    (nds: Node[]) => {
      skipNextStoreSync.current = true;
      updateBoardNodes(flowToBoard(nds));
    },
    [updateBoardNodes],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const c of changes) {
        if (c.type === 'dimensions' && 'resizing' in c) {
          resizingRef.current =
            (c as { resizing?: boolean }).resizing === true;
        }
      }

      const posEnded = changes.some(
        (c) =>
          c.type === 'position' && 'dragging' in c && c.dragging === false,
      );
      const resizeEnded = changes.some(
        (c) =>
          c.type === 'dimensions' &&
          (c as { resizing?: boolean }).resizing === false,
      );

      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        // 缩放过程中同步 style，保证 DOM 像素盒与 RF 内部尺寸一致
        const withStyle = next.map((n) => {
          if (typeof n.width === 'number' && typeof n.height === 'number') {
            return {
              ...n,
              style: {
                ...n.style,
                width: n.width,
                height: n.height,
              },
            };
          }
          return n;
        });

        if (posEnded || resizeEnded) {
          resizingRef.current = false;
          persistLayout(withStyle);
        }
        return withStyle;
      });
    },
    [setNodes, persistLayout],
  );

  const wrapperStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    background:
      'radial-gradient(1200px 600px at 10% -10%, #e0e7ff55 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #fafafa 0%, var(--bg) 60%)',
  };

  return (
    <div
      className={`relative h-full w-full ${spacePan ? 'canvas-space-pan' : ''}`}
      style={wrapperStyle}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView={!hasSavedViewport}
        defaultViewport={
          hasSavedViewport
            ? (savedViewport as Viewport)
            : { x: 0, y: 0, zoom: 1 }
        }
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        /* 空白处左键拖动画布；卡片上左键拖卡片；空格时在卡片上也可平移 */
        nodesDraggable={!spacePan}
        nodesConnectable={false}
        elementsSelectable={!spacePan}
        selectNodesOnDrag={false}
        selectionOnDrag={false}
        panOnDrag
        panActivationKeyCode={null}
        panOnScroll
        zoomOnScroll
        zoomOnDoubleClick={false}
        nodeDragThreshold={5}
        className={spacePan ? 'space-pan-active' : undefined}
        onMoveEnd={(_evt, viewport) => {
          updateBoardViewport({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
          });
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d4d4d8"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(244, 244, 245, 0.7)"
          style={{ background: '#ffffff' }}
          nodeColor="#c7d2fe"
        />
      </ReactFlow>
    </div>
  );
}
