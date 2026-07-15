import base64
from io import BytesIO

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": user.id})
    return schemas.Token(access_token=token, user=user)


@router.post("/google", response_model=schemas.LoginResponse)
def google_auth(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    """Sign up or log in with a Google ID token obtained via Google Identity
    Services on the frontend. Verifies the token's signature, audience and
    issuer server-side before trusting any of its claims."""
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    except Exception:
        raise HTTPException(status_code=503, detail="Could not verify Google credential right now. Please try again.")

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    google_id = idinfo["sub"]
    email = idinfo["email"]
    full_name = idinfo.get("name") or email.split("@")[0]
    avatar_url = idinfo.get("picture")

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        # No user linked to this Google account yet — check if the email is
        # already registered (e.g. via password signup) and link it instead
        # of creating a duplicate account.
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_id = google_id
            if not user.avatar_url:
                user.avatar_url = avatar_url
        else:
            user = models.User(
                full_name=full_name,
                email=email,
                google_id=google_id,
                avatar_url=avatar_url,
                hashed_password=None,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    if user.mfa_enabled:
        temp_token = auth.create_mfa_temp_token(user.id)
        return schemas.LoginResponse(mfa_required=True, temp_token=temp_token)

    token = auth.create_access_token({"sub": user.id})
    return schemas.LoginResponse(access_token=token, user=user)


@router.post("/login", response_model=schemas.LoginResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not user.hashed_password or not auth.verify_password(payload.password, user.hashed_password):
        if user and not user.hashed_password:
            raise HTTPException(status_code=401, detail="This account uses Google Sign-In. Use the Google button to log in.")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.mfa_enabled:
        temp_token = auth.create_mfa_temp_token(user.id)
        return schemas.LoginResponse(mfa_required=True, temp_token=temp_token)

    token = auth.create_access_token({"sub": user.id})
    return schemas.LoginResponse(access_token=token, user=user)


@router.post("/mfa/login-verify", response_model=schemas.Token)
def mfa_login_verify(payload: schemas.MFALoginVerifyRequest, db: Session = Depends(get_db)):
    user = auth.verify_mfa_temp_token(payload.temp_token, db)
    if not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled for this account")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid authentication code")

    token = auth.create_access_token({"sub": user.id})
    return schemas.Token(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.post("/mfa/setup", response_model=schemas.MFASetupResponse)
def mfa_setup(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Generates a new TOTP secret and stores it (unconfirmed). MFA isn't
    enabled until the user proves they've enrolled it via /mfa/enable."""
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    secret = pyotp.random_base32()
    current_user.mfa_secret = secret
    db.commit()

    otpauth_url = pyotp.TOTP(secret).provisioning_uri(
        name=current_user.email, issuer_name=settings.mfa_issuer_name
    )

    qr_img = qrcode.make(otpauth_url)
    buf = BytesIO()
    qr_img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return schemas.MFASetupResponse(
        secret=secret,
        otpauth_url=otpauth_url,
        qr_code_base64=f"data:image/png;base64,{qr_b64}",
    )


@router.post("/mfa/enable", response_model=schemas.UserOut)
def mfa_enable(
    payload: schemas.MFACodeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Call /mfa/setup first")

    totp = pyotp.TOTP(current_user.mfa_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid authentication code")

    current_user.mfa_enabled = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/mfa/disable", response_model=schemas.UserOut)
def mfa_disable(
    payload: schemas.MFADisableRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    if not auth.verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    totp = pyotp.TOTP(current_user.mfa_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid authentication code")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    db.refresh(current_user)
    return current_user
