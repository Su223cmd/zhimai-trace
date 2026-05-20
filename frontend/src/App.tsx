import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectManage = lazy(() => import('./pages/ProjectManage'));
const CoursewareManage = lazy(() => import('./pages/CoursewareManage'));
const KnowledgeCenter = lazy(() => import('./pages/KnowledgeCenter'));
const HomeworkCenter = lazy(() => import('./pages/HomeworkCenter'));
const DiagnosisCenter = lazy(() => import('./pages/DiagnosisCenter'));
const TeachingDecision = lazy(() => import('./pages/TeachingDecision'));
const AgentMonitor = lazy(() => import('./pages/AgentMonitor'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="project-manage" element={<Suspense fallback={<PageLoader />}><ProjectManage /></Suspense>} />
          <Route path="courseware-manage" element={<Suspense fallback={<PageLoader />}><CoursewareManage /></Suspense>} />
          <Route path="knowledge-center" element={<Suspense fallback={<PageLoader />}><KnowledgeCenter /></Suspense>} />
          <Route path="homework-center" element={<Suspense fallback={<PageLoader />}><HomeworkCenter /></Suspense>} />
          <Route path="diagnosis-center" element={<Suspense fallback={<PageLoader />}><DiagnosisCenter /></Suspense>} />
          <Route path="teaching-decision" element={<Suspense fallback={<PageLoader />}><TeachingDecision /></Suspense>} />
          <Route path="agent-monitor" element={<Suspense fallback={<PageLoader />}><AgentMonitor /></Suspense>} />
          <Route path="system-settings" element={<Suspense fallback={<PageLoader />}><SystemSettings /></Suspense>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;