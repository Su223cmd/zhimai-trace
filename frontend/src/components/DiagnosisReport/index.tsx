import { Card, Row, Col, Statistic, Typography, Button, Spin, Empty, Space } from 'antd';
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons';

interface DiagnosisReportData {
  studentName: string;
  className: string;
  homeworkTitle: string;
  diagnosisDate: string;
  overallMastery: number;
  totalKp: number;
  masteredKp: number;
  weakKpCount: number;
  rootCauseCount: number;
  recommendations: string[];
}

interface DiagnosisReportProps {
  data: DiagnosisReportData | null;
  loading?: boolean;
  title?: string;
  onExport?: () => void;
}

function DiagnosisReport({ data, loading = false, title, onExport }: DiagnosisReportProps) {
  if (loading) {
    return <Spin style={{ display: 'block', padding: 60 }} />;
  }

  if (!data) {
    return <Empty description="暂无诊断报告" style={{ padding: 40 }} />;
  }

  return (
    <Card
      title={title || '诊断报告'}
      extra={
        <Space>
          <Button icon={<PrinterOutlined />} size="small" onClick={onExport}>
            打印
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} size="small" onClick={onExport}>
            导出PDF
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 12]}>
        <Col span={8}>
          <Typography.Text type="secondary">学生</Typography.Text>
          <br />
          <Typography.Text strong>{data.studentName}</Typography.Text>
        </Col>
        <Col span={8}>
          <Typography.Text type="secondary">班级</Typography.Text>
          <br />
          <Typography.Text strong>{data.className}</Typography.Text>
        </Col>
        <Col span={8}>
          <Typography.Text type="secondary">作业</Typography.Text>
          <br />
          <Typography.Text strong>{data.homeworkTitle}</Typography.Text>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="整体掌握率"
              value={(data.overallMastery * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: data.overallMastery > 0.6 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已掌握"
              value={data.masteredKp}
              suffix={`/ ${data.totalKp}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="薄弱知识点"
              value={data.weakKpCount}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="根因问题"
              value={data.rootCauseCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {data.recommendations.length > 0 && (
        <Card size="small" title="教学建议" style={{ marginTop: 16 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {data.recommendations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                <Typography.Text>{rec}</Typography.Text>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Typography.Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
        诊断时间：{data.diagnosisDate}
      </Typography.Text>
    </Card>
  );
}

export type { DiagnosisReportData, DiagnosisReportProps };
export default DiagnosisReport;