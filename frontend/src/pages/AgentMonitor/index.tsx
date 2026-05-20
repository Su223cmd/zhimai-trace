import { useState, useEffect } from 'react';
import {
  Typography, Card, List, Tag, Space, Empty, Flex, Spin, Badge, Button, message,
  Row, Col, Timeline,
} from 'antd';
import {
  RobotOutlined, BellOutlined, ThunderboltOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { agentApi } from '../../services/agent';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { AgentNotification } from '../../types';

interface AgentState {
  name: string;
  status: string;
  last_event_type: string;
  last_event_time: string;
  description: string;
}

interface AgentEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

const AGENT_LABELS: Record<string, string> = {
  knowledge: '知识Agent',
  diagnosis: '诊断Agent',
  tracing: '追踪Agent',
  teaching: '教学Agent',
  evolution: '演化Agent',
};

const AGENT_COLORS: Record<string, string> = {
  knowledge: '#1890ff',
  diagnosis: '#722ed1',
  tracing: '#13c2c2',
  teaching: '#fa8c16',
  evolution: '#eb2f96',
};

const AGENT_CAPABILITIES: Record<string, string[]> = {
  knowledge: ['课件解析', '知识图谱构建', 'EDC关系提取', '语义对齐'],
  diagnosis: ['CDM参数估计', '知识状态推断', '根因追溯'],
  tracing: ['BKT知识追踪', '遗忘曲线建模', '掌握率预测'],
  teaching: ['学习路径生成', '教学策略推荐', '分组建议'],
  evolution: ['在线EM更新', '参数漂移检测', '模型演化'],
};

const EVENT_LABELS: Record<string, string> = {
  curriculum_imported: '课标导入',
  courseware_parsed: '课件解析',
  graph_updated: '图谱更新',
  qmatrix_confirmed: 'Q矩阵确认',
  answer_imported: '答题导入',
  cdm_estimated: 'CDM估计',
  diagnosis_completed: '诊断完成',
  parameter_drift: '参数漂移检测',
  teaching_suggestions: '教学建议生成',
  tracing_data_available: '追踪数据就绪',
};

const flowNodes = [
  { id: 'input', label: '课件/作业', x: 0, y: 0, color: '#8c8c8c', isData: true },
  { id: 'knowledge', label: '知识Agent', x: 1, y: 0, color: '#1890ff' },
  { id: 'graph', label: '知识图谱', x: 2, y: 0, color: '#52c41a', isData: true },
  { id: 'diagnosis', label: '诊断Agent', x: 1, y: 1, color: '#722ed1' },
  { id: 'cdm', label: 'CDM参数', x: 2, y: 1, color: '#52c41a', isData: true },
  { id: 'result', label: '诊断结果', x: 3, y: 1, color: '#52c41a', isData: true },
  { id: 'tracing', label: '追踪Agent', x: 1, y: 2, color: '#13c2c2' },
  { id: 'teaching', label: '教学Agent', x: 3, y: 2, color: '#fa8c16' },
  { id: 'evolution', label: '演化Agent', x: 1, y: 3, color: '#eb2f96' },
];

const flowEdges = [
  { from: 'input', to: 'knowledge' },
  { from: 'knowledge', to: 'graph' },
  { from: 'input', to: 'diagnosis' },
  { from: 'diagnosis', to: 'cdm' },
  { from: 'cdm', to: 'result' },
  { from: 'diagnosis', to: 'tracing' },
  { from: 'result', to: 'teaching' },
  { from: 'tracing', to: 'evolution' },
];

const AgentMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentsRes, eventsRes] = await Promise.all([
        agentApi.getAgentStates().catch(() => ({ agents: [], total: 0 })),
        agentApi.getAgentEvents(20).catch(() => ({ total: 0, items: [] })),
      ]);
      setAgents(agentsRes.agents || []);
      setEvents((eventsRes as { items: AgentEvent[] }).items || []);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      await agentApi.initializeAgents();
      message.success('Agent 系统已初始化');
      await loadData();
      await fetchNotifications();
    } catch {
      message.error('Agent 初始化失败');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchNotifications();
  }, [fetchNotifications]);

  const agentStatusMap = new Map(agents.map(a => [a.name, a]));

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Agent监控</Typography.Title>
          <Typography.Text type="secondary">5个智能Agent协同工作，驱动认知诊断全流程</Typography.Text>
        </div>
        <Space>
          <Tag icon={<RobotOutlined />} color="blue">{agents.length} Agents Active</Tag>
          <Button size="small" icon={<ThunderboltOutlined />} loading={initializing} onClick={handleInitialize}>
            重新初始化
          </Button>
        </Space>
      </Flex>

      <Spin spinning={loading}>
        <Flex vertical gap={16}>
          {/* Agent 流程图 */}
          <Card title="Agent 数据流" size="small">
            <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
              {/* SVG flow diagram */}
              <svg width="100%" height="100%" viewBox="0 0 440 220" style={{ maxWidth: 600, margin: '0 auto', display: 'block' }}>
                {/* Edges */}
                {flowEdges.map((edge, i) => {
                  const from = flowNodes.find(n => n.id === edge.from)!;
                  const to = flowNodes.find(n => n.id === edge.to)!;
                  const x1 = from.x * 110 + 55;
                  const y1 = from.y * 55 + 30;
                  const x2 = to.x * 110 + 55;
                  const y2 = to.y * 55 + 30;
                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d9d9d9" strokeWidth={1.5} />
                  );
                })}
                {/* Nodes */}
                {flowNodes.map(node => {
                  const cx = node.x * 110 + 55;
                  const cy = node.y * 55 + 30;
                  const isActive = agentStatusMap.get(node.id)?.status === 'active';
                  return (
                    <g key={node.id} style={{ cursor: node.isData ? 'default' : 'pointer' }} onClick={() => !node.isData && setSelectedAgent(selectedAgent === node.id ? null : node.id)}>
                      <circle cx={cx} cy={cy} r={22} fill={node.isData ? '#f6ffed' : isActive ? node.color : '#f5f5f5'} stroke={node.color} strokeWidth={selectedAgent === node.id ? 3 : 1.5} />
                      {isActive && !node.isData && (
                        <circle cx={cx} cy={cy} r={26} fill="none" stroke={node.color} strokeWidth={1} strokeDasharray="4 2" opacity={0.5}>
                          <animate attributeName="r" from="22" to="30" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={node.isData ? '#389e0d' : '#fff'} fontSize={node.isData ? 9 : 8} fontWeight={500} style={{ pointerEvents: 'none' }}>
                        {node.label.length > 4 ? node.label.slice(0, 4) : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>

          {/* Agent 详情卡片 */}
          <Row gutter={16}>
            {agents.length > 0 ? agents.map((agent) => (
              <Col span={Math.max(4, 24 / agents.length)} key={agent.name} style={{ minWidth: 160 }}>
                <Card
                  size="small"
                  style={{ borderTop: `3px solid ${AGENT_COLORS[agent.name] || '#1890ff'}` }}
                >
                  <Flex vertical gap={6}>
                    <Flex justify="space-between" align="center">
                      <Typography.Text strong style={{ color: AGENT_COLORS[agent.name], fontSize: 13 }}>
                        {AGENT_LABELS[agent.name] || agent.name}
                      </Typography.Text>
                      <Tag color={agent.status === 'active' ? 'green' : 'default'} icon={agent.status === 'active' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
                        {agent.status === 'active' ? '运行中' : agent.status}
                      </Tag>
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {agent.description}
                    </Typography.Text>
                    {(AGENT_CAPABILITIES[agent.name] || []).length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 10 }}>能力:</Typography.Text>
                        <div style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {(AGENT_CAPABILITIES[agent.name] || []).map(cap => (
                            <Tag key={cap} style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '16px' }}>{cap}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {agent.last_event_type && (
                      <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                        最近: {EVENT_LABELS[agent.last_event_type] || agent.last_event_type}
                      </Typography.Text>
                    )}
                  </Flex>
                </Card>
              </Col>
            )) : (
              <Col span={24}>
                <Card size="small"><Empty description="暂无Agent数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /></Card>
              </Col>
            )}
          </Row>

          {/* 事件时间线 + 通知 */}
          <Row gutter={16}>
            <Col span={14}>
              <Card title={<Space><BellOutlined /><span>事件时间线</span></Space>}>
                {events.length === 0 ? (
                  <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Timeline
                    items={events.slice(0, 10).map((evt) => ({
                      color: evt.status === 'completed' ? 'green' : evt.status === 'failed' ? 'red' : 'blue',
                      children: (
                        <Flex justify="space-between" align="flex-start">
                          <div>
                            <Tag color="blue">{EVENT_LABELS[evt.event_type] || evt.event_type}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {evt.payload?.content as string || evt.payload?.agent as string || ''}
                            </Typography.Text>
                          </div>
                          <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            {evt.created_at ? new Date(evt.created_at).toLocaleString('zh-CN') : ''}
                          </Typography.Text>
                        </Flex>
                      ),
                    }))}
                  />
                )}
              </Card>
            </Col>
            <Col span={10}>
              <Card
                title={
                  <Flex justify="space-between" align="center">
                    <Space>
                      <BellOutlined />
                      <span>通知</span>
                      <Badge count={unreadCount} />
                    </Space>
                    {unreadCount > 0 && (
                      <Typography.Link onClick={markAllRead}>全部已读</Typography.Link>
                    )}
                  </Flex>
                }
              >
                {notifications.length === 0 ? (
                  <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List
                    size="small"
                    dataSource={notifications}
                    renderItem={(item: AgentNotification) => (
                      <List.Item
                        style={{
                          opacity: item.is_read ? 0.6 : 1,
                          cursor: item.is_read ? 'default' : 'pointer',
                          background: item.is_read ? 'transparent' : '#f6ffed',
                        }}
                        onClick={() => { if (!item.is_read) markRead(item.id); }}
                      >
                        <List.Item.Meta
                          avatar={<Tag color={item.is_read ? 'default' : 'blue'}>{item.notification_type}</Tag>}
                          title={item.title}
                          description={
                            <Space>
                              {item.content && <span>{item.content}</span>}
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                              </Typography.Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Flex>
      </Spin>
    </>
  );
};

export default AgentMonitor;
