from typing import Optional
from pydantic import BaseModel, EmailStr, model_validator

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: Optional[str] = None
    role: str = "Operator"

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'UserCreate':
        if self.confirm_password and self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
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

class Token(BaseModel):
    access_token: str
    token_type: str
