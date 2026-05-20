import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Table, Tag, Button, Space, Empty, Flex, Tabs, Spin,
  Select, Input, Modal, Form, message, Descriptions, Popconfirm, Steps, Tooltip,
} from 'antd';
import {
  FormOutlined, TableOutlined, PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined,
  ExperimentOutlined, BulbOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { homeworkApi } from '../../services/homework';
import { projectApi } from '../../services/project';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Homework, QMatrixResponse, QMatrixRow, HomeworkResult } from '../../types';

const { TextArea } = Input;

const statusMap: Record<string, { color: string; label: string }> = {
  created: { color: 'default', label: '已创建' },
  q_matrix_confirmed: { color: 'processing', label: 'Q矩阵已确认' },
  cdm_estimated: { color: 'green', label: 'CDM已估计' },
};

const answerTemplate = `[
  { "student_id": "S001", "question_seq": 1, "student_answer": "A", "score": 5, "is_correct": true },
  { "student_id": "S001", "question_seq": 2, "student_answer": "B", "score": 0, "is_correct": false },
  { "student_id": "S002", "question_seq": 1, "student_answer": "C", "score": 0, "is_correct": false }
]`;

const HomeworkCenter = () => {
  const navigate = useNavigate();
  const { projects, currentProject, fetchProjects } = useProjectStore();

  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedHw, setSelectedHw] = useState<Homework | null>(null);
  const [activeTab, setActiveTab] = useState('items');

  const [detailData, setDetailData] = useState<HomeworkResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [qMatrix, setQMatrix] = useState<QMatrixResponse | null>(null);
  const [qMatrixLoading, setQMatrixLoading] = useState(false);
  const [qMatrixConfirming, setQMatrixConfirming] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProject) {
      loadHomeworks();
    }
  }, [currentProject]);

  const loadHomeworks = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await homeworkApi.list(currentProject?.id);
      const items = (res as { items?: Homework[] }).items || [];
      setHomeworks(items);
    } catch {
      setHomeworks([]);
      message.error('获取作业列表失败');
    } finally {
      setListLoading(false);
    }
  }, [currentProject]);

  const handleSelectHw = useCallback(async (hw: Homework) => {
    setSelectedHw(hw);
    setDetailData(null);
    setQMatrix(null);
    setDetailLoading(true);
    try {
      const res = await homeworkApi.getResults(hw.id);
      setDetailData(res as unknown as HomeworkResult);
    } catch {
      setDetailData(null);
      message.info('该作业暂无题目和答题数据');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (key === 'qmatrix' && selectedHw) {
      loadQMatrix(selectedHw.id);
    }
  }, [selectedHw]);

  const loadQMatrix = async (homeworkId: string) => {
    setQMatrixLoading(true);
    try {
      const res = await homeworkApi.getQMatrix(homeworkId);
      setQMatrix(res);
    } catch {
      setQMatrix(null);
    } finally {
      setQMatrixLoading(false);
    }
  };

  const handleGenerateQMatrix = async () => {
    if (!selectedHw) return;
    setQMatrixLoading(true);
    try {
      const res = await homeworkApi.generateQMatrix(selectedHw.id);
      message.success(`Q矩阵生成成功: ${res.n_questions} 道题目`);
      const mapped: QMatrixResponse = {
        status: res.status,
        homework_id: res.homework_id,
        kp_codes: res.kp_codes,
        kp_names: res.kp_names,
        questions: res.q_matrix.map((row, i) => ({
          question_id: `q_${i + 1}`,
          seq: i + 1,
          content: `题目 ${i + 1}`,
          q_vector: row,
          confirmed: false,
        })),
      };
      setQMatrix(mapped);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || 'Q矩阵生成失败');
    } finally {
      setQMatrixLoading(false);
    }
  };

  const toggleQMatrixCell = (rowIdx: number, colIdx: number) => {
    if (!qMatrix) return;
    const updated = { ...qMatrix };
    const row = { ...updated.questions[rowIdx] };
    const newVector = [...row.q_vector];
    newVector[colIdx] = newVector[colIdx] === 1 ? 0 : 1;
    row.q_vector = newVector;
    const newQuestions = [...updated.questions];
    newQuestions[rowIdx] = row;
    updated.questions = newQuestions;
    setQMatrix(updated);
  };

  const handleConfirmQMatrix = async () => {
    if (!selectedHw || !qMatrix) return;
    setQMatrixConfirming(true);
    try {
      const adjustments: Record<string, Record<string, number>> = {};
      qMatrix.questions.forEach((q) => {
        const kpAdjustments: Record<string, number> = {};
        qMatrix.kp_codes.forEach((kpCode, kpIdx) => {
          if (q.q_vector[kpIdx] === 1) {
            kpAdjustments[kpCode] = 1;
          }
        });
        if (Object.keys(kpAdjustments).length > 0) {
          adjustments[q.question_id] = kpAdjustments;
        }
      });
      await homeworkApi.confirmQMatrix(selectedHw.id, adjustments);
      message.success('Q矩阵确认成功');
      setQMatrix(prev => prev ? { ...prev, questions: prev.questions.map(q => ({ ...q, confirmed: true })) } : null);
      await loadHomeworks();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || 'Q矩阵确认失败');
    } finally {
      setQMatrixConfirming(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const projectId = values.project_id || currentProject?.id;
      if (!projectId) {
        message.error('请先选择项目');
        return;
      }
      await homeworkApi.create(projectId, values.title, values.class_id);
      message.success('作业创建成功');
      setCreateOpen(false);
      form.resetFields();
      await loadHomeworks();
    } catch {
      message.error('创建失败');
    }
  };

  const handleImportAnswers = async () => {
    if (!selectedHw) return;
    let answers;
    try {
      answers = JSON.parse(importText);
      if (!Array.isArray(answers)) throw new Error();
    } catch {
      message.error('JSON 格式错误，请检查输入');
      return;
    }
    setImportLoading(true);
    try {
      const res = await homeworkApi.importAnswers(selectedHw.id, answers);
      message.success(`成功导入 ${(res as { imported_count: number }).imported_count} 条答题数据`);
      setImportOpen(false);
      setImportText('');
      const detailRes = await homeworkApi.getResults(selectedHw.id);
      setDetailData(detailRes as unknown as HomeworkResult);
    } catch {
      message.error('导入答题数据失败');
    } finally {
      setImportLoading(false);
    }
  };

  const questionColumns = [
    { title: '序号', dataIndex: 'seq', key: 'seq', width: 60 },
    { title: '题目内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '类型', dataIndex: 'question_type', key: 'question_type', width: 80 },
    { title: '分值', dataIndex: 'score', key: 'score', width: 60 },
  ];

  const answerColumns = [
    { title: '学生', dataIndex: 'student_id', key: 'student_id', width: 80 },
    { title: '题目序号', dataIndex: 'question_id', key: 'question_id', width: 80 },
    { title: '答案', dataIndex: 'student_answer', key: 'student_answer', width: 100, ellipsis: true },
    {
      title: '得分', dataIndex: 'score', key: 'score', width: 60,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '正确', dataIndex: 'is_correct', key: 'is_correct', width: 60,
      render: (v: boolean | null) => v === true ? <Tag color="green">✓</Tag> : v === false ? <Tag color="red">✗</Tag> : '-',
    },
  ];

  const listColumns = [
    {
      title: '作业名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const s = statusMap[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ];

  const qMatrixColumns = qMatrix
    ? [
        {
          title: '#',
          width: 50,
          render: (_: unknown, __: unknown, idx: number) => idx + 1,
        },
        {
          title: '题目',
          dataIndex: 'content',
          key: 'content',
          width: 160,
          ellipsis: true,
        },
        ...qMatrix.kp_codes.map((kpCode, colIdx) => ({
          title: (
            <div style={{ fontSize: 11, whiteSpace: 'normal', textAlign: 'center' as const }}>
              {qMatrix.kp_names[colIdx] || kpCode}
            </div>
          ),
          key: kpCode,
          width: 50,
          render: (_: unknown, record: QMatrixRow, rowIdx: number) => {
            const val = record.q_vector[colIdx];
            return (
              <div
                onClick={() => toggleQMatrixCell(rowIdx, colIdx)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  color: val ? '#fff' : '#bbb',
                  background: val ? '#1677ff' : '#f5f5f5',
                  borderRadius: 4,
                  lineHeight: '24px',
                  userSelect: 'none',
                }}
              >
                {val ? '✓' : '○'}
              </div>
            );
          },
        })),
        {
          title: '状态',
          dataIndex: 'confirmed',
          key: 'confirmed',
          width: 80,
          render: (confirmed: boolean) => (
            <Tag color={confirmed ? 'green' : 'orange'}>
              {confirmed ? '已确认' : '待确认'}
            </Tag>
          ),
        },
      ]
    : [];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>作业中心</Typography.Title>
          <Typography.Text type="secondary">作业管理 · Q矩阵标注 · 答题数据</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建作业
        </Button>
      </Flex>

      <Row gutter={16}>
        <Col span={8}>
          <Card
            title="作业列表"
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={homeworks}
              rowKey="id"
              columns={listColumns}
              loading={listLoading}
              pagination={false}
              size="small"
              scroll={{ y: 600 }}
              locale={{ emptyText: currentProject ? '暂无作业' : '请先选择项目' }}
              onRow={(record) => ({
                onClick: () => handleSelectHw(record),
                style: {
                  cursor: 'pointer',
                  background: selectedHw?.id === record.id ? '#e6f4ff' : undefined,
                },
              })}
            />
          </Card>
        </Col>

        <Col span={16}>
          {!selectedHw ? (
            <Card style={{ height: '100%' }}>
              <Empty description="请从左侧选择一个作业查看详情" />
            </Card>
          ) : (
            <Card
              size="small"
              title={
                <Flex justify="space-between" align="center">
                  <Space>
                    <FormOutlined />
                    <span>{selectedHw.title}</span>
                    <Tag color={statusMap[selectedHw.status]?.color || 'default'}>
                      {statusMap[selectedHw.status]?.label || selectedHw.status}
                    </Tag>
                  </Space>
                  <Descriptions size="small" column={3} style={{ marginBottom: 0 }}>
                    <Descriptions.Item label="班级">{selectedHw.class_id}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {selectedHw.created_at ? new Date(selectedHw.created_at).toLocaleString('zh-CN') : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Flex>
              }
            >
              <Steps
                size="small"
                current={selectedHw.status === 'cdm_estimated' ? 2 : selectedHw.status === 'q_matrix_confirmed' ? 1 : 0}
                items={[
                  { title: '已创建', icon: <CheckCircleOutlined /> },
                  { title: 'Q矩阵确认' },
                  { title: 'CDM估计' },
                ]}
                style={{ marginBottom: 16 }}
              />
              <Space style={{ marginBottom: 16 }}>
                {selectedHw.status === 'q_matrix_confirmed' && (
                  <Button type="primary" size="small" icon={<ExperimentOutlined />} onClick={() => navigate(`/diagnosis-center?homeworkId=${selectedHw.id}`)}>
                    运行诊断
                  </Button>
                )}
                {selectedHw.status === 'cdm_estimated' && (
                  <>
                    <Button size="small" icon={<ExperimentOutlined />} onClick={() => navigate(`/diagnosis-center?homeworkId=${selectedHw.id}`)}>
                      查看诊断
                    </Button>
                    <Button size="small" icon={<BulbOutlined />} onClick={() => navigate(`/teaching-decision?homeworkId=${selectedHw.id}`)}>
                      教学建议
                    </Button>
                  </>
                )}
              </Space>
              <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={[
                  {
                    key: 'items',
                    label: (
                      <Space>
                        <EditOutlined />
                        题目与答题
                      </Space>
                    ),
                    children: (
                      <Spin spinning={detailLoading}>
                        {detailData ? (
                          <Flex vertical gap={16}>
                            <Card
                              size="small"
                              title={
                                <Flex justify="space-between" align="center">
                                  <span>题目列表 ({detailData.questions?.length || 0})</span>
                                  <Button
                                    size="small"
                                    icon={<UploadOutlined />}
                                    onClick={() => {
                                      setImportText('');
                                      setImportOpen(true);
                                    }}
                                  >
                                    导入答题数据
                                  </Button>
                                </Flex>
                              }
                            >
                              <Table
                                dataSource={detailData.questions || []}
                                rowKey="id"
                                columns={questionColumns}
                                pagination={false}
                                size="small"
                                locale={{ emptyText: '暂无题目' }}
                              />
                            </Card>
                            <Card
                              size="small"
                              title={`答题数据 (${detailData.student_answers?.length || 0} 条，${detailData.students ? Object.keys(detailData.students).length : 0} 名学生)`}
                            >
                              <Table
                                dataSource={detailData.student_answers || []}
                                rowKey="id"
                                columns={answerColumns}
                                pagination={{ pageSize: 10 }}
                                size="small"
                                locale={{ emptyText: '暂无答题数据' }}
                              />
                            </Card>
                          </Flex>
                        ) : (
                          !detailLoading && <Empty description="该作业暂无题目和答题数据" />
                        )}
                      </Spin>
                    ),
                  },
                  {
                    key: 'qmatrix',
                    label: (
                      <Space>
                        <TableOutlined />
                        Q矩阵
                      </Space>
                    ),
                    children: (
                      <Spin spinning={qMatrixLoading}>
                        <Flex vertical gap={12}>
                          <Space wrap>
                            <Button
                              icon={<FormOutlined />}
                              loading={qMatrixLoading}
                              onClick={handleGenerateQMatrix}
                            >
                              生成Q矩阵
                            </Button>
                            <Button
                              icon={<TableOutlined />}
                              onClick={() => selectedHw && loadQMatrix(selectedHw.id)}
                              disabled={!selectedHw}
                            >
                              加载已有
                            </Button>
                            {qMatrix && (
                              <Popconfirm
                                title="确认提交当前Q矩阵？"
                                onConfirm={handleConfirmQMatrix}
                                okText="确认"
                                cancelText="取消"
                              >
                                <Button
                                  type="primary"
                                  loading={qMatrixConfirming}
                                >
                                  确认Q矩阵
                                </Button>
                              </Popconfirm>
                            )}
                          </Space>
                          {!qMatrix ? (
                            <Empty description={selectedHw ? '该作业暂无Q矩阵数据，请点击"生成Q矩阵"' : '请先选择作业'} />
                          ) : (
                            <Card size="small" title={`Q矩阵 (${qMatrix.questions.length} 题目 × ${qMatrix.kp_codes.length} 知识点)`}>
                              <Table
                                dataSource={qMatrix.questions}
                                rowKey="question_id"
                                columns={qMatrixColumns}
                                pagination={false}
                                size="small"
                                scroll={{ x: qMatrix.kp_codes.length * 50 + 340 }}
                              />
                            </Card>
                          )}
                        </Flex>
                      </Spin>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="创建作业"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <Form form={form} layout="vertical" initialValues={{ class_id: 'default-class' }}>
          {!currentProject && (
            <Form.Item name="project_id" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
              <Select
                placeholder="选择项目"
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label="作业名称" rules={[{ required: true, message: '请输入作业名称' }]}>
            <Input placeholder="例如：期中考试卷" />
          </Form.Item>
          <Form.Item name="class_id" label="班级">
            <Input placeholder="班级标识" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`导入答题数据 — ${selectedHw?.title || ''}`}
        open={importOpen}
        onOk={handleImportAnswers}
        onCancel={() => setImportOpen(false)}
        confirmLoading={importLoading}
        width={640}
        okText="导入"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          请输入 JSON 数组格式的答题数据。每项包含 student_id、question_seq（题号）、student_answer、score、is_correct。
        </Typography.Paragraph>
        <TextArea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={answerTemplate}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
    </>
  );
};

export default HomeworkCenter;
