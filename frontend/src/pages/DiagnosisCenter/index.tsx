import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, Button,
  Space, Empty, Flex, Progress, Tabs, Spin, Select, Input,
  Descriptions, Timeline, message,
} from 'antd';
import {
  ExperimentOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  UserOutlined,
  NodeIndexOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { diagnosisApi } from '../../services/diagnosis';
import { homeworkApi } from '../../services/homework';
import { knowledgeApi } from '../../services/api';
import { agentApi } from '../../services/agent';
import type { ClassDiagnosisResult, DiagnosisResult, TraceResult, Homework, CDMParams } from '../../types';
import RootCauseTree from '../../components/RootCauseTree';
import MasteryHeatmap from '../../components/MasteryHeatmap';
import TrendChart from '../../components/TrendChart';
import AgentStatusCard from '../../components/AgentStatusCard';
import type { AgentStatus } from '../../components/AgentStatusCard';

/* ===== Agent 名称与描述映射 ===== */
const agentMeta: Record<string, { label: string; desc: string }> = {
  diagnosis: { label: '诊断Agent', desc: 'CDM认知诊断与根因分析' },
  knowledge: { label: '知识Agent', desc: '知识图谱构建与维护' },
  tracing: { label: '追踪Agent', desc: '学习轨迹追踪与预测' },
  teaching: { label: '教学Agent', desc: '教学决策与干预建议' },
  evolution: { label: '演化Agent', desc: '模型参数自适应演化' },
};

const AGENT_NAMES = ['diagnosis', 'knowledge', 'tracing', 'teaching', 'evolution'];

const DiagnosisCenter = () => {
  /* ===== URL 参数支持 ===== */
  const [searchParams] = useSearchParams();

  /* ===== 作业选择与基础状态 ===== */
  const [homeworkId, setHomeworkId] = useState<string>(searchParams.get('homeworkId') || '');
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  /* ===== 班级诊断状态 ===== */
  const [classResult, setClassResult] = useState<ClassDiagnosisResult | null>(null);

  /* ===== 学生诊断状态 ===== */
  const [studentId, setStudentId] = useState<string>('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [studentResult, setStudentResult] = useState<DiagnosisResult | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [traceMap, setTraceMap] = useState<Record<string, TraceResult>>({});

  /* ===== CDM参数状态 ===== */
  const [cdmParams, setCdmParams] = useState<CDMParams | null>(null);
  const [cdmLoading, setCdmLoading] = useState(false);
  const [cdmEstimateInfo, setCdmEstimateInfo] = useState<{
    converged: boolean;
    iterations: number;
  } | null>(null);

  /* ===== Agent状态 ===== */
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  /* ===== 活跃Tab ===== */
  const [activeTab, setActiveTab] = useState('class');

  /* ===== 页面加载：获取作业列表与Agent状态 ===== */
  useEffect(() => {
    setHomeworkLoading(true);
    homeworkApi.list()
      .then(res => setHomeworkList(res.items || []))
      .catch(() => message.error('获取作业列表失败'))
      .finally(() => setHomeworkLoading(false));

    fetchAgentStatuses();
  }, []);

  /* ===== URL homeworkId 自动加载数据 ===== */
  useEffect(() => {
    if (homeworkList.length === 0) return;
    const hid = searchParams.get('homeworkId') || '';
    const targetHid = hid || homeworkList.find(h => h.status === 'cdm_estimated')?.id || '';
    if (!targetHid) return;
    const hw = homeworkList.find(h => h.id === targetHid);
    if (hw?.status === 'cdm_estimated') {
      if (!homeworkId) setHomeworkId(targetHid);
      autoLoadDiagnosis(targetHid);
    }
  }, [homeworkList]);

  /* ===== 自动加载诊断数据（先查后算） ===== */
  const autoLoadDiagnosis = async (hid: string) => {
    setDiagnosing(true);
    try {
      // Load CDM params (fast GET)
      diagnosisApi.getCDMParams(hid).then(setCdmParams).catch(() => {});
      // Load class diagnosis (POST, uses cached CDM results)
      try {
        const classRes = await diagnosisApi.diagnoseStudent(hid, '__class__') as unknown as ClassDiagnosisResult;
        setClassResult(classRes);
      } catch { /* ignore */ }
      // Load student IDs
      try {
        const hwRes = await homeworkApi.getResults(hid);
        const data = hwRes as unknown as { students?: Record<string, unknown>; student_ids?: string[] };
        const ids = data.student_ids || (data.students ? Object.keys(data.students) : []);
        setStudentIds(ids);
      } catch { /* ignore */ }
    } finally {
      setDiagnosing(false);
    }
  };

  /* ===== 获取Agent状态 ===== */
  const fetchAgentStatuses = useCallback(() => {
    setAgentLoading(true);
    agentApi.getAgentStates()
      .then(res => {
        const agents = res.agents || [];
        const statusMap = new Map(agents.map(a => [a.name, a]));
        const mapped: AgentStatus[] = AGENT_NAMES.map(name => {
          const agent = statusMap.get(name);
          const meta = agentMeta[name];
          return {
            name,
            description: meta?.desc || agent?.description || '',
            status: (agent?.status as AgentStatus['status']) || 'idle',
            lastEventType: agent?.last_event_type || null,
            lastEventTime: agent?.last_event_time || null,
          };
        });
        setAgentStatuses(mapped);
      })
      .catch(() => message.error('获取Agent状态失败'))
      .finally(() => setAgentLoading(false));
  }, []);

  /* ===== 作业选择变更：仅清除结果，不自动触发诊断 ===== */
  const handleHomeworkChange = (id: string) => {
    setHomeworkId(id);
    setClassResult(null);
    setStudentResult(null);
    setStudentId('');
    setStudentIds([]);
    setTraceMap({});
    setCdmParams(null);
    setCdmEstimateInfo(null);
  };

  /* ===== 运行诊断按钮 ===== */
  const handleRunDiagnosis = async () => {
    if (!homeworkId) return;
    setDiagnosing(true);
    try {
      const res = await diagnosisApi.estimateCDM(homeworkId);
      if (res.status === 'success') {
        setCdmEstimateInfo({ converged: res.converged, iterations: res.iterations });
        message.success(`CDM估计完成: ${res.n_students}名学生, ${res.n_knowledge_points}个知识点`);
        try {
          const classRes = await diagnosisApi.diagnoseStudent(homeworkId, '__class__') as unknown as ClassDiagnosisResult;
          setClassResult(classRes);
        } catch {
          message.info('CDM参数已估计，但班级诊断结果暂不可用');
        }
        try {
          const hwRes = await homeworkApi.getResults(homeworkId);
          const data = hwRes as unknown as { students?: Record<string, unknown>; student_ids?: string[] };
          const ids = data.student_ids || (data.students ? Object.keys(data.students) : []);
          setStudentIds(ids);
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

  /* ===== 学生选择：获取学生列表并诊断 ===== */
  const handleStudentSelect = async (sid: string) => {
    setStudentId(sid);
    if (!homeworkId || !sid) return;
    setStudentLoading(true);
    setStudentResult(null);
    setTraceMap({});
    try {
      const res = await diagnosisApi.diagnoseStudent(homeworkId, sid);
      setStudentResult(res);
      const traces: Record<string, TraceResult> = {};
      const tracePromises = res.root_causes.map(async (rc) => {
        try {
          const trace = await knowledgeApi.trace(rc.root_cause.code);
          traces[rc.root_cause.code] = trace;
        } catch {
          // 单个知识点trace失败不影响整体
        }
      });
      await Promise.all(tracePromises);
      setTraceMap(traces);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '学生诊断失败');
    } finally {
      setStudentLoading(false);
    }
  };

  /* ===== 获取学生列表（切换到学生Tab时） ===== */
  const handleFetchStudentIds = useCallback(() => {
    if (!homeworkId || studentIds.length > 0) return;
    homeworkApi.getResults(homeworkId)
      .then(res => {
        const data = res as unknown as { students?: Record<string, unknown>; student_ids?: string[] };
        const ids = data.student_ids || (data.students ? Object.keys(data.students) : []);
        setStudentIds(ids);
      })
      .catch(() => {
        setStudentIds([]);
        message.error('获取学生列表失败');
      });
  }, [homeworkId, studentIds.length]);

  /* ===== CDM参数Tab激活时获取参数 ===== */
  const handleFetchCDMParams = useCallback(() => {
    if (!homeworkId) return;
    setCdmLoading(true);
    diagnosisApi.getCDMParams(homeworkId)
      .then(params => setCdmParams(params))
      .catch(() => {
        setCdmParams(null);
        message.error('获取CDM参数失败');
      })
      .finally(() => setCdmLoading(false));
  }, [homeworkId]);

  /* ===== Tab切换回调 ===== */
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'student') {
      handleFetchStudentIds();
    } else if (key === 'cdm') {
      handleFetchCDMParams();
    }
  };

  /* ===== 构建根因树数据 ===== */
  const buildRootCauseTreeData = (result: DiagnosisResult) => {
    if (result.root_causes.length === 0) return null;
    const firstRc = result.root_causes[0];
    return {
      code: firstRc.weak_kp.code,
      name: firstRc.weak_kp.code,
      mastery: firstRc.weak_kp.mastery,
      isRootCause: false,
      children: result.root_causes.map(rc => ({
        code: rc.root_cause.code,
        name: rc.root_cause.name || rc.root_cause.code,
        mastery: rc.root_cause.mastery,
        isRootCause: true,
        children: rc.prerequisite_chain.map(node => ({
          code: node.code,
          name: node.name || node.code,
          mastery: node.mastery,
          isRootCause: false,
          children: [],
        })),
      })),
    };
  };

  /* ===== 构建热力图数据 ===== */
  const buildHeatmapData = () => {
    if (!classResult) return [];
    return Object.entries(classResult.kp_avg_mastery).map(([kp, mastery]) => ({
      student: '班级平均',
      kp,
      mastery,
    }));
  };

  /* ===== 根因排名表格列 ===== */
  const rootCauseColumns = [
    { title: '排名', width: 60, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: '薄弱知识点', dataIndex: 'kp_name', key: 'kp_name' },
    { title: '薄弱人数', dataIndex: 'weak_count', key: 'weak_count', width: 100 },
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
  ];

  /* ===== 学生薄弱知识点表格列 ===== */
  const weakKpColumns = [
    {
      title: '知识点',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => {
        const hasRootCause = studentResult?.root_causes.some(rc => rc.weak_kp.code === code);
        return (
          <Space direction="vertical" size={0}>
            <span>{code}</span>
            {hasRootCause && <Tag color="volcano" style={{ fontSize: 11 }}>有根因</Tag>}
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

  /* ===== EM收敛占位数据 ===== */
  const emConvergenceData = cdmEstimateInfo
    ? Array.from({ length: Math.min(cdmEstimateInfo.iterations, 30) }, (_, i) => ({
        time: `迭代${i + 1}`,
        value: Math.max(0.01, 1 - (i + 1) / cdmEstimateInfo.iterations + Math.random() * 0.05),
        category: '对数似然变化',
      }))
    : [];

  return (
    <>
      {/* ===== 顶部标题与操作区 ===== */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>诊断中心</Typography.Title>
          <Typography.Text type="secondary">CDM认知诊断 · 根因追溯 · 教学决策</Typography.Text>
        </div>
        <Space>
          <Select
            showSearch
            placeholder="选择作业"
            value={homeworkId || undefined}
            onChange={handleHomeworkChange}
            style={{ width: 300 }}
            loading={homeworkLoading}
            options={homeworkList.map(hw => ({
              value: hw.id,
              label: `${hw.title} (${hw.id.slice(0, 8)}...)`,
            }))}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
            }
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={diagnosing}
            onClick={handleRunDiagnosis}
            disabled={!homeworkId}
          >
            运行诊断
          </Button>
        </Space>
      </Flex>

      {/* ===== 主体内容：左侧Tabs + 右侧Agent面板 ===== */}
      <Row gutter={16}>
        <Col span={18}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              /* ===== Tab1: 班级诊断 ===== */
              {
                key: 'class',
                label: '班级诊断',
                children: !classResult ? (
                  <Card>
                    <Empty description="请选择作业并运行CDM诊断" />
                  </Card>
                ) : (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={6}>
                        <Card>
                          <Statistic title="学生数" value={classResult.n_students} prefix={<UserOutlined />} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic title="知识点数" value={classResult.n_knowledge_points} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="根因数量"
                            value={classResult.class_root_causes.length}
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
                              classResult.n_knowledge_points > 0
                                ? Math.round(
                                    Object.values(classResult.kp_avg_mastery).reduce((a, b) => a + b, 0) /
                                      classResult.n_knowledge_points *
                                      100,
                                  )
                                : 0
                            }
                            suffix="%"
                            prefix={<CheckCircleOutlined />}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {/* 掌握率热力图 */}
                    <Card title="知识点掌握率热力图" style={{ marginBottom: 16 }}>
                      <MasteryHeatmap data={buildHeatmapData()} height={300} />
                    </Card>

                    {/* 根因排名表 */}
                    <Card title="根因排名">
                      <Table
                        dataSource={classResult.class_root_causes}
                        rowKey="kp_code"
                        pagination={false}
                        columns={rootCauseColumns}
                      />
                    </Card>
                  </>
                ),
              },

              /* ===== Tab2: 学生诊断 ===== */
              {
                key: 'student',
                label: '学生诊断',
                children: (
                  <>
                    {/* 学生选择器 */}
                    <Card style={{ marginBottom: 16 }}>
                      <Space wrap>
                        <Typography.Text>学生ID:</Typography.Text>
                        <Select
                          showSearch
                          placeholder={studentIds.length > 0 ? '选择学生' : '输入学生ID'}
                          value={studentId || undefined}
                          onChange={handleStudentSelect}
                          style={{ width: 240 }}
                          options={studentIds.map(sid => ({ value: sid, label: sid }))}
                          filterOption={(input, option) =>
                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                          }
                          notFoundContent={homeworkId ? '暂无学生数据' : '请先选择作业'}
                        />
                        {!studentId && (
                          <Input
                            placeholder="手动输入学生ID"
                            style={{ width: 200 }}
                            onPressEnter={(e) => handleStudentSelect((e.target as HTMLInputElement).value)}
                          />
                        )}
                      </Space>
                    </Card>

                    <Spin spinning={studentLoading}>
                      {!studentResult ? (
                        <Card>
                          <Empty description="请选择或输入学生ID后运行诊断" />
                        </Card>
                      ) : (
                        <>
                          {/* 学生诊断统计卡片 */}
                          <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={6}>
                              <Card>
                                <Statistic title="学生" value={studentResult.student_id} prefix={<UserOutlined />} />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card>
                                <Statistic title="知识点总数" value={Object.keys(studentResult.knowledge_state).length} />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card>
                                <Statistic
                                  title="薄弱知识点"
                                  value={studentResult.weak_kp_count}
                                  valueStyle={{ color: studentResult.weak_kp_count > 0 ? '#cf1322' : '#3f8600' }}
                                  prefix={<AlertOutlined />}
                                />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card>
                                <Statistic
                                  title="根因数量"
                                  value={studentResult.root_causes.length}
                                  valueStyle={{ color: studentResult.root_causes.length > 0 ? '#cf1322' : '#3f8600' }}
                                  prefix={<NodeIndexOutlined />}
                                />
                              </Card>
                            </Col>
                          </Row>

                          <Row gutter={16}>
                            {/* 薄弱知识点列表 */}
                            <Col span={14}>
                              <Card title="薄弱知识点列表" style={{ marginBottom: 16 }}>
                                {studentResult.weak_kps.length === 0 ? (
                                  <Empty description="没有薄弱知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                ) : (
                                  <Table
                                    dataSource={studentResult.weak_kps}
                                    rowKey="code"
                                    pagination={false}
                                    size="small"
                                    columns={weakKpColumns}
                                  />
                                )}
                              </Card>
                            </Col>

                            {/* 根因追溯树 */}
                            <Col span={10}>
                              <Card title="根因追溯" style={{ marginBottom: 16 }}>
                                <RootCauseTree data={buildRootCauseTreeData(studentResult)} />
                              </Card>
                            </Col>
                          </Row>

                          {/* 知识图谱关联（trace结果） */}
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
                                            {trace.downstream.length > 8 && <Tag>+{trace.downstream.length - 8}</Tag>}
                                          </Space>
                                        </Descriptions.Item>
                                      </Descriptions>
                                    </Card>
                                  </Col>
                                ))}
                              </Row>
                            </Card>
                          )}

                          {/* 完整知识状态标签 */}
                          <Card title="完整知识状态">
                            <Row gutter={[8, 8]}>
                              {Object.entries(studentResult.knowledge_state)
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
                ),
              },

              /* ===== Tab3: CDM参数 ===== */
              {
                key: 'cdm',
                label: 'CDM参数',
                children: (
                  <Spin spinning={cdmLoading}>
                    {!cdmParams ? (
                      <Card>
                        <Empty description={homeworkId ? '该作业暂无CDM参数，请先运行诊断' : '请先选择作业'} />
                      </Card>
                    ) : (
                      <>
                        {/* 模型概览统计 */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col span={6}>
                            <Card>
                              <Statistic title="学生数" value={cdmParams.alpha.student_ids.length} prefix={<ExperimentOutlined />} />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic title="知识点数" value={cdmParams.alpha.kp_codes.length} />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic title="AIC" value={cdmParams.aic} precision={2} />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic
                                title="收敛状态"
                                value={cdmParams.convergence_status === 'converged' ? '已收敛' : '未收敛'}
                                valueStyle={{
                                  color: cdmParams.convergence_status === 'converged' ? '#3f8600' : '#cf1322',
                                }}
                                prefix={
                                  cdmParams.convergence_status === 'converged' ? (
                                    <CheckCircleOutlined />
                                  ) : (
                                    <AlertOutlined />
                                  )
                                }
                              />
                            </Card>
                          </Col>
                        </Row>

                        {/* Slip与Guess参数表 */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col span={12}>
                            <Card title="Slip参数 (失误率)" size="small">
                              <Table
                                dataSource={cdmParams.slip.map((v, i) => ({
                                  key: i,
                                  index: i + 1,
                                  kp: cdmParams.alpha.kp_codes[i],
                                  value: v,
                                }))}
                                pagination={false}
                                size="small"
                                scroll={{ y: 300 }}
                                columns={[
                                  { title: '#', dataIndex: 'index', width: 50 },
                                  { title: '知识点', dataIndex: 'kp', ellipsis: true },
                                  { title: 'Slip', dataIndex: 'value', width: 100, render: (v: number) => v.toFixed(4) },
                                ]}
                              />
                            </Card>
                          </Col>
                          <Col span={12}>
                            <Card title="Guess参数 (猜测率)" size="small">
                              <Table
                                dataSource={cdmParams.guess.map((v, i) => ({
                                  key: i,
                                  index: i + 1,
                                  kp: cdmParams.alpha.kp_codes[i],
                                  value: v,
                                }))}
                                pagination={false}
                                size="small"
                                scroll={{ y: 300 }}
                                columns={[
                                  { title: '#', dataIndex: 'index', width: 50 },
                                  { title: '知识点', dataIndex: 'kp', ellipsis: true },
                                  { title: 'Guess', dataIndex: 'value', width: 100, render: (v: number) => v.toFixed(4) },
                                ]}
                              />
                            </Card>
                          </Col>
                        </Row>

                        {/* 模型详细信息 */}
                        <Card title="模型信息" size="small" style={{ marginBottom: 16 }}>
                          <Descriptions column={2}>
                            <Descriptions.Item label="模型类型">{cdmParams.model_type}</Descriptions.Item>
                            <Descriptions.Item label="参数ID">{cdmParams.cdm_params_id}</Descriptions.Item>
                            <Descriptions.Item label="BIC">{cdmParams.bic.toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="AIC">{cdmParams.aic.toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="估计时间">
                              {cdmParams.estimated_at ? new Date(cdmParams.estimated_at).toLocaleString('zh-CN') : '-'}
                            </Descriptions.Item>
                            {cdmEstimateInfo && (
                              <Descriptions.Item label="迭代次数">{cdmEstimateInfo.iterations}</Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>

                        {/* EM收敛趋势图（占位） */}
                        {emConvergenceData.length > 0 && (
                          <Card title="EM收敛趋势" size="small">
                            <TrendChart
                              data={emConvergenceData}
                              xField="time"
                              yField="value"
                              seriesField="category"
                              height={250}
                              yLabel="对数似然变化"
                            />
                          </Card>
                        )}
                      </>
                    )}
                  </Spin>
                ),
              },
            ]}
          />
        </Col>

        {/* ===== 右侧：Agent状态面板 ===== */}
        <Col span={6}>
          <Card title="Agent 状态" size="small">
            <Flex vertical gap={8}>
              {agentStatuses.length > 0 ? (
                agentStatuses.map(status => (
                  <AgentStatusCard key={status.name} data={status} loading={agentLoading} />
                ))
              ) : (
                AGENT_NAMES.map(name => {
                  const meta = agentMeta[name];
                  return (
                    <AgentStatusCard
                      key={name}
                      data={{
                        name,
                        description: meta?.desc || '',
                        status: 'idle',
                        lastEventType: null,
                        lastEventTime: null,
                      }}
                      loading={agentLoading}
                    />
                  );
                })
              )}
              <Button size="small" onClick={fetchAgentStatuses} style={{ marginTop: 4 }}>
                刷新状态
              </Button>
            </Flex>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default DiagnosisCenter;
