import sys
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(__file__))
import app._patch_win32

from app.database import engine, SessionLocal
from app.models.db_models import Base, CurriculumStandard, KnowledgePoint, Courseware, Project


def init_database():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def import_curriculum():
    db = SessionLocal()
    try:
        existing = db.query(CurriculumStandard).first()
        if existing:
            logger.info("Curriculum data already exists, skipping import")
            return

        from app.services.curriculum_service import import_default_curriculum
        result = import_default_curriculum(db)
        logger.info("Curriculum imported: %s", result)
    except Exception as e:
        logger.error("Failed to import curriculum: %s", e)
        raise
    finally:
        db.close()


def create_sample_project():
    db = SessionLocal()
    try:
        existing = db.query(Project).filter(Project.name == "示例项目").first()
        if existing:
            logger.info("Sample project already exists")
            return

        project = Project(
            name="示例项目",
            subject="geography",
            grade="高一",
            status="active",
            curriculum_imported=True,
            graph_initialized=True,
        )
        db.add(project)
        db.commit()
        logger.info("Sample project created: %s", project.id)
    except Exception as e:
        logger.error("Failed to create sample project: %s", e)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Starting data initialization...")
    init_database()
    import_curriculum()
    create_sample_project()
    logger.info("Data initialization complete")