# GraphAgent — 知识图谱驱动的多Agent学情诊断与CDM根因追溯引擎

## 快速启动

### 方式一：双击 start.bat（推荐）

1. 双击 `start.bat`
2. 首次启动：
   - 如有 Python 3.10+ → 直接使用，安装依赖后启动
   - 如无 Python → 自动下载便携版 Python（约15MB），无需安装
3. 看到 "服务已启动" 后，浏览器访问：http://localhost:8000
4. 按 Ctrl+C 停止服务

### 方式二：手动启动

```bash
pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 系统要求

- 操作系统：Windows 10/11（64位）
- Python 3.10+（可选，脚本会自动处理）
- 浏览器：Chrome / Edge / Firefox
- 首次启动需要联网（下载依赖/Python）

## 预置演示数据

系统已包含一套高中地理学情诊断的完整演示数据：
- 知识图谱：136 个节点、184 条关系
- 作业与考试：3 份作业（不同状态）
- CDM 诊断：15 名学生的知识状态分析
- 教学建议：基于诊断结果的分组教学策略
- 5 个智能 Agent 协作运行

## 系统功能

| 模块 | 功能 |
|------|------|
| 知识中心 | 知识图谱可视化、筛选、前驱追溯、导出 |
| 作业中心 | 创建作业、Q矩阵标注、答题数据导入 |
| 诊断中心 | CDM参数估计、学生/班级诊断、根因分析 |
| 教学决策 | 诊断报告、教学策略卡片、学习路径、补救优先级 |
| Agent监控 | 多Agent流程可视化、事件时间线、通知中心 |

## 目录结构

```
GraphAgent/
├── start.bat              # 一键启动脚本
├── README.txt             # 本文件
├── backend/               # 后端代码
│   ├── app/               # FastAPI 应用
│   ├── cognitive_diagnosis.db  # 数据库（含演示数据）
│   └── requirements.txt   # Python 依赖
├── frontend/              # 前端（已构建）
│   └── dist/              # 生产构建产物
├── python/                # 便携版 Python（首次运行自动下载）
└── uploads/               # 文件上传目录（自动创建）
```

## 技术栈

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：React 19 + Ant Design 6 + AntV G6
- 诊断模型：DINA 模型（CDM 认知诊断模型）
- 智能体：5-Agent 协作架构（知识、诊断、追踪、教学、演化）
- 知识图谱：自研图存储 + G6 可视化

## 常见问题

**Q: 启动后浏览器打不开？**
确保 8000 端口未被占用。编辑 start.bat 最后一行修改端口号。

**Q: 如何重置数据？**
删除 `backend/cognitive_diagnosis.db`，重启后会创建空数据库。

**Q: 便携版 Python 占用空间？**
约 30MB，在 `python/` 目录中。删除后会重新下载。
