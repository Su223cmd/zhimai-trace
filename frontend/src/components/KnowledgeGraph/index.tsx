import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Graph } from '@antv/g6';
import { Button, Space, Tooltip } from 'antd';
import {
  ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined,
  FullscreenExitOutlined, DownloadOutlined,
} from '@ant-design/icons';
import type { KnowledgeGraphDataV2, GraphEntity, GraphSubject, GraphTheme, GraphModule, GraphRelation } from '../../types';

const LAYER_CONFIG: Record<string, {
  fill: string;
  stroke: string;
  size: [number, number];
  fontSize: number;
  fontWeight: number;
  label: string;
  radius: number;
}> = {
  subject: {
    fill: '#e6f4ff',
    stroke: '#1677ff',
    size: [130, 42],
    fontSize: 14,
    fontWeight: 600,
    label: '学科',
    radius: 6,
  },
  theme: {
    fill: '#e6fffb',
    stroke: '#13c2c2',
    size: [116, 38],
    fontSize: 13,
    fontWeight: 500,
    label: '主题',
    radius: 5,
  },
  module: {
    fill: '#fff7e6',
    stroke: '#fa8c16',
    size: [104, 34],
    fontSize: 12,
    fontWeight: 500,
    label: '模块',
    radius: 5,
  },
  knowledgepoint: {
    fill: '#e6f4ff',
    stroke: '#1890ff',
    size: [94, 30],
    fontSize: 11,
    fontWeight: 400,
    label: '知识点',
    radius: 4,
  },
  exampoint: {
    fill: '#fff0f6',
    stroke: '#eb2f96',
    size: [84, 26],
    fontSize: 10,
    fontWeight: 400,
    label: '考点',
    radius: 4,
  },
  exammethod: {
    fill: '#f9f0ff',
    stroke: '#722ed1',
    size: [76, 24],
    fontSize: 10,
    fontWeight: 400,
    label: '考法',
    radius: 4,
  },
};

const RELATION_EDGE_STYLE: Record<string, {
  stroke: string;
  lineWidth: number;
  lineDash: number[];
  label: string;
  endArrow: boolean;
}> = {
  PREREQUISITE_OF: { stroke: '#ff4d4f', lineWidth: 2, lineDash: [], label: '前置依赖', endArrow: true },
  CONTAINS: { stroke: '#91caff', lineWidth: 1.5, lineDash: [], label: '包含', endArrow: true },
  SIMILAR_TO: { stroke: '#13c2c2', lineWidth: 1, lineDash: [4, 4], label: '相似', endArrow: false },
  EXAMINES: { stroke: '#eb2f96', lineWidth: 1.5, lineDash: [], label: '考查', endArrow: true },
  ASSOCIATED_WITH: { stroke: '#8c8c8c', lineWidth: 1, lineDash: [2, 2], label: '关联资料', endArrow: false },
  INVOLVES: { stroke: '#fa8c16', lineWidth: 1.5, lineDash: [], label: '涉及', endArrow: true },
  SUPPORTS: { stroke: '#52c41a', lineWidth: 1.5, lineDash: [], label: '支撑', endArrow: true },
  APPLIES: { stroke: '#1890ff', lineWidth: 1, lineDash: [4, 4], label: '应用', endArrow: true },
  REQUIRES: { stroke: '#faad14', lineWidth: 1.5, lineDash: [], label: '需要', endArrow: true },
  PART_OF: { stroke: '#1677ff', lineWidth: 1, lineDash: [6, 3], label: '属于', endArrow: true },
  CONTRASTS_WITH: { stroke: '#ff7a45', lineWidth: 1, lineDash: [4, 4], label: '对比', endArrow: false },
  HAS_EXAM_POINT: { stroke: '#eb2f96', lineWidth: 1, lineDash: [], label: '包含考点', endArrow: true },
  EXAM_POINT_OF: { stroke: '#eb2f96', lineWidth: 1, lineDash: [3, 3], label: '属于知识点', endArrow: true },
  TESTED_BY_METHOD: { stroke: '#722ed1', lineWidth: 1, lineDash: [], label: '考法', endArrow: true },
  METHOD_FOR_EXAM: { stroke: '#722ed1', lineWidth: 1, lineDash: [3, 3], label: '用于考点', endArrow: true },
  DERIVED_FROM: { stroke: '#597ef7', lineWidth: 1, lineDash: [4, 4], label: '派生自', endArrow: true },
  RELATED_TO: { stroke: '#8c8c8c', lineWidth: 1, lineDash: [2, 4], label: '相关', endArrow: false },
  BASED_ON: { stroke: '#597ef7', lineWidth: 1.5, lineDash: [], label: '基于', endArrow: true },
  EXTENDS: { stroke: '#13c2c2', lineWidth: 1.5, lineDash: [], label: '扩展', endArrow: true },
  IMPLEMENTS: { stroke: '#52c41a', lineWidth: 1.5, lineDash: [], label: '实现', endArrow: true },
  EVALUATES: { stroke: '#faad14', lineWidth: 1, lineDash: [], label: '评估', endArrow: true },
  PREPARES_FOR: { stroke: '#ff4d4f', lineWidth: 1, lineDash: [4, 4], label: '为…准备', endArrow: true },
  ENHANCES: { stroke: '#52c41a', lineWidth: 1, lineDash: [4, 4], label: '增强', endArrow: true },
  DEPENDS_ON: { stroke: '#faad14', lineWidth: 1, lineDash: [6, 3], label: '依赖', endArrow: true },
};

const getMasteryColor = (rate?: number): string => {
  if (rate == null) return '#d9d9d9';
  if (rate >= 0.8) return '#52c41a';
  if (rate >= 0.5) return '#faad14';
  return '#ff4d4f';
};

const getMasteryFill = (rate?: number): string => {
  if (rate == null) return '#f5f5f5';
  if (rate >= 0.8) return '#f6ffed';
  if (rate >= 0.5) return '#fffbe6';
  return '#fff2f0';
};

const truncate = (text: string, maxLen: number): string => {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
};

interface KnowledgeGraphProps {
  data: KnowledgeGraphDataV2;
  onNodeClick?: (code: string) => void;
  highlightPath?: string[];
}

const HIERARCHY_EDGE_TYPES = new Set([
  'CONTAINS',
  'HAS_EXAM_POINT',
  'TESTED_BY_METHOD',
]);

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick, highlightPath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const onNodeClickRef = useRef(onNodeClick);
  const highlightPathRef = useRef(highlightPath);
  onNodeClickRef.current = onNodeClick;
  highlightPathRef.current = highlightPath;

  const parentMap = useMemo(() => {
    const map: Record<string, string> = {};

    for (const theme of data.themes) {
      if (theme.subject_code) {
        map[theme.code] = theme.subject_code;
      }
    }

    for (const mod of data.modules) {
      if (mod.theme_code) {
        map[mod.code] = mod.theme_code;
      }
    }

    for (const node of data.nodes) {
      if (node.type === 'KnowledgePoint' && node.module_code) {
        map[node.code] = node.module_code;
      }
      if (node.type === 'ExamPoint') {
        const kpCode = (node as Record<string, unknown>).knowledge_point_code as string || '';
        if (kpCode) {
          map[node.code] = kpCode;
        }
      }
    }

    for (const edge of data.edges) {
      if (edge.type === 'TESTED_BY_METHOD') {
        const sourceNode = data.nodes.find(n => n.code === edge.source);
        const targetNode = data.nodes.find(n => n.code === edge.target);
        if (sourceNode?.type === 'ExamPoint' && targetNode?.type === 'ExamMethod') {
          map[targetNode.code] = sourceNode.code;
        }
      } else if (edge.type === 'METHOD_FOR_EXAM') {
        const sourceNode = data.nodes.find(n => n.code === edge.source);
        const targetNode = data.nodes.find(n => n.code === edge.target);
        if (sourceNode?.type === 'ExamMethod' && targetNode?.type === 'ExamPoint') {
          map[sourceNode.code] = targetNode.code;
        }
      }
    }

    return map;
  }, [data]);

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [child, parent] of Object.entries(parentMap)) {
      if (!map[parent]) map[parent] = [];
      map[parent].push(child);
    }
    return map;
  }, [parentMap]);

  const isNodeVisible = useCallback((code: string): boolean => {
    let current = code;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current)) break;
      visited.add(current);
      const parent = parentMap[current];
      if (parent && collapsedNodes.has(parent)) return false;
      current = parent || '';
    }
    return true;
  }, [parentMap, collapsedNodes]);

  const buildGraphData = useCallback(() => {
    const gNodes: Array<{ id: string; data: Record<string, unknown> }> = [];
    const gEdges: Array<{ id: string; source: string; target: string; data: Record<string, unknown> }> = [];

    for (const subject of data.subjects) {
      if (!isNodeVisible(subject.code)) continue;
      gNodes.push({
        id: subject.code,
        data: {
          name: subject.name,
          layer: 'subject',
          version: subject.version,
          hasChildren: (childrenMap[subject.code] || []).length > 0,
          collapsed: collapsedNodes.has(subject.code),
        },
      });
    }

    for (const theme of data.themes) {
      if (!isNodeVisible(theme.code)) continue;
      gNodes.push({
        id: theme.code,
        data: {
          name: theme.name,
          layer: 'theme',
          subject_code: theme.subject_code,
          hasChildren: (childrenMap[theme.code] || []).length > 0,
          collapsed: collapsedNodes.has(theme.code),
        },
      });
      if (theme.subject_code && isNodeVisible(theme.subject_code)) {
        gEdges.push({
          id: `hier-${theme.subject_code}-${theme.code}`,
          source: theme.subject_code,
          target: theme.code,
          data: { type: 'CONTAINS', isHierarchy: true },
        });
      }
    }

    for (const mod of data.modules) {
      if (!isNodeVisible(mod.code)) continue;
      gNodes.push({
        id: mod.code,
        data: {
          name: mod.name,
          layer: 'module',
          theme_code: mod.theme_code,
          semester: mod.semester,
          textbook_ref: mod.textbook_ref,
          hasChildren: (childrenMap[mod.code] || []).length > 0,
          collapsed: collapsedNodes.has(mod.code),
        },
      });
      if (mod.theme_code && isNodeVisible(mod.theme_code)) {
        gEdges.push({
          id: `hier-${mod.theme_code}-${mod.code}`,
          source: mod.theme_code,
          target: mod.code,
          data: { type: 'CONTAINS', isHierarchy: true },
        });
      }
    }

    for (const node of data.nodes) {
      if (!isNodeVisible(node.code)) continue;

      let layer: string;
      switch (node.type) {
        case 'KnowledgePoint':
          layer = 'knowledgepoint';
          break;
        case 'ExamPoint':
          layer = 'exampoint';
          break;
        case 'ExamMethod':
          layer = 'exammethod';
          break;
        default:
          layer = (node.type || 'knowledgepoint').toLowerCase();
      }

      gNodes.push({
        id: node.code,
        data: {
          name: node.name || node.code,
          layer,
          type: node.type,
          cognitive_level: node.cognitive_level,
          mastery_rate: node.mastery_rate,
          source_type: node.source_type,
          module_code: node.module_code,
          description: node.description,
          hasChildren: (childrenMap[node.code] || []).length > 0,
          collapsed: collapsedNodes.has(node.code),
        },
      });

      const parent = parentMap[node.code];
      if (parent && isNodeVisible(parent)) {
        gEdges.push({
          id: `hier-${parent}-${node.code}`,
          source: parent,
          target: node.code,
          data: { type: 'CONTAINS', isHierarchy: true },
        });
      }
    }

    const edgeCountMap: Record<string, number> = {};
    for (const edge of data.edges) {
      if (!isNodeVisible(edge.source) || !isNodeVisible(edge.target)) continue;
      if (HIERARCHY_EDGE_TYPES.has(edge.type)) continue;

      const sourceNode = data.nodes.find(n => n.code === edge.source);
      const targetNode = data.nodes.find(n => n.code === edge.target);
      if (!sourceNode || !targetNode) continue;

      const key = `${edge.source}-${edge.target}-${edge.type}`;
      const idx = edgeCountMap[key] || 0;
      edgeCountMap[key] = idx + 1;

      gEdges.push({
        id: `rel-${key}-${idx}`,
        source: edge.source,
        target: edge.target,
        data: {
          type: edge.type,
          weight: edge.weight,
          confidence: edge.confidence,
          discovered_by: edge.discovered_by,
          isHierarchy: false,
        },
      });
    }

    return { nodes: gNodes, edges: gEdges };
  }, [data, collapsedNodes, parentMap, childrenMap, isNodeVisible]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const graph = new Graph({
      container,
      autoFit: 'view',
      padding: [30, 30, 30, 30],
      data: buildGraphData(),
      node: {
        type: 'rect',
        style: {
          size: (d: any) => {
            const cfg = LAYER_CONFIG[d.data?.layer as string];
            return cfg?.size || [80, 28];
          },
          fill: (d: any) => {
            const layer = d.data?.layer as string;
            if (layer === 'knowledgepoint' && d.data?.mastery_rate != null) {
              return getMasteryFill(d.data.mastery_rate as number);
            }
            const cfg = LAYER_CONFIG[layer];
            return cfg?.fill || '#e6f4ff';
          },
          stroke: (d: any) => {
            const layer = d.data?.layer as string;
            if (layer === 'knowledgepoint' && d.data?.mastery_rate != null) {
              return getMasteryColor(d.data.mastery_rate as number);
            }
            const cfg = LAYER_CONFIG[layer];
            return cfg?.stroke || '#1890ff';
          },
          lineWidth: 1.5,
          radius: (d: any) => {
            const cfg = LAYER_CONFIG[d.data?.layer as string];
            return cfg?.radius || 4;
          },
          labelText: (d: any) => {
            const name = truncate(d.data?.name as string || '', 8);
            const hasChildren = d.data?.hasChildren as boolean;
            const collapsed = d.data?.collapsed as boolean;
            if (hasChildren) {
              return collapsed ? `▶ ${name}` : `▼ ${name}`;
            }
            return name;
          },
          labelFill: '#000',
          labelFontSize: (d: any) => {
            const cfg = LAYER_CONFIG[d.data?.layer as string];
            return cfg?.fontSize || 10;
          },
          labelFontWeight: (d: any) => {
            const cfg = LAYER_CONFIG[d.data?.layer as string];
            return cfg?.fontWeight || 400;
          },
          labelPlacement: 'center',
          cursor: 'pointer',
          shadowColor: 'rgba(0,0,0,0.06)',
          shadowBlur: 4,
          shadowOffsetX: 0,
          shadowOffsetY: 2,
        },
        state: {
          highlight: {
            stroke: '#1890ff',
            lineWidth: 3,
            shadowColor: 'rgba(24,144,255,0.4)',
            shadowBlur: 12,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
          },
          dim: {
            opacity: 0.15,
          },
          selected: {
            stroke: '#1890ff',
            lineWidth: 2.5,
            shadowColor: 'rgba(24,144,255,0.3)',
            shadowBlur: 8,
          },
          hover: {
            shadowColor: 'rgba(24,144,255,0.2)',
            shadowBlur: 8,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            cursor: 'pointer',
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: (d: any) => {
            const edgeStyle = RELATION_EDGE_STYLE[d.data?.type as string];
            return edgeStyle?.stroke || '#d9d9d9';
          },
          lineWidth: (d: any) => {
            const edgeStyle = RELATION_EDGE_STYLE[d.data?.type as string];
            return edgeStyle?.lineWidth || 1;
          },
          lineDash: (d: any) => {
            const edgeStyle = RELATION_EDGE_STYLE[d.data?.type as string];
            return edgeStyle?.lineDash || [];
          },
          endArrow: (d: any) => {
            if (d.data?.isHierarchy) return true;
            const edgeStyle = RELATION_EDGE_STYLE[d.data?.type as string];
            return edgeStyle?.endArrow ?? true;
          },
          labelText: (d: any) => {
            if (d.data?.isHierarchy) return '';
            const edgeStyle = RELATION_EDGE_STYLE[d.data?.type as string];
            return edgeStyle?.label || '';
          },
          labelFill: '#000',
          labelFontSize: 8,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.85,
          labelBackgroundRadius: 2,
          labelBackgroundPadding: [2, 4, 2, 4],
          curveOffset: 0,
        },
        state: {
          highlight: {
            stroke: '#1890ff',
            lineWidth: 2.5,
          },
          dim: {
            opacity: 0.08,
          },
        },
      },
      layout: {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 25,
        ranksep: 50,
        preventOverlap: true,
      },
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        'drag-element',
      ],
      animation: false,
    });

    graph.render();
    graphRef.current = graph;

    graph.on('node:click', (evt: any) => {
      const nodeId = evt.itemId || evt.target?.id;
      if (!nodeId) return;

      const nodeData = graph.getNodeData(nodeId);
      if (nodeData?.data?.hasChildren) {
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
      }

      onNodeClickRef.current?.(nodeId);
    });

    graph.on('canvas:click', () => {
      const currentPath = highlightPathRef.current;
      if (currentPath && currentPath.length > 0) {
        const allNodes = graph.getNodeData();
        const allEdges = graph.getEdgeData();
        for (const node of allNodes) {
          graph.setElementState(node.id, []);
        }
        for (const edge of allEdges) {
          graph.setElementState(edge.id, []);
        }
      }
    });

    graph.on('node:mouseenter', (evt: any) => {
      const nodeId = evt.itemId || evt.target?.id;
      if (nodeId) {
        graph.setElementState(nodeId, 'hover');
      }
    });

    graph.on('node:mouseleave', (evt: any) => {
      const nodeId = evt.itemId || evt.target?.id;
      if (nodeId) {
        const currentPath = highlightPathRef.current;
        if (currentPath && currentPath.length > 0 && currentPath.includes(nodeId)) {
          graph.setElementState(nodeId, 'highlight');
        } else if (currentPath && currentPath.length > 0 && !currentPath.includes(nodeId)) {
          graph.setElementState(nodeId, 'dim');
        } else {
          graph.setElementState(nodeId, []);
        }
      }
    });

    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        try {
          graph.resize();
        } catch {
          // ignore resize errors
        }
      }
    };
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const graphData = buildGraphData();
    graph.setData(graphData);
    graph.render();
  }, [buildGraphData]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const allNodes = graph.getNodeData();
    const allEdges = graph.getEdgeData();

    for (const node of allNodes) {
      graph.setElementState(node.id, []);
    }
    for (const edge of allEdges) {
      graph.setElementState(edge.id, []);
    }

    if (highlightPath && highlightPath.length > 0) {
      const pathSet = new Set(highlightPath);

      for (const node of allNodes) {
        if (pathSet.has(node.id)) {
          graph.setElementState(node.id, 'highlight');
        } else {
          graph.setElementState(node.id, 'dim');
        }
      }

      for (const edge of allEdges) {
        const srcId = edge.source;
        const tgtId = edge.target;
        if (pathSet.has(srcId) && pathSet.has(tgtId)) {
          graph.setElementState(edge.id, 'highlight');
        } else {
          graph.setElementState(edge.id, 'dim');
        }
      }

      const firstNodeId = highlightPath[0];
      try {
        graph.focusElement(firstNodeId);
      } catch {
        // ignore focus errors
      }
    }
  }, [highlightPath]);

  useEffect(() => {
    setCollapsedNodes(new Set());
  }, [data.subjects, data.themes, data.modules, data.nodes]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const zoom = graph.getZoom();
    graph.zoomTo(zoom * 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const zoom = graph.getZoom();
    graph.zoomTo(zoom / 1.2);
  }, []);

  const handleZoomReset = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.fitView();
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleExport = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    try {
      const dataUrl = graph.toDataURL('image/png', { backgroundColor: '#fafafa', padding: [20, 20, 20, 20] });
      const link = document.createElement('a');
      link.download = 'knowledge-graph.png';
      link.href = dataUrl as string;
      link.click();
    } catch {
      // export may fail on some browsers
    }
  }, []);

  const overlayBtnStyle: React.CSSProperties = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff',
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%', height: '100%', minHeight: 400,
        background: '#fafafa', borderRadius: 8, overflow: 'hidden', position: 'relative',
      }}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
        <Tooltip title="放大" placement="left">
          <button style={overlayBtnStyle} onClick={handleZoomIn}><ZoomInOutlined style={{ fontSize: 14 }} /></button>
        </Tooltip>
        <Tooltip title="缩小" placement="left">
          <button style={overlayBtnStyle} onClick={handleZoomOut}><ZoomOutOutlined style={{ fontSize: 14 }} /></button>
        </Tooltip>
        <Tooltip title="适应画布" placement="left">
          <button style={overlayBtnStyle} onClick={handleZoomReset}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>1:1</span>
          </button>
        </Tooltip>
        <Tooltip title={isFullscreen ? '退出全屏' : '全屏'} placement="left">
          <button style={overlayBtnStyle} onClick={handleFullscreen}>
            {isFullscreen ? <FullscreenExitOutlined style={{ fontSize: 14 }} /> : <FullscreenOutlined style={{ fontSize: 14 }} />}
          </button>
        </Tooltip>
        <Tooltip title="导出PNG" placement="left">
          <button style={overlayBtnStyle} onClick={handleExport}><DownloadOutlined style={{ fontSize: 14 }} /></button>
        </Tooltip>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8, zIndex: 10,
        background: 'rgba(255,255,255,0.92)', borderRadius: 4, padding: '6px 10px',
        border: '1px solid #f0f0f0', fontSize: 11, lineHeight: '18px',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries({ subject: { fill: '#e6f4ff', stroke: '#1677ff', label: '学科' }, theme: { fill: '#e6fffb', stroke: '#13c2c2', label: '主题' }, module: { fill: '#fff7e6', stroke: '#fa8c16', label: '模块' }, knowledgepoint: { fill: '#e6f4ff', stroke: '#1890ff', label: '知识点' }, exampoint: { fill: '#fff0f6', stroke: '#eb2f96', label: '考点' }, exammethod: { fill: '#f9f0ff', stroke: '#722ed1', label: '考法' } }).map(([key, cfg]) => (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: cfg.fill, border: `1px solid ${cfg.stroke}` }} />
              {cfg.label}
            </span>
          ))}
          <span style={{ borderLeft: '1px solid #e8e8e8', paddingLeft: 6 }}>
            掌握:
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#52c41a', marginLeft: 4 }} />
            ≥80%
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#faad14', marginLeft: 4 }} />
            50-80%
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ff4d4f', marginLeft: 4 }} />
            &lt;50%
          </span>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
