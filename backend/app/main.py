from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from app.api.v1 import courseware, knowledge, homework, diagnosis, curriculum, agent, project
from app.api.v1.class_api import router as class_router
from app.api.v1.agent_config_api import router as agent_config_router
from app.api.v1 import settings as settings_api
from app.database import engine, SessionLocal
from app.models.db_models import Base  # noqa: F401
from app.config import settings
import os
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.services.agent_service import register_all_agents
    from app.services.agent_bus import AgentBus
    from app.services.knowledge_service import init_knowledge_store
    register_all_agents()
    db = SessionLocal()
    try:
        init_knowledge_store(db)
        AgentBus.initialize_all_agents(db)
        logger.info("Application startup complete, %d agents initialized", 5)
    finally:
        db.close()
    yield
    logger.info("Application shutdown")


app = FastAPI(
    title="GraphAgent",
    description="知识图谱驱动的多Agent学情诊断与CDM根因追溯引擎",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health check (before SPA catch-all) ---
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# --- API routes ---
app.include_router(courseware.router)
app.include_router(knowledge.router)
app.include_router(homework.router)
app.include_router(diagnosis.router)
app.include_router(curriculum.router)
app.include_router(agent.router)
app.include_router(project.router)
app.include_router(class_router)
app.include_router(agent_config_router)
app.include_router(settings_api.router)

# --- Static file serving ---
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# --- Serve built frontend (production mode) ---
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_FRONTEND_DIR = os.path.join(_PROJECT_ROOT, "frontend", "dist")
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIR, "assets")), name="frontend-assets")

    @app.get("/favicon.svg")
    async def favicon():
        return FileResponse(os.path.join(_FRONTEND_DIR, "favicon.svg"))

    @app.get("/icons.svg")
    async def icons():
        return FileResponse(os.path.join(_FRONTEND_DIR, "icons.svg"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(_FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_FRONTEND_DIR, "index.html"))


# --- Exception handlers ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误",
            "detail": str(exc) if settings.DATABASE_URL.startswith("sqlite") else "请联系管理员",
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "code": "INVALID_INPUT",
            "message": str(exc),
        },
    )
