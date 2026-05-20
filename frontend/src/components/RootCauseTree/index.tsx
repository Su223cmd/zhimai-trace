import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { Spin, Empty, Typography, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';

interface RootCauseNode {
  code: string;
  name: string;
  mastery: number;
  isRootCause: boolean;
  children: RootCauseNode[];
}

interface RootCauseTreeProps {
  data: RootCauseNode | null;
  loading?: boolean;
  title?: string;
}

function transformToTreeData(node: RootCauseNode): DataNode {
  const isWeak = node.mastery < 0.5;
  const icon = node.isRootCause ? (
    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
  ) : isWeak ? (
    <QuestionCircleOutlined style={{ color: '#faad14' }} />
  ) : (
    <CheckCircleOutlined style={{ color: '#52c41a' }} />
  );

  const titleContent = (
    <span>
      {icon}
      <span style={{ marginLeft: 6, fontWeight: node.isRootCause ? 700 : 400 }}>
        {node.name}
      </span>
      <Tag
        color={node.mastery < 0.5 ? 'error' : node.mastery < 0.7 ? 'warning' : 'success'}
        style={{ marginLeft: 8 }}
      >
        {(node.mastery * 100).toFixed(0)}%
      </Tag>
      {node.isRootCause && (
        <Tag color="volcano" style={{ marginLeft: 4 }}>
          根因
        </Tag>
      )}
    </span>
  );

  return {
    key: node.code,
    title: titleContent,
    children: node.children?.map(transformToTreeData) || [],
    style: node.isRootCause
      ? { background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4, padding: 4 }
      : undefined,
  };
}

function RootCauseTree({ data, loading = false, title }: RootCauseTreeProps) {
  const treeData = useMemo(() => {
    if (!data) return [];
    return [transformToTreeData(data)];
  }, [data]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: 60 }} />;
  }

  if (!data) {
    return <Empty description="暂无根因追溯数据" style={{ padding: 40 }} />;
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
        showIcon={false}
        blockNode
        style={{ background: 'transparent' }}
      />
    </div>
  );
}

export type { RootCauseNode, RootCauseTreeProps };
export default RootCauseTree;