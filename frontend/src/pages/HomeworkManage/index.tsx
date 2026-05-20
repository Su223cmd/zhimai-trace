import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Button, Card, Modal, Form,
  Input, Select, Table, Tag, message, Flex, Spin, Drawer, Space,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, FileAddOutlined, ImportOutlined,
  TableOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { homeworkApi } from '../../services/homework';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Homework, HomeworkResult } from '../../types';

const { TextArea } = Input;

const statusMap: Record<string, { color: string; label: string }> = {
  created: { color: 'default', label: '已创建' },
  q_matrix_confirmed: { color: 'processing', label: 'Q矩阵已确认' },
  cdm_estimated: { color: 'green', label: 'CDM已估计' },
};

const questionTemplate = `[
  { "content": "第1题题目内容", "question_type": "choice", "score": 5 },
  { "content": "第2题题目内容", "question_type": "choice", "score": 5 }
]`;

const answerTemplate = `[
  { "student_id": "S001", "question_seq": 1, "student_answer": "A", "score": 5, "is_correct": true },
  { "student_id": "S001", "question_seq": 2, "student_answer": "B", "score": 0, "is_correct": false },
  { "student_id": "S002", "question_seq": 1, "student_answer": "C", "score": 0, "is_correct": false }
]`;

const HomeworkManage = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [form] = Form.useForm();
  const { projects, currentProject, fetchProjects } = useProjectStore();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<HomeworkResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedHw, setSelectedHw] = useState<Homework | null>(null);

  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [addItemsText, setAddItemsText] = useState('');
  const [addItemsLoading, setAddItemsLoading] = useState(false);

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

  const loadHomeworks = async () => {
    setLoading(true);
    try {
      const res = await homeworkApi.list(currentProject?.id);
      const items = (res as { items?: Homework[] }).items || [];
      setHomeworks(items);
    } catch {
      setHomeworks([]);
    } finally {
      setLoading(false);
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

  const openDetail = async (hw: Homework) => {
    setSelectedHw(hw);
    setDetailOpen(true);
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
  };

  const openAddItems = (hw: Homework) => {
    setSelectedHw(hw);
    setAddItemsText('');
    setAddItemsOpen(true);
  };

  const handleAddItems = async () => {
    if (!selectedHw) return;
    let questions;
    try {
      questions = JSON.parse(addItemsText);
      if (!Array.isArray(questions)) throw new Error();
    } catch {
      message.error('JSON 格式错误，请检查输入');
      return;
    }
    setAddItemsLoading(true);
    try {
      const res = await homeworkApi.addItems(selectedHw.id, questions);
      message.success(`成功添加 ${(res as { added_count: number }).added_count} 道题目`);
      setAddItemsOpen(false);
      await loadHomeworks();
    } catch {
      message.error('添加题目失败');
    } finally {
      setAddItemsLoading(false);
    }
  };

  const openImport = (hw: Homework) => {
    setSelectedHw(hw);
    setImportText('');
    setImportOpen(true);
  };

  const handleImport = async () => {
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
      await loadHomeworks();
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

  const columns = [
    {
      title: '作业名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '班级',
      dataIndex: 'class_id',
      key: 'class_id',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => {
        const s = statusMap[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: Homework) => (
        <Space size={4}>
          <Button size="small" icon={<TableOutlined />} onClick={() => navigate(`/qmatrix-editor?homeworkId=${record.id}`)}>
            Q矩阵
          </Button>
          <Button size="small" icon={<ExperimentOutlined />} onClick={() => navigate(`/diagnosis-overview?homeworkId=${record.id}`)}>
            诊断
          </Button>
          <Button size="small" icon={<FileAddOutlined />} onClick={() => openAddItems(record)}>
            题目
          </Button>
          <Button size="small" icon={<ImportOutlined />} onClick={() => openImport(record)}>
            答题
          </Button>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>作业管理</Typography.Title>
          <Typography.Text type="secondary">创建作业、导入题目与答题数据</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建作业
        </Button>
      </Flex>

      <Spin spinning={loading}>
        <Card>
          <Table
            dataSource={homeworks}
            rowKey="id"
            columns={columns}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: currentProject ? '暂无作业，请点击右上角创建' : '请先选择一个项目' }}
          />
        </Card>
      </Spin>

      <Drawer
        title={selectedHw?.title || '作业详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        <Spin spinning={detailLoading}>
          {detailData ? (
            <Flex vertical gap={16}>
              <Card size="small" title={`题目列表 (${detailData.questions?.length || 0})`}>
                <Table
                  dataSource={detailData.questions || []}
                  rowKey="id"
                  columns={questionColumns}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无题目，请添加' }}
                />
              </Card>
              <Card size="small" title={`答题数据 (${detailData.student_answers?.length || 0} 条，${detailData.students ? Object.keys(detailData.students).length : 0} 名学生)`}>
                <Table
                  dataSource={detailData.student_answers || []}
                  rowKey="id"
                  columns={answerColumns}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  locale={{ emptyText: '暂无答题数据，请导入' }}
                />
              </Card>
            </Flex>
          ) : (
            !detailLoading && <Typography.Text type="secondary">暂无数据</Typography.Text>
          )}
        </Spin>
      </Drawer>

      <Modal
        title={`添加题目 — ${selectedHw?.title || ''}`}
        open={addItemsOpen}
        onOk={handleAddItems}
        onCancel={() => setAddItemsOpen(false)}
        confirmLoading={addItemsLoading}
        width={640}
        okText="添加"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          请输入 JSON 数组格式的题目数据。每项包含 content（题目内容）、question_type（题目类型）、score（分值）。
        </Typography.Paragraph>
        <TextArea
          value={addItemsText}
          onChange={e => setAddItemsText(e.target.value)}
          placeholder={questionTemplate}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      <Modal
        title={`导入答题数据 — ${selectedHw?.title || ''}`}
        open={importOpen}
        onOk={handleImport}
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
    </>
  );
};

export default HomeworkManage;
