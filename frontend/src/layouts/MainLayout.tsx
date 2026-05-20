import { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Popover, List, Avatar, Empty } from 'antd';
import {
  BookOutlined,
  ApartmentOutlined,
  BulbOutlined,
  BellOutlined,
  UserOutlined,
  DashboardOutlined,
  FormOutlined,
  ExperimentOutlined,
  RobotOutlined,
  FolderOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useNotificationStore } from '../stores/useNotificationStore';

const { Header, Sider, Content } = Layout;

const LogoIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width={collapsed ? 28 : 28} height={28} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="8" r="4" fill="#1677ff" />
    <circle cx="6" cy="20" r="3.5" fill="#52c41a" />
    <circle cx="22" cy="20" r="3.5" fill="#faad14" />
    <circle cx="14" cy="22" r="3" fill="#ff4d4f" />
    <line x1="14" y1="12" x2="6" y2="17" stroke="#1677ff" strokeWidth="1.5" opacity="0.6" />
    <line x1="14" y1="12" x2="22" y2="17" stroke="#1677ff" strokeWidth="1.5" opacity="0.6" />
    <line x1="6" y1="20" x2="14" y2="22" stroke="#52c41a" strokeWidth="1.2" opacity="0.5" />
    <line x1="22" y1="20" x2="14" y2="22" stroke="#faad14" strokeWidth="1.2" opacity="0.5" />
  </svg>
);

const menuItems = [
  { type: 'group' as const, label: '教学工作流' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '系统总览' },
  { key: '/project-manage', icon: <FolderOutlined />, label: '项目管理' },
  { key: '/courseware-manage', icon: <BookOutlined />, label: '课件管理' },
  { type: 'divider' as const },
  { type: 'group' as const, label: '知识与诊断' },
  { key: '/knowledge-center', icon: <ApartmentOutlined />, label: '知识中心' },
  { key: '/homework-center', icon: <FormOutlined />, label: '作业中心' },
  { key: '/diagnosis-center', icon: <ExperimentOutlined />, label: '诊断中心' },
  { type: 'divider' as const },
  { type: 'group' as const, label: '决策与监控' },
  { key: '/teaching-decision', icon: <BulbOutlined />, label: '教学决策' },
  { key: '/agent-monitor', icon: <RobotOutlined />, label: 'Agent监控' },
  { type: 'divider' as const },
  { key: '/system-settings', icon: <SettingOutlined />, label: '系统设置' },
];

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, unreadCount, fetchNotifications, markRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={200}
        style={{ background: '#fff' }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottom: '1px solid var(--color-border)', padding: collapsed ? '0 8px' : '0 16px' }}>
          <LogoIcon collapsed={collapsed} />
          {!collapsed && (
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1677ff', whiteSpace: 'nowrap' }}>
              GraphAgent
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, borderBottom: '1px solid var(--color-border)' }}>
          <Popover
            content={
              notifications.length === 0 ? (
                <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  style={{ width: 300 }}
                  dataSource={notifications}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer', opacity: item.is_read ? 0.6 : 1 }}
                      onClick={() => markRead(item.id)}
                    >
                      <List.Item.Meta
                        title={item.title}
                        description={item.content || item.notification_type}
                      />
                    </List.Item>
                  )}
                />
              )
            }
            trigger="click"
          >
            <Badge count={unreadCount} style={{ cursor: 'pointer' }}>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
          </Popover>
          <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 'var(--radius-md)', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
