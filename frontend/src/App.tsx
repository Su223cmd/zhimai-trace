import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const KnowledgeCenter = lazy(() => import('./pages/KnowledgeCenter'));
const KnowledgeDetail = lazy(() => import('./pages/KnowledgeDetail'));
const CoursewareManage = lazy(() => import('./pages/CoursewareManage'));
const ProjectManage = lazy(() => import('./pages/ProjectManage'));
const HomeworkCenter = lazy(() => import('./pages/HomeworkCenter'));
const DiagnosisCenter = lazy(() => import('./pages/DiagnosisCenter'));
const DiagnosisDetail = lazy(() => import('./pages/DiagnosisDetail'));
const DiagnosisOverview = lazy(() => import('./pages/DiagnosisOverview'));
const TeachingDecision = lazy(() => import('./pages/TeachingDecision'));
const StudentDiagnosis = lazy(() => import('./pages/StudentDiagnosis'));
const QMatrixEditor = lazy(() => import('./pages/QMatrixEditor'));
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
          <Route path="knowledge" element={<Suspense fallback={<PageLoader />}><KnowledgeCenter /></Suspense>} />
          <Route path="knowledge/:kpCode" element={<Suspense fallback={<PageLoader />}><KnowledgeDetail /></Suspense>} />
          <Route path="courseware" element={<Suspense fallback={<PageLoader />}><CoursewareManage /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectManage /></Suspense>} />
          <Route path="homework" element={<Suspense fallback={<PageLoader />}><HomeworkCenter /></Suspense>} />
          <Route path="diagnosis" element={<Suspense fallback={<PageLoader />}><DiagnosisCenter /></Suspense>} />
          <Route path="diagnosis/detail" element={<Suspense fallback={<PageLoader />}><DiagnosisDetail /></Suspense>} />
          <Route path="diagnosis/overview" element={<Suspense fallback={<PageLoader />}><DiagnosisOverview /></Suspense>} />
          <Route path="teaching" element={<Suspense fallback={<PageLoader />}><TeachingDecision /></Suspense>} />
          <Route path="student/:studentId" element={<Suspense fallback={<PageLoader />}><StudentDiagnosis /></Suspense>} />
          <Route path="qmatrix/:homeworkId" element={<Suspense fallback={<PageLoader />}><QMatrixEditor /></Suspense>} />
          <Route path="agent" element={<Suspense fallback={<PageLoader />}><AgentMonitor /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SystemSettings /></Suspense>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
