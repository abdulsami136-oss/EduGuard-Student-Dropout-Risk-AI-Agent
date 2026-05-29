from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT_DIR / "data" / "student-mat.csv"
MODEL_DIR = ROOT_DIR / "model"
MODEL_PATH = MODEL_DIR / "dropout_model.pkl"


RISK_LOW_MAX = 33
RISK_MEDIUM_MAX = 66


def risk_label(score_0_100: float) -> str:
    if score_0_100 < RISK_LOW_MAX:
        return "Low"
    if score_0_100 < RISK_MEDIUM_MAX:
        return "Medium"
    return "High"


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    # Some CSVs include stray tabs/spaces in headers.
    df = df.copy()
    df.columns = [str(c).strip().replace("\t", " ") for c in df.columns]
    return df


def load_dataset(path: Path = DATA_PATH) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")
    # student-mat.csv uses semicolon-separated values.
    df = pd.read_csv(path, sep=";")
    df = _normalize_columns(df)
    return df


def _make_target(df: pd.DataFrame) -> pd.Series:
    """
    Uses the dataset's `Target` column when present.
    Treats 'Dropout' as positive class; everything else as not-dropout.
    """
    if "Target" not in df.columns:
        raise ValueError(
            "Expected a `Target` column (Dropout/Enrolled/Graduate). "
            "Your file doesn't look like the provided dataset."
        )

    y_raw = df["Target"].astype(str).str.strip().str.lower()
    return (y_raw == "dropout").astype(int)


def _student_id_from_row(row: pd.Series) -> str:
    # Dataset doesn't provide a unique StudentID; create a stable synthetic id.
    # This keeps the demo app consistent across restarts.
    return f"S{int(row.name) + 1:05d}"


def _split_columns(df: pd.DataFrame) -> Tuple[List[str], List[str]]:
    numeric_cols: List[str] = []
    categorical_cols: List[str] = []

    for col in df.columns:
        if col == "Target":
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    return numeric_cols, categorical_cols


def build_pipeline(df: pd.DataFrame) -> Tuple[Pipeline, List[str], List[str]]:
    df = _normalize_columns(df)
    X = df.drop(columns=["Target"])
    numeric_cols, categorical_cols = _split_columns(df)

    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ]
    )

    clf = RandomForestClassifier(
        n_estimators=350,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
        max_depth=None,
        min_samples_split=4,
        min_samples_leaf=2,
    )

    pipe = Pipeline([("pre", pre), ("clf", clf)])
    return pipe, numeric_cols, categorical_cols


@dataclass
class TrainedArtifacts:
    pipeline: Pipeline
    feature_names: List[str]
    numeric_cols: List[str]
    categorical_cols: List[str]
    dataset: pd.DataFrame
    target: pd.Series


def train_and_persist(
    data_path: Path = DATA_PATH, model_path: Path = MODEL_PATH
) -> TrainedArtifacts:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset(data_path)
    y = _make_target(df)

    pipe, numeric_cols, categorical_cols = build_pipeline(df)
    X = df.drop(columns=["Target"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipe.fit(X_train, y_train)

    # Get post-transform feature names for explanation.
    pre: ColumnTransformer = pipe.named_steps["pre"]
    feature_names: List[str] = []
    feature_names.extend(numeric_cols)

    if categorical_cols:
        ohe: OneHotEncoder = pre.named_transformers_["cat"]
        # sklearn >= 1.0 provides get_feature_names_out
        ohe_names = list(ohe.get_feature_names_out(categorical_cols))
        feature_names.extend(ohe_names)

    joblib.dump(
        {
            "pipeline": pipe,
            "feature_names": feature_names,
            "numeric_cols": numeric_cols,
            "categorical_cols": categorical_cols,
        },
        model_path,
    )

    return TrainedArtifacts(
        pipeline=pipe,
        feature_names=feature_names,
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
        dataset=df,
        target=y,
    )


def load_or_train(
    data_path: Path = DATA_PATH, model_path: Path = MODEL_PATH
) -> TrainedArtifacts:
    df = load_dataset(data_path)
    y = _make_target(df)

    if model_path.exists():
        payload = joblib.load(model_path)
        pipe: Pipeline = payload["pipeline"]
        feature_names: List[str] = payload["feature_names"]
        numeric_cols: List[str] = payload["numeric_cols"]
        categorical_cols: List[str] = payload["categorical_cols"]
        return TrainedArtifacts(
            pipeline=pipe,
            feature_names=feature_names,
            numeric_cols=numeric_cols,
            categorical_cols=categorical_cols,
            dataset=df,
            target=y,
        )

    return train_and_persist(data_path=data_path, model_path=model_path)


def list_students(df: pd.DataFrame, limit: int = 5000) -> List[Dict[str, Any]]:
    df = _normalize_columns(df)
    students: List[Dict[str, Any]] = []
    for idx, row in df.head(limit).iterrows():
        students.append(
            {
                "studentId": _student_id_from_row(row),
                "rowIndex": int(idx),
            }
        )
    return students


def predict_for_row(
    artifacts: TrainedArtifacts, row_index: int
) -> Dict[str, Any]:
    df = artifacts.dataset.reset_index(drop=True)
    if row_index < 0 or row_index >= len(df):
        raise IndexError("row_index out of range")

    row = df.loc[row_index]
    X_row = row.drop(labels=["Target"]).to_frame().T

    proba = float(artifacts.pipeline.predict_proba(X_row)[0, 1])
    score = proba * 100.0

    # "Why" explanation (lightweight, no SHAP):
    # - take RF feature importances
    # - for numeric features, check how far the student's value is from dataset median (z-ish)
    # - surface top 4 drivers as human-readable reasons
    reasons = explain_risk(artifacts, row_index=row_index, top_k=4)

    # Provide a few "dashboard metrics" from available columns.
    metrics = _extract_student_metrics(row)

    return {
        "studentId": _student_id_from_row(row),
        "rowIndex": int(row_index),
        "riskScore": round(score, 1),
        "riskLabel": risk_label(score),
        "reasons": reasons,
        "metrics": metrics,
        "rawTarget": str(row.get("Target")),
    }


def _extract_student_metrics(row: pd.Series) -> Dict[str, Any]:
    # Best-effort mapping for the dashboard; columns differ from school dataset.
    def get(col: str) -> Optional[float]:
        if col in row.index and pd.notna(row[col]):
            try:
                return float(row[col])
            except Exception:
                return None
        return None

    return {
        "admissionGrade": get("Admission grade"),
        "ageAtEnrollment": get("Age at enrollment"),
        "tuitionUpToDate": bool(row.get("Tuition fees up to date", 0) == 1)
        if "Tuition fees up to date" in row.index
        else None,
        "debtor": bool(row.get("Debtor", 0) == 1) if "Debtor" in row.index else None,
        "unitsApproved1": get("Curricular units 1st sem (approved)"),
        "unitsApproved2": get("Curricular units 2nd sem (approved)"),
        "grade1": get("Curricular units 1st sem (grade)"),
        "grade2": get("Curricular units 2nd sem (grade)"),
    }


def _safe_zscore(series: pd.Series, value: float) -> float:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if len(s) < 5:
        return 0.0
    std = float(s.std(ddof=0))
    if std == 0:
        return 0.0
    mean = float(s.mean())
    return (value - mean) / std


def explain_risk(
    artifacts: TrainedArtifacts, row_index: int, top_k: int = 4
) -> List[Dict[str, Any]]:
    df = artifacts.dataset.reset_index(drop=True)
    row = df.loc[row_index]

    pre: ColumnTransformer = artifacts.pipeline.named_steps["pre"]
    clf: RandomForestClassifier = artifacts.pipeline.named_steps["clf"]

    importances = clf.feature_importances_
    if len(importances) != len(artifacts.feature_names):
        # If something doesn't align, degrade gracefully.
        return []

    # Build a per-feature "influence score" for the student:
    # influence ~= global importance * magnitude-of-deviation (numeric only)
    influences: List[Tuple[str, float, str]] = []

    # Numeric: use zscore magnitude
    for col in artifacts.numeric_cols:
        if col not in row.index:
            continue
        val = row[col]
        if pd.isna(val):
            continue
        z = abs(_safe_zscore(df[col], float(val)))
        try:
            imp_idx = artifacts.feature_names.index(col)
        except ValueError:
            continue
        score = float(importances[imp_idx]) * float(z)
        direction = "higher than average" if float(val) > float(pd.to_numeric(df[col], errors="coerce").mean()) else "lower than average"
        influences.append((col, score, direction))

    # Categorical: if a category is rare and important, flag it (simple heuristic).
    for col in artifacts.categorical_cols:
        if col not in row.index:
            continue
        val = str(row[col])
        # one-hot name looks like "Column_Value"
        ohe_name = f"{col}_{val}"
        matching = [i for i, fn in enumerate(artifacts.feature_names) if fn == ohe_name]
        if not matching:
            continue
        imp_idx = matching[0]
        # rarity = 1 - frequency
        freq = float((df[col].astype(str) == val).mean())
        rarity = 1.0 - freq
        score = float(importances[imp_idx]) * rarity
        influences.append((col, score, f"value '{val}' is uncommon"))

    influences.sort(key=lambda t: t[1], reverse=True)
    top = influences[:top_k]

    reasons: List[Dict[str, Any]] = []
    for feat, s, detail in top:
        reasons.append(
            {
                "feature": feat,
                "impact": round(float(s), 4),
                "detail": detail,
            }
        )
    return reasons


def generate_suggestions(prediction: Dict[str, Any]) -> List[str]:
    # Lightweight rules layered atop model reasons.
    suggestions: List[str] = []
    metrics = prediction.get("metrics") or {}
    reasons = prediction.get("reasons") or []

    grade1 = metrics.get("grade1")
    grade2 = metrics.get("grade2")

    if isinstance(grade1, (int, float)) and grade1 < 12:
        suggestions.append("Focus on improving 1st semester performance via weekly study blocks and tutoring.")
    if isinstance(grade2, (int, float)) and grade2 < 12:
        suggestions.append("Review 2nd semester weak units and meet with faculty for a catch-up plan.")
    if metrics.get("debtor") is True:
        suggestions.append("Resolve outstanding payments early to avoid administrative blocks.")
    if metrics.get("tuitionUpToDate") is False:
        suggestions.append("Bring tuition status up to date; financial holds often correlate with withdrawal risk.")

    # Add a couple generic actions if we have few suggestions.
    if len(suggestions) < 3:
        suggestions.append("Attend office hours regularly and track assignments with a weekly checklist.")
        suggestions.append("If stress is high, use student support services and set realistic weekly goals.")

    # Tie back to top reasons (make it feel personalized).
    for r in reasons[:2]:
        feat = r.get("feature")
        if feat and isinstance(feat, str):
            suggestions.append(f"Target improvement around: {feat}.")

    # Dedupe while keeping order.
    seen = set()
    out: List[str] = []
    for s in suggestions:
        if s not in seen:
            out.append(s)
            seen.add(s)
    return out[:6]
