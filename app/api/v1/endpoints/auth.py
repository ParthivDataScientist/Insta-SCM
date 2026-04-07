from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
import logging
import pyotp
import uuid
import jwt

from app.core.auth import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.db.session import get_session
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, MFAVerify, ForgotPasswordRequest, ResetPasswordRequest
from app.api.deps import get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_session)):
    """Register a new user."""
    user = db.exec(select(User).where(User.email == user_in.email)).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role or "Operator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_session),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """OAuth2 compatible token login, get an access token for future requests."""
    user = db.exec(select(User).where(User.email == form_data.username)).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if user.locked_until and user.locked_until > datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Account is locked. Try again later.")
        
    if not verify_password(form_data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)
        db.add(user)
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Reset failure tracking on success
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    db.commit()

    if user.mfa_enabled:
        # Generate a temporary MFA token valid for 5 mins
        mfa_token = create_access_token(
            subject=str(user.id), expires_delta=timedelta(minutes=5)
        )
        return {"requires_mfa": True, "mfa_token": mfa_token}

    access_token_expires = timedelta(minutes=getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 8))
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=False, # True if using HTTPS
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/mfa/setup")
def setup_mfa(current_user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    """Generate a new MFA secret, does not enforce until verify is called."""
    secret = pyotp.random_base32()
    current_user.mfa_secret = secret
    db.add(current_user)
    db.commit()
    
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="Insta-SCM")
    return {"secret": secret, "otpauth_url": uri}

@router.post("/mfa/verify", response_model=Token)
def verify_mfa(mfa_data: MFAVerify, response: Response, db: Session = Depends(get_session)):
    """Verify MFA token matching the code, returns the actual JWT session."""
    try:
        secret = getattr(settings, "JWT_SECRET_KEY", "fallback_secret_for_local_dev_only")
        payload = jwt.decode(mfa_data.mfa_token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")

    user = db.exec(select(User).where(User.id == int(user_id))).first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="Invalid user or MFA not configured")
        
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(mfa_data.code):
        raise HTTPException(status_code=400, detail="Invalid authentication code")
        
    if not user.mfa_enabled:
        user.mfa_enabled = True
        db.add(user)
        db.commit()

    access_token_expires = timedelta(minutes=getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 8))
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Successfully logged out"}

@router.post("/forgot-password")
def forgot_password(request_data: ForgotPasswordRequest, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == request_data.email)).first()
    if not user:
        return {"message": "If that email is in our system, a reset link will be sent."}
        
    token = uuid.uuid4().hex
    user.reset_token = get_password_hash(token)
    user.reset_token_expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    db.add(user)
    db.commit()
    
    reset_link = f"http://localhost:5173/reset-password?token={token}&email={user.email}"
    print(f"\n" + "="*50)
    print(f"PASSWORD RESET EMAIL TO: {user.email}")
    print(f"LINK: {reset_link}")
    print("="*50 + "\n")
    
    return {"message": "If that email is in our system, a reset link will be sent."}

@router.post("/reset-password")
def reset_password(request_data: ResetPasswordRequest, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == request_data.email)).first()
    if not user or not user.reset_token or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid token or user")
        
    if user.reset_token_expires < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Token has expired")
        
    if not verify_password(request_data.token, user.reset_token):
        raise HTTPException(status_code=400, detail="Invalid token")
        
    user.hashed_password = get_password_hash(request_data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    
    # unlock account on successful reset
    user.locked_until = None
    user.failed_login_attempts = 0
    
    db.add(user)
    db.commit()
    return {"message": "Password reset successfully"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user."""
    return current_user
