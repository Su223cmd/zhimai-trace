import { Card, Tag, Typography, Spin, Space } from 'antd';
import {
  ExperimentOutlined,
  ApartmentOutlined,
  LineChartOutlined,
  BulbOutlined,
  SyncOutlined,
} from '@ant-design/icons';

interface AgentStatus {
  name: string;
  description: string;
  status: 'active' | 'idle' | 'error';
  lastEventType: string | null;
  lastEventTime: string | null;
}

interface AgentStatusCardProps {
  data: AgentStatus;
  loading?: boolean;
  onRefresh?: () => void;
}

const agentIcons: Record<string, React.ReactNode> = {
  diagnosis: <ExperimentOutlined />,
  knowledge: <ApartmentOutlined />,
  tracing: <LineChartOutlined />,
  teaching: <BulbOutlined />,
  evolution: <SyncOutlined spin />,
};

const statusColors: Record<string, string> = {
  active: 'green',
  idle: 'default',
  error: 'red',
};

const statusLabels: Record<string, string> = {
  active: '运行中',
  idle: '空闲',
  error: '异常',
};

const agentNames: Record<string, string> = {
  diagnosis: '诊断Agent',
  knowledge: '知识Agent',
  tracing: '追踪Agent',
  teaching: '教学Agent',
  evolution: '演化Agent',
};

function AgentStatusCard({ data, loading = false }: AgentStatusCardProps) {
  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      hoverable
      style={{ borderLeft: `3px solid ${data.status === 'active' ? '#52c41a' : data.status === 'error' ? '#ff4d4f' : '#d9d9d9'}` }}
    >
      <Space>
        <span style={{ fontSize: 24 }}>{agentIcons[data.name] || <ApartmentOutlined />}</span>
        <div>
          <Space size={6}>
            <Typography.Text strong>{agentNames[data.name] || data.name}</Typography.Text>
            <Tag color={statusColors[data.status]}>{statusLabels[data.status]}</Tag>
          </Space>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data.description}
          </Typography.Text>
          {data.lastEventType && (
            <>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                最后事件：{data.lastEventType}
                {data.lastEventTime ? ` · ${data.lastEventTime}` : ''}
              </Typography.Text>
            </>
          )}
        </div>
      </Space>
    </Card>
  );
}

export type { AgentStatus, AgentStatusCardProps };
export default AgentStatusCard;