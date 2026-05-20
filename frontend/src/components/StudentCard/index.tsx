import { Card, Tag, Typography, Skeleton, Space, Statistic, Row, Col } from 'antd';
import { UserOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface StudentCardProps {
  studentId: string;
  studentName?: string;
  className?: string;
  weakKpCount?: number;
  totalKpCount?: number;
  avgMastery?: number;
  status?: 'normal' | 'warning' | 'danger';
  loading?: boolean;
  onClick?: () => void;
}

const masteryColors: Record<string, string> = {
  normal: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
};

const masteryLabels: Record<string, string> = {
  normal: '良好',
  warning: '注意',
  danger: '薄弱',
};

function StudentCard({
  studentId,
  studentName,
  className,
  weakKpCount,
  totalKpCount,
  avgMastery,
  status = 'normal',
  loading = false,
  onClick,
}: StudentCardProps) {
  if (loading) {
    return (
      <Card size="small">
        <Skeleton active avatar paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      hoverable={!!onClick}
      onClick={onClick}
      style={{ borderLeft: `3px solid ${masteryColors[status]}` }}
    >
      <Space align="start">
        <UserOutlined style={{ fontSize: 24, color: masteryColors[status], marginTop: 4 }} />
        <div style={{ flex: 1 }}>
          <Space size={6}>
            <Typography.Text strong>{studentName || `学生 ${studentId}`}</Typography.Text>
            <Tag color={masteryColors[status]}>{masteryLabels[status]}</Tag>
          </Space>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ID: {studentId}
            {className ? ` · ${className}` : ''}
          </Typography.Text>

          {(weakKpCount !== undefined || avgMastery !== undefined) && (
            <Row gutter={12} style={{ marginTop: 8 }}>
              {avgMastery !== undefined && (
                <Col>
                  <Statistic
                    title="平均掌握率"
                    value={avgMastery}
                    suffix="%"
                    precision={0}
                    valueStyle={{ fontSize: 16, color: masteryColors[status] }}
                  />
                </Col>
              )}
              {weakKpCount !== undefined && (
                <Col>
                  <Statistic
                    title="薄弱知识点"
                    value={weakKpCount}
                    prefix={weakKpCount > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
                    valueStyle={{
                      fontSize: 16,
                      color: weakKpCount > 0 ? '#ff4d4f' : '#52c41a',
                    }}
                    suffix={totalKpCount !== undefined ? ` / ${totalKpCount}` : ''}
                  />
                </Col>
              )}
            </Row>
          )}
        </div>
      </Space>
    </Card>
  );
}

export type { StudentCardProps };
export default StudentCard;