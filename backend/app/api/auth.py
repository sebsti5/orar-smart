"""/api/auth: register, login, logout, me."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.db import get_db
from app.models import Institution, User
from app.schemas import GeneralSettings, InstitutionSetup

router = APIRouter(prefix="/auth", tags=["auth"])


def _check_email(v: str) -> str:
    v = auth.normalize_email(v)
    if not auth.is_valid_email(v):
        raise ValueError("Adresa de email nu este validă.")
    return v


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=auth.MIN_PASSWORD_LEN, max_length=auth.MAX_PASSWORD_LEN)
    institution_name: str = Field(max_length=200)

    _email = field_validator("email")(_check_email)

    @field_validator("institution_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Numele instituției este obligatoriu.")
        return v


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=auth.MAX_PASSWORD_LEN)


class MeOut(BaseModel):
    email: str
    institution_name: str


def _me(user: User) -> MeOut:
    return MeOut(email=user.email, institution_name=user.institution.name)


@router.post("/register", response_model=MeOut)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> MeOut:
    if db.scalar(select(User).where(User.email == body.email)) is not None:
        raise HTTPException(status_code=409, detail="Există deja un cont cu acest email.")
    setup = InstitutionSetup(general=GeneralSettings(name=body.institution_name))
    inst = Institution(
        name=body.institution_name,
        setup_json=setup.model_dump_json(),
        share_token=secrets.token_urlsafe(12),
    )
    user = User(email=body.email, password_hash=auth.hash_password(body.password),
                institution=inst)
    db.add_all([inst, user])
    db.commit()
    auth.set_session_cookie(response, user.id)
    return _me(user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> MeOut:
    email = auth.normalize_email(body.email)
    if auth.is_rate_limited(email):
        raise HTTPException(
            status_code=429,
            detail="Prea multe încercări eșuate. Încercați din nou peste 15 minute.",
        )
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not auth.verify_password(body.password, user.password_hash):
        auth.record_failure(email)
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă.")
    auth.clear_failures(email)
    auth.set_session_cookie(response, user.id)
    return _me(user)


@router.post("/logout")
def logout(response: Response) -> dict:
    auth.clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(auth.current_user)) -> MeOut:
    return _me(user)
