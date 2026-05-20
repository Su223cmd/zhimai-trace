import { useState } from 'react';
import {
  Typography, Card, Row, Col, Button, Modal, Form, Input, Select,
  Tag, Space, Empty, Flex, message,
} from 'antd';
import {
  PlusOutlined, ImportOutlined,
} from '@ant-design/icons';
import { projectApi } from '../../services/project';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Project } from '../../types';

const ProjectManage = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const { projects, currentProject, fetchProjects, setCurrentProject } = useProjectStore();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await projectApi.create(values.name, values.subject, values.grade, values.description);
      message.success('项目创建成功');
      setCreateOpen(false);
      form.resetFields();
      await fetchProjects();
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleImportCurriculum = async (projectId: string) => {
    setImportingId(projectId);
    try {
      const res = await projectApi.importCurriculum(projectId);
      message.success(`课标导入成功: ${res.entity_count} 实体, ${res.relation_count} 关系`);
      await fetchProjects();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '课标导入失败');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>项目管理</Typography.Title>
          <Typography.Text type="secondary">创建和管理诊断项目</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建项目
        </Button>
      </Flex>

      {projects.length === 0 ? (
        <Card>
          <Empty description="暂无项目，请先创建一个项目" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map((p: Project) => (
            <Col span={8} key={p.id}>
              <Card
                hoverable
                style={{
                  borderColor: currentProject?.id === p.id ? '#1677ff' : undefined,
                  borderWidth: currentProject?.id === p.id ? 2 : 1,
                }}
                onClick={() => setCurrentProject(p)}
              >
                <Flex vertical gap={8}>
                  <Flex justify="space-between" align="center">
                    <Typography.Text strong>{p.name}</Typography.Text>
                    {currentProject?.id === p.id && <Tag color="blue">当前</Tag>}
                  </Flex>
                  <Space wrap>
                    <Tag>{p.subject}</Tag>
                    {p.grade && <Tag>{p.grade}</Tag>}
                    <Tag color={p.curriculum_imported ? 'green' : 'default'}>
                      {p.curriculum_imported ? '已导入课标' : '未导入课标'}
                    </Tag>
                  </Space>
                  {p.description && (
                    <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                      {p.description}
                    </Typography.Text>
                  )}
                  <Button
                    size="small"
                    icon={<ImportOutlined />}
                    loading={importingId === p.id}
                    onClick={(e) => { e.stopPropagation(); handleImportCurriculum(p.id); }}
                    disabled={p.curriculum_imported}
                  >
                    {p.curriculum_imported ? '已导入' : '导入课标'}
                  </Button>
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建项目"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：高一地理诊断" />
          </Form.Item>
          <Form.Item name="subject" label="学科" rules={[{ required: true, message: '请输入学科' }]}>
            <Select
              placeholder="选择学科"
              options={[
                { value: 'geography', label: '地理' },
                { value: 'math', label: '数学' },
                { value: 'physics', label: '物理' },
                { value: 'chemistry', label: '化学' },
                { value: 'biology', label: '生物' },
                { value: 'history', label: '历史' },
                { value: 'chinese', label: '语文' },
                { value: 'english', label: '英语' },
              ]}
            />
          </Form.Item>
          <Form.Item name="grade" label="年级">
            <Select
              placeholder="选择年级"
              options={[
                { value: '高一', label: '高一' },
                { value: '高二', label: '高二' },
                { value: '高三', label: '高三' },
                { value: '初一', label: '初一' },
                { value: '初二', label: '初二' },
                { value: '初三', label: '初三' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="项目描述（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ProjectManage;
