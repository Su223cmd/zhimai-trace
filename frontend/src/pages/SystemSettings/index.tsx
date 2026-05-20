import { useState, useEffect } from 'react';
import {
  Typography, Card, Tabs, Form, Input, Select, Switch, Button,
  Divider, Space, message, Tag, Flex, Alert,
} from 'antd';
import {
  UserOutlined, SettingOutlined, BellOutlined, SaveOutlined,
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import ProjectSelector from '../../components/ProjectSelector';
import { useProjectStore } from '../../stores/useProjectStore';
import { settingsApi } from '../../services/settings';

const SystemSettings = () => {
  const [saving, setSaving] = useState(false);
  const [userForm] = Form.useForm();
  const [notifyForm] = Form.useForm();
  const [llmForm] = Form.useForm();
  const { currentProject } = useProjectStore();

  const [llmConfig, setLLMConfig] = useState<{ provider: string; api_key: string; base_url: string; configured: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);

  useEffect(() => {
    settingsApi.getLLMConfig().then(setLLMConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (llmConfig) {
      llmForm.setFieldsValue({
        provider: llmConfig.provider,
        base_url: llmConfig.base_url,
      });
    }
  }, [llmConfig]);

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      setSaving(true);
      message.success('用户信息已保存');
      console.log('User settings:', values);
    } catch {
      message.warning('请检查表单填写');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotify = async () => {
    try {
      const values = await notifyForm.validateFields();
      setSaving(true);
      message.success('通知偏好已保存');
      console.log('Notify settings:', values);
    } catch {
      message.warning('请检查表单填写');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLLM = async () => {
    try {
      const values = await llmForm.validateFields();
      setSaving(true);
      await settingsApi.updateLLMConfig({
        provider: values.provider,
        api_key: values.api_key || undefined,
        base_url: values.base_url,
      });
      message.success('模型配置已保存');
      setTestResult(null);
      const config = await settingsApi.getLLMConfig();
      setLLMConfig(config);
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await settingsApi.testLLMConnection();
      setTestResult(result);
      if (result.status === 'success') {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch {
      setTestResult({ status: 'error', message: '请求失败' });
    } finally {
      setTesting(false);
    }
  };

  const tabItems = [
    {
      key: 'user',
      label: (
        <span><UserOutlined /> 用户设置</span>
      ),
      children: (
        <Card style={{ maxWidth: 600 }}>
          <Form form={userForm} layout="vertical" initialValues={{ nickname: '教师', email: '' }}>
            <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder="输入昵称" />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input placeholder="输入邮箱" type="email" />
            </Form.Item>
            <Form.Item label="学科" name="subject">
              <Select
                placeholder="选择主教学科"
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
            <Form.Item label="年级" name="grade">
              <Select
                placeholder="选择默认年级"
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
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveUser}>
              保存用户设置
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'project',
      label: (
        <span><SettingOutlined /> 项目配置</span>
      ),
      children: (
        <Card style={{ maxWidth: 600 }}>
          <Typography.Title level={5}>当前项目</Typography.Title>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <ProjectSelector style={{ width: '100%' }} />
            {currentProject && (
              <Card size="small" style={{ background: '#fafafa' }}>
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>{currentProject.name}</Typography.Text>
                  <Space wrap>
                    <Tag>{currentProject.subject}</Tag>
                    {currentProject.grade && <Tag>{currentProject.grade}</Tag>}
                    <Tag color={currentProject.curriculum_imported ? 'green' : 'default'}>
                      {currentProject.curriculum_imported ? '已导入课标' : '未导入课标'}
                    </Tag>
                    <Tag color={currentProject.graph_initialized ? 'green' : 'default'}>
                      {currentProject.graph_initialized ? '图谱已初始化' : '图谱未初始化'}
                    </Tag>
                  </Space>
                  {currentProject.description && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {currentProject.description}
                    </Typography.Text>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    创建时间：{new Date(currentProject.created_at).toLocaleString('zh-CN')}
                  </Typography.Text>
                </Space>
              </Card>
            )}
          </Space>

          <Divider />

          <Typography.Title level={5}>模型配置</Typography.Title>
          <Form layout="vertical">
            <Form.Item label="CDM模型类型" name="modelType" initialValue="dina">
              <Select
                options={[
                  { value: 'dina', label: 'DINA模型' },
                  { value: 'dino', label: 'DINO模型' },
                ]}
              />
            </Form.Item>
            <Form.Item label="掌握阈值" name="masteryThreshold" initialValue={0.5}>
              <Select
                options={[
                  { value: 0.4, label: '0.4（宽松）' },
                  { value: 0.5, label: '0.5（标准）' },
                  { value: 0.6, label: '0.6（严格）' },
                ]}
              />
            </Form.Item>
            <Form.Item label="遗忘曲线半衰期（天）" name="halfLife" initialValue={7}>
              <Select
                options={[
                  { value: 3, label: '3天（高频）' },
                  { value: 7, label: '7天（标准）' },
                  { value: 14, label: '14天（低频）' },
                  { value: 30, label: '30天（长周期）' },
                ]}
              />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'llm',
      label: (
        <span><ApiOutlined /> 模型配置</span>
      ),
      children: (
        <Card style={{ maxWidth: 600 }}>
          <Typography.Title level={5}>AI 大模型配置</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            配置系统使用的AI大模型，用于课件解析、知识提取等智能功能。
          </Typography.Paragraph>

          {llmConfig?.configured && (
            <Alert
              type="success"
              message="模型已配置"
              description={`当前使用: ${llmConfig.provider === 'zhipu' ? '智谱AI' : 'DeepSeek'} (${llmConfig.api_key})`}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form form={llmForm} layout="vertical">
            <Form.Item label="模型提供商" name="provider" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'zhipu', label: '智谱AI (GLM-4)' },
                  { value: 'deepseek', label: 'DeepSeek' },
                ]}
              />
            </Form.Item>
            <Form.Item label="API Key" name="api_key">
              <Input.Password placeholder="输入API密钥" />
            </Form.Item>
            <Form.Item label="Base URL" name="base_url" rules={[{ required: true }]}>
              <Input placeholder="API基础地址" />
            </Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveLLM}>
                保存配置
              </Button>
              <Button icon={<ApiOutlined />} loading={testing} onClick={handleTestConnection}>
                测试连接
              </Button>
            </Space>
          </Form>

          {testResult && (
            <Alert
              type={testResult.status === 'success' ? 'success' : 'error'}
              message={testResult.status === 'success' ? '连接成功' : '连接失败'}
              description={testResult.message}
              showIcon
              icon={testResult.status === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      ),
    },
    {
      key: 'notification',
      label: (
        <span><BellOutlined /> 通知偏好</span>
      ),
      children: (
        <Card style={{ maxWidth: 600 }}>
          <Form form={notifyForm} layout="vertical" initialValues={{
            diagnosisComplete: true,
            coursewareParsed: true,
            agentError: true,
            weeklyReport: false,
          }}>
            <Form.Item label="诊断完成通知" name="diagnosisComplete" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="课件解析完成通知" name="coursewareParsed" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Agent异常通知" name="agentError" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="每周摘要报告" name="weeklyReport" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveNotify}>
              保存通知偏好
            </Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>系统设置</Typography.Title>
          <Typography.Text type="secondary">用户设置、项目配置、模型配置和通知偏好</Typography.Text>
        </div>
      </Flex>

      <Tabs items={tabItems} />
    </>
  );
};

export default SystemSettings;
