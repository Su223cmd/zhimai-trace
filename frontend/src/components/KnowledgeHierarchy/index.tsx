import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { Spin, Empty, Typography, Tag } from 'antd';
import { useMemo } from 'react';

interface HierarchyNode {
  key: string;
  title: string;
  level: number;
  count: number;
  children?: HierarchyNode[];
}

interface KnowledgeHierarchyProps {
  data: HierarchyNode[];
  loading?: boolean;
  title?: string;
  onSelect?: (node: HierarchyNode) => void;
}

const levelNames = ['学科', '主题', '单元', '知识点', '考点', '考法'];
const levelColors = ['#1890ff', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96'];

function transformHierarchy(nodes: HierarchyNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.key,
    title: (
      <span>
        <Tag color={levelColors[node.level - 1] || '#888'} style={{ fontSize: 10 }}>
          {levelNames[node.level - 1] || 'L' + node.level}
        </Tag>
        <span style={{ marginLeft: 4, fontWeight: node.level <= 2 ? 600 : 400 }}>
          {node.title}
        </span>
        <Tag style={{ marginLeft: 6 }}>{node.count}</Tag>
      </span>
    ),
    children: node.children ? transformHierarchy(node.children) : undefined,
  }));
}

function KnowledgeHierarchy({
  data,
  loading = false,
  title,
  onSelect,
}: KnowledgeHierarchyProps) {
  const treeData = useMemo(() => transformHierarchy(data), [data]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: 60 }} />;
  }

  if (!data || data.length === 0) {
    return <Empty description="暂无层级数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Tree
        treeData={treeData}
        defaultExpandAll
        showLine={{ showLeafIcon: false }}
        blockNode
        style={{ background: 'transparent' }}
        onSelect={(keys, info) => {
          if (onSelect && info.node) onSelect(data.find((n) => n.key === keys[0]) || data[0]);
        }}
      />
    </div>
  );
}

export type { HierarchyNode, KnowledgeHierarchyProps };
export default KnowledgeHierarchy;