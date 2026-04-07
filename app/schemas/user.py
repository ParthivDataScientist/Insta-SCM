from typing import Optional
from pydantic import BaseModel, EmailStr, model_validator, Field
import re

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., description="Password must be complex")
    confirm_password: Optional[str] = None
    role: str = "Operator"
    tos_accepted: bool

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'UserCreate':
        if self.confirm_password and self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        if not self.tos_accepted:
            raise ValueError('Must accept Terms of Service')
        if not re.search(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$", self.password):
            raise ValueError('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character')
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    mfa_enabled: bool = False

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    requires_mfa: bool = False
    mfa_token: Optional[str] = None

class MFAVerify(BaseModel):
    mfa_token: str
    code: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'ResetPasswordRequest':
        if not re.search(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$", self.new_password):
            raise ValueError('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character')
        return self
