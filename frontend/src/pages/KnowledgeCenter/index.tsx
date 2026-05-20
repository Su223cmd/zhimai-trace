import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Typography, Button, Card, Row, Col, Statistic, Space, Descriptions, Tag,
  Spin, Empty, Collapse, Flex, Divider, Input, Tree, Modal,
  Form, Select, message, Tooltip, Badge,
} from 'antd';
import {
  SyncOutlined, ArrowRightOutlined, SearchOutlined, PlusOutlined,
  LinkOutlined, ApartmentOutlined,
  FolderOutlined, FileTextOutlined, BookOutlined, ExperimentOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { knowledgeApi } from '../../services/api';
import KnowledgeGraph from '../../components/KnowledgeGraph';
import type { KnowledgeGraphDataV2, TraceResult, RelatedEntity, OntologyInfo, GraphEntity } from '../../types';

const ENTITY_LABELS: Record<string, string> = {
  KnowledgePoint: '知识点', Question: '试题', TeachingMaterial: '教学资料',
  LearningActivity: '学习活动', CoreCompetency: '核心素养', ExternalData: '外部数据',
  ExamPoint: '考点', ExamMethod: '考法', Subject: '学科',
};

const RELATION_LABELS: Record<string, string> = {
  PREREQUISITE_OF: '前置依赖', CONTAINS: '包含', SIMILAR_TO: '相似',
  EXAMINES: '考查', ASSOCIATED_WITH: '关联资料', INVOLVES: '涉及',
  SUPPORTS: '支撑', APPLIES: '应用', REQUIRES: '需要', PART_OF: '属于',
  CONTRASTS_WITH: '对比', HAS_EXAM_POINT: '包含考点', EXAM_POINT_OF: '属于知识点',
  TESTED_BY_METHOD: '考法', METHOD_FOR_EXAM: '用于考点',
};

const LAYER_ICONS: Record<string, React.ReactNode> = {
  subject: <BookOutlined />,
  theme: <FolderOutlined />,
  module: <FolderOutlined />,
  knowledgepoint: <FileTextOutlined />,
  exampoint: <ExperimentOutlined />,
  exammethod: <BulbOutlined />,
};

const LAYER_COLORS: Record<string, string> = {
  subject: '#1677ff', theme: '#13c2c2', module: '#fa8c16',
  knowledgepoint: '#1890ff', exampoint: '#eb2f96', exammethod: '#722ed1',
};

const KnowledgeCenter = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphDataV2 | null>(null);
  const [_ontologyInfo, setOntologyInfo] = useState<OntologyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [relatedEntities, setRelatedEntities] = useState<RelatedEntity[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addParentCode, setAddParentCode] = useState<string>('');
  const [addForm] = Form.useForm();
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationForm] = Form.useForm();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMastery, setFilterMastery] = useState<string>('all');
  const fetchCountRef = useRef(0);

  useEffect(() => {
    const currentCount = ++fetchCountRef.current;
    let cancelled = false;
    setLoading(true);
    Promise.all([knowledgeApi.graph(), knowledgeApi.ontology()])
      .then(([graphRes, ontologyRes]) => {
        if (!cancelled && currentCount === fetchCountRef.current) {
          setGraphData(graphRes);
          setOntologyInfo(ontologyRes);
        }
      })
      .catch((e) => { console.error('Failed to fetch graph:', e); })
      .finally(() => {
        if (!cancelled && currentCount === fetchCountRef.current) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      await knowledgeApi.sync();
      const [graphRes, ontologyRes] = await Promise.all([knowledgeApi.graph(), knowledgeApi.ontology()]);
      setGraphData(graphRes);
      setOntologyInfo(ontologyRes);
      message.success('知识图谱同步完成');
    } catch (e) {
      console.error('Sync failed:', e);
      message.error('同步失败');
    } finally {
      setLoading(false);
    }
  };

  const treeData = useMemo(() => {
    if (!graphData) return [];
    const subjects = graphData.subjects || [];
    const themes = graphData.themes || [];
    const modules = graphData.modules || [];
    const nodes = graphData.nodes || [];

    const themeBySubject: Record<string, typeof themes> = {};
    for (const t of themes) {
      const key = t.subject_code || '';
      if (!themeBySubject[key]) themeBySubject[key] = [];
      themeBySubject[key].push(t);
    }
    const moduleByTheme: Record<string, typeof modules> = {};
    for (const m of modules) {
      const key = m.theme_code || '';
      if (!moduleByTheme[key]) moduleByTheme[key] = [];
      moduleByTheme[key].push(m);
    }
    const kpByModule: Record<string, GraphEntity[]> = {};
    const epByKp: Record<string, GraphEntity[]> = {};
    for (const n of nodes) {
      if (n.type === 'KnowledgePoint') {
        const key = n.module_code || '';
        if (!kpByModule[key]) kpByModule[key] = [];
        kpByModule[key].push(n);
      } else if (n.type === 'ExamPoint') {
        const key = (n as Record<string, unknown>).knowledge_point_code as string || '';
        if (!epByKp[key]) epByKp[key] = [];
        epByKp[key].push(n);
      }
    }

    const buildNode = (code: string, name: string, layer: string, children?: DataNode[]): DataNode => {
      const mastery = nodes.find(n => n.code === code)?.mastery_rate;
      const title = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'rgba(0,0,0,0.85)' }}>{name}</span>
          {mastery != null && mastery > 0 && (
            <Tag color={mastery >= 0.8 ? 'success' : mastery >= 0.5 ? 'warning' : 'error'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
              {Math.round(mastery * 100)}%
            </Tag>
          )}
        </span>
      );
      return {
        key: code,
        title,
        icon: <span style={{ color: LAYER_COLORS[layer], fontSize: 12 }}>{LAYER_ICONS[layer]}</span>,
        children,
      };
    };

    return subjects.map(subj => {
      const childThemes = (themeBySubject[subj.code] || []).map(theme => {
        const childModules = (moduleByTheme[theme.code] || []).map(mod => {
          const childKPs = (kpByModule[mod.code] || []).map(kp => {
            const childEPs = (epByKp[kp.code] || []).map(ep =>
              buildNode(ep.code, ep.name || ep.code, 'exampoint')
            );
            return buildNode(kp.code, kp.name || kp.code, 'knowledgepoint', childEPs.length > 0 ? childEPs : undefined);
          });
          return buildNode(mod.code, mod.name || mod.code, 'module', childKPs.length > 0 ? childKPs : undefined);
        });
        return buildNode(theme.code, theme.name || theme.code, 'theme', childModules.length > 0 ? childModules : undefined);
      });
      return buildNode(subj.code, subj.name || subj.code, 'subject', childThemes.length > 0 ? childThemes : undefined);
    });
  }, [graphData]);

  const handleNodeClick = useCallback(async (nodeCode: string) => {
    setSelectedNode(nodeCode);
    setTraceLoading(true);
    setRelatedLoading(true);
    try {
      const [traceRes, relatedRes] = await Promise.all([
        knowledgeApi.trace(nodeCode),
        knowledgeApi.related(nodeCode),
      ]);
      setTraceResult(traceRes);
      if (traceRes.prerequisite_chains.length > 0) {
        const longestChain = traceRes.prerequisite_chains.reduce((a, b) => a.depth > b.depth ? a : b);
        setHighlightPath(longestChain.chain.map(n => n.code));
      } else {
        setHighlightPath([nodeCode]);
      }
      setRelatedEntities(relatedRes.related || []);
    } catch (e) {
      console.error('Trace/Related failed:', e);
      setHighlightPath([nodeCode]);
      setRelatedEntities([]);
    } finally {
      setTraceLoading(false);
      setRelatedLoading(false);
    }
  }, []);

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const code = selectedKeys[0] as string;
      handleNodeClick(code);
    }
  };

  const handleTreeRightClick = ({ node }: { node: { key: React.Key } }) => {
    setAddParentCode(String(node.key));
  };

  const handleAddEntity = () => {
    addForm.resetFields();
    setAddModalOpen(true);
  };

  const handleAddEntitySubmit = async () => {
    try {
      const values = await addForm.validateFields();
      await knowledgeApi.createEntity(values.type, values.name, {
        parent_code: addParentCode,
        description: values.description || '',
      });
      message.success('实体添加成功');
      setAddModalOpen(false);
      handleSync();
    } catch {
      message.error('添加失败');
    }
  };

  const handleAddRelation = () => {
    relationForm.resetFields();
    setRelationModalOpen(true);
  };

  const handleAddRelationSubmit = async () => {
    try {
      const values = await relationForm.validateFields();
      await knowledgeApi.createRelation(values.source, values.target, values.relationType);
      message.success('关系添加成功');
      setRelationModalOpen(false);
      handleSync();
    } catch {
      message.error('添加失败');
    }
  };

  const handleCloseDetail = () => {
    setSelectedNode(null);
    setHighlightPath([]);
    setTraceResult(null);
    setRelatedEntities([]);
  };

  const selectedNodeData = graphData?.nodes.find(n => n.code === selectedNode);
  const entityCounts = graphData?.stats.entity_counts || {};
  const incomingRelations = relatedEntities.filter(r => r.direction === 'incoming');
  const outgoingRelations = relatedEntities.filter(r => r.direction === 'outgoing');

  // 计算掌握率统计
  const masteryStats = useMemo(() => {
    if (!graphData) return { total: 0, weak: 0, partial: 0, mastered: 0, avgMastery: 0 };
    const kpNodes = graphData.nodes.filter(n => n.type === 'KnowledgePoint' && n.mastery_rate != null);
    const total = kpNodes.length;
    const weak = kpNodes.filter(n => n.mastery_rate! < 0.3).length;
    const partial = kpNodes.filter(n => n.mastery_rate! >= 0.3 && n.mastery_rate! < 0.6).length;
    const mastered = kpNodes.filter(n => n.mastery_rate! >= 0.6).length;
    const avgMastery = total > 0 ? kpNodes.reduce((s, n) => s + n.mastery_rate!, 0) / total : 0;
    return { total, weak, partial, mastered, avgMastery };
  }, [graphData]);

  // 过滤后的图谱数据
  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;
    if (filterType === 'all' && filterMastery === 'all') return graphData;

    let filteredNodes = graphData.nodes;
    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.type === filterType);
    }
    if (filterMastery === 'weak') {
      filteredNodes = filteredNodes.filter(n => n.mastery_rate != null && n.mastery_rate < 0.3);
    } else if (filterMastery === 'partial') {
      filteredNodes = filteredNodes.filter(n => n.mastery_rate != null && n.mastery_rate >= 0.3 && n.mastery_rate < 0.6);
    } else if (filterMastery === 'mastered') {
      filteredNodes = filteredNodes.filter(n => n.mastery_rate != null && n.mastery_rate >= 0.6);
    }

    const nodeCodes = new Set(filteredNodes.map(n => n.code));
    const filteredEdges = graphData.edges.filter(e => nodeCodes.has(e.source) && nodeCodes.has(e.target));

    return {
      ...graphData,
      nodes: filteredNodes,
      edges: filteredEdges,
      stats: {
        ...graphData.stats,
        total_nodes: filteredNodes.length,
        total_edges: filteredEdges.length,
      },
    };
  }, [graphData, filterType, filterMastery]);

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>知识中心</Typography.Title>
          <Typography.Text type="secondary">知识体系管理 · 关系发现 · 掌握率分析</Typography.Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleAddEntity}>新增实体</Button>
          <Button icon={<LinkOutlined />} onClick={handleAddRelation}>新增关系</Button>
          <Button icon={<SyncOutlined />} onClick={handleSync} loading={loading}>同步</Button>
        </Space>
      </Flex>

      <Row gutter={12} style={{ marginBottom: 12, flexShrink: 0 }}>
        <Col span={4}><Card size="small"><Statistic title="实体" value={graphData?.stats.total_nodes || 0} valueStyle={{ fontSize: 18 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="关系" value={graphData?.stats.total_edges || 0} valueStyle={{ fontSize: 18, color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="知识点" value={entityCounts.KnowledgePoint || 0} valueStyle={{ fontSize: 18, color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="考点" value={entityCounts.ExamPoint || 0} valueStyle={{ fontSize: 18, color: '#eb2f96' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="薄弱知识点" value={masteryStats.weak} valueStyle={{ fontSize: 18, color: masteryStats.weak > 0 ? '#ff4d4f' : '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="平均掌握率" value={Math.round(masteryStats.avgMastery * 100)} suffix="%" valueStyle={{ fontSize: 18, color: masteryStats.avgMastery >= 0.6 ? '#52c41a' : '#faad14' }} /></Card></Col>
      </Row>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {/* 左侧：目录树 */}
        <div style={{ width: 260, flexShrink: 0, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <Input
              placeholder="搜索知识点..."
              prefix={<SearchOutlined />}
              size="small"
              allowClear
              value={searchValue}
              onChange={e => {
                const val = e.target.value;
                setSearchValue(val);
                if (val) {
                  const matched = graphData?.nodes
                    .filter(n => (n.name || '').toLowerCase().includes(val.toLowerCase()) || n.code.toLowerCase().includes(val.toLowerCase()))
                    .map(n => n.code) || [];
                  setExpandedKeys([...new Set([...matched])]);
                  setAutoExpandParent(true);
                }
              }}
            />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : treeData.length > 0 ? (
              <Tree
                showIcon
                blockNode
                treeData={treeData}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                selectedKeys={selectedNode ? [selectedNode] : []}
                onExpand={keys => { setExpandedKeys(keys as string[]); setAutoExpandParent(false); }}
                onSelect={handleTreeSelect}
                onRightClick={handleTreeRightClick}
                style={{ fontSize: 13 }}
              />
            ) : (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
            )}
          </div>
        </div>

        {/* 中间：知识图谱 */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                <ApartmentOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                关系图谱
              </Typography.Text>
              <Select
                size="small"
                value={filterType}
                onChange={setFilterType}
                style={{ width: 110 }}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'KnowledgePoint', label: '知识点' },
                  { value: 'ExamPoint', label: '考点' },
                  { value: 'ExamMethod', label: '考法' },
                ]}
              />
              <Select
                size="small"
                value={filterMastery}
                onChange={setFilterMastery}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部掌握率' },
                  { value: 'weak', label: '薄弱 (<30%)' },
                  { value: 'partial', label: '部分 (30-60%)' },
                  { value: 'mastered', label: '已掌握 (≥60%)' },
                ]}
              />
            </Space>
            <Space size={4}>
              {(filterType !== 'all' || filterMastery !== 'all') && (
                <Button size="small" onClick={() => { setFilterType('all'); setFilterMastery('all'); }}>清除筛选</Button>
              )}
              {highlightPath.length > 0 && (
                <Tooltip title="清除高亮">
                  <Button size="small" onClick={() => setHighlightPath([])}>清除路径</Button>
                </Tooltip>
              )}
            </Space>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>
            ) : filteredGraphData && filteredGraphData.nodes.length > 0 ? (
              <KnowledgeGraph data={filteredGraphData} onNodeClick={handleNodeClick} highlightPath={highlightPath} />
            ) : (
              <Empty description={graphData ? '筛选后无匹配节点，请调整筛选条件' : '暂无图谱数据，请先导入课标'} style={{ padding: 60 }} />
            )}
          </div>
        </div>

        {/* 右侧：详情面板 */}
        <div style={{ width: selectedNode ? 320 : 0, flexShrink: 0, transition: 'width 0.3s', overflow: 'hidden', background: '#fff', border: selectedNode ? '1px solid #d9d9d9' : 'none', borderRadius: 8 }}>
          {selectedNode && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text strong ellipsis style={{ maxWidth: 200, fontSize: 14 }}>
                  {selectedNodeData?.name || selectedNode}
                </Typography.Text>
                <Button size="small" type="text" onClick={handleCloseDetail}>✕</Button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {selectedNodeData && (
                  <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="编码"><code style={{ fontSize: 11 }}>{selectedNodeData.code}</code></Descriptions.Item>
                    <Descriptions.Item label="类型">
                      <Tag color="blue">{ENTITY_LABELS[selectedNodeData.type] || selectedNodeData.type}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="认知层级">
                      {selectedNodeData.cognitive_level ? <Tag>{selectedNodeData.cognitive_level}</Tag> : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="掌握率">
                      {selectedNodeData.mastery_rate != null ? (
                        <Badge color={selectedNodeData.mastery_rate >= 0.8 ? '#52c41a' : selectedNodeData.mastery_rate >= 0.5 ? '#faad14' : '#ff4d4f'} text={`${(selectedNodeData.mastery_rate * 100).toFixed(0)}%`} />
                      ) : '无数据'}
                    </Descriptions.Item>
                    <Descriptions.Item label="来源">
                      <Tag>{selectedNodeData.source_type === 'courseware_custom' ? '课件自定义' : '课程标准'}</Tag>
                    </Descriptions.Item>
                    {selectedNodeData.description && (
                      <Descriptions.Item label="描述">
                        <Typography.Paragraph style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 3 }}>
                          {selectedNodeData.description}
                        </Typography.Paragraph>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                )}

                {(traceLoading || relatedLoading) ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
                ) : (
                  <>
                    {traceResult && (
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text strong style={{ fontSize: 13, color: '#ff4d4f' }}>
                          🔍 前驱追溯路径
                        </Typography.Text>
                        {traceResult.prerequisite_chains.length > 0 ? (
                          <Collapse size="small" style={{ marginTop: 8 }}
                            items={traceResult.prerequisite_chains.map((chain, i) => ({
                              key: i,
                              label: <span style={{ fontSize: 12 }}>路径{i + 1} (深度{chain.depth})</span>,
                              children: (
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                  {chain.chain.map((node, j) => (
                                    <span key={node.code}>
                                      <Tag color={j === 0 ? 'error' : 'processing'} style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => handleNodeClick(node.code)}>
                                        {node.name}
                                      </Tag>
                                      {j < chain.chain.length - 1 && <ArrowRightOutlined style={{ fontSize: 9, color: '#999' }} />}
                                    </span>
                                  ))}
                                </div>
                              ),
                            }))}
                          />
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>无前驱依赖</Typography.Text>
                        )}

                        {traceResult.downstream.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <Typography.Text strong style={{ fontSize: 13, color: '#1677ff' }}>
                              📡 下游影响 ({traceResult.downstream_count})
                            </Typography.Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {traceResult.downstream.slice(0, 20).map(code => {
                                const node = graphData?.nodes.find(n => n.code === code);
                                return (
                                  <Tag key={code} color="processing" style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => handleNodeClick(code)}>
                                    {node?.name || code}
                                  </Tag>
                                );
                              })}
                              {traceResult.downstream.length > 20 && (
                                <Tag style={{ fontSize: 11 }}>+{traceResult.downstream.length - 20}...</Tag>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {relatedEntities.length > 0 && (
                      <div>
                        <Divider style={{ margin: '12px 0' }} />
                        <Typography.Text strong style={{ fontSize: 13 }}>🔗 关联实体</Typography.Text>
                        {incomingRelations.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>入向</Typography.Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {incomingRelations.slice(0, 10).map((rel, i) => (
                                <Tag key={`in-${i}`} color="orange" style={{ fontSize: 11 }}>
                                  {RELATION_LABELS[rel.type] || rel.type}: {rel.source_entity?.name || rel.source}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                        {outgoingRelations.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>出向</Typography.Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {outgoingRelations.slice(0, 10).map((rel, i) => (
                                <Tag key={`out-${i}`} color="green" style={{ fontSize: 11 }}>
                                  {RELATION_LABELS[rel.type] || rel.type}: {rel.target_entity?.name || rel.target}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal title="新增知识实体" open={addModalOpen} onOk={handleAddEntitySubmit} onCancel={() => setAddModalOpen(false)} width={480}>
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：大气环流" />
          </Form.Item>
          <Form.Item name="type" label="实体类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="选择类型" options={[
              { value: 'KnowledgePoint', label: '知识点' },
              { value: 'ExamPoint', label: '考点' },
              { value: 'ExamMethod', label: '考法' },
              { value: 'CoreCompetency', label: '核心素养' },
              { value: 'TeachingMaterial', label: '教学资料' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选描述" />
          </Form.Item>
          {addParentCode && (
            <Form.Item label="父节点">
              <Input value={addParentCode} disabled />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal title="新增知识关系" open={relationModalOpen} onOk={handleAddRelationSubmit} onCancel={() => setRelationModalOpen(false)} width={480}>
        <Form form={relationForm} layout="vertical">
          <Form.Item name="source" label="源节点编码" rules={[{ required: true, message: '请输入源节点' }]}>
            <Input placeholder="如：GEO_CLIMATE_001" />
          </Form.Item>
          <Form.Item name="target" label="目标节点编码" rules={[{ required: true, message: '请输入目标节点' }]}>
            <Input placeholder="如：GEO_CLIMATE_002" />
          </Form.Item>
          <Form.Item name="relationType" label="关系类型" rules={[{ required: true, message: '请选择关系类型' }]}>
            <Select placeholder="选择关系类型" options={Object.entries(RELATION_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeCenter;