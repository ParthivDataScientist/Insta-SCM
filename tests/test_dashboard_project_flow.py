def create_manager(client, name="Manager A"):
    response = client.post("/api/v1/projects/managers", json={"name": name})
    assert response.status_code == 200
    return response.json()


def create_execution_project(client, payload):
    base_payload = {
        "project_name": "Execution Project",
        "stage": "Win",
        "board_stage": "TBC",
    }
    base_payload.update(payload)
    response = client.post("/api/v1/projects/", json=base_payload)
    assert response.status_code == 200, response.text
    return response.json()


class TestDesignToExecutionFlow:
    def test_crm_sync_and_win_conversion(self, client):
        sync_response = client.post("/api/v1/projects/crm/designs/sync")
        assert sync_response.status_code == 200
        assert sync_response.json()["upserted"] == 3

        design_response = client.get("/api/v1/projects/designs")
        assert design_response.status_code == 200
        design_rows = design_response.json()
        assert len(design_rows) == 3

        target = next(row for row in design_rows if row["crm_project_id"] == "CRM-DES-2401")
        win_response = client.post(f"/api/v1/projects/designs/{target['id']}/win")
        assert win_response.status_code == 200
        won_project = win_response.json()
        assert won_project["stage"] == "Win"
        assert won_project["crm_project_id"] == "CRM-DES-2401"
        assert won_project["board_stage"] == "TBC"

        execution_response = client.get("/api/v1/projects/")
        assert execution_response.status_code == 200
        execution_ids = {project["crm_project_id"] for project in execution_response.json()}
        assert "CRM-DES-2401" in execution_ids

        design_after_win = client.get("/api/v1/projects/designs").json()
        assert all(row["crm_project_id"] != "CRM-DES-2401" for row in design_after_win)

        stats = client.get("/api/v1/projects/designs/stats").json()
        assert stats["total_brief"] == 2
        assert stats["win_count"] == 1
        assert stats["drop_count"] == 1
        assert stats["design_iterations"] == 1

        # A later CRM refresh must not demote a locally promoted Win record.
        second_sync = client.post("/api/v1/projects/crm/designs/sync")
        assert second_sync.status_code == 200
        execution_after_resync = client.get("/api/v1/projects/").json()
        persisted_project = next(
            project
            for project in execution_after_resync
            if project["crm_project_id"] == "CRM-DES-2401"
        )
        assert persisted_project["stage"] == "Win"
        assert persisted_project["project_name"] == "Aero India Pavilion"


class TestManagerAvailability:
    def test_available_windows_and_conflicts(self, client):
        manager = create_manager(client, "Allocation Manager")

        create_execution_project(
            client,
            {
                "crm_project_id": "CRM-ALLOC-1",
                "project_name": "Project X",
                "manager_id": manager["id"],
                "event_start_date": "2026-04-02",
                "event_end_date": "2026-04-05",
                "dispatch_date": "2026-04-02",
                "dismantling_date": "2026-04-05",
                "allocation_start_date": "2026-04-02",
                "allocation_end_date": "2026-04-05",
            },
        )
        create_execution_project(
            client,
            {
                "crm_project_id": "CRM-ALLOC-2",
                "project_name": "Project Y",
                "manager_id": manager["id"],
                "event_start_date": "2026-04-10",
                "event_end_date": "2026-04-15",
                "dispatch_date": "2026-04-10",
                "dismantling_date": "2026-04-15",
                "allocation_start_date": "2026-04-10",
                "allocation_end_date": "2026-04-15",
            },
        )

        open_response = client.get(
            "/api/v1/projects/availability-check",
            params={
                "start_date": "2026-04-06",
                "end_date": "2026-04-09",
                "manager_id": manager["id"],
            },
        )
        assert open_response.status_code == 200
        manager_status = open_response.json()[str(manager["id"])]
        assert manager_status["available"] is True
        assert any(
            window["start_date"] == "2026-04-06" and window["end_date"] == "2026-04-09"
            for window in manager_status["available_windows"]
        )

        conflict_response = client.get(
            "/api/v1/projects/availability-check",
            params={
                "start_date": "2026-04-04",
                "end_date": "2026-04-08",
                "manager_id": manager["id"],
            },
        )
        assert conflict_response.status_code == 200
        conflict_status = conflict_response.json()[str(manager["id"])]
        assert conflict_status["available"] is False
        assert any(conflict["project_name"] == "Project X" for conflict in conflict_status["conflicts"])


class TestProjectAndTimelineSync:
    def test_board_and_timeline_updates_share_project_state(self, client):
        manager = create_manager(client, "Sync Manager")
        project = create_execution_project(
            client,
            {
                "crm_project_id": "CRM-SYNC-1",
                "project_name": "Syncable Project",
                "event_name": "Sync Expo",
                "venue": "Hall 1",
                "area": "120 Sqm",
                "branch": "Mumbai",
                "event_start_date": "2026-05-05",
                "event_end_date": "2026-05-10",
            },
        )

        update_response = client.put(
            f"/api/v1/projects/{project['id']}",
            json={
                "board_stage": "Approved",
                "manager_id": manager["id"],
                "dispatch_date": "2026-05-01",
                "dismantling_date": "2026-05-11",
                "allocation_start_date": "2026-05-01",
                "allocation_end_date": "2026-05-11",
            },
        )
        assert update_response.status_code == 200
        updated_project = update_response.json()
        assert updated_project["board_stage"] == "Approved"
        assert updated_project["manager_id"] == manager["id"]
        assert updated_project["dispatch_date"] == "2026-05-01"

        project_rows = client.get("/api/v1/projects/").json()
        row = next(item for item in project_rows if item["id"] == project["id"])
        assert row["board_stage"] == "Approved"
        assert row["project_manager"] == "Sync Manager"

        timeline_response = client.get("/api/v1/projects/timeline")
        assert timeline_response.status_code == 200
        timeline_rows = timeline_response.json()
        manager_bucket = next(
            bucket for bucket in timeline_rows
            if bucket["manager"]["full_name"] == "Sync Manager"
        )
        allocation = next(item for item in manager_bucket["allocations"] if item["id"] == project["id"])
        assert allocation["allocation_start_date"] == "2026-05-01"
        assert allocation["allocation_end_date"] == "2026-05-11"
        assert allocation["project"]["board_stage"] == "Approved"
