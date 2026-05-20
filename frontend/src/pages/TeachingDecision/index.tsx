import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Empty, Card, Typography, Flex, Select, Button, Space, Spin, message, Input,
  Timeline, Tag, Descriptions, List, Table, Tabs, Progress, Statistic, Row, Col,
} from 'antd';
import {
  BulbOutlined, RocketOutlined, SortAscendingOutlined,
  AlertOutlined,
  UserOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { diagnosisApi } from '../../services/diagnosis';
import { useHomeworkStore } from '../../stores/useHomeworkStore';
import type { LearningPath } from '../../types';

interface FocusKp {
  kp_code: string;
  kp_name: string;
  current_mastery: number;
  urgency: number;
}

interface Strategy {
  kp_code: string;
  kp_name: string;
  approach: string;
  exercises: string;
  expected_improvement: string;
}

interface GroupSuggestion {
  target_group: string;
  student_count: number;
  group_label: string;
  focus_kps: FocusKp[];
  strategy: Strategy[];
  estimated_sessions: number;
}

interface PriorityItem {
  kp_code: string;
  kp_name: string;
  avg_mastery: number;
  weak_count: number;
  weak_rate: number;
  urgency_score: number;
  prerequisite_depth: number;
}

const TeachingDecision = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [homeworkId, setHomeworkId] = useState(searchParams.get('homeworkId') || '');
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [suggestions, setSuggestions] = useState<GroupSuggestion[] | null>(null);
  const [priorities, setPriorities] = useState<PriorityItem[] | null>(null);
  const [classResult, setClassResult] = useState<{
    n_students: number;
    n_knowledge_points: number;
    kp_avg_mastery: Record<string, number>;
    class_root_causes: Array<{ kp_code: string; kp_name: string; weak_count: number; weak_rate: number; avg_mastery: number; root_cause_code: string }>;
  } | null>(null);
  const { homeworks, fetchHomeworks } = useHomeworkStore();

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  useEffect(() => {
    if (homeworks.length > 0 && !homeworkId) {
      setHomeworkId(homeworks[0].id);
    }
  }, [homeworks]);

  useEffect(() => {
    if (homeworkId) {
      loadAllData();
    }
  }, [homeworkId]);

  const loadAllData = async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const [sugRes, priRes] = await Promise.all([
        diagnosisApi.getTeachingSuggestions(homeworkId).catch(() => null),
        diagnosisApi.getRemediationPriority(homeworkId).catch(() => null),
      ]);
      if (sugRes) setSuggestions((sugRes as { suggestions?: GroupSuggestion[] }).suggestions || []);
      if (priRes) setPriorities((priRes as { priorities?: PriorityItem[] }).priorities || []);

      // 尝试获取班级诊断数据用于报告
      try {
        const classRes = await diagnosisApi.diagnoseStudent(homeworkId, '__class__');
        setClassResult(classRes as unknown as typeof classResult);
      } catch {
        setClassResult(null);
      }
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPaths = async (sid?: string) => {
    const targetId = sid || studentId;
    if (!targetId) return;
    if (sid) setStudentId(sid);
    setLoading(true);
    try {
      const res = await diagnosisApi.getLearningPaths(targetId);
      setPaths(res.paths || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '加载学习路径失败');
    } finally {
      setLoading(false);
    }
  };

  const studentsWithPath = ['S003', 'S005', 'S007', 'S011'];

  // 诊断报告 — 自动生成关键发现
  const reportFindings = useMemo(() => {
    if (!classResult && !priorities) return null;
    const findings: string[] = [];

    if (priorities && priorities.length > 0) {
      const top = priorities[0];
      findings.push(`最薄弱知识点「${top.kp_name}」平均掌握率仅 ${Math.round(top.avg_mastery * 100)}%，影响 ${top.weak_count} 名学生`);
      if (priorities.length > 1) {
        const highUrgency = priorities.filter(p => p.urgency_score > 0.15);
        if (highUrgency.length > 0) {
          findings.push(`共 ${highUrgency.length} 个知识点紧迫度较高，需优先关注`);
        }
      }
    }

    if (classResult) {
      const avgMastery = classResult.n_knowledge_points > 0
        ? Object.values(classResult.kp_avg_mastery).reduce((a, b) => a + b, 0) / classResult.n_knowledge_points
        : 0;
      findings.push(`班级平均掌握率 ${Math.round(avgMastery * 100)}%，共 ${classResult.n_students} 名学生`);
      if (classResult.class_root_causes.length > 0) {
        const topRoot = classResult.class_root_causes[0];
        findings.push(`根因「${topRoot.kp_name}」影响范围最广，薄弱率 ${(topRoot.weak_rate * 100).toFixed(1)}%`);
      }
    }

    if (suggestions && suggestions.length > 0) {
      const totalStudents = suggestions.reduce((s, g) => s + g.student_count, 0);
      findings.push(`建议分为 ${suggestions.length} 个教学组，共涉及 ${totalStudents} 名学生`);
    }

    return findings;
  }, [classResult, priorities, suggestions]);

  // 诊断报告 — 行动建议
  const actionItems = useMemo(() => {
    if (!priorities || priorities.length === 0) return [];
    const actions: { priority: number; text: string }[] = [];
    priorities.slice(0, 3).forEach((p, i) => {
      actions.push({
        priority: i + 1,
        text: `优先补救「${p.kp_name}」— 掌握率 ${Math.round(p.avg_mastery * 100)}%，前置深度 ${p.prerequisite_depth} 层`,
      });
    });
    if (suggestions && suggestions.length > 0) {
      const longestGroup = suggestions.reduce((a, b) => a.estimated_sessions > b.estimated_sessions ? a : b);
      actions.push({
        priority: actions.length + 1,
        text: `预计 ${longestGroup.estimated_sessions} 课时可完成最紧迫组的补救教学`,
      });
    }
    return actions;
  }, [priorities, suggestions]);

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>教学决策</Typography.Title>
          <Typography.Text type="secondary">基于诊断结果的个性化学习路径与教学建议</Typography.Text>
        </div>
        <BulbOutlined style={{ fontSize: 24, color: '#faad14' }} />
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
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
          <Button type="primary" icon={<BulbOutlined />} loading={loading} onClick={loadAllData} disabled={!homeworkId}>
            刷新数据
          </Button>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="report"
        items={[
          /* ===== Tab1: 诊断报告 ===== */
          {
            key: 'report',
            label: '诊断报告',
            icon: <FileTextOutlined />,
            children: (
              <Spin spinning={loading}>
                {!classResult && (!priorities || priorities.length === 0) ? (
                  <Card>
                    <Empty description="请选择作业并刷新数据以生成诊断报告" />
                  </Card>
                ) : (
                  <Flex vertical gap={16}>
                    {/* 概览统计 */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Card>
                          <Statistic title="学生数" value={classResult?.n_students || '-'} prefix={<UserOutlined />} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic title="知识点数" value={classResult?.n_knowledge_points || priorities?.length || '-'} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="平均掌握率"
                            value={classResult ? Math.round(Object.values(classResult.kp_avg_mastery).reduce((a, b) => a + b, 0) / classResult.n_knowledge_points * 100) : '-'}
                            suffix={classResult ? '%' : ''}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="根因数量"
                            value={classResult?.class_root_causes?.length || 0}
                            valueStyle={{ color: (classResult?.class_root_causes?.length || 0) > 0 ? '#cf1322' : '#3f8600' }}
                            prefix={<AlertOutlined />}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {/* 关键发现 */}
                    {reportFindings && reportFindings.length > 0 && (
                      <Card title="关键发现" size="small">
                        <Flex vertical gap={8}>
                          {reportFindings.map((f, i) => (
                            <Typography.Text key={i} style={{ fontSize: 13 }}>
                              <Tag color="blue" style={{ marginRight: 8 }}>{i + 1}</Tag>
                              {f}
                            </Typography.Text>
                          ))}
                        </Flex>
                      </Card>
                    )}

                    {/* 薄弱知识点 TOP5 */}
                    {priorities && priorities.length > 0 && (
                      <Card title="薄弱知识点 TOP5" size="small">
                        <Table
                          dataSource={priorities.slice(0, 5)}
                          rowKey="kp_code"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: '#', width: 40, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
                            { title: '知识点', dataIndex: 'kp_name', key: 'kp_name' },
                            {
                              title: '平均掌握率', dataIndex: 'avg_mastery', key: 'avg_mastery', width: 150,
                              render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" status={v < 0.3 ? 'exception' : 'active'} />,
                            },
                            { title: '薄弱人数', dataIndex: 'weak_count', key: 'weak_count', width: 80 },
                            {
                              title: '紧迫度', dataIndex: 'urgency_score', key: 'urgency_score', width: 90,
                              render: (v: number) => <Tag color={v > 0.3 ? 'red' : v > 0.15 ? 'orange' : 'green'}>{v.toFixed(3)}</Tag>,
                            },
                          ]}
                        />
                      </Card>
                    )}

                    {/* 行动建议 */}
                    {actionItems.length > 0 && (
                      <Card title="行动建议" size="small">
                        <Flex vertical gap={6}>
                          {actionItems.map(item => (
                            <Typography.Text key={item.priority} style={{ fontSize: 13 }}>
                              <Tag color={item.priority <= 2 ? 'red' : 'orange'} style={{ marginRight: 8 }}>
                                P{item.priority}
                              </Tag>
                              {item.text}
                            </Typography.Text>
                          ))}
                        </Flex>
                      </Card>
                    )}

                    {/* 学生分组概览 */}
                    {suggestions && suggestions.length > 0 && (
                      <Card title="学生分组概览" size="small">
                        <Row gutter={12}>
                          {suggestions.map((group, idx) => (
                            <Col span={Math.max(6, 24 / suggestions.length)} key={idx}>
                              <Card size="small" style={{ borderTop: `3px solid ${['#1677ff', '#52c41a', '#fa8c16', '#eb2f96'][idx % 4]}` }}>
                                <Typography.Text strong>{group.group_label}</Typography.Text>
                                <div style={{ marginTop: 4 }}>
                                  <Tag>{group.student_count}人</Tag>
                                  <Tag color="orange">预计{group.estimated_sessions}课时</Tag>
                                </div>
                                {group.focus_kps.length > 0 && (
                                  <div style={{ marginTop: 8 }}>
                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>重点:</Typography.Text>
                                    <div style={{ marginTop: 2 }}>
                                      {group.focus_kps.slice(0, 3).map(kp => (
                                        <Tag key={kp.kp_code} color={kp.urgency > 0.3 ? 'red' : 'orange'} style={{ fontSize: 11, margin: '2px' }}>
                                          {kp.kp_name}
                                        </Tag>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card>
                    )}
                  </Flex>
                )}
              </Spin>
            ),
          },

          /* ===== Tab2: 教学策略 ===== */
          {
            key: 'strategies',
            label: '教学策略',
            icon: <BulbOutlined />,
            children: (
              <Spin spinning={loading}>
                {suggestions && suggestions.length > 0 ? (
                  <Flex vertical gap={16}>
                    {suggestions.map((group, gIdx) => (
                      <Card
                        key={gIdx}
                        title={
                          <Space>
                            <Tag color="blue">{group.target_group}</Tag>
                            <Tag>{group.student_count}人</Tag>
                            <Typography.Text type="secondary">{group.group_label}</Typography.Text>
                            <Tag color="orange">预计{group.estimated_sessions}课时</Tag>
                          </Space>
                        }
                      >
                        <Row gutter={[16, 16]}>
                          {group.strategy.map((s) => (
                            <Col span={12} key={s.kp_code}>
                              <Card
                                size="small"
                                type="inner"
                                title={
                                  <Space>
                                    <Tag color={
                                      group.focus_kps.find(k => k.kp_code === s.kp_code)?.urgency ?? 0 > 0.3 ? 'red' : 'orange'
                                    }>
                                      {s.kp_name}
                                    </Tag>
                                    <Progress
                                      percent={Math.round((group.focus_kps.find(k => k.kp_code === s.kp_code)?.current_mastery ?? 0) * 100)}
                                      size="small"
                                      style={{ width: 100, display: 'inline-block' }}
                                      status="exception"
                                    />
                                  </Space>
                                }
                              >
                                <Descriptions column={1} size="small">
                                  <Descriptions.Item label="教学策略">{s.approach}</Descriptions.Item>
                                  <Descriptions.Item label="练习量">{s.exercises}</Descriptions.Item>
                                  <Descriptions.Item label="预期提升">
                                    <Tag color="green">{s.expected_improvement}</Tag>
                                  </Descriptions.Item>
                                </Descriptions>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card>
                    ))}
                  </Flex>
                ) : (
                  !loading && <Card><Empty description="请选择作业并刷新数据以获取教学策略" /></Card>
                )}
              </Spin>
            ),
          },

          /* ===== Tab3: 学习路径 ===== */
          {
            key: 'path',
            label: '学习路径',
            icon: <RocketOutlined />,
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Flex vertical gap={8}>
                    <Space wrap>
                      <Typography.Text>学生ID:</Typography.Text>
                      <Input
                        placeholder="输入学生ID"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        style={{ width: 200 }}
                      />
                      <Button type="primary" icon={<RocketOutlined />} loading={loading} onClick={() => handleLoadPaths()} disabled={!studentId}>
                        加载学习路径
                      </Button>
                    </Space>
                    <Space>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>快捷选择:</Typography.Text>
                      {studentsWithPath.map(sid => (
                        <Tag
                          key={sid}
                          color={studentId === sid ? 'blue' : 'default'}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleLoadPaths(sid)}
                        >
                          {sid}
                        </Tag>
                      ))}
                    </Space>
                  </Flex>
                </Card>

                <Spin spinning={loading}>
                  {paths.length === 0 ? (
                    <Card>
                      <Empty description="暂无学习路径，请先完成诊断分析" />
                    </Card>
                  ) : (
                    <Flex vertical gap={16}>
                      {paths.map((path, idx) => (
                        <Card
                          key={path.id}
                          title={
                            <Space>
                              <Tag color="blue">路径 #{idx + 1}</Tag>
                              {path.root_cause_kp_id && <Tag color="volcano">根因: {path.root_cause_kp_id}</Tag>}
                              <Tag color={path.status === 'active' ? 'green' : 'default'}>{path.status}</Tag>
                            </Space>
                          }
                        >
                          <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="预计时长">{path.estimated_duration ? `${path.estimated_duration.total_hours}小时` : '-'}</Descriptions.Item>
                            <Descriptions.Item label="会话数">{path.estimated_duration?.sessions || '-'}</Descriptions.Item>
                            <Descriptions.Item label="进度">{Math.round(path.progress * 100)}%</Descriptions.Item>
                          </Descriptions>

                          {path.path_nodes.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>学习路径节点:</Typography.Text>
                              <Timeline
                                items={path.path_nodes.map((node) => ({
                                  color: node.mastery_rate < 0.3 ? 'red' : node.mastery_rate < 0.6 ? 'orange' : 'green',
                                  children: (
                                    <Space>
                                      <Tag>{node.sequence}</Tag>
                                      <span>{node.kp_name || node.kp_id}</span>
                                      <Tag color={node.mastery_rate < 0.3 ? 'red' : 'orange'}>{Math.round(node.mastery_rate * 100)}%</Tag>
                                      {node.cognitive_level && <Tag>{node.cognitive_level}</Tag>}
                                    </Space>
                                  ),
                                }))}
                              />
                            </div>
                          )}

                          {path.activities.length > 0 && (
                            <div>
                              <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>学习活动:</Typography.Text>
                              <List
                                size="small"
                                dataSource={path.activities}
                                renderItem={(activity) => (
                                  <List.Item>
                                    <Space>
                                      <Tag>{activity.type}</Tag>
                                      <span>{activity.content?.name || activity.content?.kp_name || '-'}</span>
                                      <Tag color={activity.status === 'completed' ? 'green' : activity.status === 'active' ? 'blue' : 'default'}>{activity.status}</Tag>
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            </div>
                          )}
                        </Card>
                      ))}
                    </Flex>
                  )}
                </Spin>
              </>
            ),
          },

          /* ===== Tab4: 补救优先级 ===== */
          {
            key: 'priority',
            label: '补救优先级',
            icon: <SortAscendingOutlined />,
            children: (
              <Spin spinning={loading}>
                {priorities && priorities.length > 0 ? (
                  <Card title="补救优先级排序">
                    <Table
                      dataSource={priorities}
                      rowKey="kp_code"
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '知识点', dataIndex: 'kp_name', key: 'kp_name' },
                        { title: '薄弱人数', dataIndex: 'weak_count', key: 'weak_count', width: 90 },
                        {
                          title: '平均掌握率', dataIndex: 'avg_mastery', key: 'avg_mastery', width: 160,
                          render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" status={v < 0.3 ? 'exception' : 'active'} />,
                        },
                        {
                          title: '紧迫度', dataIndex: 'urgency_score', key: 'urgency_score', width: 100,
                          render: (v: number) => <Tag color={v > 0.3 ? 'red' : v > 0.15 ? 'orange' : 'green'}>{v.toFixed(3)}</Tag>,
                        },
                        {
                          title: '前置深度', dataIndex: 'prerequisite_depth', key: 'prerequisite_depth', width: 90,
                          render: (v: number) => <Tag>{v}</Tag>,
                        },
                      ]}
                    />
                  </Card>
                ) : (
                  !loading && <Card><Empty description="请选择作业并刷新数据以获取补救优先级" /></Card>
                )}
              </Spin>
            ),
          },
        ]}
      />
    </>
  );
};

export default TeachingDecision;
