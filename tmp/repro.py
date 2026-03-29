from typing import Optional, List
from datetime import date
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

class TestModel(SQLModel):
    some_date: Optional[date] = None
    comments: Optional[list] = Field(default=[], sa_column=Column(JSON))

class Test(TestModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

print("Class created successfully")
