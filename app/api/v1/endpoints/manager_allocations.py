from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from app.db.session import engine
from app.models.manager_allocation import ManagerAllocation

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

@router.get("/", response_model=List[ManagerAllocation])
def get_allocations(session: Session = Depends(get_session)):
    allocations = session.exec(select(ManagerAllocation)).all()
    return allocations

@router.post("/", response_model=ManagerAllocation)
def create_allocation(allocation: ManagerAllocation, session: Session = Depends(get_session)):
    session.add(allocation)
    session.commit()
    session.refresh(allocation)
    return allocation

@router.put("/{alloc_id}", response_model=ManagerAllocation)
def update_allocation(alloc_id: int, alloc_in: ManagerAllocation, session: Session = Depends(get_session)):
    allocation = session.get(ManagerAllocation, alloc_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
        
    update_data = alloc_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key != 'id':
            setattr(allocation, key, value)
            
    session.add(allocation)
    session.commit()
    session.refresh(allocation)
    return allocation

@router.delete("/{alloc_id}")
def delete_allocation(alloc_id: int, session: Session = Depends(get_session)):
    allocation = session.get(ManagerAllocation, alloc_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    session.delete(allocation)
    session.commit()
    return {"message": "Allocation deleted"}
