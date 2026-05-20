import sys
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with open("_test_result.txt", "w") as f:
    try:
        f.write("step1: importing platform patch\n")
        f.flush()
        import app._patch_win32
        f.write("step2: patch OK\n")
        f.flush()
        
        f.write("step3: importing database\n")
        f.flush()
        from app.database import engine
        f.write("step4: engine OK\n")
        f.flush()
        
        f.write("step5: importing models\n")
        f.flush()
        from app.models.db_models import Base, AgentMessage, AgentEvent, AgentState
        f.write("step6: models OK\n")
        f.flush()
        
        f.write("step7: importing agent_bus\n")
        f.flush()
        from app.services.agent_bus import AgentBus
        f.write("step8: agent_bus OK\n")
        f.flush()
        
        f.write("step9: importing agent_service\n")
        f.flush()
        from app.services.agent_service import register_all_agents
        f.write("step10: agent_service OK\n")
        f.flush()
        
        f.write("step11: registering agents\n")
        f.flush()
        register_all_agents()
        f.write("ALL OK\n")
    except Exception as e:
        f.write(f"ERROR: {type(e).__name__}: {e}\n")
        import traceback
        f.write(traceback.format_exc())