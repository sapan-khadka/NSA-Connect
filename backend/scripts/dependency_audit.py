#!/usr/bin/env python3
"""Audit pinned Python requirements with pip-audit + OSV severities.

Fails (exit 1) on HIGH/CRITICAL findings. Prints moderate/low as warnings.
"""

from __future__ import annotations

import json
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import certifi

REQUIREMENT_FILES = ("requirements.txt", "requirements-dev.txt")
FAIL_SEVERITIES = frozenset({"HIGH", "CRITICAL"})
WARN_SEVERITIES = frozenset({"MODERATE", "MEDIUM", "LOW"})
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent

OSV_URL = "https://api.osv.dev/v1/vulns/{vuln_id}"
_osv_cache: dict[str, str] = {}
_ssl_context = ssl.create_default_context(cafile=certifi.where())


@dataclass(frozen=True)
class Finding:
    package: str
    version: str
    vuln_id: str
    severity: str
    fix_versions: tuple[str, ...]
    summary: str


def _run_pip_audit() -> dict:
    cmd = [sys.executable, "-m", "pip_audit", "-f", "json"]
    for req in REQUIREMENT_FILES:
        cmd.extend(["-r", str(BACKEND_DIR / req)])
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    raw = proc.stdout.strip()
    if not raw:
        raise RuntimeError(proc.stderr.strip() or "pip-audit produced no output")

    start = raw.find("{")
    if start < 0:
        raise RuntimeError(f"pip-audit did not return JSON: {raw[:200]}")

    return json.loads(raw[start:])


def _cvss_severity(score: str) -> str | None:
    """Best-effort severity from a CVSS vector string."""
    if not score:
        return None
    upper = score.upper()
    if any(marker in upper for marker in (":C:H", "/C:H", ":I:H", "/I:H")):
        return "HIGH"
    if any(marker in upper for marker in (":A:H", "/A:H", "VA:H", "VI:H", "VC:H")):
        return "HIGH"
    low_markers = (":C:L", "/C:L", ":I:L", "/I:L", ":A:L", "/A:L")
    if any(marker in upper for marker in low_markers):
        return "MODERATE"
    return None


def _lookup_osv_severity(vuln_id: str) -> str:
    if vuln_id in _osv_cache:
        return _osv_cache[vuln_id]

    url = OSV_URL.format(vuln_id=vuln_id)
    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "nsa-connect-audit"},
        )
        with urllib.request.urlopen(
            request,
            timeout=20,
            context=_ssl_context,
        ) as response:
            payload = json.load(response)
    except urllib.error.HTTPError:
        severity = "UNKNOWN"
        _osv_cache[vuln_id] = severity
        return severity
    except urllib.error.URLError:
        severity = "UNKNOWN"
        _osv_cache[vuln_id] = severity
        return severity

    db_severity = payload.get("database_specific", {}).get("severity")
    if isinstance(db_severity, str) and db_severity.strip():
        severity = db_severity.strip().upper()
        _osv_cache[vuln_id] = severity
        return severity

    for item in payload.get("severity", []):
        derived = _cvss_severity(str(item.get("score", "")))
        if derived:
            _osv_cache[vuln_id] = derived
            return derived

    severity = "UNKNOWN"
    _osv_cache[vuln_id] = severity
    return severity


def _resolve_severity(vuln: dict) -> str:
    for candidate in (vuln.get("id"), *vuln.get("aliases", [])):
        if not candidate:
            continue
        severity = _lookup_osv_severity(str(candidate))
        if severity != "UNKNOWN":
            return severity
    return "UNKNOWN"


def _collect_findings(report: dict) -> list[Finding]:
    findings: list[Finding] = []
    seen: set[tuple[str, str, str]] = set()

    for dep in report.get("dependencies", []):
        package = dep.get("name", "?")
        version = dep.get("version", "?")
        for vuln in dep.get("vulns", []):
            vuln_id = str(vuln.get("id", "?"))
            key = (package.lower(), version, vuln_id)
            if key in seen:
                continue
            seen.add(key)

            description = str(vuln.get("description", "")).strip()
            summary = description.split("\n", maxsplit=1)[0]
            summary = re.sub(r"\s+", " ", summary)[:160]

            findings.append(
                Finding(
                    package=package,
                    version=version,
                    vuln_id=vuln_id,
                    severity=_resolve_severity(vuln),
                    fix_versions=tuple(vuln.get("fix_versions") or ()),
                    summary=summary,
                )
            )

    return findings


def _print_group(title: str, items: list[Finding]) -> None:
    if not items:
        return
    print(f"\n{title} ({len(items)}):")
    for item in items:
        fix = ", ".join(item.fix_versions) if item.fix_versions else "none listed"
        print(
            f"  - {item.package}=={item.version} | {item.vuln_id} "
            f"| {item.severity} | fix: {fix}"
        )
        if item.summary:
            print(f"    {item.summary}")


def _print_package_summary(findings: list[Finding]) -> None:
    by_package: dict[str, list[Finding]] = {}
    for item in findings:
        key = f"{item.package}=={item.version}"
        by_package.setdefault(key, []).append(item)

    print("\n=== Summary by package ===")
    for package, items in sorted(by_package.items()):
        severities = sorted({item.severity for item in items})
        fixes = sorted({v for item in items for v in item.fix_versions})
        fix_label = ", ".join(fixes) if fixes else "none listed"
        print(
            f"  {package}: {len(items)} finding(s), "
            f"severities={','.join(severities)}, fix={fix_label}"
        )


def main() -> int:
    print("Running pip-audit against requirements.txt and requirements-dev.txt...")
    report = _run_pip_audit()
    findings = _collect_findings(report)

    if not findings:
        print("No known vulnerabilities found.")
        return 0

    blocking = [f for f in findings if f.severity in FAIL_SEVERITIES]
    warnings = [f for f in findings if f.severity in WARN_SEVERITIES]
    unknown = [
        f for f in findings if f.severity not in FAIL_SEVERITIES | WARN_SEVERITIES
    ]

    _print_package_summary(findings)
    _print_group("HIGH / CRITICAL (blocks CI)", blocking)
    _print_group("MODERATE / LOW (warning only)", warnings)
    _print_group("UNKNOWN severity (warning only)", unknown)

    print(
        f"\nTotal: {len(findings)} finding(s) — "
        f"{len(blocking)} blocking, {len(warnings)} warning, {len(unknown)} unknown"
    )

    if blocking:
        print(
            "\nDependency audit FAILED: resolve HIGH/CRITICAL vulnerabilities "
            "before merging."
        )
        return 1

    print("\nDependency audit passed (no HIGH/CRITICAL vulnerabilities).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
