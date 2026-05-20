import sys
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def step(name):
    print(f"[OK] {name}", flush=True)

step("start")
from app.config import settings
step(f"config: {settings.DATABASE_URL}")

from app.database import engine
step("engine created")