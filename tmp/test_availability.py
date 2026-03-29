from datetime import date
from app.services.availability import is_manager_available

def test_overlap_logic():
    existing = [
        {"id": 1, "material_dispatch_date": date(2024, 1, 10), "dismantling_date": date(2024, 1, 20), "project_name": "Proj 1"},
        {"id": 2, "material_dispatch_date": date(2024, 2, 1), "dismantling_date": None, "project_name": "Proj 2"}, # Indefinite
    ]
    
    # Case 1: No overlap
    res = is_manager_available(date(2024, 1, 1), date(2024, 1, 5), existing)
    assert res["available"] == True
    
    # Case 2: Exact overlap (start matches end)
    res = is_manager_available(date(2024, 1, 5), date(2024, 1, 10), existing)
    assert res["available"] == False
    assert len(res["conflicts"]) == 1
    
    # Case 3: Inside range
    res = is_manager_available(date(2024, 1, 12), date(2024, 1, 15), existing)
    assert res["available"] == False
    
    # Case 4: Overlap with indefinite
    res = is_manager_available(date(2024, 2, 15), date(2024, 2, 20), existing)
    assert res["available"] == False
    assert res["conflicts"][0]["id"] == 2
    
    # Case 5: Before indefinite
    res = is_manager_available(date(2024, 1, 25), date(2024, 1, 30), existing)
    assert res["available"] == True
    
    print("All backend tests passed!")

if __name__ == "__main__":
    test_overlap_logic()
