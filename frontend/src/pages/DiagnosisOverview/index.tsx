import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, Button,
  Space, Empty, Flex, Progress, message, Select,
} from 'antd';
import {
  ExperimentOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { diagnosisApi } from '../../services/diagnosis';
import { homeworkApi } from '../../services/homework';
import { useHomeworkStore } from '../../stores/useHomeworkStore';
import type { ClassDiagnosisResult } from '../../types';

const DiagnosisOverview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [diagnosing, setDiagnosing] = useState(false);
  const [homeworkId, setHomeworkId] = useState<string>('');
  const [result, setResult] = useState<ClassDiagnosisResult | null>(null);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const { homeworks, fetchHomeworks } = useHomeworkStore();

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  useEffect(() => {
    const urlId = searchParams.get('homeworkId');
    if (urlId) {
      setHomeworkId(urlId);
    } else if (homeworks.length > 0 && !homeworkId) {
      setHomeworkId(homeworks[0].id);
    }
  }, [homeworks, searchParams]);

  useEffect(() => {
    if (homeworkId) {
      handleEstimateCDM();
    }
  }, [homeworkId]);

  const handleEstimateCDM = async () => {
    if (!homeworkId) return;
    setDiagnosing(true);
    try {
      const res = await diagnosisApi.estimateCDM(homeworkId);
      if (res.status === 'success') {
        message.success(`CDM估计完成: ${res.n_students}名学生, ${res.n_knowledge_points}个知识点`);
        try {
          const classResult = await diagnosisApi.diagnoseStudent(homeworkId, '__class__') as unknown as ClassDiagnosisResult;
          setResult(classResult);
        } catch {
          message.info('CDM参数已估计，但班级诊断结果暂不可用');
        }
        try {
          const hwRes = await homeworkApi.getResults(homeworkId) as unknown as { students?: Record<string, unknown> };
          setStudentIds(hwRes.students ? Object.keys(hwRes.students) : []);
        } catch {
          setStudentIds([]);
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || 'CDM估计失败');
    } finally {
      setDiagnosing(false);
    }
  };

  const goToStudentDiagnosis = (studentId: string) => {
    navigate(`/student-diagnosis?homeworkId=${homeworkId}&studentId=${studentId}`);
  };

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>诊断总览</Typography.Title>
          <Typography.Text type="secondary">班级认知诊断与根因分析</Typography.Text>
        </div>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Typography.Text>作业:</Typography.Text>
          <Select
            showSearch
            placeholder="选择作业"
            value={homeworkId || undefined}
            onChange={setHomeworkId}
            style={{ width: 300 }}
            options={homeworks.map(hw => ({ value: hw.id, label: `${hw.title} (${hw.id.slice(0, 8)}...)` }))}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false}
          />
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            loading={diagnosing}
            onClick={handleEstimateCDM}
            disabled={!homeworkId}
          >
            重新诊断
          </Button>
        </Space>
      </Card>

      {!result ? (
        <Card>
          <Empty description="请选择作业并运行CDM诊断" />
        </Card>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="学生数" value={result.n_students} prefix={<ExperimentOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="知识点数" value={result.n_knowledge_points} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="根因数量"
                  value={result.class_root_causes.length}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<AlertOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均掌握率"
                  value={
                    result.n_knowledge_points > 0
                      ? Math.round(Object.values(result.kp_avg_mastery).reduce((a, b) => a + b, 0) / result.n_knowledge_points * 100)
                      : 0
                  }
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card title="根因排名" style={{ marginBottom: 16 }}>
            <Table
              dataSource={result.class_root_causes}
              rowKey="kp_code"
              pagination={false}
              columns={[
                {
                  title: '排名',
                  width: 60,
                  render: (_, __, idx) => idx + 1,
                },
                {
                  title: '薄弱知识点',
                  dataIndex: 'kp_name',
                  key: 'kp_name',
                },
                {
                  title: '薄弱人数',
                  dataIndex: 'weak_count',
                  key: 'weak_count',
                  width: 100,
                },
                {
                  title: '薄弱率',
                  dataIndex: 'weak_rate',
                  key: 'weak_rate',
                  width: 100,
                  render: (v: number) => <Tag color={v > 0.5 ? 'red' : v > 0.3 ? 'orange' : 'green'}>{(v * 100).toFixed(1)}%</Tag>,
                },
                {
                  title: '平均掌握率',
                  dataIndex: 'avg_mastery',
                  key: 'avg_mastery',
                  width: 160,
                  render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" status={v < 0.3 ? 'exception' : 'active'} />,
                },
                {
                  title: '根因知识点',
                  dataIndex: 'root_cause_code',
                  key: 'root_cause_code',
                  width: 160,
                  render: (v: string) => v ? <Tag color="volcano">{v}</Tag> : '-',
                },
              ]}
            />
          </Card>

          {studentIds.length > 0 && (
            <Card title={<Space><UserOutlined /><span>学生列表</span></Space>}>
              <Flex wrap="wrap" gap={8}>
                {studentIds.map(sid => (
                  <Button
                    key={sid}
                    size="small"
                    onClick={() => goToStudentDiagnosis(sid)}
                  >
                    {sid}
                  </Button>
                ))}
              </Flex>
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                点击学生ID查看个人诊断详情与根因追溯
              </Typography.Text>
            </Card>
          )}
        </>
      )}
    </>
  );
};

export default DiagnosisOverview;
