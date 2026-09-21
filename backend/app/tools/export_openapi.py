"""Run with PYTHONPATH=backend: uv run --frozen python -m app.tools.export_openapi."""

import json
from pathlib import Path

from app.main import create_app


def main() -> None:
    destination = Path(__file__).resolve().parents[2] / "openapi.json"
    destination.write_text(
        json.dumps(create_app().openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )
    print(f"Exported {destination}")


if __name__ == "__main__":
    main()
