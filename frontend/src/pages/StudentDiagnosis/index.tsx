import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, Button,
  Space, Spin, Empty, Flex, Progress, Timeline, message, Descriptions, Select,
} from 'antd';
import {
  UserOutlined, ExperimentOutlined, AlertOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { diagnosisApi } from '../../services/diagnosis';
import { knowledgeApi } from '../../services/api';
import { homeworkApi } from '../../services/homework';
import { useHomeworkStore } from '../../stores/useHomeworkStore';
import type { DiagnosisResult, TraceResult } from '../../types';

const StudentDiagnosis = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [homeworkId, setHomeworkId] = useState(searchParams.get('homeworkId') || '');
  const [studentId, setStudentId] = useState(searchParams.get('studentId') || '');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [traceMap, setTraceMap] = useState<Record<string, TraceResult>>({});

  const [studentIds, setStudentIds] = useState<string[]>([]);
  const { homeworks, fetchHomeworks } = useHomeworkStore();

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  useEffect(() => {
    if (homeworkId) {
      homeworkApi.getResults(homeworkId).then(res => {
        const data = res as unknown as { students?: Record<string, unknown> };
        setStudentIds(data.students ? Object.keys(data.students) : []);
      }).catch(() => setStudentIds([]));
    } else {
      setStudentIds([]);
    }
  }, [homeworkId]);

  useEffect(() => {
    const hwId = searchParams.get('homeworkId');
    const stuId = searchParams.get('studentId');
    if (hwId && stuId) {
      setHomeworkId(hwId);
      setStudentId(stuId);
    }
  }, []);

  const handleDiagnose = async () => {
    if (!homeworkId || !studentId) return;
    setLoading(true);
    setResult(null);
    setTraceMap({});
    try {
      const res = await diagnosisApi.diagnoseStudent(homeworkId, studentId);
      setResult(res);

      const traces: Record<string, TraceResult> = {};
      const tracePromises = res.root_causes.map(async (rc: { root_cause: { code: string } }) => {
        try {
          const trace = await knowledgeApi.trace(rc.root_cause.code);
          traces[rc.root_cause.code] = trace;
        } catch {
          // trace may fail for some knowledge points
        }
      });
      await Promise.all(tracePromises);
      setTraceMap(traces);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '诊断失败');
    } finally {
      setLoading(false);
    }
  };

  const weakKpColumns = [
    {
      title: '知识点',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => {
        const rootCause = result?.root_causes.find(rc => rc.weak_kp.code === code);
        return (
          <Space direction="vertical" size={0}>
            <span>{code}</span>
            {rootCause && <Tag color="volcano" style={{ fontSize: 11 }}>有根因</Tag>}
          </Space>
        );
      },
    },
    {
      title: '掌握率',
      dataIndex: 'mastery',
      key: 'mastery',
      width: 180,
      sorter: (a: { mastery: number }, b: { mastery: number }) => a.mastery - b.mastery,
      render: (v: number) => (
        <Progress
          percent={Math.round(v * 100)}
          size="small"
          status={v < 0.3 ? 'exception' : v < 0.6 ? 'active' : 'success'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'mastery',
      key: 'status',
      width: 100,
      render: (v: number) => {
        if (v < 0.3) return <Tag color="red">未掌握</Tag>;
        if (v < 0.6) return <Tag color="orange">部分掌握</Tag>;
        return <Tag color="green">已掌握</Tag>;
      },
    },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>学生诊断</Typography.Title>
          <Typography.Text type="secondary">个人认知状态诊断与根因追溯</Typography.Text>
        </div>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Typography.Text>作业:</Typography.Text>
          <Select
            showSearch
            placeholder="选择或输入作业ID"
            value={homeworkId || undefined}
            onChange={setHomeworkId}
            style={{ width: 300 }}
            options={homeworks.map((hw: { id: string; title: string }) => ({ value: hw.id, label: `${hw.title} (${hw.id.slice(0, 8)}...)` }))}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false}
          />
          <Typography.Text>学生:</Typography.Text>
          <Select
            showSearch
            placeholder={studentIds.length > 0 ? '选择学生' : '输入学生ID'}
            value={studentId || undefined}
            onChange={setStudentId}
            style={{ width: 200 }}
            options={studentIds.map(sid => ({ value: sid, label: sid }))}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false}
            notFoundContent={homeworkId ? '暂无学生数据' : '请先选择作业'}
          />
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            loading={loading}
            onClick={handleDiagnose}
            disabled={!homeworkId || !studentId}
          >
            运行诊断
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {!result ? (
          <Card>
            <Empty description="请输入作业ID和学生ID后运行诊断" />
          </Card>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic title="学生" value={result.student_id} prefix={<UserOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="知识点总数"
                    value={Object.keys(result.knowledge_state).length}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="薄弱知识点"
                    value={result.weak_kp_count}
                    valueStyle={{ color: result.weak_kp_count > 0 ? '#cf1322' : '#3f8600' }}
                    prefix={<AlertOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="根因数量"
                    value={result.root_causes.length}
                    valueStyle={{ color: result.root_causes.length > 0 ? '#cf1322' : '#3f8600' }}
                    prefix={<NodeIndexOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={14}>
                <Card title="薄弱知识点列表" style={{ marginBottom: 16 }}>
                  {result.weak_kps.length === 0 ? (
                    <Empty description="没有薄弱知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Table
                      dataSource={result.weak_kps}
                      rowKey="code"
                      pagination={false}
                      size="small"
                      columns={weakKpColumns}
                    />
                  )}
                </Card>
              </Col>

              <Col span={10}>
                <Card title="根因追溯" style={{ marginBottom: 16 }}>
                  {result.root_causes.length === 0 ? (
                    <Empty description="未发现根因" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Flex vertical gap={16}>
                      {result.root_causes.map((rc, idx) => (
                        <Card
                          key={idx}
                          size="small"
                          type="inner"
                          title={
                            <Space>
                              <AlertOutlined style={{ color: '#cf1322' }} />
                              <span>根因 #{idx + 1}</span>
                            </Space>
                          }
                        >
                          <Descriptions column={1} size="small">
                            <Descriptions.Item label="薄弱知识点">
                              <Tag color="red">{rc.weak_kp.code}</Tag>
                              <Progress
                                percent={Math.round(rc.weak_kp.mastery * 100)}
                                size="small"
                                style={{ width: 120, display: 'inline-block', marginLeft: 8 }}
                                status="exception"
                              />
                            </Descriptions.Item>
                            <Descriptions.Item label="根因知识点">
                              <Tag color="volcano">{rc.root_cause.code}</Tag>
                              {rc.root_cause.name && (
                                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                                  {rc.root_cause.name}
                                </Typography.Text>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="追溯深度">
                              <Tag>{rc.trace_depth} 层</Tag>
                            </Descriptions.Item>
                          </Descriptions>

                          {rc.prerequisite_chain.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                前置知识链:
                              </Typography.Text>
                              <Timeline
                                style={{ marginTop: 4 }}
                                items={rc.prerequisite_chain.map((node, i) => ({
                                  color: node.mastery < 0.3 ? 'red' : node.mastery < 0.6 ? 'orange' : 'green',
                                  children: (
                                    <Space>
                                      <span style={{ fontWeight: i === rc.prerequisite_chain.length - 1 ? 600 : 400 }}>
                                        {node.name || node.code}
                                      </span>
                                      <Tag color={node.mastery < 0.3 ? 'red' : node.mastery < 0.6 ? 'orange' : 'green'}>
                                        {Math.round(node.mastery * 100)}%
                                      </Tag>
                                    </Space>
                                  ),
                                }))}
                              />
                            </div>
                          )}
                        </Card>
                      ))}
                    </Flex>
                  )}
                </Card>
              </Col>
            </Row>

            {Object.keys(traceMap).length > 0 && (
              <Card title="知识图谱关联" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  {Object.entries(traceMap).map(([code, trace]) => (
                    <Col span={12} key={code}>
                      <Card size="small" type="inner" title={<Tag color="volcano">{code}</Tag>}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="前置链数">
                            {trace.prerequisite_chains.length}
                          </Descriptions.Item>
                          <Descriptions.Item label="下游影响">
                            {trace.downstream_count} 个知识点
                          </Descriptions.Item>
                          <Descriptions.Item label="下游节点">
                            <Space wrap>
                              {trace.downstream.slice(0, 8).map(d => (
                                <Tag key={d}>{d}</Tag>
                              ))}
                              {trace.downstream.length > 8 && (
                                <Tag>+{trace.downstream.length - 8}</Tag>
                              )}
                            </Space>
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            )}

            <Card title="完整知识状态">
              <Row gutter={[8, 8]}>
                {Object.entries(result.knowledge_state)
                  .sort(([, a], [, b]) => a - b)
                  .map(([code, mastery]) => (
                    <Col key={code} style={{ flex: '0 0 auto' }}>
                      <Tag color={mastery < 0.3 ? 'red' : mastery < 0.6 ? 'orange' : 'green'}>
                        {code}: {Math.round(mastery * 100)}%
                      </Tag>
                    </Col>
                  ))}
              </Row>
            </Card>
          </>
        )}
      </Spin>
    </>
  );
};

export default StudentDiagnosis;
