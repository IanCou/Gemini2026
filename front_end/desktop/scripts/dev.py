import os
import sys
import subprocess
from pathlib import Path

desktop_dir = Path(__file__).resolve().parent.parent
front_end_dir = desktop_dir.parent
repo_root = front_end_dir.parent

try:
    from dotenv import load_dotenv
    for env_file in [desktop_dir / ".env", front_end_dir / ".env", repo_root / ".env"]:
        if env_file.exists():
            load_dotenv(env_file)
            print(f"[dev.py] Loaded {env_file}")
except ImportError:
    print("[dev.py] python-dotenv not installed, skipping .env loading")

uvicorn_cmd = [
    sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8765",
    "--reload", "--reload-dir", str(front_end_dir), "--reload-dir", str(repo_root / "backend")
]

http_cmd = [
    sys.executable, "-m", "http.server", "1420", "--bind", "127.0.0.1"
]

print("[dev.py] Starting uvicorn...")
uvicorn_proc = subprocess.Popen(uvicorn_cmd, cwd=str(front_end_dir))

print("[dev.py] Starting http.server...")
http_proc = subprocess.Popen(http_cmd, cwd=str(desktop_dir / "public"))

try:
    uvicorn_proc.wait()
    http_proc.wait()
except KeyboardInterrupt:
    print("Shutting down...")
finally:
    uvicorn_proc.terminate()
    http_proc.terminate()
