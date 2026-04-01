"""Project-wide filesystem path constants."""

from pathlib import Path

# Resolved relative to this file (src/paths.py → parent = src/ → parent = project root)
DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"
