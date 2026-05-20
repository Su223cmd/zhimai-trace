import { useState, lazy, Suspense } from 'react';
import { Tabs, Spin, Space, Steps, Card, Typography, Flex } from 'antd';
import {
  ImportOutlined, ExperimentOutlined, BulbOutlined,
  RobotOutlined,
} from '@ant-design/icons';

const HomeworkCenter = lazy(() => import('../HomeworkCenter'));
const DiagnosisCenter = lazy(() => import('../DiagnosisCenter'));
const TeachingDecision = lazy(() => import('../TeachingDecision'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin size="large" />
  </div>
);

const { Text } = Typography;

const workflowSteps = [
  {
    key: 'data',
    title: '数据接入',
    icon: <ImportOutlined />,
    description: '导入学生答题数据、管理作业',
    agentHint: 'Knowledge Agent 自动校验数据格式和字段完整性',
  },
  {
    key: 'diagnosis',
    title: '智能诊断',
    icon: <ExperimentOutlined />,
    description: 'CDM认知诊断、根因追溯、知识状态分析',
    agentHint: 'Diagnosis Agent + Tracing Agent 协作完成诊断',
  },
  {
    key: 'suggestions',
    title: '教学建议',
    icon: <BulbOutlined />,
    description: '分组策略、学习路径、干预建议',
    agentHint: 'Teaching Agent 基于诊断结果生成教学建议',
  },
];

const DiagnosisAnalysis = () => {
  const [activeKey, setActiveKey] = useState('data');
  const currentStep = workflowSteps.findIndex(s => s.key === activeKey);

  return (
    <Flex vertical gap={16}>
      <Steps
        current={currentStep}
        size="small"
        items={workflowSteps.map(s => ({
          title: (
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveKey(s.key)}
            >
              <Space size={4}>{s.icon}{s.title}</Space>
            </span>
          ),
          description: s.description,
        }))}
        style={{ padding: '0 16px' }}
      />

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: 'data',
            label: (
              <Space>
                <ImportOutlined />
                <span>数据接入</span>
              </Space>
            ),
            children: (
              <Suspense fallback={<PageLoader />}><HomeworkCenter /></Suspense>
            ),
          },
          {
            key: 'diagnosis',
            label: (
              <Space>
                <ExperimentOutlined />
                <span>智能诊断</span>
              </Space>
            ),
            children: (
              <Suspense fallback={<PageLoader />}><DiagnosisCenter /></Suspense>
            ),
          },
          {
            key: 'suggestions',
            label: (
              <Space>
                <BulbOutlined />
                <span>教学建议</span>
              </Space>
            ),
            children: (
              <Suspense fallback={<PageLoader />}><TeachingDecision /></Suspense>
            ),
          },
        ]}
      />

      {workflowSteps[currentStep] && (
        <Card size="small" style={{ background: '#fafafa', border: 'none' }}>
          <Space>
            <RobotOutlined style={{ color: '#1677ff' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {workflowSteps[currentStep].agentHint}
            </Text>
          </Space>
        </Card>
      )}
    </Flex>
  );
};

export default DiagnosisAnalysis;
