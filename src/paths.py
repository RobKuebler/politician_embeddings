"""Project-wide filesystem path constants."""

from pathlib import Path

# Resolved relative to this file:
# src/paths.py -> parent = src/ -> parent = project root
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
OUTPUTS_DIR = ROOT_DIR / "outputs"
FRONTEND_DATA_DIR = ROOT_DIR / "frontend" / "public" / "data"
