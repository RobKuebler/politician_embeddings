"""Shared helpers for module-based CLIs."""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path

_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
_LOG_DATE_FORMAT = "%H:%M:%S"
_PERIOD_HELP = (
    "Bundestag period number, e.g. 20 or 21. If omitted, the current period is used."
)


class SmartDefaultsFormatter(argparse.ArgumentDefaultsHelpFormatter):
    """Show defaults only when they add useful information."""

    def _get_help_string(self, action: argparse.Action) -> str:
        help_text = action.help or ""
        if "%(default)" in help_text:
            return help_text
        if action.default in (argparse.SUPPRESS, None, False):
            return help_text
        return f"{help_text} (default: %(default)s)"


def build_parser(description: str) -> argparse.ArgumentParser:
    """Create a consistent parser for module CLIs."""
    return argparse.ArgumentParser(
        description=description,
        formatter_class=SmartDefaultsFormatter,
    )


def add_period_argument(parser: argparse.ArgumentParser) -> None:
    """Add the shared period CLI option."""
    parser.add_argument(
        "--period",
        type=int,
        default=None,
        metavar="INT",
        help=_PERIOD_HELP,
    )


def configure_logging() -> None:
    """Configure the shared CLI logging format."""
    logging.basicConfig(
        level=logging.INFO,
        format=_LOG_FORMAT,
        datefmt=_LOG_DATE_FORMAT,
    )


def write_github_output(**values: str | int | bool) -> None:
    """Write step outputs when running inside GitHub Actions."""
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return

    with Path(output_path).open("a", encoding="utf-8") as handle:
        for key, value in values.items():
            rendered = str(value).lower() if isinstance(value, bool) else str(value)
            handle.write(f"{key}={rendered}\n")
