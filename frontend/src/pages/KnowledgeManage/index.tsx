import { useState, lazy, Suspense } from 'react';
import { Tabs, Spin, Space } from 'antd';
import {
  ApartmentOutlined, BookOutlined, FolderOutlined,
} from '@ant-design/icons';

const KnowledgeCenter = lazy(() => import('../KnowledgeCenter'));
const CoursewareManage = lazy(() => import('../CoursewareManage'));
const ProjectManage = lazy(() => import('../ProjectManage'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin size="large" />
  </div>
);

const KnowledgeManage = () => {
  return (
    <Tabs
      defaultActiveKey="graph"
      items={[
        {
          key: 'graph',
          label: (
            <Space>
              <ApartmentOutlined />
              <span>知识图谱</span>
            </Space>
          ),
          children: (
            <Suspense fallback={<PageLoader />}><KnowledgeCenter /></Suspense>
          ),
        },
        {
          key: 'resources',
          label: (
            <Space>
              <BookOutlined />
              <span>教学资源</span>
            </Space>
          ),
          children: (
            <Suspense fallback={<PageLoader />}><CoursewareManage /></Suspense>
          ),
        },
        {
          key: 'projects',
          label: (
            <Space>
              <FolderOutlined />
              <span>课件包管理</span>
            </Space>
          ),
          children: (
            <Suspense fallback={<PageLoader />}><ProjectManage /></Suspense>
          ),
        },
      ]}
    />
  );
};

export default KnowledgeManage;
