from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional
from app.db.session import engine
from app.models.dashboard_project import DashboardProject
from app.models.manager import Manager
from app.models.manager_allocation import ManagerAllocation
from app.schemas.dashboard_project import DashboardProjectCreate, DashboardProjectRead, DashboardProjectUpdate
from app.services.availability import is_manager_available
from datetime import date as py_date

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
    
    # Mirror into ManagerAllocation
    pm_name = project.project_manager or "Unassigned"
    manager = session.exec(select(Manager).where(Manager.name == pm_name)).first()
    if not manager:
        manager = Manager(name=pm_name)
        session.add(manager)
        session.commit()
        session.refresh(manager)
        
    start_date = project.material_dispatch_date or project.event_start_date
    if start_date:
        import datetime
        end_date = project.dismantling_date or (start_date + datetime.timedelta(days=7))
        alloc = ManagerAllocation(
            manager_id=manager.id,
            project_id=project.id,
            allocation_start_date=start_date,
            allocation_end_date=end_date
        )
        session.add(alloc)
        session.commit()
        
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
    
    # Sync ManagerAllocation
    pm_name = project.project_manager or "Unassigned"
    manager = session.exec(select(Manager).where(Manager.name == pm_name)).first()
    if not manager:
        manager = Manager(name=pm_name)
        session.add(manager)
        session.commit()
        session.refresh(manager)

    start_date = project.material_dispatch_date or project.event_start_date
    existing_alloc = session.exec(select(ManagerAllocation).where(ManagerAllocation.project_id == project.id)).first()
    
    if existing_alloc:
        existing_alloc.manager_id = manager.id
        if start_date:
            import datetime
            existing_alloc.allocation_start_date = start_date
            existing_alloc.allocation_end_date = project.dismantling_date or (start_date + datetime.timedelta(days=7))
        session.add(existing_alloc)
    elif start_date:
        import datetime
        end_date = project.dismantling_date or (start_date + datetime.timedelta(days=7))
        new_alloc = ManagerAllocation(
            manager_id=manager.id,
            project_id=project.id,
            allocation_start_date=start_date,
            allocation_end_date=end_date
        )
        session.add(new_alloc)

    session.commit()
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    session.delete(project)
    session.commit()
    return {"message": "Project deleted successfully"}

@router.get("/manager/{manager_name}", response_model=List[DashboardProjectRead])
def get_manager_projects(manager_name: str, session: Session = Depends(get_session)):
    """
    Fetch all projects assigned to a specific manager.
    """
    query = select(DashboardProject).where(DashboardProject.project_manager == manager_name)
    projects = session.exec(query).all()
    return projects

@router.get("/availability-check")
def check_availability(
    start_date: py_date,
    end_date: Optional[py_date] = None,
    manager_name: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Check availability for a manager or all managers in a date range.
    """
    if manager_name:
        # Check specific manager
        query = select(DashboardProject).where(DashboardProject.project_manager == manager_name)
        projects = session.exec(query).all()
        result = is_manager_available(start_date, end_date, [p.model_dump() for p in projects])
        return {manager_name: result}
    else:
        # Check all managers
        query = select(DashboardProject)
        all_projects = session.exec(query).all()
        
        # Group by manager
        manager_map = {}
        for p in all_projects:
            if not p.project_manager: continue
            if p.project_manager not in manager_map:
                manager_map[p.project_manager] = []
            manager_map[p.project_manager].append(p.model_dump())
            
        results = {}
        for pm, projects in manager_map.items():
            results[pm] = is_manager_available(start_date, end_date, projects)
            
        return results

@router.get("/timeline")
def get_timeline_data(session: Session = Depends(get_session)):
    """
    Dynamically group all active projects by their project_manager to build the timeline natively.
    """
    try:
        from collections import defaultdict
        
        # 1. Fetch all managers
        managers = session.exec(select(Manager)).all()
        # 2. Fetch all projects
        projects = session.exec(select(DashboardProject)).all()
        
        # 3. Group projects by PM name
        manager_groups = defaultdict(list)
        for p in projects:
            pm = p.project_manager or "Unassigned"
            manager_groups[pm].append(p)
            
        result = []
        # Process known managers first
        for manager in managers:
            pm_name = manager.name
            projs = manager_groups.get(pm_name, [])
            
            alloc_data = []
            for p in projs:
                start = p.material_dispatch_date or p.event_start_date
                if start:
                    alloc_data.append({
                        "id": p.id,
                        "project_id": p.id,
                        "manager_id": manager.id,
                        "allocation_start_date": start,
                        "allocation_end_date": p.dismantling_date,
                        "project": p.model_dump()
                    })
            result.append({
                "manager": manager.model_dump(),
                "allocations": alloc_data
            })
            
            # Remove from tracking to catch unassigned
            if pm_name in manager_groups:
                del manager_groups[pm_name]
                
        # 4. Catch Unassigned or ghost managers
        for pm_name, projs in manager_groups.items():
            alloc_data = []
            for p in projs:
                start = p.material_dispatch_date or p.event_start_date
                if start:
                     alloc_data.append({
                        "id": p.id,
                        "project_id": p.id,
                        "allocation_start_date": start,
                        "allocation_end_date": p.dismantling_date,
                        "project": p.model_dump()
                     })
            result.append({
                "manager": {"name": pm_name, "id": None},
                "allocations": alloc_data
            })
        
        return sorted(result, key=lambda x: str(x["manager"].get("name", "")))
    except Exception as e:
        print(f"Timeline generation error: {e}")
        return []

