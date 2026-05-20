import { List, Tag, Typography, Spin, Empty, Space } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

interface ExamPoint {
  id: string;
  name: string;
  description: string;
  frequency: 'high' | 'medium' | 'low';
  difficulty: number;
  relatedQuestions: number;
}

interface ExamPointListProps {
  data: ExamPoint[];
  loading?: boolean;
  title?: string;
  onSelect?: (point: ExamPoint) => void;
}

const freqColors: Record<string, string> = {
  high: 'volcano',
  medium: 'orange',
  low: 'default',
};

const freqLabels: Record<string, string> = {
  high: '高频',
  medium: '中频',
  low: '低频',
};

function ExamPointList({ data, loading = false, title, onSelect }: ExamPointListProps) {
  if (loading) {
    return <Spin style={{ display: 'block', padding: 40 }} />;
  }

  if (!data || data.length === 0) {
    return <Empty description="暂无考点数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <List
        dataSource={data}
        renderItem={(item) => (
          <List.Item
            onClick={() => onSelect?.(item)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <List.Item.Meta
              avatar={<FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
              title={
                <Space size={8}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <Tag color={freqColors[item.frequency]}>{freqLabels[item.frequency]}</Tag>
                  <Tag color="blue">难度 {item.difficulty.toFixed(1)}</Tag>
                  <Tag>{item.relatedQuestions} 题</Tag>
                </Space>
              }
              description={item.description}
            />
          </List.Item>
        )}
      />
    </div>
  );
}

export type { ExamPoint, ExamPointListProps };
export default ExamPointList;