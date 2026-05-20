import { Timeline, Tag, Typography, Spin, Empty, Space } from 'antd';
import {
  SendOutlined,
  ExperimentOutlined,
  ApartmentOutlined,
  LineChartOutlined,
  BulbOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';

interface MessageFlow {
  id: string;
  from: string;
  to: string;
  type: string;
  timestamp: string;
  summary: string;
}

interface AgentMessageFlowProps {
  data: MessageFlow[];
  loading?: boolean;
  title?: string;
  maxItems?: number;
}

const agentIcons: Record<string, React.ReactNode> = {
  diagnosis: <ExperimentOutlined />,
  knowledge: <ApartmentOutlined />,
  tracing: <LineChartOutlined />,
  teaching: <BulbOutlined />,
  evolution: <SyncOutlined spin />,
};

const agentColors: Record<string, string> = {
  diagnosis: 'blue',
  knowledge: 'purple',
  tracing: 'cyan',
  teaching: 'orange',
  evolution: 'magenta',
};

function AgentMessageFlow({
  data,
  loading = false,
  title,
  maxItems = 20,
}: AgentMessageFlowProps) {
  const items = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.slice(0, maxItems).map((msg) => ({
      dot: <SendOutlined style={{ fontSize: 11 }} />,
      children: (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Space size={6}>
            <Tag color={agentColors[msg.from] || 'default'} icon={agentIcons[msg.from]}>
              {msg.from}
            </Tag>
            <span style={{ fontSize: 11, color: '#999' }}>→</span>
            <Tag color={agentColors[msg.to] || 'default'} icon={agentIcons[msg.to]}>
              {msg.to}
            </Tag>
            <Tag>{msg.type}</Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {msg.summary}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 10 }}>
            {msg.timestamp}
          </Typography.Text>
        </Space>
      ),
    }));
  }, [data, maxItems]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: 60 }} />;
  }

  if (!items.length) {
    return <Empty description="暂无Agent消息" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Timeline items={items} />
    </div>
  );
}

export type { MessageFlow, AgentMessageFlowProps };
export default AgentMessageFlow;