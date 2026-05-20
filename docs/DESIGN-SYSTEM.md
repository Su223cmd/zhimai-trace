# DESIGN-SYSTEM.md — AI认知诊断引擎 UI设计系统

> 约束前端实现效果，确保AI生成代码的视觉一致性和可运行性
> 本产品以CDM（认知诊断模型）为核心引擎，UI必须反映CDM参数，而非LLM输出

---

## 1. 技术栈（强制，不允许替换）

| 技术 | 版本 | 用途 | 不允许用 |
|------|------|------|---------|
| React | 18+ | UI框架 | Vue/Angular |
| TypeScript | 5+ | 类型安全 | JavaScript |
| Vite | 5+ | 构建工具 | Webpack/CRA |
| Ant Design | 5.x | 组件库 | MUI/Chakra/自研 |
| @ant-design/icons | 5.x | 图标 | 其他图标库 |
| AntV G6 | 5.x | 知识图谱可视化 | D3.js/Cytoscape |
| ECharts | 5.x | 数据图表 | Chart.js/Recharts |
| @ant-design/charts | 2.x | ECharts的React封装 | - |
| Tailwind CSS | 3.x | 工具类样式 | CSS Modules/styled-components/Emotion |
| React Router | 6.x | 路由 | - |
| Axios | 1.x | HTTP请求 | fetch |

**规则**：
1. 所有UI组件必须使用Ant Design，不允许自研组件
2. 样式方案只用Tailwind CSS，不允许混用其他CSS方案
3. 图表只用ECharts（通过@ant-design/charts），不允许引入其他图表库
4. 图谱只用AntV G6，不允许用D3.js

---

## 2. 设计Token

### 2.1 色彩系统

```css
:root {
  /* 品牌色 - 智能蓝 */
  --color-primary: #1677ff;
  --color-primary-hover: #4096ff;
  --color-primary-active: #0958d9;

  /* 语义色 - CDM掌握率 P(mastery) */
  --color-cdm-high: #52c41a;       /* P(mastery) ≥ 0.8 绿色 */
  --color-cdm-medium: #faad14;     /* P(mastery) 0.5-0.8 黄色 */
  --color-cdm-low: #ff4d4f;        /* P(mastery) < 0.5 红色 */

  /* 语义色 - 诊断 */
  --color-root-cause: #ff4d4f;     /* 根因节点 */
  --color-trace-path: #ff4d4f;     /* 追溯路径 */
  --color-downstream: #1677ff;     /* 下游影响 */
  --color-counterfactual: #722ed1; /* 反事实预测 */

  /* 语义色 - 状态 */
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #ff4d4f;
  --color-info: #1677ff;

  /* 语义色 - 智能体 */
  --color-agent: #722ed1;

  /* 中性色 */
  --color-text-primary: rgba(0, 0, 0, 0.88);
  --color-text-secondary: rgba(0, 0, 0, 0.65);
  --color-text-tertiary: rgba(0, 0, 0, 0.45);
  --color-bg-layout: #f5f5f5;
  --color-bg-container: #ffffff;
  --color-border: #d9d9d9;
}
```

### 2.2 字体

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-size-h1: 24px;
  --font-size-h2: 20px;
  --font-size-h3: 16px;
  --font-size-body: 14px;
  --font-size-caption: 12px;
  --font-line-height: 1.5714;
}
```

### 2.3 间距

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl: 48px;
}
```

### 2.4 圆角

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

## 3. 布局规范

### 3.1 整体布局

```
┌─────────────────────────────────────────────────────┐
│  Header (64px)  [Logo] [导航菜单]  [🔔通知铃铛] [用户头像]  │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │                                          │
│ (200px)  │  Content Area                            │
│          │  (padding: 24px)                         │
│ · 课件管理│                                          │
│ · 知识图谱│                                          │
│ · 诊断   │                                          │
│ · 教学决策│                                          │
│ · 通知中心│  Badge(count=unreadCount)                │
│ · 设置   │                                          │
├──────────┴──────────────────────────────────────────┤
│  Footer (可选)                                       │
└─────────────────────────────────────────────────────┘
```

**Ant Design组件**：`Layout` + `Layout.Sider` + `Layout.Header` + `Layout.Content`

### 3.2 页面内布局

```
┌─────────────────────────────────────────┐
│  PageHeader (标题 + 操作按钮)            │
├─────────────────────────────────────────┤
│  统计卡片行 (Row > Col > Statistic)      │
├─────────────────────────────────────────┤
│  主内容区                                │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ 左侧面板      │ │ 右侧面板      │      │
│  │ (span=14)    │ │ (span=10)    │      │
│  └──────────────┘ └──────────────┘      │
├─────────────────────────────────────────┤
│  表格/列表 (Table / List)               │
└─────────────────────────────────────────┘
```

**Ant Design组件**：`PageHeader` + `Row`/`Col` + `Card` + `Statistic` + `Table`

---

## 4. 组件使用规范

### 4.1 必须使用的Ant Design组件

| 场景 | 组件 | 不允许 |
|------|------|--------|
| 按钮 | `Button` | 自研按钮 |
| 表单 | `Form` + `Input` + `Select` + `DatePicker` | 自研表单 |
| 表格 | `Table` | 自研表格 |
| 弹窗 | `Modal` | 自研弹窗 |
| 消息提示 | `message` / `notification` | alert() |
| 标签页 | `Tabs` | 自研标签页 |
| 卡片 | `Card` | 自研卡片 |
| 统计数值 | `Statistic` | 自研数值展示 |
| 标签 | `Tag` | 自研标签 |
| 进度条 | `Progress` | 自研进度条 |
| 面包屑 | `Breadcrumb` | - |
| 下拉菜单 | `Dropdown` | - |
| 空状态 | `Empty` | - |
| 加载 | `Spin` / `Skeleton` | 自研loading |
| 确认框 | `Popconfirm` | - |
| 抽屉 | `Drawer` | - |
| 描述列表 | `Descriptions` | - |
| 步骤条 | `Steps` | - |
| 折叠面板 | `Collapse` | - |
| 上传 | `Upload` | - |
| 结果页 | `Result` | - |

### 4.2 MasteryTag（基于CDM P(mastery)）

```tsx
import { Tag } from 'antd';

const MasteryTag: React.FC<{ rate: number }> = ({ rate }) => {
  const color = rate >= 0.8 ? 'success' : rate >= 0.5 ? 'warning' : 'error';
  return <Tag color={color}>{(rate * 100).toFixed(0)}%</Tag>;
};
```

### 4.3 ConfidenceTag

```tsx
import { Tag } from 'antd';

const ConfidenceTag: React.FC<{ confidence: number }> = ({ confidence }) => {
  const color = confidence >= 0.7 ? 'success' : confidence >= 0.5 ? 'warning' : 'error';
  const label = confidence >= 0.7 ? '高置信' : confidence >= 0.5 ? '中置信' : '低置信';
  return <Tag color={color}>{label} {(confidence * 100).toFixed(0)}%</Tag>;
};
```

### 4.4 CDMParamsDisplay

```tsx
import { Descriptions, Tag } from 'antd';

const CDMParamsDisplay: React.FC<{
  slip: number;
  guess: number;
  aic: number;
  bic: number;
  convergence: boolean;
}> = ({ slip, guess, aic, bic, convergence }) => {
  return (
    <Descriptions column={2} size="small">
      <Descriptions.Item label="Slip(粗心率)">{(slip * 100).toFixed(1)}%</Descriptions.Item>
      <Descriptions.Item label="Guess(猜对率)">{(guess * 100).toFixed(1)}%</Descriptions.Item>
      <Descriptions.Item label="AIC">{aic.toFixed(1)}</Descriptions.Item>
      <Descriptions.Item label="BIC">{bic.toFixed(1)}</Descriptions.Item>
      <Descriptions.Item label="收敛状态">
        {convergence ? <Tag color="success">已收敛</Tag> : <Tag color="error">未收敛</Tag>}
      </Descriptions.Item>
    </Descriptions>
  );
};
```

### 4.5 KnowledgeStateVector

```tsx
import { Progress, Tooltip, Space } from 'antd';

interface KnowledgeMastery {
  name: string;
  mastery: number;
}

const KnowledgeStateVector: React.FC<{ items: KnowledgeMastery[] }> = ({ items }) => {
  const getColor = (mastery: number) =>
    mastery >= 0.8 ? '#52c41a' : mastery >= 0.5 ? '#faad14' : '#ff4d4f';

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {items.map((item) => (
        <Tooltip key={item.name} title={`P(mastery) = ${item.mastery.toFixed(3)}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 120, fontSize: 13, textAlign: 'right' }}>{item.name}</span>
            <Progress
              percent={Math.round(item.mastery * 100)}
              strokeColor={getColor(item.mastery)}
              size="small"
              style={{ flex: 1 }}
            />
          </div>
        </Tooltip>
      ))}
    </Space>
  );
};
```

### 4.6 CounterfactualCard

```tsx
import { Card, Descriptions, Tag, Progress } from 'antd';

interface CounterfactualItem {
  knowledgePoint: string;
  currentMastery: number;
  predictedMastery: number;
  improvement: number;
}

const CounterfactualCard: React.FC<{
  condition: string;
  items: CounterfactualItem[];
}> = ({ condition, items }) => {
  return (
    <Card
      title="反事实预测"
      extra={<Tag color="purple">{condition}</Tag>}
      size="small"
    >
      <Descriptions column={1} size="small">
        {items.map((item) => (
          <Descriptions.Item key={item.knowledgePoint} label={item.knowledgePoint}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{(item.currentMastery * 100).toFixed(0)}%</span>
              <span style={{ color: '#722ed1' }}>→</span>
              <span style={{ color: '#722ed1', fontWeight: 600 }}>
                {(item.predictedMastery * 100).toFixed(0)}%
              </span>
              <Tag color="purple">+{(item.improvement * 100).toFixed(0)}%</Tag>
            </div>
            <Progress
              percent={Math.round(item.predictedMastery * 100)}
              success={{ percent: Math.round(item.currentMastery * 100) }}
              size="small"
            />
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};
```

### 4.7 NotificationBell

```tsx
import { Badge, Popover, List, BellOutlined } from '@ant-design/icons';

interface AgentNotification {
  title: string;
  content: string;
  type: 'cdm_update' | 'prereq_candidate' | 'low_mastery' | 'courseware_optimize';
  createdAt: string;
  read: boolean;
}

const NotificationBell: React.FC<{ unreadCount: number; notifications: AgentNotification[] }> = ({ unreadCount, notifications }) => {
  return (
    <Popover content={<List size="small" dataSource={notifications.slice(0, 5)} renderItem={(item) => <List.Item><List.Item.Meta title={item.title} description={item.content} /></List.Item></List.Item>} />} trigger="click">
      <Badge count={unreadCount}>
        <BellOutlined style={{ fontSize: 18 }} />
      </Badge>
    </Popover>
  );
};
```

### 4.8 CoursewareModeTag

```tsx
import { Tag } from 'antd';

const CoursewareModeTag: React.FC<{ mode: 'template' | 'free' }> = ({ mode }) => {
  return mode === 'template' 
    ? <Tag color="success">📋 模板模式 (确定性提取)</Tag>
    : <Tag color="warning">🤖 自由模式 (需教师确认)</Tag>;
};
```

### 4.9 PartialCorrelationTag

```tsx
import { Tag, Tooltip } from 'antd';

const PartialCorrelationTag: React.FC<{ r: number; pValue: number; sampleSize: number }> = ({ r, pValue, sampleSize }) => {
  const isSignificant = pValue < 0.05 && sampleSize >= 30;
  return (
    <Tooltip title={`偏相关系数=${r.toFixed(3)}, p=${pValue.toFixed(4)}, n=${sampleSize}`}>
      {isSignificant 
        ? <Tag color="success">偏相关显著 r={r.toFixed(2)}</Tag>
        : <Tag color="default">偏相关不显著</Tag>}
    </Tooltip>
  );
};
```

---

## 5. 图谱可视化规范

### 5.1 AntV G6配置

```typescript
import G6 from '@antv/g6';

const graphConfig = {
  layout: {
    type: 'dagre',
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 100,
  },
  defaultNode: {
    type: 'rect',
    size: [160, 52],
    style: {
      radius: 8,
      fill: '#e6f4ff',
      stroke: '#1677ff',
      lineWidth: 1.5,
    },
    labelCfg: {
      style: {
        fontSize: 13,
        fill: 'rgba(0,0,0,0.88)',
      },
    },
  },
  defaultEdge: {
    type: 'polyline',
    style: {
      stroke: '#bfbfbf',
      lineWidth: 1.5,
      endArrow: {
        path: G6.Arrow.triangle(6, 8, 0),
        fill: '#bfbfbf',
      },
    },
  },
  nodeStateStyles: {
    rootCause: {
      fill: '#fff1f0',
      stroke: '#ff4d4f',
      lineWidth: 3,
      shadowColor: '#ff4d4f',
      shadowBlur: 12,
    },
    inTracePath: {
      stroke: '#ff4d4f',
      lineWidth: 2.5,
    },
    dimmed: {
      opacity: 0.15,
    },
  },
  edgeStateStyles: {
    inTracePath: {
      stroke: '#ff4d4f',
      lineWidth: 3,
    },
    dimmed: {
      opacity: 0.1,
    },
  },
};
```

### 5.2 节点颜色规则（基于CDM P(mastery)）

```typescript
function getNodeStyle(mastery: number) {
  if (mastery >= 0.8) {
    return { fill: '#f6ffed', stroke: '#52c41a' };
  }
  if (mastery >= 0.5) {
    return { fill: '#fffbe6', stroke: '#faad14' };
  }
  return { fill: '#fff1f0', stroke: '#ff4d4f' };
}
```

### 5.3 节点标签显示P(mastery)

```typescript
function formatNodeLabel(name: string, mastery: number): string {
  return `${name}\nP=${mastery.toFixed(2)}`;
}

function buildNodeData(knowledgePoints: KnowledgePoint[]) {
  return knowledgePoints.map((kp) => {
    const style = getNodeStyle(kp.mastery);
    return {
      id: kp.id,
      label: formatNodeLabel(kp.name, kp.mastery),
      style: { ...style, radius: 8 },
      labelCfg: {
        style: {
          fontSize: 12,
          fill: 'rgba(0,0,0,0.88)',
        },
      },
    };
  });
}
```

### 5.4 四层图谱渲染（课程→章节→节→单元）

```typescript
type GraphLayer = 'course' | 'chapter' | 'section' | 'unit';

interface HierarchyNode {
  id: string;
  label: string;
  layer: GraphLayer;
  mastery: number;
  children?: HierarchyNode[];
  parentId?: string;
}

const LAYER_CONFIG: Record<GraphLayer, { color: string; size: [number, number]; fontSize: number }> = {
  course: { color: '#1677ff', size: [180, 56], fontSize: 14 },
  chapter: { color: '#4096ff', size: [160, 48], fontSize: 13 },
  section: { color: '#69b1ff', size: [140, 44], fontSize: 12 },
  unit: { color: '#91caff', size: [120, 40], fontSize: 12 },
};

function buildHierarchyGraph(nodes: HierarchyNode[], expandedLayers: Set<GraphLayer>) {
  const visibleNodes: any[] = [];
  const visibleEdges: any[] = [];

  function traverse(node: HierarchyNode) {
    const layerConfig = LAYER_CONFIG[node.layer];
    const style = getNodeStyle(node.mastery);
    visibleNodes.push({
      id: node.id,
      label: formatNodeLabel(node.label, node.mastery),
      type: 'rect',
      size: layerConfig.size,
      style: { ...style, radius: 8 },
      labelCfg: { style: { fontSize: layerConfig.fontSize, fill: 'rgba(0,0,0,0.88)' } },
      data: { layer: node.layer, mastery: node.mastery },
    });

    if (node.children && expandedLayers.has(node.layer)) {
      node.children.forEach((child) => {
        traverse(child);
        visibleEdges.push({
          source: node.id,
          target: child.id,
          type: 'cubic',
          style: { stroke: '#bfbfbf', lineWidth: 1.5 },
        });
      });
    }
  }

  nodes.forEach(traverse);
  return { nodes: visibleNodes, edges: visibleEdges };
}
```

### 5.5 追溯路径高亮

```typescript
function highlightTracePath(graph: G6.Graph, pathNodeIds: string[]) {
  const pathEdgeIds = new Set<string>();
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    pathEdgeIds.add(`${pathNodeIds[i]}-${pathNodeIds[i + 1]}`);
  }

  graph.getNodes().forEach((node) => {
    const id = node.getID();
    if (id === pathNodeIds[0]) {
      graph.setItemState(node, 'rootCause', true);
    } else if (pathNodeIds.includes(id)) {
      graph.setItemState(node, 'inTracePath', true);
    } else {
      graph.setItemState(node, 'dimmed', true);
    }
  });

  graph.getEdges().forEach((edge) => {
    const source = edge.getSource().getID();
    const target = edge.getTarget().getID();
    const edgeKey = `${source}-${target}`;
    if (pathEdgeIds.has(edgeKey)) {
      graph.setItemState(edge, 'inTracePath', true);
    } else {
      graph.setItemState(edge, 'dimmed', true);
    }
  });
}
```

---

## 6. 图表规范

### 6.1 ScoreDistributionChart（分数分布柱状图）

```tsx
import { Column } from '@ant-design/charts';

const ScoreDistributionChart: React.FC<{ data: { range: string; count: number }[] }> = ({ data }) => {
  const config = {
    data,
    xField: 'range',
    yField: 'count',
    color: '#1677ff',
    columnWidthRatio: 0.6,
    label: { position: 'middle' as const },
  };
  return <Column {...config} />;
};
```

### 6.2 KnowledgeMasteryChart（知识掌握率条形图，CDM阈值着色）

```tsx
import { Bar } from '@ant-design/charts';

interface MasteryDataItem {
  knowledgePoint: string;
  mastery: number;
}

const KnowledgeMasteryChart: React.FC<{ data: MasteryDataItem[] }> = ({ data }) => {
  const getMasteryColor = (mastery: number) =>
    mastery >= 0.8 ? '#52c41a' : mastery >= 0.5 ? '#faad14' : '#ff4d4f';

  const config = {
    data,
    yField: 'knowledgePoint',
    xField: 'mastery',
    colorField: 'mastery',
    color: ({ mastery }: MasteryDataItem) => getMasteryColor(mastery),
    barWidthRatio: 0.6,
    label: {
      position: 'right' as const,
      formatter: (datum: MasteryDataItem) => `${(datum.mastery * 100).toFixed(0)}%`,
    },
    xAxis: {
      max: 1,
      label: {
        formatter: (text: string) => `${(parseFloat(text) * 100).toFixed(0)}%`,
      },
    },
    legend: false,
  };
  return <Bar {...config} />;
};
```

### 6.3 CounterfactualChart（反事实预测对比图）

```tsx
import { Column } from '@ant-design/charts';

interface CounterfactualDataItem {
  knowledgePoint: string;
  type: '当前' | '预测';
  mastery: number;
}

const CounterfactualChart: React.FC<{ data: CounterfactualDataItem[] }> = ({ data }) => {
  const config = {
    data,
    xField: 'knowledgePoint',
    yField: 'mastery',
    colorField: 'type',
    group: true,
    color: ['#1677ff', '#722ed1'],
    columnWidthRatio: 0.4,
    yAxis: {
      max: 1,
      label: {
        formatter: (text: string) => `${(parseFloat(text) * 100).toFixed(0)}%`,
      },
    },
    label: {
      position: 'middle' as const,
      formatter: (datum: CounterfactualDataItem) =>
        `${(datum.mastery * 100).toFixed(0)}%`,
    },
  };
  return <Column {...config} />;
};
```

### 6.4 CDMModelFitChart（CDM模型收敛曲线）

```tsx
import { Line } from '@ant-design/charts';

interface IterationDataItem {
  iteration: number;
  logLikelihood: number;
}

const CDMModelFitChart: React.FC<{ data: IterationDataItem[] }> = ({ data }) => {
  const config = {
    data,
    xField: 'iteration',
    yField: 'logLikelihood',
    smooth: true,
    point: { size: 3 },
    color: '#1677ff',
    xAxis: { title: { text: 'EM迭代次数' } },
    yAxis: { title: { text: 'Log-Likelihood' } },
  };
  return <Line {...config} />;
};
```

---

## 7. 页面线框图（Ant Design组件标注）

### 页面1: 知识状态总览

```
组件结构:
Layout > Content >
  Alert(banner, type=info, message="🔔 系统通知: CDM模型已更新 | 发现新前驱关系候选 | 等值线判读连续3次<30%")
  PageHeader(title="期中考试 - 高一(3)班", extra=[Button"导出报告"])
  Row(gutter=16) >
    Col(span=6) > Card > Statistic(title="班级均分", value=68.5)
    Col(span=6) > Card > Statistic(title="最高分", value=95)
    Col(span=6) > Card > Statistic(title="最低分", value=32)
    Col(span=6) > Card > Statistic(title="参考人数", value=45)
  Card(title="分数分布") > ScoreDistributionChart
  Card(title="知识掌握率 TOP3") >
    List >
      ListItem(extra=MasteryTag rate=0.32) >
        "1. 等值线判读" + Progress(percent=32, status=exception)
      ListItem(extra=MasteryTag rate=0.41) >
        "2. 热力环流原理" + Progress(percent=41, status=active)
      ListItem(extra=MasteryTag rate=0.52) >
        "3. 降水特征辨析" + Progress(percent=52, status=active)
  Card(title="CDM诊断指标") >
    CDMParamsDisplay(slip=0.12, guess=0.18, aic=2345.6, bic=2389.1, convergence=true)
  Card(title="AI建议") >
    Alert(type=info, message="建议优先补: 等值线判读",
          description="影响14人×5个下游知识点=70影响点，补后P(mastery)预期32%→75%")
    Button(type=primary) "查看详细诊断"
    Button "查看知识图谱"
    Button "查看教学建议"
```

### 页面2: 认知诊断详情

```
组件结构:
Layout > Content >
  PageHeader(title="认知诊断详情")
  Row(gutter=16) >
    Col(span=14) > Card(title="知识图谱") >
      div(id="graph-container", style={height: 500}) > G6图谱
    Col(span=10) >
      Card(title="CDM诊断参数") >
        Collapse >
          Panel(header="Q矩阵") >
            Table(columns=[
              {title:"题目", dataIndex:"question"},
              {title:"知识点1", dataIndex:"kp1", render: Tag(1/0)},
              {title:"知识点2", dataIndex:"kp2", render: Tag(1/0)},
              {title:"知识点3", dataIndex:"kp3", render: Tag(1/0)},
            ])
          Panel(header="知识状态向量") >
            KnowledgeStateVector(items=[
              {name:"等值线判读", mastery:0.32},
              {name:"热力环流原理", mastery:0.41},
              {name:"降水特征辨析", mastery:0.52},
            ])
          Panel(header="根因推断") >
            Descriptions(column=1) >
              Item(label="根因知识点") > Tag(color=error) "等值线判读"
              Item(label="追溯路径") > "气候类型判断 ← 气温降水读图 ← 等值线判读"
              Item(label="置信度") > ConfidenceTag(confidence=0.85)
          Panel(header="模型参数") >
            CDMParamsDisplay(slip, guess, aic, bic, convergence)
            CDMModelFitChart(data=iterationData)
      Card(title="反事实预测") >
        CounterfactualCard(condition="如果补了等值线判读", items=[
          {knowledgePoint:"气温降水读图", currentMastery:0.45, predictedMastery:0.72, improvement:0.27},
          {knowledgePoint:"气候类型判断", currentMastery:0.23, predictedMastery:0.61, improvement:0.38},
        ])
```

### 页面3: 教学决策

```
组件结构:
Layout > Content >
  PageHeader(title="教学决策")
  Card(title="补课优先级") >
    Table(columns=[
      {title:"优先级", dataIndex:"rank"},
      {title:"知识点", dataIndex:"name"},
      {title:"教材位置", dataIndex:"textbook_ref"},
      {title:"影响人数", dataIndex:"students", render: Tag},
      {title:"当前P(mastery)", dataIndex:"mastery", render: MasteryTag},
      {title:"CDM量化预测", dataIndex:"prediction", render: (v) => Tag(color=purple) `补后P=${v}`},
      {title:"预期提升", dataIndex:"improvement"},
    ])
  Card(title="学生分组") >
    Tabs >
      TabPane(tab="A组 - 等值线判读(14人)") >
        List > Avatar + StudentName items
      TabPane(tab="B组 - 热力环流(11人)") >
        List > Avatar + StudentName items
      TabPane(tab="C组 - 降水辨析(8人)") >
        List > Avatar + StudentName items
  Card(title="教学建议") >
    Alert(type=info, message="先补A组(等值线判读)")
    Descriptions(column=1) >
      Item(label="理由") > "它是B组和C组部分知识的前置"
      Item(label="预期效果") > "补完后5个下游知识点P(mastery)提升"
      Item(label="参考教材") > "必修一P52-55"
      Item(label="建议方式") > "3道专项练习+1道综合应用"
    Space >
      Button(type=primary) "采纳建议"
      Button "调整方案"
      Button "导出报告"
  Card(title="课件优化建议") >
    List >
      ListItem(extra=Button"查看") > "等值线判读课件缺少交互练习环节"
      ListItem(extra=Button"查看") > "热力环流课件图示与课标对齐度不足"
```

### 页面4: 课件管理

```
组件结构:
Layout > Content >
  PageHeader(title="课件管理", extra=[Button(type=primary, icon=UploadOutlined) "上传课件", Button "从课程标准导入", Button(icon=DownloadOutlined) "[下载课件模板]"])
  Alert(banner, type=info, message="💡 按模板填写可确定性解析，无需LLM辅助，准确率≥95%")
  Card(title="上传课件") >
    Upload.Dragger(
      name="file",
      accept=".pptx,.pdf,.docx",
      action="/api/courseware/upload",
    ) >
      p(className="ant-upload-drag-icon") > InboxOutlined
      p(className="ant-upload-text") > "点击或拖拽课件文件上传"
      p(className="ant-upload-hint") > "支持 PPTX / PDF / DOCX 格式 | 下载模板可获得确定性解析"
  Card(title="课件列表") >
    Table(columns=[
      {title:"课件名称", dataIndex:"name"},
      {title:"上传时间", dataIndex:"uploadTime"},
      {title:"解析模式", dataIndex:"parseMode", render: CoursewareModeTag(mode='template'|'free')},
      {title:"模板", dataIndex:"isTemplate", render: Tag(✅ 是(确定性解析) / ❌ 否(LLM辅助解析))},
      {title:"解析状态", dataIndex:"parseStatus", render: Tag(解析中/已完成/失败)},
      {title:"知识点数", dataIndex:"knowledgePointCount"},
      {title:"课标对齐率", dataIndex:"alignmentRate", render: Progress},
      {title:"操作", render: [Button"查看", Button"重新解析", Popconfirm"删除"]},
    ])
  Card(title="课件优化反馈") >
    List >
      ListItem(extra=Tag color=purple "待优化") >
        List.ItemMeta(title="等值线判读.pptx", description="缺少3个课标要求的知识点，建议补充: 等值线间距判读、等值线弯曲判读")
      ListItem(extra=Tag color=success "已优化") >
        List.ItemMeta(title="热力环流.pdf", description="已补充交互式图示，课标对齐率从72%提升至95%")
```

---

## 10. 智能体通知交互规范

### 10.1 通知类型与UI表示

| 通知类型 | type值 | 触发条件 | UI表示 | 优先级 |
|---------|--------|---------|--------|--------|
| CDM参数更新 | `cdm_update` | 新考试数据导入后CDM估计完成 | Toast + 通知列表 | 高 |
| 前驱关系候选 | `prereq_candidate` | 偏相关检验发现显著前驱关系 | 通知列表 + 教师确认 | 中 |
| 掌握率预警 | `low_mastery` | 连续3次P(mastery)<30% | Toast + 通知列表 | 高 |
| 课件优化建议 | `courseware_optimize` | 班级掌握率<30%关联课件页 | 通知列表 | 低 |

### 10.2 通知中心交互

```
侧边栏 "通知中心" 入口:
  - 显示 Badge(count=未读数)
  - 点击进入通知列表页

Header 通知铃铛:
  - NotificationBell 组件
  - 点击展开 Popover 显示最近5条通知
  - 高优先级事件同时弹出 Toast (Ant Design notification)

通知列表页:
  - Table 展示所有通知
  - 列: 标题、内容、类型Tag、时间、状态(已读/未读)
  - 批量标记已读
  - 按类型筛选
  - 未读通知加粗显示
```

### 10.3 Toast通知规则

```
高优先级事件(立即弹出Toast):
  - CDM参数更新完成: notification.success("CDM模型已更新，请查看最新诊断结果")
  - 掌握率预警: notification.warning("等值线判读连续3次<30%，建议关注")

中/低优先级事件(仅通知列表，不弹Toast):
  - 前驱关系候选: 通知列表中显示，等待教师确认
  - 课件优化建议: 通知列表中显示
```

### 10.4 通知去重规则

```
同一事件24小时内仅产生1条通知:
  - 去重键: type + 关联实体ID
  - 例: 同一知识点的掌握率预警，24h内只通知1次
  - 超过24h后再次触发则产生新通知
```

---

## 8. 响应式断点

| 断点 | 宽度 | 布局变化 |
|------|------|---------|
| xl | ≥1200px | 标准三栏/两栏布局 |
| lg | ≥992px | 侧边栏收窄 |
| md | ≥768px | 侧边栏折叠为图标 |
| sm | <768px | 侧边栏隐藏，汉堡菜单 |

---

## 9. 动效规范

| 场景 | 动效 | 实现 |
|------|------|------|
| 根因节点 | 红色脉冲 | G6 nodeStateStyles + CSS animation |
| 追溯路径 | 渐显高亮 | G6 edgeStateStyles transition |
| 页面切换 | 淡入 | CSS transition opacity 200ms |
| 卡片悬浮 | 阴影加深 | CSS hover shadow |
| 数据加载 | Skeleton | Ant Design Skeleton组件 |
| 诊断进行中 | Spin | Ant Design Spin组件 |
| CDM参数变化 | 数值动画 | CSS counter / Ant Design Statistic `formatter` + requestAnimationFrame |
| P(mastery)变化 | 进度条平滑过渡 | Progress `transition: all 0.6s ease` |
| 反事实预测 | 紫色渐显 | CSS transition + opacity 400ms |

### 9.1 CDM参数数值动画实现

```tsx
import { Statistic } from 'antd';
import { useEffect, useState } from 'react';

const AnimatedStatistic: React.FC<{
  value: number;
  precision?: number;
  suffix?: string;
  prefix?: string;
}> = ({ value, precision = 1, suffix = '', prefix = '' }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <Statistic
      value={parseFloat(displayValue.toFixed(precision))}
      suffix={suffix}
      prefix={prefix}
    />
  );
};
```

### 9.2 P(mastery)进度条平滑过渡

```css
.ant-progress-bg {
  transition: all 0.6s ease !important;
}
```
