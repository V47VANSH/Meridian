"""Rebuild the combined milestone 3-5 submission ZIP.

    python submission/build.py

Produces `submission/team-098-milestone-3-5.zip` containing exactly three files
inside a parent folder of the same name. The submission is checked by an
automated validator that fails on any extra file, draft, PDF or sub-folder, so
this script rebuilds the folder from scratch each time rather than adding to
whatever is already there.

`api-doc.yaml` and `user-stories.txt` are both derived from `backend/openapi.yaml`,
which is itself generated from the live route table. That chain is deliberate:
the stories submitted cannot claim endpoints the API does not serve.

Run `backend/scripts/export_openapi.py` first if the API has changed.
"""

from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required. Run this with backend/.venv's interpreter.")

TEAM = "098"
FOLDER = f"team-{TEAM}-milestone-3-5"

ROOT = Path(__file__).resolve().parents[1]
SUBMISSION_DIR = Path(__file__).resolve().parent
TARGET = SUBMISSION_DIR / FOLDER
SPEC = ROOT / "backend" / "openapi.yaml"

# The validator accepts these three and nothing else.
ALLOWED = {"api-doc.yaml", "user-identification.txt", "user-stories.txt"}


def build_user_stories(spec: dict) -> str:
    mapping = spec["x-user-story-mapping"]
    total = sum(len(epic["stories"]) for epic in mapping)

    lines: list[str] = []
    add = lines.append

    add("MERIDIAN - APARTMENT COMPLEX MANAGEMENT SYSTEM")
    add("Team 98 | IITM BS Degree, Software Engineering | May 2026")
    add("User Stories")
    add("")
    add("")
    add("FORMAT AND METHOD")
    add("=================")
    add("")
    add("Each story follows the required form:")
    add("")
    add("    As a [type of user], I want [an action], so that [a benefit/value].")
    add("")
    add("Stories were written against the SMART guidelines - each names a specific")
    add("actor and action, has an observable outcome that can be demonstrated, is")
    add("achievable within a sprint, is relevant to a pain point identified in user")
    add("research, and is bounded by the sprint it was scheduled in.")
    add("")
    add("The endpoints listed under each story are not documentation written after")
    add("the fact. They are published inside the API contract itself, as an")
    add("'x-user-story-mapping' extension in api-doc.yaml, so the traceability from")
    add("story to implementation travels with the specification and is regenerated")
    add("from the live route table whenever the API changes.")
    add("")
    add(f"Total: {total} user stories across {len(mapping)} epics.")

    for epic in mapping:
        add("")
        add("")
        add("=" * 74)
        add(epic["epic"].upper())
        add("=" * 74)
        for story in epic["stories"]:
            add("")
            add(story["id"])
            add("-" * len(story["id"]))
            actor, _, rest = story["story"].partition(", I want ")
            want, _, benefit = rest.partition(" so that ")
            add(f"  {actor.strip()},")
            add(f"  I want {want.strip().rstrip(',')},")
            add(f"  so that {benefit.strip()}")
            add("")
            add("  Implemented by:")
            for endpoint in story["endpoints"]:
                add(f"    - {endpoint}")

    add("")
    add("")
    add("=" * 74)
    add("COVERAGE")
    add("=" * 74)
    add("")
    for epic in mapping:
        add(f"  {epic['epic']:<50} {len(epic['stories'])} stories")
    add("")
    add(f"  {'TOTAL':<50} {total} stories")
    add("")
    add("Every story above is implemented and covered by automated tests. The full")
    add("test inventory, including the expected-vs-actual case that did not match on")
    add("first run, is in the milestone reports.")
    add("")

    return "\n".join(lines)


def main() -> None:
    if not SPEC.exists():
        sys.exit(f"Missing {SPEC}. Run backend/scripts/export_openapi.py first.")

    spec = yaml.safe_load(SPEC.read_text(encoding="utf-8"))

    # user-identification.txt is hand-written; preserve it across rebuilds.
    identification = TARGET / "user-identification.txt"
    preserved = identification.read_text(encoding="utf-8") if identification.exists() else None
    if preserved is None:
        sys.exit(
            "user-identification.txt is missing and cannot be generated — it is "
            "hand-written. Restore it from git before rebuilding."
        )

    # Rebuild from empty so a stray file cannot survive into the archive.
    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True)

    (TARGET / "user-identification.txt").write_text(preserved, encoding="utf-8", newline="\r\n")
    (TARGET / "user-stories.txt").write_text(
        build_user_stories(spec), encoding="utf-8", newline="\r\n"
    )
    shutil.copyfile(SPEC, TARGET / "api-doc.yaml")

    present = {p.name for p in TARGET.iterdir()}
    if present != ALLOWED:
        sys.exit(f"Unexpected contents: {sorted(present)}; expected {sorted(ALLOWED)}")

    archive = SUBMISSION_DIR / f"{FOLDER}.zip"
    archive.unlink(missing_ok=True)

    # The parent folder must be inside the archive — zipping the three files
    # directly fails the validator's structural check.
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(ALLOWED):
            zf.write(TARGET / name, arcname=f"{FOLDER}/{name}")

    with zipfile.ZipFile(archive) as zf:
        entries = zf.namelist()

    print(f"Wrote {archive.name} ({archive.stat().st_size // 1024} KB)")
    for entry in entries:
        print(f"  {entry}")

    paths = len(spec["paths"])
    stories = sum(len(e["stories"]) for e in spec["x-user-story-mapping"])
    print(f"\napi-doc.yaml: {paths} paths, {stories} user stories mapped")


if __name__ == "__main__":
    main()
