"""Export the OpenAPI spec to `openapi.yaml`.

Run from the `backend/` directory:

    python scripts/export_openapi.py

The spec is generated from the live route definitions, so the YAML can never
describe an endpoint that does not exist.
"""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

OUTPUT = Path(__file__).resolve().parents[1] / "openapi.yaml"


def main() -> None:
    schema = app.openapi()
    OUTPUT.write_text(
        yaml.dump(schema, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    paths = schema.get("paths", {})
    operations = sum(len(methods) for methods in paths.values())
    print(f"Wrote {OUTPUT}")
    print(f"  {len(paths)} paths, {operations} operations")
    print(f"  {len(schema.get('components', {}).get('schemas', {}))} schemas")


if __name__ == "__main__":
    main()
