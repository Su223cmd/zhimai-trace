import { useState, useEffect } from 'react';
import { Tag, Button, Drawer, Space, Typography, Flex, Tooltip, Empty, InputNumber, Select, Input, message } from 'antd';
import {
  SettingOutlined, InfoCircleOutlined, ClockCircleOutlined,
  CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../stores/useAgentStore';

const { Text } = Typography;

interface AgentStep {
  agent: string;
  action: string;
  status: 'completed' | 'running' | 'error' | 'pending';
  detail?: string;
  timestamp?: string;
}

interface AgentConfigItem {
  key: string;
  label: string;
  value: string | number;
  type: 'select' | 'number' | 'text';
  options?: string[];
  description?: string;
}

interface AgentProcessPanelProps {
  steps?: AgentStep[];
  configs?: AgentConfigItem[];
  description?: string;
  onConfigChange?: (key: string, value: string | number) => void;
  onRerun?: () => void;
  agentName?: string;
}

const agentColors: Record<string, string> = {
  knowledge: '#1677ff',
  diagnosis: '#52c41a',
  tracing: '#fa8c16',
  teaching: '#722ed1',
  evolution: '#13c2c2',
};

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  running: <LoadingOutlined style={{ color: '#1677ff' }} />,
  error: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
  pending: <ClockCircleOutlined style={{ color: '#d9d9d9' }} />,
};

const AgentProcessPanel: React.FC<AgentProcessPanelProps> = ({
  steps = [],
  configs = [],
  description,
  onConfigChange,
  onRerun,
  agentName,
}) => {
  const [configOpen, setConfigOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { configs: remoteConfigs, fetchConfigs, updateConfig } = useAgentStore();

  useEffect(() => {
    if (agentName && configOpen) {
      fetchConfigs(agentName);
    }
  }, [agentName, configOpen]);

  const displayConfigs = agentName && remoteConfigs.length > 0
    ? remoteConfigs.map(rc => ({
        key: rc.config_key,
        label: rc.config_key,
        value: rc.config_value,
        type: (rc.value_type === 'number' ? 'number' : rc.value_type === 'select' ? 'select' : 'text') as AgentConfigItem['type'],
        description: rc.description || undefined,
      }))
    : configs;

  const handleConfigUpdate = async (key: string, value: string | number) => {
    if (agentName) {
      try {
        await updateConfig(agentName, key, String(value));
        message.success('参数已更新');
      } catch {
        message.error('更新失败');
      }
    }
    onConfigChange?.(key, value);
  };

  const hasContent = steps.length > 0 || displayConfigs.length > 0 || description;

  if (!hasContent) return null;

  return (
    <>
      <div style={{
        borderTop: '1px solid #f0f0f0', marginTop: 12, paddingTop: 12,
      }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Space>
            <RobotOutlined style={{ color: '#1677ff' }} />
            <Text type="secondary" style={{ fontSize: 13 }}>Agent 处理过程</Text>
          </Space>
          <Space size={4}>
            {description && (
              <Tooltip title="查看工作原理说明">
                <Button size="small" type="text" icon={<InfoCircleOutlined />} onClick={() => setInfoOpen(true)} />
              </Tooltip>
            )}
            {displayConfigs.length > 0 && (
              <Tooltip title="调整参数">
                <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => setConfigOpen(true)} />
              </Tooltip>
            )}
            {onRerun && (
              <Button size="small" type="link" onClick={onRerun}>重新执行</Button>
            )}
          </Space>
        </Flex>

        {steps.length > 0 ? (
          <Flex vertical gap={4}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 4,
                background: step.status === 'running' ? '#f0f5ff' : 'transparent',
              }}>
                {statusIcons[step.status]}
                <Tag color={agentColors[step.agent] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                  {step.agent}
                </Tag>
                <Text style={{ fontSize: 12 }}>{step.action}</Text>
                {step.detail && (
                  <Text type="secondary" style={{ fontSize: 11 }}>({step.detail})</Text>
                )}
              </div>
            ))}
          </Flex>
        ) : (
          <Empty description="暂无处理记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>

      {/* Info Drawer */}
      <Drawer
        title="工作原理"
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        width={400}
      >
        <Typography.Paragraph>{description}</Typography.Paragraph>
      </Drawer>

      {/* Config Drawer */}
      <Drawer
        title="参数配置"
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        width={400}
      >
        <Flex vertical gap={16}>
          {displayConfigs.map(cfg => (
            <div key={cfg.key}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{cfg.label}</Text>
              {cfg.description && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cfg.description}</Text>
              )}
              {cfg.type === 'number' ? (
                <InputNumber
                  size="small"
                  value={typeof cfg.value === 'number' ? cfg.value : Number(cfg.value)}
                  onChange={(v) => v != null && handleConfigUpdate(cfg.key, v)}
                  style={{ width: '100%' }}
                />
              ) : cfg.type === 'select' && cfg.options ? (
                <Select
                  size="small"
                  value={String(cfg.value)}
                  onChange={(v) => handleConfigUpdate(cfg.key, v)}
                  style={{ width: '100%' }}
                  options={cfg.options.map(o => ({ value: o, label: o }))}
                />
              ) : (
                <Input
                  size="small"
                  value={String(cfg.value)}
                  onChange={(e) => handleConfigUpdate(cfg.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </Flex>
      </Drawer>
    </>
  );
};

export default AgentProcessPanel;
