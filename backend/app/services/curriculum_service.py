from typing import Optional
import json
import os
import logging
from sqlalchemy.orm import Session
from app.models.db_models import CurriculumStandard, Project
from app.services.knowledge_service import init_from_curriculum

logger = logging.getLogger(__name__)

GEOGRAPHY_CURRICULUM = None


def _get_curriculum_json_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "data", "curriculum", "geography.json")


def _load_geography_curriculum() -> dict:
    global GEOGRAPHY_CURRICULUM
    if GEOGRAPHY_CURRICULUM is not None:
        return GEOGRAPHY_CURRICULUM

    json_path = _get_curriculum_json_path()
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                GEOGRAPHY_CURRICULUM = json.load(f)
            logger.info("Loaded curriculum from %s", json_path)
            return GEOGRAPHY_CURRICULUM
        except Exception as e:
            logger.error("Failed to load curriculum JSON: %s", str(e))

    GEOGRAPHY_CURRICULUM = _get_builtin_curriculum()
    logger.warning("Using built-in curriculum data (JSON file not found or invalid)")
    return GEOGRAPHY_CURRICULUM


def _get_builtin_curriculum() -> dict:
    return {
    "subject_code": "GEO",
    "subject_name": "地理",
    "version": "JYT-2025",
    "themes": [
        {
            "code": "GEO-T01",
            "name": "自然地理",
            "description": "自然地理基础——认识自然环境的组成、结构、功能及演化规律",
            "modules": [
                {
                    "code": "GEO-B1-C01",
                    "name": "必修一第一章 宇宙中的地球",
                    "semester": "高一上",
                    "textbook_ref": "人教版必修一P1-20",
                    "knowledge_points": [
                        {"code": "GEO-B1-C01-KP01", "name": "天体系统", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-01-01", "description": "天体系统的层次和级别"},
                        {"code": "GEO-B1-C01-KP02", "name": "太阳系", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-01-02", "description": "太阳系的组成和行星特征"},
                        {"code": "GEO-B1-C01-KP03", "name": "地球运动", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-03", "description": "地球自转和公转的运动特征"},
                        {"code": "GEO-B1-C01-KP04", "name": "地球自转", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-04", "description": "地球自转的方向、周期和速度"},
                        {"code": "GEO-B1-C01-KP05", "name": "地球公转", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-05", "description": "地球公转的轨道、周期和速度"},
                        {"code": "GEO-B1-C01-KP06", "name": "黄赤交角", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-06", "description": "黄道面与赤道面的夹角及其意义"},
                        {"code": "GEO-B1-C01-KP07", "name": "太阳直射点移动", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-07", "description": "太阳直射点在南北回归线间的移动规律"},
                        {"code": "GEO-B1-C01-KP08", "name": "昼夜长短变化", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-01-08", "description": "昼夜长短随纬度和季节的变化规律",
                         "exam_points": [
                            {"name": "昼夜长短分布规律", "description": "不同季节全球昼夜长短的纬度分布规律", "frequency": 5, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "选择题判断昼夜分布", "question_type": "choice", "description": "根据日期判断南北半球昼夜长短状况"},
                                {"name": "综合题分析昼夜变化", "question_type": "essay", "description": "结合太阳直射点移动分析昼夜长短变化过程"},
                            ]},
                            {"name": "昼夜长短计算", "description": "根据日出日落时间计算昼长夜长", "frequency": 4, "difficulty": 0.7,
                             "exam_methods": [
                                {"name": "选择题计算昼长", "question_type": "choice", "description": "根据日出日落时间计算当地昼长"},
                                {"name": "读图题判读日照图", "question_type": "graph", "description": "读日照图判断昼夜长短和日出日落时间"},
                            ]},
                            {"name": "极昼极夜现象", "description": "极昼极夜的纬度范围及变化规律", "frequency": 3, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "选择题判断极昼极夜范围", "question_type": "choice", "description": "根据日期判断极昼极夜的纬度范围"},
                            ]},
                        ]},
                        {"code": "GEO-B1-C01-KP09", "name": "正午太阳高度角", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-01-09", "description": "正午太阳高度角的分布和变化规律"},
                        {"code": "GEO-B1-C01-KP10", "name": "四季更替", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-01-10", "description": "四季的形成原因和划分"},
                        {"code": "GEO-B1-C01-KP11", "name": "地球圈层结构", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-01-11", "description": "地球内部和外部圈层结构"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B1-C01-KP01", "GEO-B1-C01-KP02"]},
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B1-C01-KP03", "GEO-B1-C01-KP06", "GEO-B1-C01-KP07"]},
                    ],
                },
                {
                    "code": "GEO-B1-C02",
                    "name": "必修一第二章 大气",
                    "semester": "高一上",
                    "textbook_ref": "人教版必修一P21-60",
                    "knowledge_points": [
                        {"code": "GEO-B1-C02-KP01", "name": "大气受热过程", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-02-01", "description": "太阳辐射、地面辐射和大气辐射的转换过程",
                         "exam_points": [
                            {"name": "大气受热过程三环节", "description": "太阳辐射→地面吸收→大气辐射的三个环节", "frequency": 5, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "选择题判断辐射类型", "question_type": "choice", "description": "给出辐射过程描述，判断属于哪种辐射"},
                                {"name": "综合题分析受热过程", "question_type": "essay", "description": "结合图表分析大气受热过程各环节"},
                            ]},
                            {"name": "大气逆辐射保温作用", "description": "大气逆辐射对地面的保温效应", "frequency": 4, "difficulty": 0.5,
                             "exam_methods": [
                                {"name": "选择题判断保温效应", "question_type": "choice", "description": "判断大气逆辐射的保温作用场景"},
                                {"name": "读图题判读气温变化", "question_type": "graph", "description": "读气温日变化图分析保温作用"},
                            ]},
                            {"name": "大气削弱作用", "description": "大气对太阳辐射的吸收、反射和散射作用", "frequency": 3, "difficulty": 0.5,
                             "exam_methods": [
                                {"name": "选择题判断削弱方式", "question_type": "choice", "description": "给出现象判断属于哪种削弱作用"},
                            ]},
                        ]},
                        {"code": "GEO-B1-C02-KP02", "name": "大气逆辐射", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-02", "description": "大气对地面的保温效应"},
                        {"code": "GEO-B1-C02-KP03", "name": "热力环流", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-03", "description": "冷热不均引起的大气运动"},
                        {"code": "GEO-B1-C02-KP04", "name": "等值线判读", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-04", "description": "等压线、等温线等值线的判读方法",
                         "exam_points": [
                            {"name": "等压线判读", "description": "等压线图中高压、低压、锋面的识别与判读", "frequency": 5, "difficulty": 0.7,
                             "exam_methods": [
                                {"name": "选择题判断气压场", "question_type": "choice", "description": "根据等压线图判断高压脊、低压槽等气压场"},
                                {"name": "综合题分析风向风力", "question_type": "essay", "description": "结合等压线图判断风向及风力大小"},
                            ]},
                            {"name": "等温线判读", "description": "等温线图中温度分布规律及影响因素分析", "frequency": 4, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "选择题判断温度分布", "question_type": "choice", "description": "根据等温线弯曲判断地形或洋流影响"},
                                {"name": "读图题分析影响因素", "question_type": "graph", "description": "读等温线图分析影响温度分布的因素"},
                            ]},
                            {"name": "等值线疏密与数值变化", "description": "等值线疏密反映要素变化程度及递变规律", "frequency": 3, "difficulty": 0.5,
                             "exam_methods": [
                                {"name": "选择题判断变化梯度", "question_type": "choice", "description": "根据等值线疏密判断要素变化梯度"},
                            ]},
                        ]},
                        {"code": "GEO-B1-C02-KP05", "name": "气压带风带", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-02-05", "description": "全球气压带和风带的分布规律"},
                        {"code": "GEO-B1-C02-KP06", "name": "气候类型判断", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-02-06", "description": "根据气温降水特征判断气候类型",
                         "exam_points": [
                            {"name": "气温降水特征判读", "description": "根据气温曲线和降水柱状图判读气候特征", "frequency": 5, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "选择题判断气候类型", "question_type": "choice", "description": "根据气温降水数据或图表判断气候类型"},
                                {"name": "综合题分析气候成因", "question_type": "essay", "description": "结合区域图分析气候类型成因及特征"},
                            ]},
                            {"name": "气候类型分布规律", "description": "世界主要气候类型的分布规律与纬度位置关系", "frequency": 4, "difficulty": 0.5,
                             "exam_methods": [
                                {"name": "选择题判断分布区域", "question_type": "choice", "description": "根据地理位置判断可能出现的气候类型"},
                            ]},
                            {"name": "特殊气候成因", "description": "非地带性气候的成因分析", "frequency": 3, "difficulty": 0.8,
                             "exam_methods": [
                                {"name": "综合题分析特殊气候", "question_type": "essay", "description": "分析非地带性气候的形成原因及特征"},
                                {"name": "选择题判断影响因素", "question_type": "choice", "description": "判断特殊气候形成的主导因素"},
                            ]},
                        ]},
                        {"code": "GEO-B1-C02-KP07", "name": "气温降水读图", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-07", "description": "气温曲线和降水柱状图的判读"},
                        {"code": "GEO-B1-C02-KP08", "name": "大气环流", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-02-08", "description": "三圈环流的形成和分布"},
                        {"code": "GEO-B1-C02-KP09", "name": "季风环流", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-02-09", "description": "东亚季风和南亚季风的形成与特征"},
                        {"code": "GEO-B1-C02-KP10", "name": "锋面系统", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-10", "description": "冷锋、暖锋、准静止锋的特征和天气"},
                        {"code": "GEO-B1-C02-KP11", "name": "气旋反气旋", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-02-11", "description": "低压气旋和高压反气旋的气流和天气"},
                        {"code": "GEO-B1-C02-KP12", "name": "温室效应", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-02-12", "description": "温室气体对全球气候的影响"},
                        {"code": "GEO-B1-C02-KP13", "name": "大气污染", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-02-13", "description": "大气污染物的来源、扩散和治理"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC03", "name": "地理实践力", "description": "运用地理工具和方法进行观察和实验", "knowledge_points": ["GEO-B1-C02-KP03", "GEO-B1-C02-KP04"]},
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B1-C02-KP01", "GEO-B1-C02-KP06", "GEO-B1-C02-KP08"]},
                    ],
                },
                {
                    "code": "GEO-B1-C03",
                    "name": "必修一第三章 水循环",
                    "semester": "高一上",
                    "textbook_ref": "人教版必修一P61-85",
                    "knowledge_points": [
                        {"code": "GEO-B1-C03-KP01", "name": "水循环", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-03-01", "description": "水循环的过程和意义"},
                        {"code": "GEO-B1-C03-KP02", "name": "洋流", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-03-02", "description": "世界洋流的分布规律及影响"},
                        {"code": "GEO-B1-C03-KP03", "name": "河流补给", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-03-03", "description": "河流的主要补给类型和特点"},
                        {"code": "GEO-B1-C03-KP04", "name": "水文特征", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-03-04", "description": "河流水文特征的分析方法"},
                        {"code": "GEO-B1-C03-KP05", "name": "水资源", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-03-05", "description": "水资源的分布和合理利用"},
                        {"code": "GEO-B1-C03-KP06", "name": "厄尔尼诺现象", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-03-06", "description": "厄尔尼诺和拉尼娜现象的影响"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B1-C03-KP02", "GEO-B1-C03-KP05"]},
                        {"code": "GEO-CC03", "name": "地理实践力", "description": "运用地理工具和方法进行观察和实验", "knowledge_points": ["GEO-B1-C03-KP04"]},
                    ],
                },
                {
                    "code": "GEO-B1-C04",
                    "name": "必修一第四章 地表形态",
                    "semester": "高一上",
                    "textbook_ref": "人教版必修一P86-120",
                    "knowledge_points": [
                        {"code": "GEO-B1-C04-KP01", "name": "内力作用", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-04-01", "description": "地壳运动、岩浆活动、变质作用"},
                        {"code": "GEO-B1-C04-KP02", "name": "外力作用", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-04-02", "description": "风化、侵蚀、搬运、堆积作用"},
                        {"code": "GEO-B1-C04-KP03", "name": "板块构造", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-04-03", "description": "板块构造学说与地貌形成"},
                        {"code": "GEO-B1-C04-KP04", "name": "褶皱构造", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-04-04", "description": "背斜和向斜的判读与地貌"},
                        {"code": "GEO-B1-C04-KP05", "name": "断层构造", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-04-05", "description": "断层的判读与地貌"},
                        {"code": "GEO-B1-C04-KP06", "name": "河流地貌", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-04-06", "description": "河流侵蚀和堆积地貌"},
                        {"code": "GEO-B1-C04-KP07", "name": "喀斯特地貌", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-04-07", "description": "喀斯特地貌的形成和特征"},
                        {"code": "GEO-B1-C04-KP08", "name": "风沙地貌", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-04-08", "description": "风力侵蚀和堆积地貌"},
                        {"code": "GEO-B1-C04-KP09", "name": "海岸地貌", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-04-09", "description": "海蚀和海积地貌"},
                        {"code": "GEO-B1-C04-KP10", "name": "地貌判读", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-04-10", "description": "等高线地形图判读和地貌识别",
                         "exam_points": [
                            {"name": "等高线地形图判读", "description": "等高线地形图中地形部位识别与高程计算", "frequency": 5, "difficulty": 0.7,
                             "exam_methods": [
                                {"name": "选择题判断地形部位", "question_type": "choice", "description": "根据等高线图判断山顶、山谷、山脊、鞍部等"},
                                {"name": "综合题计算相对高度", "question_type": "essay", "description": "结合等高线图计算两点间相对高度与温差"},
                            ]},
                            {"name": "地形剖面图绘制与判读", "description": "地形剖面图的绘制方法及判读", "frequency": 3, "difficulty": 0.6,
                             "exam_methods": [
                                {"name": "读图题判读剖面图", "question_type": "graph", "description": "根据地形剖面图判断地形特征和通视情况"},
                            ]},
                            {"name": "等高线与地貌综合判读", "description": "结合等高线图识别河流地貌、喀斯特地貌等", "frequency": 4, "difficulty": 0.8,
                             "exam_methods": [
                                {"name": "综合题分析地貌成因", "question_type": "essay", "description": "结合等高线图和地质信息分析地貌成因"},
                                {"name": "选择题判断地貌类型", "question_type": "choice", "description": "根据等高线特征判断典型地貌类型"},
                            ]},
                        ]},
                        {"code": "GEO-B1-C04-KP11", "name": "地质灾害", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B1-04-11", "description": "地震、滑坡、泥石流的成因和防御"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B1-C04-KP01", "GEO-B1-C04-KP03"]},
                        {"code": "GEO-CC03", "name": "地理实践力", "description": "运用地理工具和方法进行观察和实验", "knowledge_points": ["GEO-B1-C04-KP10"]},
                    ],
                },
                {
                    "code": "GEO-B1-C05",
                    "name": "必修一第五章 自然地理环境",
                    "semester": "高一上",
                    "textbook_ref": "人教版必修一P121-145",
                    "knowledge_points": [
                        {"code": "GEO-B1-C05-KP01", "name": "地理环境整体性", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-01", "description": "自然地理环境各要素的相互联系"},
                        {"code": "GEO-B1-C05-KP02", "name": "地理环境差异性", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-02", "description": "地域分异规律"},
                        {"code": "GEO-B1-C05-KP03", "name": "纬度地带性", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-03", "description": "从赤道到两极的地域分异"},
                        {"code": "GEO-B1-C05-KP04", "name": "经度地带性", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-04", "description": "从沿海到内陆的地域分异"},
                        {"code": "GEO-B1-C05-KP05", "name": "垂直地带性", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B1-05-05", "description": "山地垂直地域分异规律"},
                        {"code": "GEO-B1-C05-KP06", "name": "自然带", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B1-05-06", "description": "世界主要自然带的分布和特征"},
                        {"code": "GEO-B1-C05-KP07", "name": "土壤", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-07", "description": "土壤的组成、形成和类型"},
                        {"code": "GEO-B1-C05-KP08", "name": "植被", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B1-05-08", "description": "植被与自然环境的关系"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B1-C05-KP01", "GEO-B1-C05-KP02"]},
                    ],
                },
            ]
        },
        {
            "code": "GEO-T02",
            "name": "人文地理",
            "description": "人文地理基础——认识人类活动与地理环境的关系",
            "modules": [
                {
                    "code": "GEO-B2-C01",
                    "name": "必修二第一章 人口",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P1-30",
                    "knowledge_points": [
                        {"code": "GEO-B2-C01-KP01", "name": "人口增长模式", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-01-01", "description": "人口增长的阶段和模式"},
                        {"code": "GEO-B2-C01-KP02", "name": "人口迁移", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-01-02", "description": "人口迁移的原因和影响"},
                        {"code": "GEO-B2-C01-KP03", "name": "人口容量", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-01-03", "description": "环境人口容量和合理人口容量"},
                        {"code": "GEO-B2-C01-KP04", "name": "人口分布", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-01-04", "description": "世界人口分布的特点和影响因素"},
                        {"code": "GEO-B2-C01-KP05", "name": "人口问题", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-01-05", "description": "人口老龄化、人口增长过快等问题"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B2-C01-KP02", "GEO-B2-C01-KP04"]},
                    ],
                },
                {
                    "code": "GEO-B2-C02",
                    "name": "必修二第二章 城市",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P31-60",
                    "knowledge_points": [
                        {"code": "GEO-B2-C02-KP01", "name": "城市内部空间结构", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-02-01", "description": "城市功能区的分布和形成"},
                        {"code": "GEO-B2-C02-KP02", "name": "城市体系", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-02-02", "description": "城市等级体系和服务范围"},
                        {"code": "GEO-B2-C02-KP03", "name": "城市化", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-02-03", "description": "城市化的过程和特点"},
                        {"code": "GEO-B2-C02-KP04", "name": "城市化问题", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-02-04", "description": "城市化带来的问题和对策"},
                        {"code": "GEO-B2-C02-KP05", "name": "城市区位", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B2-02-05", "description": "影响城市选址的地理因素"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B2-C02-KP01", "GEO-B2-C02-KP05"]},
                    ],
                },
                {
                    "code": "GEO-B2-C03",
                    "name": "必修二第三章 农业",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P61-90",
                    "knowledge_points": [
                        {"code": "GEO-B2-C03-KP01", "name": "农业区位因素", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B2-03-01", "description": "影响农业生产的自然和社会经济因素"},
                        {"code": "GEO-B2-C03-KP02", "name": "农业地域类型", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-03-02", "description": "世界主要农业地域类型及分布"},
                        {"code": "GEO-B2-C03-KP03", "name": "季风水田农业", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-03-03", "description": "亚洲季风水田农业的特点和区位"},
                        {"code": "GEO-B2-C03-KP04", "name": "商品谷物农业", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-03-04", "description": "商品谷物农业的特点和分布"},
                        {"code": "GEO-B2-C03-KP05", "name": "大牧场放牧业", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B2-03-05", "description": "大牧场放牧业的分布和特点"},
                        {"code": "GEO-B2-C03-KP06", "name": "乳畜业", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B2-03-06", "description": "乳畜业的区位条件和分布"},
                        {"code": "GEO-B2-C03-KP07", "name": "混合农业", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B2-03-07", "description": "混合农业的特点和典型案例"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B2-C03-KP02", "GEO-B2-C03-KP03"]},
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B2-C03-KP01"]},
                    ],
                },
                {
                    "code": "GEO-B2-C04",
                    "name": "必修二第四章 工业",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P91-120",
                    "knowledge_points": [
                        {"code": "GEO-B2-C04-KP01", "name": "工业区位因素", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B2-04-01", "description": "影响工业布局的区位因素"},
                        {"code": "GEO-B2-C04-KP02", "name": "工业地域", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-04-02", "description": "工业集聚和工业地域的形成"},
                        {"code": "GEO-B2-C04-KP03", "name": "传统工业区", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-04-03", "description": "传统工业区的特点和典型案例"},
                        {"code": "GEO-B2-C04-KP04", "name": "新兴工业区", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-04-04", "description": "新兴工业区的特点和典型案例"},
                        {"code": "GEO-B2-C04-KP05", "name": "产业转移", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-04-05", "description": "产业转移的原因和影响"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B2-C04-KP01", "GEO-B2-C04-KP05"]},
                    ],
                },
                {
                    "code": "GEO-B2-C05",
                    "name": "必修二第五章 交通运输",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P121-145",
                    "knowledge_points": [
                        {"code": "GEO-B2-C05-KP01", "name": "交通运输方式", "cognitive_level": "remember", "curriculum_alignment": "JYT-2025-GEO-B2-05-01", "description": "五种交通运输方式的特点和选择"},
                        {"code": "GEO-B2-C05-KP02", "name": "交通运输布局", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B2-05-02", "description": "交通运输线点和网的布局因素"},
                        {"code": "GEO-B2-C05-KP03", "name": "交通运输影响", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-05-03", "description": "交通运输对聚落和商业的影响"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B2-C05-KP02", "GEO-B2-C05-KP03"]},
                    ],
                },
                {
                    "code": "GEO-B2-C06",
                    "name": "必修二第六章 人类与地理环境",
                    "semester": "高一下",
                    "textbook_ref": "人教版必修二P146-165",
                    "knowledge_points": [
                        {"code": "GEO-B2-C06-KP01", "name": "人地关系", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B2-06-01", "description": "人地关系思想的演变"},
                        {"code": "GEO-B2-C06-KP02", "name": "可持续发展", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-06-02", "description": "可持续发展的内涵和原则"},
                        {"code": "GEO-B2-C06-KP03", "name": "环境问题", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B2-06-03", "description": "主要环境问题的成因和治理"},
                        {"code": "GEO-B2-C06-KP04", "name": "生态保护", "cognitive_level": "evaluate", "curriculum_alignment": "JYT-2025-GEO-B2-06-04", "description": "生态环境保护的主要措施"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC04", "name": "人地协调观", "description": "理解人与地理环境协调发展的意义", "knowledge_points": ["GEO-B2-C06-KP01", "GEO-B2-C06-KP02"]},
                    ],
                },
            ]
        },
        {
            "code": "GEO-T03",
            "name": "区域地理",
            "description": "区域地理——认识区域特征、区域差异和区域发展",
            "modules": [
                {
                    "code": "GEO-B3-C01",
                    "name": "选择性必修一 自然地理基础",
                    "semester": "高二上",
                    "textbook_ref": "人教版选择性必修一",
                    "knowledge_points": [
                        {"code": "GEO-B3-C01-KP01", "name": "地球自转意义", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B3-01-01", "description": "时差、地转偏向力等自转意义"},
                        {"code": "GEO-B3-C01-KP02", "name": "地球公转意义", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B3-01-02", "description": "昼夜长短、正午太阳高度等公转意义"},
                        {"code": "GEO-B3-C01-KP03", "name": "气压带风带移动", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B3-01-03", "description": "气压带风带的季节移动及影响"},
                        {"code": "GEO-B3-C01-KP04", "name": "天气系统分析", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B3-01-04", "description": "锋面气旋的综合判读"},
                        {"code": "GEO-B3-C01-KP05", "name": "地形图判读", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B3-01-05", "description": "等高线地形图的综合判读"},
                        {"code": "GEO-B3-C01-KP06", "name": "河流侵蚀堆积", "cognitive_level": "apply", "curriculum_alignment": "JYT-2025-GEO-B3-01-06", "description": "河流不同河段的侵蚀和堆积特征"},
                        {"code": "GEO-B3-C01-KP07", "name": "整体性差异性", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B3-01-07", "description": "自然地理环境的整体性与差异性分析"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC02", "name": "综合思维", "description": "综合分析地理要素的相互关系", "knowledge_points": ["GEO-B3-C01-KP04", "GEO-B3-C01-KP07"]},
                    ],
                },
                {
                    "code": "GEO-B3-C02",
                    "name": "选择性必修二 区域发展",
                    "semester": "高二下",
                    "textbook_ref": "人教版选择性必修二",
                    "knowledge_points": [
                        {"code": "GEO-B3-C02-KP01", "name": "区域特征", "cognitive_level": "understand", "curriculum_alignment": "JYT-2025-GEO-B3-02-01", "description": "区域的基本特征和划分方法"},
                        {"code": "GEO-B3-C02-KP02", "name": "区域差异", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B3-02-02", "description": "不同区域的发展差异和比较"},
                        {"code": "GEO-B3-C02-KP03", "name": "区域发展", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B3-02-03", "description": "区域发展的阶段和策略"},
                        {"code": "GEO-B3-C02-KP04", "name": "资源跨区域调配", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B3-02-04", "description": "南水北调、西气东输等工程"},
                        {"code": "GEO-B3-C02-KP05", "name": "产业转移分析", "cognitive_level": "analyze", "curriculum_alignment": "JYT-2025-GEO-B3-02-05", "description": "区域产业转移的原因和影响"},
                    ],
                    "core_competencies": [
                        {"code": "GEO-CC01", "name": "区域认知", "description": "从空间视角认识地理环境", "knowledge_points": ["GEO-B3-C02-KP01", "GEO-B3-C02-KP02"]},
                    ],
                },
            ]
        },
    ],
    "relations": [
        {"from": "GEO-B1-C01-KP03", "to": "GEO-B1-C01-KP04", "type": "PREREQUISITE_OF", "weight": 1.0, "confidence": 1.0, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP03", "to": "GEO-B1-C01-KP05", "type": "PREREQUISITE_OF", "weight": 1.0, "confidence": 1.0, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP05", "to": "GEO-B1-C01-KP06", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP06", "to": "GEO-B1-C01-KP07", "type": "PREREQUISITE_OF", "weight": 0.95, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP07", "to": "GEO-B1-C01-KP08", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP07", "to": "GEO-B1-C01-KP09", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP08", "to": "GEO-B1-C01-KP10", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C01-KP09", "to": "GEO-B1-C01-KP10", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP01", "to": "GEO-B1-C02-KP02", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP01", "to": "GEO-B1-C02-KP03", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP03", "to": "GEO-B1-C02-KP08", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP08", "to": "GEO-B1-C02-KP05", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP05", "to": "GEO-B1-C02-KP09", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP04", "to": "GEO-B1-C02-KP07", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP07", "to": "GEO-B1-C02-KP06", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP05", "to": "GEO-B1-C02-KP06", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP10", "to": "GEO-B1-C02-KP11", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP01", "to": "GEO-B1-C02-KP12", "type": "REQUIRES", "weight": 0.6, "confidence": 0.5, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C02-KP04", "to": "GEO-B1-C02-KP03", "type": "APPLIES", "weight": 0.6, "confidence": 0.5, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C03-KP01", "to": "GEO-B1-C03-KP03", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C03-KP03", "to": "GEO-B1-C03-KP04", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.75, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C03-KP02", "to": "GEO-B1-C03-KP06", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP01", "to": "GEO-B1-C04-KP03", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP01", "to": "GEO-B1-C04-KP04", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP01", "to": "GEO-B1-C04-KP05", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP02", "to": "GEO-B1-C04-KP06", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP02", "to": "GEO-B1-C04-KP07", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP02", "to": "GEO-B1-C04-KP08", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP02", "to": "GEO-B1-C04-KP09", "type": "PREREQUISITE_OF", "weight": 0.75, "confidence": 0.65, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP10", "to": "GEO-B1-C04-KP06", "type": "APPLIES", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C04-KP01", "to": "GEO-B1-C04-KP11", "type": "REQUIRES", "weight": 0.6, "confidence": 0.5, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP01", "to": "GEO-B1-C05-KP02", "type": "CONTRASTS_WITH", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP02", "to": "GEO-B1-C05-KP03", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP02", "to": "GEO-B1-C05-KP04", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP02", "to": "GEO-B1-C05-KP05", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP06", "to": "GEO-B1-C05-KP07", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B1-C05-KP06", "to": "GEO-B1-C05-KP08", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C01-KP01", "to": "GEO-B2-C01-KP05", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C01-KP04", "to": "GEO-B2-C01-KP02", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C01-KP01", "to": "GEO-B2-C01-KP03", "type": "PREREQUISITE_OF", "weight": 0.75, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C02-KP05", "to": "GEO-B2-C02-KP01", "type": "PREREQUISITE_OF", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C02-KP03", "to": "GEO-B2-C02-KP04", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP01", "to": "GEO-B2-C03-KP02", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP02", "to": "GEO-B2-C03-KP03", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP02", "to": "GEO-B2-C03-KP04", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP02", "to": "GEO-B2-C03-KP05", "type": "CONTAINS", "weight": 0.85, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP02", "to": "GEO-B2-C03-KP06", "type": "CONTAINS", "weight": 0.85, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C03-KP02", "to": "GEO-B2-C03-KP07", "type": "CONTAINS", "weight": 0.85, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C04-KP01", "to": "GEO-B2-C04-KP02", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C04-KP02", "to": "GEO-B2-C04-KP03", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C04-KP02", "to": "GEO-B2-C04-KP04", "type": "CONTAINS", "weight": 0.9, "confidence": 0.9, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C04-KP01", "to": "GEO-B2-C04-KP05", "type": "REQUIRES", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C05-KP01", "to": "GEO-B2-C05-KP02", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.75, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C05-KP02", "to": "GEO-B2-C05-KP03", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C06-KP01", "to": "GEO-B2-C06-KP02", "type": "PREREQUISITE_OF", "weight": 0.9, "confidence": 0.85, "discovered_by": "curriculum"},
        {"from": "GEO-B2-C06-KP03", "to": "GEO-B2-C06-KP04", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.75, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C01-KP01", "to": "GEO-B3-C01-KP04", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C01-KP02", "to": "GEO-B3-C01-KP04", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.7, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C01-KP03", "to": "GEO-B3-C01-KP04", "type": "PREREQUISITE_OF", "weight": 0.75, "confidence": 0.65, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C01-KP05", "to": "GEO-B3-C01-KP06", "type": "PREREQUISITE_OF", "weight": 0.8, "confidence": 0.75, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C01-KP06", "to": "GEO-B3-C01-KP07", "type": "PREREQUISITE_OF", "weight": 0.75, "confidence": 0.65, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C02-KP01", "to": "GEO-B3-C02-KP02", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C02-KP02", "to": "GEO-B3-C02-KP03", "type": "PREREQUISITE_OF", "weight": 0.85, "confidence": 0.8, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C02-KP03", "to": "GEO-B3-C02-KP04", "type": "REQUIRES", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
        {"from": "GEO-B3-C02-KP03", "to": "GEO-B3-C02-KP05", "type": "REQUIRES", "weight": 0.7, "confidence": 0.6, "discovered_by": "curriculum"},
    ],
    "contains": [
        {"parent": "GEO-B1-C01-KP03", "child": "GEO-B1-C01-KP04"},
        {"parent": "GEO-B1-C01-KP03", "child": "GEO-B1-C01-KP05"},
        {"parent": "GEO-B1-C02-KP08", "child": "GEO-B1-C02-KP05"},
        {"parent": "GEO-B1-C02-KP08", "child": "GEO-B1-C02-KP09"},
    ],
    }


def import_curriculum_to_project(db: Session, project_id: str, curriculum_data: dict) -> dict:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {"status": "error", "message": "项目不存在"}

    existing = db.query(CurriculumStandard).filter(
        CurriculumStandard.project_id == project_id,
    ).first()

    if existing:
        init_from_curriculum(existing.knowledge_tree, project_id)
        return {"status": "already_exists", "id": str(existing.id)}

    cs = CurriculumStandard(
        subject=project.subject,
        version=curriculum_data.get("version", ""),
        grade=project.grade or "",
        knowledge_tree=curriculum_data,
        project_id=project_id,
    )
    db.add(cs)

    project.curriculum_imported = True
    db.commit()
    db.refresh(cs)

    kp_count = sum(
        len(m.get("knowledge_points", []))
        for t in curriculum_data.get("themes", [])
        for m in t.get("modules", [])
    )
    cc_count = sum(
        len(m.get("core_competencies", []))
        for t in curriculum_data.get("themes", [])
        for m in t.get("modules", [])
    )
    return {"status": "imported", "id": str(cs.id), "knowledge_points": kp_count, "core_competencies": cc_count}


def import_default_curriculum(db: Session) -> dict:
    project = db.query(Project).filter(Project.subject == "geography").first()
    if not project:
        project = Project(
            name="地理",
            subject="geography",
            grade="高一",
            description="默认地理项目",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
    return import_curriculum_to_project(db, str(project.id), _load_geography_curriculum())


def create_project(db: Session, name: str, subject: str, grade: Optional[str] = None, description: Optional[str] = None) -> Project:
    project = Project(
        name=name,
        subject=subject,
        grade=grade,
        description=description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session) -> list[dict]:
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "subject": p.subject,
            "grade": p.grade,
            "description": p.description,
            "status": p.status,
            "curriculum_imported": p.curriculum_imported,
            "graph_initialized": p.graph_initialized,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in projects
    ]


def get_project(db: Session, project_id: str) -> Optional[dict]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None
    return {
        "id": str(project.id),
        "name": project.name,
        "subject": project.subject,
        "grade": project.grade,
        "description": project.description,
        "status": project.status,
        "curriculum_imported": project.curriculum_imported,
        "graph_initialized": project.graph_initialized,
        "settings": project.settings,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


def get_curriculum_tree(subject: Optional[str] = None) -> dict:
    return _load_geography_curriculum()


def align_courseware_kp(courseware_kps: list[dict], curriculum_kps: list[dict]) -> list[dict]:
    from app.services.knowledge_service import semantic_align_kp
    aligned = []
    curriculum_dict = {kp.get("code", ""): kp for kp in curriculum_kps}
    for cw_kp in courseware_kps:
        cw_name = cw_kp.get("name", "")
        match = semantic_align_kp(cw_name, curriculum_dict)
        aligned.append({
            "courseware_kp": cw_kp,
            "curriculum_kp": match,
            "alignment_score": match["score"] if match else 0.0,
            "aligned": match is not None,
        })
    return aligned
