from datetime import date as py_date
from typing import List, Optional

def is_manager_available(new_start: py_date, new_end: Optional[py_date], existing_projects: List[dict]) -> dict:
    """
    Checks if a manager is available for a given date range.
    
    Args:
        new_start: The start date (dispatch date) of the new project.
        new_end: The end date (dismantle date) of the new project. If None, it's considered indefinite.
        existing_projects: A list of dicts with 'material_dispatch_date' and 'dismantling_date'.
        
    Returns:
        dict: { "available": bool, "conflicts": List[dict] }
    """
    conflicts = []
    
    # If no start date, we can't check
    if not new_start:
        return {"available": True, "conflicts": []}

    for project in existing_projects:
        start = project.get("material_dispatch_date")
        end = project.get("dismantling_date")
        
        # If no start date for existing project, it's an invalid data state, skip
        if not start:
            continue
            
        # Overlap Logic:
        # (StartA <= EndB) and (EndA >= StartB)
        # If End is None, we treat it as infinite in the future
        
        # Determine effective end dates
        effective_new_end = new_end if new_end else py_date.max
        effective_existing_end = end if end else py_date.max
        
        # Check overlap
        if new_start <= effective_existing_end and effective_new_end >= start:
            conflicts.append(project)
            
    return {
        "available": len(conflicts) == 0,
        "conflicts": conflicts
    }
