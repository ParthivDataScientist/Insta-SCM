from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional
from app.db.session import engine
from app.models.dashboard_project import DashboardProject
from app.schemas.dashboard_project import DashboardProjectCreate, DashboardProjectRead, DashboardProjectUpdate

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

@router.get("/stats")
def get_project_stats(session: Session = Depends(get_session)):
    projects = session.exec(select(DashboardProject)).all()
    
    total = len(projects)
    open_briefs = sum(1 for p in projects if not p.stage or p.stage.lower() != "confirmed")
    won_projects = sum(1 for p in projects if p.stage and p.stage.lower() == "confirmed")
    
    # Unique branch count
    branches = {p.branch for p in projects if p.branch}
    # Unique PM count
    pms = {p.project_manager for p in projects if p.project_manager}
    
    return {
        "total": total,
        "open_briefs": open_briefs,
        "won_projects": won_projects,
        "branches_count": len(branches),
        "pm_count": len(pms)
    }

@router.get("/", response_model=List[DashboardProjectRead])
def get_projects(
    session: Session = Depends(get_session),
    stage: Optional[str] = None
):
    query = select(DashboardProject)
    if stage:
        query = query.where(DashboardProject.stage == stage)
        
    projects = session.exec(query).all()
    return projects

@router.post("/", response_model=DashboardProjectRead)
def create_project(project_in: DashboardProjectCreate, session: Session = Depends(get_session)):
    project = DashboardProject.model_validate(project_in)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.put("/{project_id}", response_model=DashboardProjectRead)
def update_project(project_id: int, project_in: DashboardProjectUpdate, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = project_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    # Force updated_at for SQLite triggers
    project.updated_at = func.now()
        
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    session.delete(project)
    session.commit()
    return {"message": "Project deleted successfully"}
