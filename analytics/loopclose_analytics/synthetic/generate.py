"""
E10.1–10.2 — Synthetic population + screening results.

v0: self-contained generator (no Synthea dependency) so the pipeline runs on day one. Synthea FHIR R4
export can be layered in later (E10.1) by replacing `_demographics` with a reader over Synthea Patients.
Outputs NDJSON the API seeder (E10.3) ingests.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np

LOCALES = ["ar", "en", "ur", "hi"]
LOCALE_WEIGHTS = [0.45, 0.25, 0.18, 0.12]  # placeholder UAE resident mix; documented assumption
NATIONALITY_BY_LOCALE = {"ar": ["AE", "EG", "JO", "SY"], "en": ["GB", "PH", "US", "ZA"], "ur": ["PK"], "hi": ["IN"]}

FIT_POSITIVITY = 0.06  # 5–7% (programme literature; see simulation/parameters.yaml)
BIRADS_4_5_RATE = 0.025


@dataclass
class Patient:
    fhirId: str
    givenName: str
    familyName: str
    birthDate: str
    sex: str
    nationality: str
    preferredLocale: str
    phone: str
    distanceKm: float
    transportBarrier: bool
    priorNoShows: int


@dataclass
class Result:
    externalId: str
    programmeId: str
    patientFhirId: str
    loincCode: str
    valueText: str
    actionable: bool
    flags: list[str]
    issuedAt: str


def _demographics(rng: np.random.Generator, i: int) -> Patient:
    locale = rng.choice(LOCALES, p=LOCALE_WEIGHTS)
    age = int(rng.integers(40, 76))
    birth = date(2026 - age, int(rng.integers(1, 13)), int(rng.integers(1, 28)))
    distance = float(np.clip(rng.lognormal(2.3, 0.6), 1, 120))
    return Patient(
        fhirId=f"pt-{i:05d}",
        givenName=f"Patient{i:05d}",
        familyName="Synthetic",
        birthDate=birth.isoformat(),
        sex=str(rng.choice(["female", "male"])),
        nationality=str(rng.choice(NATIONALITY_BY_LOCALE[locale])),
        preferredLocale=str(locale),
        phone=f"+9715{rng.integers(10000000, 99999999)}",
        distanceKm=round(distance, 1),
        transportBarrier=bool(rng.random() < (0.25 if distance > 30 else 0.08)),
        priorNoShows=int(rng.poisson(0.3)),
    )


def _fit_result(rng: np.random.Generator, p: Patient, when: datetime) -> Result:
    positive = rng.random() < FIT_POSITIVITY
    flags: list[str] = []
    if positive:
        if rng.random() < 0.08:
            flags.append("alarm_symptoms")
        if rng.random() < 0.15:
            flags.append("anaemia")
    return Result(
        externalId=f"fit-{p.fhirId}-{when.date().isoformat()}",
        programmeId="colorectal-fit",
        patientFhirId=p.fhirId,
        loincCode="29771-3",
        valueText="FIT positive" if positive else "FIT negative",
        actionable=positive,
        flags=flags,
        issuedAt=when.isoformat(),
    )


def _mammogram_result(rng: np.random.Generator, p: Patient, when: datetime) -> Result:
    r = rng.random()
    if r < BIRADS_4_5_RATE * 0.2:
        cat, flags = "5", ["birads_5"]
    elif r < BIRADS_4_5_RATE * 0.45:
        cat, flags = "4c", ["birads_4c"]
    elif r < BIRADS_4_5_RATE:
        cat, flags = str(rng.choice(["4a", "4b"])), []
    else:
        cat, flags = str(rng.choice(["1", "2", "3"], p=[0.5, 0.4, 0.1])), []
    return Result(
        externalId=f"mmg-{p.fhirId}-{when.date().isoformat()}",
        programmeId="breast-birads",
        patientFhirId=p.fhirId,
        loincCode="72137-3",
        valueText=f"BI-RADS {cat}",
        actionable=cat.startswith(("4", "5")),
        flags=flags,
        issuedAt=when.isoformat(),
    )


def generate_population(n: int, seed: int, out_dir: Path) -> dict:
    rng = np.random.default_rng(seed)
    start = datetime(2026, 9, 1, tzinfo=UTC)
    patients: list[Patient] = []
    results: list[Result] = []
    for i in range(n):
        p = _demographics(rng, i)
        patients.append(p)
        when = start + timedelta(days=int(rng.integers(0, 60)), hours=int(rng.integers(7, 18)))
        results.append(_fit_result(rng, p, when))
        if p.sex == "female" and rng.random() < 0.6:
            results.append(_mammogram_result(rng, p, when + timedelta(days=int(rng.integers(0, 10)))))

    (out_dir / "patients.ndjson").write_text("\n".join(json.dumps(asdict(p)) for p in patients), encoding="utf-8")
    (out_dir / "results.ndjson").write_text("\n".join(json.dumps(asdict(r)) for r in results), encoding="utf-8")
    actionable = [r for r in results if r.actionable]
    return {
        "patients": len(patients),
        "results": len(results),
        "actionable": len(actionable),
        "fit_positive": sum(1 for r in actionable if r.programmeId == "colorectal-fit"),
        "birads_4_5": sum(1 for r in actionable if r.programmeId == "breast-birads"),
        "out_dir": str(out_dir),
    }
