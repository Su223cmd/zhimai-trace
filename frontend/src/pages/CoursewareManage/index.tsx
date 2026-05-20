import { useState, useEffect } from 'react';
import {
  Typography, Button, Upload, Table, Card, Modal, Form,
  Select, Space, Drawer, List, Tag, message, Alert, Spin,
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { coursewareApi } from '../../services/api';
import CoursewareModeTag from '../../components/CoursewareModeTag';
import ParseStatusTag from '../../components/ParseStatusTag';
import type { CoursewareItem, CoursewareDetail } from '../../types';

const { Title, Text } = Typography;

const CoursewareManage = () => {
  const [coursewares, setCoursewares] = useState<CoursewareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<CoursewareDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
  const [form] = Form.useForm();

  const fetchCoursewares = async () => {
    setLoading(true);
    try {
      const data = await coursewareApi.list();
      setCoursewares(data.items || []);
    } catch {
      message.error('获取课件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    coursewareApi.list()
      .then((data) => {
        setCoursewares(data.items || []);
      })
      .catch(() => {
        message.error('获取课件列表失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleUpload = async (file: File) => {
    const values = form.getFieldsValue();
    try {
      await coursewareApi.upload(file, values.subject, values.version, values.grade);
      message.success('课件上传成功');
      setUploadModalOpen(false);
      form.resetFields();
      fetchCoursewares();
    } catch {
      message.error('课件上传失败');
    }
    return false;
  };

  const handleParse = async (id: string) => {
    setParsingIds(prev => new Set(prev).add(id));
    try {
      const result = await coursewareApi.parse(id);
      message.success(`解析完成：${result.parse_mode === 'template' ? '模板模式' : '自由模式'}，发现${result.created_knowledge_points}个知识点`);
      fetchCoursewares();
    } catch {
      message.error('解析失败');
    } finally {
      setParsingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailDrawerOpen(true);
    setDetailLoading(true);
    try {
      const data = await coursewareApi.get(id);
      setCurrentDetail(data);
    } catch {
      message.error('获取课件详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '课件名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (v: string) => v === 'geography' ? '地理' : v,
    },
    {
      title: '版本/年级',
      key: 'version_grade',
      width: 120,
      render: (_: unknown, record: CoursewareItem) => `${record.version} ${record.grade}`,
    },
    {
      title: '页数',
      dataIndex: 'slide_count',
      key: 'slide_count',
      width: 80,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '解析模式',
      dataIndex: 'parse_mode',
      key: 'parse_mode',
      width: 160,
      render: (mode: 'template' | 'free', record: CoursewareItem) =>
        record.parse_status === 'completed' ? <CoursewareModeTag mode={mode} /> : '-',
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      key: 'parse_status',
      width: 120,
      render: (status: CoursewareItem['parse_status']) => <ParseStatusTag status={status} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: CoursewareItem) => (
        <Space>
          {record.parse_status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              loading={parsingIds.has(record.id)}
              onClick={() => handleParse(record.id)}
            >
              解析
            </Button>
          )}
          {record.parse_status === 'completed' && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
              详情
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>课件管理</Title>
          <Text type="secondary">上传PPT课件，解析知识点与教学结构</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} href={coursewareApi.downloadTemplate()} target="_blank">
            下载课件模板
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
            上传课件
          </Button>
        </Space>
      </div>

      <Alert
        message="推荐使用课件模板"
        description="使用模板上传的课件，知识点提取准确率≥95%；自由上传的课件，提取准确率≥80%且需教师确认"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={coursewares}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无课件，请上传PPT课件开始解析' }}
        />
      </Card>

      <Modal
        title="上传课件"
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" initialValues={{ subject: 'geography', version: '人教版', grade: '高一' }}>
          <Form.Item name="subject" label="学科">
            <Select options={[{ value: 'geography', label: '地理' }]} />
          </Form.Item>
          <Form.Item name="version" label="教材版本">
            <Select options={[{ value: '人教版', label: '人教版' }, { value: '湘教版', label: '湘教版' }]} />
          </Form.Item>
          <Form.Item name="grade" label="年级">
            <Select options={[{ value: '高一', label: '高一' }, { value: '高二', label: '高二' }]} />
          </Form.Item>
          <Form.Item label="选择课件">
            <Upload
              accept=".pptx"
              showUploadList={false}
              beforeUpload={(file) => { handleUpload(file); return false; }}
            >
              <Button icon={<UploadOutlined />}>选择PPT文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={currentDetail?.name || '课件详情'}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={480}
      >
        {detailLoading ? (
          <Spin />
        ) : currentDetail ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <CoursewareModeTag mode={currentDetail.parse_mode} />
                <ParseStatusTag status={currentDetail.parse_status} />
              </Space>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>版本：</Text><Text>{currentDetail.version} {currentDetail.grade}</Text>
              <br />
              <Text strong>页数：</Text><Text>{currentDetail.slide_count ?? '-'}</Text>
            </div>
            <Title level={5}>提取的知识点 ({currentDetail.knowledge_points?.length ?? 0})</Title>
            <List
              size="small"
              dataSource={currentDetail.knowledge_points || []}
              renderItem={(kp) => (
                <List.Item>
                  <List.Item.Meta
                    title={kp.name}
                    description={
                      <Space size={4}>
                        <Tag>{kp.source_type === 'template' ? '模板提取' : 'LLM提取'}</Tag>
                        {kp.cognitive_level && <Tag color="blue">{kp.cognitive_level}</Tag>}
                        {kp.chapter && <Text type="secondary">{kp.chapter}</Text>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无知识点' }}
            />
          </>
        ) : null}
      </Drawer>
    </>
  );
};

export default CoursewareManage;
