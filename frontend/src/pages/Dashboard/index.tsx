import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Typography, Spin, Tag, Empty, Flex, Button, Space,
  Select, Modal, Input, message, Tooltip, Badge, Divider,
} from 'antd';
import {
  TeamOutlined, BookOutlined, FileTextOutlined, ExperimentOutlined,
  ImportOutlined, BulbOutlined, BellOutlined, PlusOutlined,
  DashboardOutlined, SettingOutlined, UserAddOutlined,
  CheckCircleOutlined, ClockCircleOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { get, post, put } from '../../services/api';
import { coursewareApi } from '../../services/api';
import { useProjectStore } from '../../stores/useProjectStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { homeworkApi } from '../../services/homework';
import { agentApi } from '../../services/agent';
import type { DashboardOverview, DashboardProject } from '../../types';

const { Text, Title } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [allHomeworks, setAllHomeworks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [editingClassId, setEditingClassId] = useState('');
  const [editingClassName, setEditingClassName] = useState('');
  const [studentInput, setStudentInput] = useState('');
  const [savingStudents, setSavingStudents] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  const { projects, currentProject, fetchProjects, setCurrentProject, fetchClasses, classes, currentClassId, setCurrentClassId } = useProjectStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();

  const pendingHomeworks = allHomeworks.filter(hw => hw.status === 'created' || hw.status === 'q_matrix_confirmed');
  const cdmHomeworkId = allHomeworks.find(h => h.status === 'cdm_estimated')?.id || '';

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [overviewRes, , homeworkRes, agentRes] = await Promise.all([
        get<DashboardOverview>('/api/class/dashboard/overview').catch(() => null),
        fetchProjects(),
        homeworkApi.list().catch(() => ({ items: [] })),
        agentApi.getAgentStates().catch(() => ({ agents: [], total: 0 })),
        fetchNotifications(),
      ]);
      if (overviewRes) setOverview(overviewRes);
      const hwItems = (homeworkRes as { items: Array<{ id: string; title: string; status: string }> }).items || [];
      setAllHomeworks(hwItems);
      setAgentCount((agentRes as { agents: unknown[] }).agents?.length || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  // Sync selected project with store
  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
      fetchClasses(currentProject.id);
    }
  }, [currentProject]);

  const currentProjectData = overview?.projects.find(p => p.id === selectedProjectId);

  const handleProjectChange = (pid: string) => {
    setSelectedProjectId(pid);
    const p = projects.find(x => x.id === pid);
    if (p) setCurrentProject(p);
    fetchClasses(pid);
    setCurrentClassId('');
  };

  const handleManageStudents = async (classId: string, className: string) => {
    setEditingClassId(classId);
    setEditingClassName(className);
    setStudentModalVisible(true);
    try {
      const res = await get<{ student_ids: string[] }>('/api/class/' + classId + '/students');
      setStudentInput((res.student_ids || []).join('\n'));
    } catch {
      setStudentInput('');
    }
  };

  const handleSaveStudents = async () => {
    setSavingStudents(true);
    try {
      const ids = studentInput.split('\n').map(s => s.trim()).filter(Boolean);
      await put('/api/class/' + editingClassId + '/students', { student_ids: ids });
      message.success('学生列表已更新');
      setStudentModalVisible(false);
      loadDashboard();
    } catch {
      message.error('保存失败');
    } finally {
      setSavingStudents(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !selectedProjectId) return;
    setCreatingClass(true);
    try {
      await post('/api/class/create', {
        name: newClassName.trim(),
        project_id: selectedProjectId,
      });
      message.success('班级创建成功');
      setAddModalVisible(false);
      setNewClassName('');
      loadDashboard();
      fetchClasses(selectedProjectId);
    } catch {
      message.error('创建失败');
    } finally {
      setCreatingClass(false);
    }
  };

  return (
    <>
      {/* Header with project/class switcher */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>系统总览</Title>
          <Text type="secondary">多班级教学管理与诊断看板</Text>
        </div>
        <Space size={12}>
          <Select
            value={selectedProjectId || undefined}
            onChange={handleProjectChange}
            style={{ width: 200 }}
            placeholder="选择课件包"
            options={projects.map(p => ({
              value: p.id,
              label: (
                <Space>
                  <BookOutlined />
                  <span>{p.name}</span>
                  <Tag style={{ fontSize: 11 }}>{p.subject}</Tag>
                </Space>
              ),
            }))}
          />
          <Select
            value={currentClassId || undefined}
            onChange={setCurrentClassId}
            style={{ width: 160 }}
            placeholder="选择班级"
            options={classes.map(c => ({
              value: c.id,
              label: (
                <Space>
                  <TeamOutlined />
                  <span>{c.name}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>{c.student_count}人</Text>
                </Space>
              ),
            }))}
          />
          <Button icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            新建班级
          </Button>
        </Space>
      </Flex>

      <Spin spinning={loading}>
        {/* Stats row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card hoverable style={{ borderLeft: '3px solid #1677ff' }}>
              <Statistic
                title="班级数量"
                value={overview?.total_classes || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {overview?.projects?.length || 0} 个课件包
              </Text>
            </Card>
          </Col>
          <Col span={5}>
            <Card hoverable style={{ borderLeft: '3px solid #52c41a' }}>
              <Statistic
                title="学生总数"
                value={overview?.total_students || 0}
                prefix={<UserAddOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                跨 {overview?.total_classes || 0} 个班级
              </Text>
            </Card>
          </Col>
          <Col span={5}>
            <Card hoverable style={{ borderLeft: '3px solid #fa8c16' }}>
              <Statistic
                title="作业数量"
                value={overview?.total_homeworks || 0}
                prefix={<ImportOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {pendingHomeworks.length > 0 ? `${pendingHomeworks.length} 份待处理` : '全部已处理'}
              </Text>
            </Card>
          </Col>
          <Col span={5}>
            <Card hoverable style={{ borderLeft: '3px solid #722ed1' }}>
              <Statistic
                title="课件数量"
                value={currentProjectData?.courseware_count || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前课件包
              </Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card hoverable style={{ borderLeft: '3px solid #13c2c2' }}>
              <Statistic
                title="Agent"
                value={agentCount}
                suffix="/5"
                prefix={<NodeIndexOutlined />}
                valueStyle={{ color: agentCount === 5 ? '#3f8600' : '#faad14' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {agentCount === 5 ? '全部在线' : '部分就绪'}
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Class cards — the core new feature */}
        <Card
          title={
            <Space>
              <TeamOutlined />
              <span>班级看板</span>
              {selectedProjectId && (
                <Tag color="blue">
                  {currentProjectData?.classes?.length || 0} 个班级
                </Tag>
              )}
            </Space>
          }
          size="small"
          style={{ marginBottom: 24 }}
          extra={
            <Space>
              {unreadCount > 0 && (
                <Badge count={unreadCount}>
                  <Button size="small" icon={<BellOutlined />} onClick={() => navigate('/agent-monitor')}>
                    通知
                  </Button>
                </Badge>
              )}
            </Space>
          }
        >
          {!selectedProjectId ? (
            <Empty description="请先选择一个课件包" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (currentProjectData?.classes || []).length === 0 ? (
            <Empty
              description="暂无班级，点击右上角「新建班级」添加"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Row gutter={[16, 16]}>
              {currentProjectData!.classes.map((cls) => (
                <Col span={8} key={cls.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      borderTop: currentClassId === cls.id ? '3px solid #1677ff' : '3px solid transparent',
                      background: currentClassId === cls.id ? '#f0f5ff' : undefined,
                    }}
                    onClick={() => setCurrentClassId(cls.id)}
                  >
                    <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 15 }}>{cls.name}</Text>
                      <Space size={4}>
                        <Tooltip title="管理学生">
                          <Button
                            size="small"
                            type="text"
                            icon={<UserAddOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleManageStudents(cls.id, cls.name); }}
                          />
                        </Tooltip>
                      </Space>
                    </Flex>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Statistic
                          title="学生"
                          value={cls.student_count}
                          valueStyle={{ fontSize: 18 }}
                          prefix={<TeamOutlined />}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="作业"
                          value={cls.homework_count}
                          valueStyle={{ fontSize: 18 }}
                          prefix={<FileTextOutlined />}
                        />
                      </Col>
                      <Col span={8}>
                        <Flex vertical align="center">
                          <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
                          {cls.homework_count > 0 ? (
                            <Tag color="green" style={{ marginTop: 4 }}>
                              <CheckCircleOutlined /> 已配置
                            </Tag>
                          ) : (
                            <Tag style={{ marginTop: 4 }}>
                              <ClockCircleOutlined /> 待配置
                            </Tag>
                          )}
                        </Flex>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        {/* Bottom row: Courseware overview + Quick actions */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {/* Courseware packages overview */}
          <Col span={14}>
            <Card title="课件包概览" size="small">
              {(overview?.projects || []).length === 0 ? (
                <Empty description="暂无课件包" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Row gutter={[12, 12]}>
                  {overview!.projects.map((proj) => (
                    <Col span={8} key={proj.id}>
                      <Card
                        size="small"
                        hoverable
                        style={{
                          borderLeft: proj.id === selectedProjectId ? '3px solid #1677ff' : '3px solid #d9d9d9',
                          background: proj.id === selectedProjectId ? '#f0f5ff' : undefined,
                        }}
                        onClick={() => handleProjectChange(proj.id)}
                      >
                        <Text strong style={{ fontSize: 13 }}>{proj.name}</Text>
                        <div style={{ marginTop: 4 }}>
                          <Space size={4}>
                            <Tag style={{ fontSize: 11 }}>{proj.subject}</Tag>
                            {proj.grade && <Tag style={{ fontSize: 11 }}>{proj.grade}</Tag>}
                          </Space>
                        </div>
                        <Divider style={{ margin: '8px 0' }} />
                        <Flex justify="space-between">
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <FileTextOutlined /> {proj.courseware_count} 课件
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <TeamOutlined /> {proj.classes.length} 班级
                          </Text>
                        </Flex>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card>
          </Col>

          {/* Quick actions + pending tasks */}
          <Col span={10}>
            <Card title="快速入口" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Button block icon={<FileTextOutlined />} onClick={() => navigate('/courseware-manage')} style={{ height: 44 }}>
                    导入课件
                  </Button>
                </Col>
                <Col span={12}>
                  <Button block icon={<ImportOutlined />} onClick={() => navigate('/homework-center')} style={{ height: 44 }}>
                    创建作业
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    block
                    type="primary"
                    icon={<ExperimentOutlined />}
                    onClick={() => navigate(`/diagnosis-center${cdmHomeworkId ? `?homeworkId=${cdmHomeworkId}` : ''}`)}
                    style={{ height: 44 }}
                  >
                    运行诊断
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    block
                    icon={<BulbOutlined />}
                    onClick={() => navigate(`/teaching-decision${cdmHomeworkId ? `?homeworkId=${cdmHomeworkId}` : ''}`)}
                    style={{ height: 44 }}
                  >
                    教学建议
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* Pending tasks */}
            {pendingHomeworks.length > 0 && (
              <Card title="待处理" size="small">
                <Flex vertical gap={6}>
                  {pendingHomeworks.slice(0, 3).map(hw => (
                    <div key={hw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Tag color={hw.status === 'created' ? 'default' : 'processing'}>
                          {hw.status === 'created' ? '待确认Q矩阵' : '可运行诊断'}
                        </Tag>
                        <Text style={{ fontSize: 13 }}>{hw.title}</Text>
                      </Space>
                      <Button size="small" type="link" onClick={() => navigate('/homework-center')}>
                        前往
                      </Button>
                    </div>
                  ))}
                </Flex>
              </Card>
            )}
          </Col>
        </Row>
      </Spin>

      {/* Add Class Modal */}
      <Modal
        title="新建班级"
        open={addModalVisible}
        onOk={handleAddClass}
        onCancel={() => { setAddModalVisible(false); setNewClassName(''); }}
        confirmLoading={creatingClass}
        okText="创建"
      >
        <Flex vertical gap={12}>
          <div>
            <Text>班级名称</Text>
            <Input
              placeholder="例如: 高一(1)班"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            将添加到当前选中的课件包: {currentProjectData?.name || '未选择'}
          </Text>
        </Flex>
      </Modal>

      {/* Manage Students Modal */}
      <Modal
        title={`管理学生 — ${editingClassName}`}
        open={studentModalVisible}
        onOk={handleSaveStudents}
        onCancel={() => setStudentModalVisible(false)}
        confirmLoading={savingStudents}
        okText="保存"
        width={480}
      >
        <Flex vertical gap={8}>
          <Text type="secondary">每行一个学生ID，例如: S001, S002, S003 ...</Text>
          <Input.TextArea
            value={studentInput}
            onChange={e => setStudentInput(e.target.value)}
            rows={10}
            placeholder="S001&#10;S002&#10;S003"
            style={{ fontFamily: 'monospace' }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {studentInput.split('\n').map(s => s.trim()).filter(Boolean).length} 名学生
          </Text>
        </Flex>
      </Modal>
    </>
  );
};

export default Dashboard;
