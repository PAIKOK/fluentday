from pydantic import BaseModel, EmailStr, Field, field_validator


def _check_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(value.encode()) > 72:
        raise ValueError("Password is too long (72 bytes maximum).")
    return value


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=1, max_length=80)
    timezone: str | None = Field(default=None, max_length=64)

    _password = field_validator("password")(_check_password)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Please enter your name.")
        return value


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=200)


class EmailIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetPasswordIn(TokenIn):
    password: str

    _password = field_validator("password")(_check_password)


class MessageOut(BaseModel):
    message: str
