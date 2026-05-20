import { Tag } from 'antd';
import { ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

interface ParseStatusTagProps {
  status: 'pending' | 'parsing' | 'completed' | 'failed';
}

const statusConfig = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待解析' },
  parsing: { color: 'processing', icon: <SyncOutlined spin />, text: '解析中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已解析' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '解析失败' },
};

const ParseStatusTag = ({ status }: ParseStatusTagProps) => {
  const config = statusConfig[status];
  return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
};

export default ParseStatusTag;
