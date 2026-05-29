from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from .auth_utils import hash_password, new_token, verify_password
from .database import get_db
from .db_models import User
from .model import (
    TrainedArtifacts,
    generate_suggestions,
    load_or_train,
    predict_for_row,
    risk_label,
)


router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(..., description="Student | Admin | Faculty")
    full_name: Optional[str] = Field(None, max_length=120)
    student_id: Optional[str] = Field(
        None, description="Required for Student role, e.g. S00001"
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not EMAIL_RE.match(email):
            raise ValueError("Invalid email address")
        return email

    @field_validator("role")
    @classmethod
    def normalize_role(cls, v: str) -> str:
        role = v.strip().title()
        if role not in {"Student", "Admin", "Faculty"}:
            raise ValueError("Role must be Student, Admin, or Faculty")
        return role


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginResponse(BaseModel):
    role: str
    userId: str
    email: str
    token: str
    fullName: Optional[str] = None


def _user_public_id(user: User) -> str:
    if user.role == "Student" and user.student_id:
        return user.student_id
    return f"U{user.id:05d}"


def _validate_student_id(student_id: str, art: TrainedArtifacts) -> int:
    sid = student_id.strip().upper()
    if not sid.startswith("S") or not sid[1:].isdigit():
        raise HTTPException(
            status_code=400,
            detail="Student ID must look like S00001",
        )
    row_index = int(sid[1:]) - 1
    df = art.dataset.reset_index(drop=True)
    if row_index < 0 or row_index >= len(df):
        raise HTTPException(status_code=400, detail="Student ID not found in dataset")
    return row_index


class StudentSummary(BaseModel):
    studentId: str
    rowIndex: int
    riskScore: float
    riskLabel: str


class StudentDetail(BaseModel):
    studentId: str
    rowIndex: int
    riskScore: float
    riskLabel: str
    reasons: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    suggestions: List[str]


class AdminOverview(BaseModel):
    totalStudents: int
    riskCounts: Dict[str, int]
    breakdownByCourse: Dict[str, int]


def _artifacts() -> TrainedArtifacts:
    # Load from disk or train on first request.
    return load_or_train()


@router.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/register", response_model=LoginResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> LoginResponse:
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    student_id: Optional[str] = None
    if req.role == "Student":
        if not req.student_id:
            raise HTTPException(
                status_code=400,
                detail="Student ID is required when registering as a student",
            )
        art = _artifacts()
        _validate_student_id(req.student_id, art)
        student_id = req.student_id.strip().upper()
        taken = db.query(User).filter(User.student_id == student_id).first()
        if taken:
            raise HTTPException(
                status_code=409,
                detail="This student ID is already linked to another account",
            )
    elif req.student_id:
        raise HTTPException(
            status_code=400,
            detail="Student ID is only used for Student accounts",
        )

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        full_name=req.full_name.strip() if req.full_name else None,
        student_id=student_id,
        api_token=new_token(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return LoginResponse(
        role=user.role,
        userId=_user_public_id(user),
        email=user.email,
        token=user.api_token or "",
        fullName=user.full_name,
    )


@router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.api_token = new_token()
    db.commit()
    db.refresh(user)

    return LoginResponse(
        role=user.role,
        userId=_user_public_id(user),
        email=user.email,
        token=user.api_token or "",
        fullName=user.full_name,
    )


@router.get("/students", response_model=List[StudentSummary])
def get_students(risk: Optional[str] = None, limit: int = 250) -> List[StudentSummary]:
    art = _artifacts()
    df = art.dataset.reset_index(drop=True)
    limit = max(1, min(limit, 2000))

    risk_norm = risk.strip().title() if risk else None
    if risk_norm and risk_norm not in {"Low", "Medium", "High"}:
        raise HTTPException(status_code=400, detail="risk must be Low|Medium|High")

    items: List[StudentSummary] = []
    # For speed, predict in a loop only over first N.
    for row_index in range(min(limit, len(df))):
        pred = predict_for_row(art, row_index=row_index)
        if risk_norm and pred["riskLabel"] != risk_norm:
            continue
        items.append(
            StudentSummary(
                studentId=pred["studentId"],
                rowIndex=pred["rowIndex"],
                riskScore=pred["riskScore"],
                riskLabel=pred["riskLabel"],
            )
        )
    return items


@router.get("/students/{student_id}", response_model=StudentDetail)
def get_student(student_id: str) -> StudentDetail:
    art = _artifacts()
    df = art.dataset.reset_index(drop=True)

    # student_id is synthetic: S00001 => rowIndex 0
    if not student_id.startswith("S") or not student_id[1:].isdigit():
        raise HTTPException(status_code=400, detail="Invalid student ID format")
    row_index = int(student_id[1:]) - 1
    if row_index < 0 or row_index >= len(df):
        raise HTTPException(status_code=404, detail="Student not found")

    pred = predict_for_row(art, row_index=row_index)
    suggestions = generate_suggestions(pred)

    return StudentDetail(
        studentId=pred["studentId"],
        rowIndex=pred["rowIndex"],
        riskScore=pred["riskScore"],
        riskLabel=pred["riskLabel"],
        reasons=pred["reasons"],
        metrics=pred["metrics"],
        suggestions=suggestions,
    )


@router.get("/admin/overview", response_model=AdminOverview)
def admin_overview() -> AdminOverview:
    art = _artifacts()
    df = art.dataset.reset_index(drop=True)

    # Compute risk counts (loop is ok for demo dataset size).
    counts = {"Low": 0, "Medium": 0, "High": 0}
    for i in range(len(df)):
        proba = float(art.pipeline.predict_proba(df.drop(columns=["Target"]).iloc[[i]])[0, 1])
        score = proba * 100.0
        counts[risk_label(score)] += 1

    # Department-ish breakdown: use Course code if present.
    breakdown: Dict[str, int] = {}
    if "Course" in df.columns:
        for course, n in df["Course"].value_counts().head(12).items():
            breakdown[str(course)] = int(n)

    return AdminOverview(
        totalStudents=int(len(df)),
        riskCounts=counts,
        breakdownByCourse=breakdown,
    )


class FacultyClassResponse(BaseModel):
    facultyId: str
    classKey: str
    students: List[StudentSummary]
    classAverages: Dict[str, float]


def _faculty_class_key(faculty_id: str) -> str:
    # Deterministic mapping (demo): pick a course code bucket based on hash.
    return str(abs(hash(faculty_id)) % 5)


@router.get("/faculty/{faculty_id}/class", response_model=FacultyClassResponse)
def faculty_class(faculty_id: str, limit: int = 80) -> FacultyClassResponse:
    art = _artifacts()
    df = art.dataset.reset_index(drop=True)
    limit = max(1, min(limit, 300))

    class_key = _faculty_class_key(faculty_id)

    # If `Course` exists: assign courses to faculty buckets.
    if "Course" in df.columns:
        courses = sorted(df["Course"].astype(str).unique().tolist())
        if courses:
            picked = courses[int(class_key) % len(courses)]
            subset = df[df["Course"].astype(str) == picked].head(limit)
            idxs = subset.index.tolist()
        else:
            idxs = list(range(min(limit, len(df))))
    else:
        idxs = list(range(min(limit, len(df))))

    students: List[StudentSummary] = []
    grade1s: List[float] = []
    grade2s: List[float] = []

    for i in idxs:
        pred = predict_for_row(art, row_index=int(i))
        students.append(
            StudentSummary(
                studentId=pred["studentId"],
                rowIndex=pred["rowIndex"],
                riskScore=pred["riskScore"],
                riskLabel=pred["riskLabel"],
            )
        )
        m = pred.get("metrics") or {}
        if isinstance(m.get("grade1"), (int, float)):
            grade1s.append(float(m["grade1"]))
        if isinstance(m.get("grade2"), (int, float)):
            grade2s.append(float(m["grade2"]))

    class_avgs = {
        "grade1Avg": float(sum(grade1s) / len(grade1s)) if grade1s else 0.0,
        "grade2Avg": float(sum(grade2s) / len(grade2s)) if grade2s else 0.0,
        "riskAvg": float(sum(s.riskScore for s in students) / len(students)) if students else 0.0,
    }

    return FacultyClassResponse(
        facultyId=faculty_id,
        classKey=class_key,
        students=students,
        classAverages={k: round(v, 2) for k, v in class_avgs.items()},
    )


class FacultyNoteRequest(BaseModel):
    facultyId: str
    studentId: str
    message: str


@router.post("/faculty/note")
def faculty_note(req: FacultyNoteRequest) -> Dict[str, str]:
    # Demo-only: no persistence, just pretend we sent it.
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    return {"status": "sent", "studentId": req.studentId}
