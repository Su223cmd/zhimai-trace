import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Card, Row, Col, Statistic, Space, Descriptions, Tag, Spin, Empty, Collapse, Flex, Divider } from 'antd';
import { SyncOutlined, ArrowRightOutlined, ExperimentOutlined, BulbOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../../services/api';
import KnowledgeGraph from '../../components/KnowledgeGraph';
import type { KnowledgeGraphDataV2, TraceResult, RelatedEntity, OntologyInfo } from '../../types';

const ENTITY_LABELS: Record<string, string> = {
  KnowledgePoint: '知识点',
  Question: '试题',
  TeachingMaterial: '教学资料',
  LearningActivity: '学习活动',
  CoreCompetency: '核心素养',
  ExternalData: '外部数据',
  ExamPoint: '考点',
  ExamMethod: '考法',
  Subject: '学科',
};

const RELATION_LABELS: Record<string, string> = {
  PREREQUISITE_OF: '前置依赖',
  CONTAINS: '包含',
  SIMILAR_TO: '相似',
  EXAMINES: '考查',
  ASSOCIATED_WITH: '关联资料',
  INVOLVES: '涉及',
  SUPPORTS: '支撑',
  APPLIES: '应用',
  REQUIRES: '需要',
  PART_OF: '属于',
  CONTRASTS_WITH: '对比',
  HAS_EXAM_POINT: '包含考点',
  EXAM_POINT_OF: '属于知识点',
  TESTED_BY_METHOD: '考法',
  METHOD_FOR_EXAM: '用于考点',
};

const KnowledgeOverview = () => {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<KnowledgeGraphDataV2 | null>(null);
  const [ontologyInfo, setOntologyInfo] = useState<OntologyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [relatedEntities, setRelatedEntities] = useState<RelatedEntity[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[]>([]);
  const fetchCountRef = useRef(0);

  useEffect(() => {
    const currentCount = ++fetchCountRef.current;
    let cancelled = false;

    Promise.all([
      knowledgeApi.graph(),
      knowledgeApi.ontology(),
    ])
      .then(([graphRes, ontologyRes]) => {
        if (!cancelled && currentCount === fetchCountRef.current) {
          setGraphData(graphRes);
          setOntologyInfo(ontologyRes);
        }
      })
      .catch((e) => {
        console.error('Failed to fetch graph:', e);
      })
      .finally(() => {
        if (!cancelled && currentCount === fetchCountRef.current) {
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      await knowledgeApi.sync();
      const [graphRes, ontologyRes] = await Promise.all([
        knowledgeApi.graph(),
        knowledgeApi.ontology(),
      ]);
      setGraphData(graphRes);
      setOntologyInfo(ontologyRes);
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = async (nodeCode: string) => {
    setSelectedNode(nodeCode);
    setTraceLoading(true);
    setRelatedLoading(true);
    try {
      const result = await knowledgeApi.trace(nodeCode);
      setTraceResult(result);
      if (result.prerequisite_chains.length > 0) {
        const longestChain = result.prerequisite_chains.reduce((a, b) => a.depth > b.depth ? a : b);
        setHighlightPath(longestChain.chain.map((n) => n.code));
      } else {
        setHighlightPath([nodeCode]);
      }
    } catch (e) {
      console.error('Trace failed:', e);
      setHighlightPath([nodeCode]);
    } finally {
      setTraceLoading(false);
    }

    try {
      const relatedRes = await knowledgeApi.related(nodeCode);
      setRelatedEntities(relatedRes.related || []);
    } catch (e) {
      console.error('Related fetch failed:', e);
      setRelatedEntities([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedNode(null);
    setHighlightPath([]);
    setTraceResult(null);
    setRelatedEntities([]);
  };

  const selectedNodeData = graphData?.nodes.find((n) => n.code === selectedNode);

  const entityCounts = graphData?.stats.entity_counts || {};
  const relationCounts = graphData?.stats.relation_counts || {};

  const incomingRelations = relatedEntities.filter(r => r.direction === 'incoming');
  const outgoingRelations = relatedEntities.filter(r => r.direction === 'outgoing');

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>知识图谱</Typography.Title>
          <Typography.Text type="secondary">基于 JY/T 国标本体的知识体系与掌握率分析</Typography.Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={handleSync} loading={loading}>
            同步图谱
          </Button>
        </Space>
      </Flex>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card><Statistic title="实体总数" value={graphData?.stats.total_nodes || 0} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="关系总数" value={graphData?.stats.total_edges || 0} valueStyle={{ color: 'var(--color-cdm-high)' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="知识点" value={entityCounts.KnowledgePoint || 0} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="试题" value={entityCounts.Question || 0} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="教学资料" value={entityCounts.TeachingMaterial || 0} valueStyle={{ color: '#13c2c2' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="核心素养" value={entityCounts.CoreCompetency || 0} valueStyle={{ color: '#eb2f96' }} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={selectedNode ? 16 : 24}>
          <Card title="知识图谱可视化" styles={{ body: { padding: 0 } }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
                <Spin size="large" />
              </div>
            ) : graphData && graphData.nodes.length > 0 ? (
              <KnowledgeGraph
                data={graphData}
                onNodeClick={handleNodeClick}
                highlightPath={highlightPath}
              />
            ) : (
              <Empty description="暂无知识图谱数据，请先导入课程标准或上传课件" style={{ padding: 60 }} />
            )}
          </Card>

          <div style={{ marginTop: 8, padding: '8px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11 }}>实体类型：</span>
            {Object.entries({ KnowledgePoint: { fill: '#1890ff', label: '知识点' }, CoreCompetency: { fill: '#eb2f96', label: '核心素养' }, TeachingMaterial: { fill: '#13c2c2', label: '教学资料' }, Question: { fill: '#722ed1', label: '试题' }, LearningActivity: { fill: '#fa8c16', label: '学习活动' }, ExternalData: { fill: '#8c8c8c', label: '外部数据' }, ExamPoint: { fill: '#eb2f96', label: '考点' }, ExamMethod: { fill: '#722ed1', label: '考法' } }).map(([type, style]) => (
              <span key={type} style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: style.fill, verticalAlign: 'middle', marginRight: 3 }} />
                {style.label}
              </span>
            ))}
            <span style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11 }}>掌握率：</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#52c41a', marginRight: 3 }} />≥80%</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#faad14', marginRight: 3 }} />50-80%</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ff4d4f', marginRight: 3 }} />&lt;50%</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#d9d9d9', marginRight: 3 }} />无数据</span>
          </div>

          {ontologyInfo && (
            <Card title="本体信息 (JY/T 国标)" style={{ marginTop: 16 }} size="small">
              <Row gutter={24}>
                <Col span={12}>
                  <Typography.Text strong style={{ fontSize: 13 }}>实体类型 ({ontologyInfo.entity_types.length})</Typography.Text>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ontologyInfo.entity_types.map((type) => (
                      <Tag key={type} color="blue">{ENTITY_LABELS[type] || type} ({entityCounts[type] || 0})</Tag>
                    ))}
                  </div>
                </Col>
                <Col span={12}>
                  <Typography.Text strong style={{ fontSize: 13 }}>关系类型 ({Object.keys(ontologyInfo.relation_types).length})</Typography.Text>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(ontologyInfo.relation_types).map(([type, _def]) => (
                      <Tag key={type} color="geekblue">
                        {RELATION_LABELS[type] || type} ({relationCounts[type] || 0})
                      </Tag>
                    ))}
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {selectedNode && (
          <Col span={8}>
            <Card
              title={selectedNodeData?.name || selectedNode}
              extra={<Button size="small" onClick={handleCloseDetail}>关闭</Button>}
              style={{ maxHeight: 700, overflow: 'auto' }}
            >
              {selectedNodeData && (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="编码">{selectedNodeData.code}</Descriptions.Item>
                  <Descriptions.Item label="实体类型">
                    <Tag color="blue">{ENTITY_LABELS[selectedNodeData.type] || selectedNodeData.type}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="认知层级">
                    {selectedNodeData.cognitive_level ? <Tag color="blue">{selectedNodeData.cognitive_level}</Tag> : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="掌握率">
                    {selectedNodeData.mastery_rate ? `${(selectedNodeData.mastery_rate * 100).toFixed(0)}%` : '无数据'}
                  </Descriptions.Item>
                  <Descriptions.Item label="来源">
                    <Tag>{selectedNodeData.source_type || '课程标准'}</Tag>
                  </Descriptions.Item>
                  {selectedNodeData.description && (
                    <Descriptions.Item label="描述">{selectedNodeData.description}</Descriptions.Item>
                  )}
                </Descriptions>
              )}

              {traceLoading ? (
                <Spin />
              ) : traceResult ? (
                <div style={{ marginTop: 16 }}>
                  <Typography.Title level={5}>前驱追溯路径</Typography.Title>
                  {traceResult.prerequisite_chains.length > 0 ? (
                    <Collapse
                      size="small"
                      items={traceResult.prerequisite_chains.map((chain, i) => ({
                        key: i,
                        label: `路径${i + 1} (深度${chain.depth})`,
                        children: (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                            {chain.chain.map((node, j) => (
                              <span key={node.code}>
                                <Tag color={j === 0 ? 'red' : 'blue'}>{node.name}</Tag>
                                {j < chain.chain.length - 1 && <ArrowRightOutlined style={{ fontSize: 10 }} />}
                              </span>
                            ))}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Typography.Text type="secondary">该知识点无前驱依赖</Typography.Text>
                  )}

                  {traceResult.downstream.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Title level={5}>下游影响 ({traceResult.downstream_count})</Typography.Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {traceResult.downstream.map((code) => {
                          const node = graphData?.nodes.find((n) => n.code === code);
                          return <Tag key={code} color="processing">{node?.name || code}</Tag>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <Divider style={{ margin: '12px 0' }} />

              {relatedLoading ? (
                <Spin />
              ) : relatedEntities.length > 0 ? (
                <div>
                  <Typography.Title level={5}>关联实体</Typography.Title>
                  {selectedNodeData?.type === 'KnowledgePoint' && (
                    <div style={{ marginBottom: 12 }}>
                      <Space>
                        <Button size="small" icon={<ExperimentOutlined />} onClick={() => navigate('/diagnosis-center')}>
                          查看诊断
                        </Button>
                        <Button size="small" icon={<BulbOutlined />} onClick={() => navigate('/teaching-decision')}>
                          教学建议
                        </Button>
                      </Space>
                    </div>
                  )}
                  {incomingRelations.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>入向关系</Typography.Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {incomingRelations.map((rel, i) => {
                          const entity = rel.source_entity;
                          return (
                            <Tag key={`in-${i}`} color="orange">
                              {RELATION_LABELS[rel.type] || rel.type}: {entity?.name || rel.source}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {outgoingRelations.length > 0 && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>出向关系</Typography.Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {outgoingRelations.map((rel, i) => {
                          const entity = rel.target_entity;
                          return (
                            <Tag key={`out-${i}`} color="green">
                              {RELATION_LABELS[rel.type] || rel.type}: {entity?.name || rel.target}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : !relatedLoading ? (
                <Typography.Text type="secondary">暂无关联实体</Typography.Text>
              ) : null}
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
};

export default KnowledgeOverview;
