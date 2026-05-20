"""
GraphAgent 测试数据补全脚本
补全所有模块的演示数据，确保每个页面都有内容
"""
import uuid
import json
import random
import math
from datetime import datetime, timedelta
from app.database import SessionLocal
from sqlalchemy import text

random.seed(42)

PROJECT_ID = "df7d2c46-f5ce-49d9-b3d2-444f56344e9e"
MAIN_HW_ID = "45cd884f-5092-4994-be2b-c3142f0b4888"
CDM_ID = "93d2c46a-3f09-4e37-a9f2-224b03ddd58e"

KP_CODES = [
    "GEO-B1-C01-KP03", "GEO-B1-C01-KP04", "GEO-B1-C01-KP05", "GEO-B1-C01-KP06",
    "GEO-B1-C02-KP01", "GEO-B1-C02-KP02", "GEO-B1-C02-KP04", "GEO-B1-C02-KP05",
    "GEO-B1-C03-KP01", "GEO-B1-C03-KP03", "GEO-B1-C04-KP10", "GEO-B1-C02-KP06",
]

KP_NAMES = {
    "GEO-B1-C01-KP03": "天体运动", "GEO-B1-C01-KP04": "地球自转", "GEO-B1-C01-KP05": "地球公转",
    "GEO-B1-C01-KP06": "四季更替", "GEO-B1-C02-KP01": "大气受热过程", "GEO-B1-C02-KP02": "热力环流",
    "GEO-B1-C02-KP04": "气压带风带", "GEO-B1-C02-KP05": "季风环流", "GEO-B1-C03-KP01": "水循环",
    "GEO-B1-C03-KP03": "洋流运动", "GEO-B1-C04-KP10": "地貌判断", "GEO-B1-C02-KP06": "天气系统判断",
}

STUDENT_IDS = [f"S{str(i).zfill(3)}" for i in range(1, 16)]


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now()


def ts(minutes_ago=0):
    return datetime.now() - timedelta(minutes=minutes_ago)


def clean_old_data(db):
    """清理不属于主项目的旧测试数据"""
    print("[1/6] 清理旧测试数据...")
    tables_to_clean = [
        ("homeworks", "project_id", PROJECT_ID, False),
    ]
    # Delete homeworks not belonging to main project
    db.execute(text(f"DELETE FROM student_answers WHERE homework_id NOT IN (SELECT id FROM homeworks WHERE project_id = :pid)"), {"pid": PROJECT_ID})
    db.execute(text(f"DELETE FROM questions WHERE homework_id NOT IN (SELECT id FROM homeworks WHERE project_id = :pid)"), {"pid": PROJECT_ID})
    db.execute(text(f"DELETE FROM cdm_parameters WHERE homework_id NOT IN (SELECT id FROM homeworks WHERE project_id = :pid)"), {"pid": PROJECT_ID})
    db.execute(text(f"DELETE FROM diagnoses WHERE homework_id NOT IN (SELECT id FROM homeworks WHERE project_id = :pid)"), {"pid": PROJECT_ID})
    db.execute(text("DELETE FROM homeworks WHERE project_id != :pid"), {"pid": PROJECT_ID})
    # Clean other test projects
    db.execute(text("DELETE FROM projects WHERE id != :pid"), {"pid": PROJECT_ID})
    db.commit()
    print("  OK - 旧数据已清理")


def seed_homeworks(db):
    """补全作业数据：增加2个不同状态的作业"""
    print("[2/6] 补全作业数据...")

    hw2_id = uid()
    hw3_id = uid()

    # 作业2: 第三章测验 (q_matrix_confirmed)
    db.execute(text("""
        INSERT OR IGNORE INTO homeworks (id, title, class_id, status, project_id, created_at)
        VALUES (:id, :title, :class_id, :status, :pid, :ts)
    """), {
        "id": hw2_id, "title": "高一地理大气与气候测验", "class_id": "class-2024-01",
        "status": "q_matrix_confirmed", "pid": PROJECT_ID, "ts": ts(1440),
    })

    hw2_questions = [
        ("关于大气受热过程的叙述，正确的是：\nA. 大气直接吸收太阳辐射增温\nB. 地面辐射是对流层大气的直接热源\nC. 大气逆辐射只发生在夜晚\nD. 温室效应与大气受热过程无关", "choice", 5.0),
        ("热力环流形成的基本原因是：\nA. 水平气压梯度力\nB. 地转偏向力\nC. 冷热不均\nD. 摩擦力", "choice", 5.0),
        ("形成三圈环流的主要因素是：\nA. 海陆热力性质差异\nB. 太阳辐射随纬度分布不均和地转偏向力\nC. 地形起伏\nD. 人类活动", "choice", 5.0),
        ("关于季风的叙述，正确的是：\nA. 东亚季风仅由海陆热力性质差异形成\nB. 南亚夏季吹东北季风\nC. 东亚冬季吹西北季风\nD. 季风只影响亚洲", "choice", 5.0),
        ("水循环中，使陆地水不断得到补充的环节是：\nA. 蒸发\nB. 水汽输送\nC. 降水\nD. 径流", "choice", 5.0),
        ("关于洋流对地理环境的影响，错误的是：\nA. 暖流对沿岸气候有增温增湿作用\nB. 寒流对沿岸气候有降温减湿作用\nC. 洋流对海洋生物分布无影响\nD. 洋流会影响海洋污染物的扩散", "choice", 5.0),
    ]

    hw2_q_ids = []
    for i, (content, qtype, score) in enumerate(hw2_questions):
        qid = uid()
        hw2_q_ids.append(qid)
        q_matrix = {}
        if i == 0: q_matrix = {"GEO-B1-C02-KP01": 1}
        elif i == 1: q_matrix = {"GEO-B1-C02-KP02": 1}
        elif i == 2: q_matrix = {"GEO-B1-C02-KP04": 1, "GEO-B1-C01-KP03": 1}
        elif i == 3: q_matrix = {"GEO-B1-C02-KP05": 1}
        elif i == 4: q_matrix = {"GEO-B1-C03-KP01": 1}
        elif i == 5: q_matrix = {"GEO-B1-C03-KP03": 1}

        db.execute(text("""
            INSERT OR IGNORE INTO questions (id, homework_id, seq, content, question_type, score, q_matrix, q_matrix_confirmed, q_matrix_source)
            VALUES (:id, :hw_id, :seq, :content, :qtype, :score, :qm, 1, 'ai_generated')
        """), {
            "id": qid, "hw_id": hw2_id, "seq": i + 1,
            "content": content, "qtype": qtype, "score": score,
            "qm": json.dumps(q_matrix),
        })

    # HW2 student answers (12 students)
    hw2_students = STUDENT_IDS[:12]
    answer_map = {
        0: ["B", "B", "B", "C", "C", "C"],
        1: ["B", "C", "B", "A", "B", "C"],
        2: ["A", "C", "B", "C", "C", "A"],
        3: ["B", "C", "B", "D", "B", "A"],
        4: ["A", "C", "B", "C", "B", "C"],
        5: ["B", "C", "A", "D", "C", "C"],
    }
    correct_answers = ["B", "C", "B", "C", "C", "C"]

    for si, sid in enumerate(hw2_students):
        pattern = answer_map[si % len(answer_map)]
        for qi, qid in enumerate(hw2_q_ids):
            ans = pattern[qi]
            is_correct = ans == correct_answers[qi]
            score = 5.0 if is_correct else 0.0
            db.execute(text("""
                INSERT OR IGNORE INTO student_answers (id, homework_id, student_id, question_id, student_answer, score, is_correct)
                VALUES (:id, :hw_id, :sid, :qid, :ans, :score, :correct)
            """), {
                "id": uid(), "hw_id": hw2_id, "sid": sid, "qid": qid,
                "ans": ans, "score": score, "correct": is_correct,
            })

    # 作业3: 课后练习 (created)
    db.execute(text("""
        INSERT OR IGNORE INTO homeworks (id, title, class_id, status, project_id, created_at)
        VALUES (:id, :title, :class_id, :status, :pid, :ts)
    """), {
        "id": hw3_id, "title": "高一地理地貌课后练习", "class_id": "class-2024-01",
        "status": "created", "pid": PROJECT_ID, "ts": ts(4320),
    })

    hw3_questions = [
        ("下列地貌中，由流水侵蚀作用形成的是：\nA. 冲积扇 B. 峡谷 C. 沙丘 D. 冰斗", "choice", 5.0),
        ("关于喀斯特地貌的叙述，正确的是：\nA. 只分布在热带\nB. 化学溶蚀作用为主\nC. 与地下水无关\nD. 只形成地表地貌", "choice", 5.0),
        ("地貌对人类活动的影响不包括：\nA. 影响农业类型\nB. 影响交通线路选择\nC. 影响人口分布\nD. 影响地球自转速度", "choice", 5.0),
        ("阅读等高线地形图，下列说法正确的是：\nA. 等高线密集处坡度缓\nB. 等高线向高处凸出处为山谷\nC. 闭合等高线中心一定是山顶\nD. 等高线不能相交", "choice", 5.0),
    ]
    for i, (content, qtype, score) in enumerate(hw3_questions):
        db.execute(text("""
            INSERT OR IGNORE INTO questions (id, homework_id, seq, content, question_type, score)
            VALUES (:id, :hw_id, :seq, :content, :qtype, :score)
        """), {
            "id": uid(), "hw_id": hw3_id, "seq": i + 1,
            "content": content, "qtype": qtype, "score": score,
        })

    db.commit()
    print(f"  OK - 作业2(大气测验, q_matrix_confirmed) + 作业3(地貌练习, created)")


def seed_diagnoses(db):
    """补全诊断结果：15名学生的诊断 + 班级诊断"""
    print("[3/6] 补全诊断数据...")

    mastery_patterns = [
        [1,1,1,1,1,1,1,1,1,1,1,1], [0,1,1,1,1,1,0,1,1,1,0,1],
        [1,0,0,1,0,1,1,1,1,0,1,0], [0,0,1,0,0,1,1,0,1,0,0,1],
        [1,1,0,1,1,0,0,1,0,1,1,1], [0,1,0,0,0,0,1,0,0,1,0,0],
        [1,1,1,0,1,1,1,1,1,1,1,0], [0,0,0,1,0,1,0,0,1,0,0,0],
        [1,0,1,1,1,0,1,1,0,1,1,1], [0,1,1,0,0,1,0,1,1,0,1,0],
        [1,1,0,1,1,1,1,0,1,1,0,1], [0,0,1,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,0,1,1,1,1,1,1,1], [0,1,0,0,1,0,0,1,0,0,1,0],
        [1,0,1,1,1,1,0,1,1,1,0,1],
    ]

    for si, sid in enumerate(STUDENT_IDS):
        pattern = mastery_patterns[si]
        ks = {}
        for ki, kp in enumerate(KP_CODES):
            ks[kp] = pattern[ki]

        weak_kps = [kp for kp, v in ks.items() if v == 0]
        root_causes = []
        if weak_kps:
            root_kp = weak_kps[0]
            trace = [{"code": "GEO-B1-C01-KP01", "name": "地球系统", "mastery": 0.3}]
            root_causes.append({
                "weak_kp": {"code": root_kp, "mastery": 0.2},
                "root_cause": {"code": "GEO-B1-C01-KP01", "mastery": 0.3, "name": "地球系统"},
                "prerequisite_chain": trace,
                "trace_depth": 2,
            })

        db.execute(text("""
            INSERT OR IGNORE INTO diagnoses (id, homework_id, student_id, question_id, knowledge_state, trace_path, confidence, cdm_params_ref, created_at)
            VALUES (:id, :hw_id, :sid, '', :ks, :tp, :conf, :cdm_id, :ts)
        """), {
            "id": uid(), "hw_id": MAIN_HW_ID, "sid": sid,
            "ks": json.dumps(ks), "tp": json.dumps(root_causes),
            "conf": 0.85 + random.random() * 0.1,
            "cdm_id": CDM_ID, "ts": ts(180 + si * 5),
        })

    # Class diagnosis
    kp_avg = {}
    for kp in KP_CODES:
        vals = [mastery_patterns[si][ki] for si in range(15) for ki, k in enumerate(KP_CODES) if k == kp]
        kp_avg[kp] = round(sum(vals) / len(vals), 3) if vals else 0.5

    weak_count = {kp: sum(1 for si in range(15) for ki, k in enumerate(KP_CODES) if k == kp and mastery_patterns[si][ki] == 0) for kp in KP_CODES}

    root_causes_data = []
    for kp in sorted(KP_CODES, key=lambda x: kp_avg.get(x, 1))[:5]:
        root_causes_data.append({
            "kp_code": kp, "kp_name": KP_NAMES.get(kp, kp),
            "weak_count": weak_count.get(kp, 0),
            "weak_rate": round(weak_count.get(kp, 0) / 15, 3),
            "avg_mastery": kp_avg.get(kp, 0.5),
            "root_cause_code": "GEO-B1-C01-KP01",
            "prerequisite_chain": [
                {"code": "GEO-B1-C01-KP01", "name": "地球系统", "mastery": 0.35},
                {"code": kp, "name": KP_NAMES.get(kp, kp), "mastery": kp_avg.get(kp, 0.5)},
            ],
        })

    student_groups_data = [
        {"group_id": "G1", "name": "基础薄弱组", "student_ids": STUDENT_IDS[3:6] + STUDENT_IDS[7:9] + [STUDENT_IDS[11]],
         "focus_kps": ["GEO-B1-C02-KP01", "GEO-B1-C02-KP04"], "avg_mastery": 0.35,
         "description": "大气相关知识点掌握薄弱，需要强化基础概念"},
        {"group_id": "G2", "name": "地貌待提升组", "student_ids": [STUDENT_IDS[1], STUDENT_IDS[5], STUDENT_IDS[9], STUDENT_IDS[11]],
         "focus_kps": ["GEO-B1-C04-KP10"], "avg_mastery": 0.45,
         "description": "地貌判断题得分率低，需要增加读图训练"},
        {"group_id": "G3", "name": "综合提升组", "student_ids": [STUDENT_IDS[0], STUDENT_IDS[4], STUDENT_IDS[8], STUDENT_IDS[10], STUDENT_IDS[12]],
         "focus_kps": ["GEO-B1-C03-KP01", "GEO-B1-C03-KP03"], "avg_mastery": 0.72,
         "description": "整体掌握较好，可在水循环和洋流方面进一步深化"},
    ]

    teaching_suggestions_data = []
    for kp in sorted(KP_CODES, key=lambda x: kp_avg.get(x, 1))[:6]:
        teaching_suggestions_data.append({
            "kp_code": kp, "kp_name": KP_NAMES.get(kp, kp),
            "mastery_rate": kp_avg.get(kp, 0.5),
            "strategy": "概念图讲解 + 对比实验" if kp_avg.get(kp, 0.5) < 0.4 else "专项练习 + 错题分析",
            "priority": round(1.0 - kp_avg.get(kp, 0.5) + 0.1, 2),
            "estimated_improvement": "+20%~+35%",
            "exercise_count": 6 if kp_avg.get(kp, 0.5) < 0.4 else 4,
            "group_target": "基础薄弱组" if kp_avg.get(kp, 0.5) < 0.4 else "综合提升组",
            "related_students": [s for s in STUDENT_IDS if mastery_patterns[STUDENT_IDS.index(s)][KP_CODES.index(kp)] == 0],
        })

    db.execute(text("""
        INSERT OR IGNORE INTO class_diagnoses (id, homework_id, class_id, root_causes, student_groups, teaching_suggestions, created_at)
        VALUES (:id, :hw_id, :class_id, :rc, :sg, :ts_data, :ts)
    """), {
        "id": uid(), "hw_id": MAIN_HW_ID, "class_id": "class-2024-01",
        "rc": json.dumps(root_causes_data),
        "sg": json.dumps(student_groups_data),
        "ts_data": json.dumps(teaching_suggestions_data),
        "ts": ts(120),
    })

    db.commit()
    print(f"  OK - 15名学生诊断 + 班级诊断 + 教学建议")


def seed_learning_paths(db):
    """补全学习路径和活动"""
    print("[4/6] 补全学习路径...")

    path_students = [
        ("S003", "GEO-B1-C02-KP01", 0.2),
        ("S007", "GEO-B1-C02-KP04", 0.25),
        ("S011", "GEO-B1-C04-KP10", 0.3),
        ("S005", "GEO-B1-C03-KP03", 0.15),
    ]

    for sid, root_kp, progress in path_students:
        path_id = uid()
        nodes = [
            {"kp_id": "GEO-B1-C01-KP01", "kp_name": "地球系统", "mastery_rate": 0.4, "cognitive_level": "识记", "sequence": 1},
            {"kp_id": "GEO-B1-C01-KP03", "kp_name": "天体运动", "mastery_rate": 0.55, "cognitive_level": "理解", "sequence": 2},
            {"kp_id": root_kp, "kp_name": KP_NAMES.get(root_kp, root_kp), "mastery_rate": round(0.3 + progress, 2), "cognitive_level": "应用", "sequence": 3},
        ]
        edges = [
            {"from": "GEO-B1-C01-KP01", "to": "GEO-B1-C01-KP03", "relation": "PREREQUISITE_OF"},
            {"from": "GEO-B1-C01-KP03", "to": root_kp, "relation": "SUPPORTS"},
        ]

        db.execute(text("""
            INSERT OR IGNORE INTO learning_paths (id, student_id, root_cause_kp_id, path_nodes, path_edges, estimated_duration, status, progress, created_at)
            VALUES (:id, :sid, :rkp, :nodes, :edges, :dur, 'active', :prog, :ts)
        """), {
            "id": path_id, "sid": sid, "rkp": root_kp,
            "nodes": json.dumps(nodes), "edges": json.dumps(edges),
            "dur": json.dumps({"total_hours": 2.5, "sessions": 3, "weeks": 1}),
            "prog": progress, "ts": ts(60),
        })

        activities = [
            (1, "review", {"name": "基础概念复习", "kp_name": "地球系统"}, "completed",
             {"score": 85, "time_spent_min": 15}),
            (2, "exercise", {"name": "天体运动专项练习", "kp_name": "天体运动"}, "in_progress", None),
            (3, "assessment", {"name": "综合测试", "kp_name": KP_NAMES.get(root_kp, root_kp)}, "pending", None),
        ]
        for seq, atype, content, status, result in activities:
            db.execute(text("""
                INSERT OR IGNORE INTO learning_activities (id, learning_path_id, activity_type, content, sequence, status, result, started_at)
                VALUES (:id, :pid, :atype, :content, :seq, :status, :result, :ts)
            """), {
                "id": uid(), "pid": path_id, "atype": atype,
                "content": json.dumps(content), "seq": seq,
                "status": status, "result": json.dumps(result) if result else None,
                "ts": ts(50 - seq * 15) if status != "pending" else None,
            })

    db.commit()
    print(f"  OK - 4条学习路径 + 活动")


def seed_agent_data(db):
    """补全Agent事件和通知"""
    print("[5/6] 补全Agent数据...")

    agents = ["knowledge", "diagnosis", "tracing", "teaching", "evolution"]
    agent_names_cn = {
        "knowledge": "知识Agent", "diagnosis": "诊断Agent",
        "tracing": "追踪Agent", "teaching": "教学Agent", "evolution": "演化Agent",
    }

    event_templates = [
        ("knowledge", "graph_updated", "知识图谱同步完成，新增 12 个实体、8 条关系"),
        ("knowledge", "curriculum_imported", "课标导入完成：地理学科 92 个知识点、15 个考点"),
        ("knowledge", "entity_created", "新增考点：等高线地形图判读"),
        ("knowledge", "relation_discovered", "发现新关系：大气受热过程 → 温室效应（SUPPORTS, 置信度0.89）"),
        ("diagnosis", "cdm_estimated", f"CDM参数估计完成：DINA模型，15名学生×12知识点，AIC=287.3，已收敛"),
        ("diagnosis", "diagnosis_completed", "班级诊断完成：识别 5 个根因知识点，3 个学生分组"),
        ("diagnosis", "qmatrix_confirmed", f"Q矩阵确认完成：{MAIN_HW_ID}，8道题目×12个知识点"),
        ("diagnosis", "answer_imported", f"答题数据导入：120 条记录，15 名学生"),
        ("tracing", "trace_completed", "根因追溯完成：S003 学生大气受热过程薄弱，根因为地球系统基础不足（深度3）"),
        ("tracing", "trajectory_analyzed", "学习轨迹分析：S007 知识点掌握趋势上升，预计3周可达标"),
        ("tracing", "path_generated", "学习路径生成：S011 → 地貌判断，路径长度3，预计2.5课时"),
        ("teaching", "suggestion_generated", "教学建议生成完成：6 条策略，优先级最高为大气受热过程（紧迫度0.85）"),
        ("teaching", "group_suggested", "学生分组建议：基础薄弱组(5人)、地貌提升组(4人)、综合提升组(6人)"),
        ("teaching", "remediation_planned", "补救计划：大气受热过程 → 概念图讲解+对比实验，预计+35%提升"),
        ("evolution", "model_updated", "模型参数演化：slip 参数微调，整体误差降低 2.3%"),
        ("evolution", "drift_detected", "参数漂移检测：季风环流猜对率上升 5%，建议重新估计"),
        ("evolution", "feedback_processed", "教师反馈处理：修正 S012 大气环流诊断结果"),
        ("evolution", "snapshot_created", "知识图谱快照创建：v3 版本，136 节点 184 关系"),
    ]

    for i, (agent, event_type, payload_text) in enumerate(event_templates):
        db.execute(text("""
            INSERT INTO agent_events (event_type, source_type, source_id, payload, status, created_at, processed_at)
            VALUES (:etype, :agent, :sid, :payload, 'processed', :ts, :ts2)
        """), {
            "etype": event_type, "agent": agent, "sid": i + 1,
            "payload": json.dumps({"agent": agent, "message": payload_text, "homework_id": MAIN_HW_ID}),
            "ts": ts(300 - i * 15), "ts2": ts(300 - i * 15 + 2),
        })

    notifications = [
        ("知识Agent", "知识图谱同步完成", "课标数据已导入，新增 12 个知识实体和 8 条前驱关系", "info"),
        ("诊断Agent", "CDM参数估计已完成", "DINA模型收敛，AIC=287.3，15名学生的知识状态已更新", "info"),
        ("诊断Agent", "班级诊断报告已生成", "识别 5 个根因知识点，建议优先关注大气受热过程", "diagnosis"),
        ("追踪Agent", "学习路径已生成", "S003、S007、S011、S005 四名学生的个性化补救路径已就绪", "info"),
        ("教学Agent", "教学建议已更新", "根据最新诊断结果，生成了 6 条教学策略建议", "teaching"),
        ("演化Agent", "检测到参数漂移", "季风环流猜对率上升 5%，建议下次考试后重新估计CDM参数", "warning"),
        ("诊断Agent", "S003 根因追溯完成", "大气受热过程薄弱 → 根因：地球系统基础概念不足（3层前驱链）", "diagnosis"),
        ("教学Agent", "学生分组建议已生成", "基础薄弱组(5人)、地貌提升组(4人)、综合提升组(6人)", "teaching"),
        ("知识Agent", "新考点已添加", "等高线地形图判读、气压带风带判断已加入知识图谱", "info"),
        ("演化Agent", "教师反馈已处理", "S012 大气环流诊断结果已根据教师反馈修正", "info"),
    ]

    for i, (sender, title, content, ntype) in enumerate(notifications):
        is_read = i < 5
        db.execute(text("""
            INSERT INTO agent_notifications (teacher_id, notification_type, title, content, is_read, created_at)
            VALUES (1, :ntype, :title, :content, :read, :ts)
        """), {
            "ntype": ntype, "title": title, "content": content,
            "read": is_read, "ts": ts(250 - i * 20),
        })

    # Agent messages
    messages = [
        ("knowledge", "diagnosis", "graph_ready", {"entity_count": 136, "relation_count": 184}),
        ("diagnosis", "tracing", "diagnosis_done", {"student_count": 15, "weak_kp_count": 5}),
        ("tracing", "teaching", "trace_done", {"path_count": 4, "avg_depth": 2.8}),
        ("teaching", "evolution", "suggestion_done", {"strategy_count": 6, "top_priority": "大气受热过程"}),
        ("diagnosis", "knowledge", "request_graph", {"kp_codes": KP_CODES}),
        ("tracing", "diagnosis", "request_diagnosis", {"student_ids": ["S003", "S007"]}),
        ("teaching", "tracing", "request_paths", {"student_ids": STUDENT_IDS[:5]}),
        ("evolution", "diagnosis", "model_updated", {"slip_delta": -0.02, "guess_delta": 0.01}),
    ]

    for i, (sender, receiver, mtype, payload) in enumerate(messages):
        db.execute(text("""
            INSERT INTO agent_messages (id, sender_agent, receiver_agent, message_type, payload, status, created_at, processed_at)
            VALUES (:id, :sender, :receiver, :mtype, :payload, 'processed', :ts, :ts2)
        """), {
            "id": uid(), "sender": sender, "receiver": receiver, "mtype": mtype,
            "payload": json.dumps(payload), "ts": ts(200 - i * 12), "ts2": ts(200 - i * 12 + 3),
        })

    db.commit()
    print(f"  OK - 18条事件 + 10条通知 + 8条消息")


def seed_supplementary(db):
    """补全辅助数据：班级、学生分组等"""
    print("[6/6] 补全辅助数据...")

    # Student groups
    db.execute(text("""
        INSERT OR IGNORE INTO student_groups (id, class_id, name, student_ids, focus_kps, created_at)
        VALUES (:id, :class_id, :name, :sids, :kps, :ts)
    """), {
        "id": uid(), "class_id": "class-2024-01", "name": "基础薄弱组",
        "sids": json.dumps(STUDENT_IDS[3:6] + STUDENT_IDS[7:9]),
        "kps": json.dumps(["GEO-B1-C02-KP01", "GEO-B1-C02-KP04"]),
        "ts": ts(100),
    })
    db.execute(text("""
        INSERT OR IGNORE INTO student_groups (id, class_id, name, student_ids, focus_kps, created_at)
        VALUES (:id, :class_id, :name, :sids, :kps, :ts)
    """), {
        "id": uid(), "class_id": "class-2024-01", "name": "综合提升组",
        "sids": json.dumps([STUDENT_IDS[0], STUDENT_IDS[4], STUDENT_IDS[8], STUDENT_IDS[10], STUDENT_IDS[12]]),
        "kps": json.dumps(["GEO-B1-C03-KP01", "GEO-B1-C03-KP03"]),
        "ts": ts(100),
    })

    db.commit()
    print("  OK - 学生分组数据")


def verify(db):
    """验证数据完整性"""
    print("\n========== 数据验证 ==========")
    checks = [
        ("projects", f"WHERE id = '{PROJECT_ID}'", 1),
        ("homeworks", f"WHERE project_id = '{PROJECT_ID}'", 3),
        ("questions", f"WHERE homework_id IN (SELECT id FROM homeworks WHERE project_id = '{PROJECT_ID}')", 18),
        ("student_answers", f"WHERE homework_id = '{MAIN_HW_ID}'", 120),
        ("graph_entities", "", 136),
        ("graph_relations", "", 184),
        ("diagnoses", f"WHERE homework_id = '{MAIN_HW_ID}'", 15),
        ("class_diagnoses", f"WHERE homework_id = '{MAIN_HW_ID}'", 1),
        ("learning_paths", "", 4),
        ("learning_activities", "", 12),
        ("agent_events", "", 39),
        ("agent_notifications", "", 19),
        ("agent_messages", "", 26),
        ("agent_states", "", 5),
        ("student_groups", "", 2),
    ]

    all_ok = True
    for table, where_clause, min_count in checks:
        r = db.execute(text(f"SELECT COUNT(*) FROM {table} {where_clause}"))
        count = r.scalar()
        status = "OK" if count >= min_count else "WARN"
        if status == "WARN":
            all_ok = False
        print(f"  {status} {table}: {count} (expected >={min_count})")

    print(f"\n{'All checks passed!' if all_ok else 'Some checks need attention.'}")


def main():
    db = SessionLocal()
    try:
        clean_old_data(db)
        seed_homeworks(db)
        seed_diagnoses(db)
        seed_learning_paths(db)
        seed_agent_data(db)
        seed_supplementary(db)
        verify(db)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
