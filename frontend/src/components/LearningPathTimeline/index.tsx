import { Timeline, Card, Tag, Typography, Space, Spin, Empty } from 'antd';
import {
  PlayCircleOutlined,
  ExperimentOutlined,
  BulbOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

interface LearningStep {
  name: string;
  description: string;
  type: 'review' | 'practice' | 'assess' | 'milestone';
  estimateMinutes: number;
  kpCodes: string[];
}

interface LearningPathTimelineProps {
  data: LearningStep[];
  loading?: boolean;
  title?: string;
  totalMinutes?: number;
}

const stepIcons: Record<string, React.ReactNode> = {
  review: <BulbOutlined />,
  practice: <ExperimentOutlined />,
  assess: <PlayCircleOutlined />,
  milestone: <TrophyOutlined />,
};

const stepColors: Record<string, string> = {
  review: '#1677ff',
  practice: '#52c41a',
  assess: '#faad14',
  milestone: '#722ed1',
};

function LearningPathTimeline({
  data,
  loading = false,
  title,
  totalMinutes,
}: LearningPathTimelineProps) {
  if (loading) {
    return <Spin style={{ display: 'block', padding: 60 }} />;
  }

  if (!data || data.length === 0) {
    return <Empty description="暂无学习路径" style={{ padding: 40 }} />;
  }

  const items = data.map((step, idx) => ({
    dot: <span style={{ color: stepColors[step.type] }}>{stepIcons[step.type]}</span>,
    color: stepColors[step.type],
    children: (
      <Card size="small" style={{ marginBottom: 4 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <Typography.Text strong>
              步骤 {idx + 1}：{step.name}
            </Typography.Text>
            <Tag color={stepColors[step.type]}>
              {step.type === 'review'
                ? '复习'
                : step.type === 'practice'
                  ? '练习'
                  : step.type === 'assess'
                    ? '评估'
                    : '里程碑'}
            </Tag>
            <Tag>{step.estimateMinutes}分钟</Tag>
          </Space>
          <Typography.Text type="secondary">{step.description}</Typography.Text>
          <Space size={4}>
            {step.kpCodes.map((kp) => (
              <Tag key={kp} color="geekblue">
                {kp}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>
    ),
  }));

  return (
    <div>
      {title && (
        <Space style={{ marginBottom: 16 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {totalMinutes && (
            <Tag color="blue">预计总时间：{totalMinutes}分钟</Tag>
          )}
        </Space>
      )}
      <Timeline items={items} />
    </div>
  );
}

export type { LearningStep, LearningPathTimelineProps };
export default LearningPathTimeline;