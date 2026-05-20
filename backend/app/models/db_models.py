import app._patch_win32  # noqa: F401  must be before sqlalchemy import

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime
import uuid


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    subject = Column(String(50), nullable=False)
    grade = Column(String(20))
    description = Column(String(500))
    status = Column(String(20), default="active")
    curriculum_imported = Column(Boolean, default=False)
    graph_initialized = Column(Boolean, default=False)
    settings = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class GraphEntity(Base):
    __tablename__ = "graph_entities"
    id = Column(String, primary_key=True)
    entity_type = Column(String(50), nullable=False, index=True)
    code = Column(String(100), nullable=False, unique=True)
    name = Column(String(200))
    properties = Column(Text)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class GraphRelation(Base):
    __tablename__ = "graph_relations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_code = Column(String(100), nullable=False, index=True)
    target_code = Column(String(100), nullable=False, index=True)
    relation_type = Column(String(50), nullable=False, index=True)
    weight = Column(Float, default=1.0)
    confidence = Column(Float, default=0.5)
    discovered_by = Column(String(50), default="manual")
    evidence = Column(Text)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)


class Courseware(Base):
    __tablename__ = "coursewares"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    subject = Column(String(50), nullable=False)
    version = Column(String(50))
    grade = Column(String(20))
    file_path = Column(String(500), nullable=False)
    slide_count = Column(Integer)
    parse_status = Column(String(20), default="pending")
    parse_mode = Column(String(20), default="free")
    parsed_at = Column(DateTime)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    cognitive_level = Column(String(20))
    chapter = Column(String(200))
    section = Column(String(200))
    page_start = Column(Integer)
    page_end = Column(Integer)
    curriculum_code = Column(String(50))
    is_key_point = Column(Boolean, default=False)
    mastery_rate = Column(Float, default=0.0)
    source_type = Column(String(20), nullable=False)
    courseware_id = Column(String(36), ForeignKey("coursewares.id"))
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)


class CurriculumStandard(Base):
    __tablename__ = "curriculum_standards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject = Column(String(50), nullable=False)
    version = Column(String(50), nullable=False)
    grade = Column(String(20), nullable=False)
    knowledge_tree = Column(JSON, nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)


class Homework(Base):
    __tablename__ = "homeworks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    courseware_id = Column(String(36), ForeignKey("coursewares.id"))
    class_id = Column(String(36), nullable=False)
    title = Column(String(200), nullable=False)
    homework_date = Column(DateTime)
    status = Column(String(20), default="created")
    project_id = Column(String(36), ForeignKey("projects.id"), index=True)
    created_at = Column(DateTime, default=datetime.now)


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    seq = Column(Integer, nullable=False)
    content = Column(String, nullable=False)
    question_type = Column(String(20), nullable=False)
    score = Column(Float, nullable=False)
    answer = Column(String)
    q_matrix = Column(JSON)
    q_matrix_confirmed = Column(Boolean, default=False)
    q_matrix_source = Column(String(20))


class StudentAnswer(Base):
    __tablename__ = "student_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    student_id = Column(String(36), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"))
    student_answer = Column(String)
    score = Column(Float)
    is_correct = Column(Boolean)


class CDMParameter(Base):
    __tablename__ = "cdm_parameters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    model_type = Column(String(20), nullable=False)
    slip = Column(JSON)
    guess = Column(JSON)
    alpha = Column(JSON)
    aic = Column(Float)
    bic = Column(Float)
    convergence_status = Column(String(20))
    estimated_at = Column(DateTime, default=datetime.now)


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    student_id = Column(String(36), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"))
    root_cause_kp_id = Column(String(36), ForeignKey("knowledge_points.id"))
    confidence = Column(Float)
    knowledge_state = Column(JSON)
    trace_path = Column(JSON)
    cdm_params_ref = Column(String(36), ForeignKey("cdm_parameters.id"))
    teacher_confirmed = Column(Boolean, default=False)
    teacher_correction = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)


class ClassDiagnosis(Base):
    __tablename__ = "class_diagnoses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    class_id = Column(String(36), nullable=False)
    root_causes = Column(JSON)
    student_groups = Column(JSON)
    teaching_suggestions = Column(JSON)
    courseware_feedback = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)


class TeacherFeedback(Base):
    __tablename__ = "teacher_feedbacks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    diagnosis_id = Column(String(36), ForeignKey("diagnoses.id", ondelete="CASCADE"))
    feedback_type = Column(String(20), nullable=False)
    correction = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)


class CoursewareFeedback(Base):
    __tablename__ = "courseware_feedbacks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    courseware_id = Column(String(36), ForeignKey("coursewares.id", ondelete="CASCADE"))
    slide_number = Column(Integer, nullable=False)
    knowledge_id = Column(String(36), ForeignKey("knowledge_points.id"))
    mastery_rate = Column(Float)
    suggestion = Column(String)
    created_at = Column(DateTime, default=datetime.now)


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(50), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=False)
    payload = Column(JSON)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.now)
    processed_at = Column(DateTime)


class AgentNotification(Base):
    __tablename__ = "agent_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(Integer, nullable=False)
    event_id = Column(Integer, ForeignKey("agent_events.id"))
    notification_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class DiagnosisSession(Base):
    __tablename__ = "diagnosis_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    student_id = Column(String(36), nullable=False)
    knowledge_state_snapshot = Column(JSON, nullable=False)
    cdm_params_ref = Column(String(36), ForeignKey("cdm_parameters.id"))
    kt_prediction = Column(JSON)
    learning_rate = Column(JSON)
    forgetting_curve = Column(JSON)
    mastery_time_prediction = Column(JSON)
    session_timestamp = Column(DateTime, default=datetime.now, index=True)
    created_at = Column(DateTime, default=datetime.now)


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), nullable=False)
    diagnosis_session_id = Column(String(36), ForeignKey("diagnosis_sessions.id"))
    root_cause_kp_id = Column(String(36), ForeignKey("knowledge_points.id"))
    path_nodes = Column(JSON, nullable=False)
    path_edges = Column(JSON)
    estimated_duration = Column(JSON)
    status = Column(String(20), default="active")
    progress = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime)


class LearningActivity(Base):
    __tablename__ = "learning_activities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learning_path_id = Column(String(36), ForeignKey("learning_paths.id", ondelete="CASCADE"))
    knowledge_point_id = Column(String(36), ForeignKey("knowledge_points.id"))
    activity_type = Column(String(30), nullable=False)
    content = Column(JSON)
    sequence = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")
    result = Column(JSON)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_agent = Column(String(50), nullable=False, index=True)
    receiver_agent = Column(String(50), nullable=False, index=True)
    message_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String(20), default="pending")
    parent_message_id = Column(String(36), ForeignKey("agent_messages.id"))
    created_at = Column(DateTime, default=datetime.now)
    processed_at = Column(DateTime)


class CausalDiscoveryResult(Base):
    __tablename__ = "causal_discovery_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    homework_id = Column(String(36), ForeignKey("homeworks.id", ondelete="CASCADE"))
    algorithm = Column(String(30), nullable=False)
    skeleton = Column(JSON, nullable=False)
    cpdag = Column(JSON)
    do_calculus_results = Column(JSON)
    confidence_scores = Column(JSON)
    sample_size = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)


class AgentState(Base):
    __tablename__ = "agent_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_name = Column(String(50), nullable=False, unique=True, index=True)
    status = Column(String(20), default="active")
    last_event_type = Column(String(50))
    last_event_time = Column(DateTime)
    state_data = Column(JSON)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SchoolClass(Base):
    __tablename__ = "classes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    grade = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)


class StudentGroup(Base):
    __tablename__ = "student_groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    student_ids = Column(JSON)
    focus_kps = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
