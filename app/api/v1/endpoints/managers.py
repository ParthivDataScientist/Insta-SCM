from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from app.db.session import engine
from app.models.manager import Manager

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

@router.get("/", response_model=List[Manager])
def get_managers(session: Session = Depends(get_session)):
    managers = session.exec(select(Manager)).all()
    # Sort by name
    return sorted(managers, key=lambda m: m.name)

@router.post("/", response_model=Manager)
def create_manager(manager: Manager, session: Session = Depends(get_session)):
    existing = session.exec(select(Manager).where(Manager.name == manager.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Manager with this name already exists")
    session.add(manager)
    session.commit()
    session.refresh(manager)
    return manager

@router.put("/{manager_id}", response_model=Manager)
def update_manager(manager_id: int, manager_in: Manager, session: Session = Depends(get_session)):
    manager = session.get(Manager, manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
        
    manager_data = manager_in.model_dump(exclude_unset=True)
    for key, value in manager_data.items():
        if key != 'id':
            setattr(manager, key, value)
            
    session.add(manager)
    session.commit()
    session.refresh(manager)
    return manager

@router.delete("/{manager_id}")
def delete_manager(manager_id: int, session: Session = Depends(get_session)):
    manager = session.get(Manager, manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    session.delete(manager)
    session.commit()
    return {"message": "Manager deleted"}
