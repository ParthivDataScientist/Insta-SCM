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


def create_design_project(client, payload):
    base_payload = {
        "project_name": "Design Brief",
        "status": "pending",
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
        converted_row = next(row for row in design_after_win if row["crm_project_id"] == "CRM-DES-2401")
        assert converted_row["status"] == "won"

        stats = client.get("/api/v1/projects/designs/stats").json()
        assert stats["total_brief"] == 3
        assert stats["pending_count"] == 0
        assert stats["in_progress_count"] == 0
        assert stats["changes_count"] == 1
        assert stats["won_count"] == 1
        assert stats["lost_count"] == 1
        assert stats["open_count"] == 1

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
        assert persisted_project["status"] == "won"
        assert persisted_project["project_name"] == "Aero India Pavilion"

    def test_revision_progression_and_awb_search(self, client):
        project = create_design_project(
            client,
            {
                "crm_project_id": "CRM-DES-9001",
                "project_name": "Revision Ready Booth",
                "client_id": None,
                "booking_date": "2026-04-01",
                "event_start_date": "2026-04-20",
            },
        )

        in_progress = client.put(
            f"/api/v1/projects/{project['id']}",
            json={"status": "in_progress", "current_version": "v1"},
        )
        assert in_progress.status_code == 200
        in_progress_row = in_progress.json()
        assert in_progress_row["status"] == "in_progress"
        assert in_progress_row["current_version"] == "v1"
        assert in_progress_row["revision_count"] == 0
        assert in_progress_row["revision_history"][0]["version"] == "v1"

        changes = client.put(
            f"/api/v1/projects/{project['id']}",
            json={
                "status": "changes",
                "current_version": "Final",
                "revision_note": "Client requested layout changes",
            },
        )
        assert changes.status_code == 200
        changes_row = changes.json()
        assert changes_row["status"] == "changes"
        assert changes_row["current_version"] == "Final"
        assert changes_row["revision_count"] == 1
        assert [entry["version"] for entry in changes_row["revision_history"]] == ["v1", "Final"]

        preserve_version = client.put(
            f"/api/v1/projects/{project['id']}",
            json={"status": "in_progress"},
        )
        assert preserve_version.status_code == 200
        assert preserve_version.json()["current_version"] == "Final"

        shipment_response = client.post(
            "/api/v1/shipments/track/888598190302",
            json={
                "exhibition_name": "Revision Ready Booth",
                "project_id": project["id"],
            },
        )
        assert shipment_response.status_code == 201, shipment_response.text

        search_response = client.get("/api/v1/projects/designs", params={"search": "888598190302"})
        assert search_response.status_code == 200
        matched = search_response.json()
        assert len(matched) == 1
        assert matched[0]["id"] == project["id"]
        assert "888598190302" in matched[0]["linked_awbs"]

    def test_design_stats_honor_booking_and_show_date_filters(self, client):
        create_design_project(
            client,
            {
                "crm_project_id": "CRM-DATE-1",
                "project_name": "Booking Filter A",
                "booking_date": "2026-04-01",
                "event_start_date": "2026-05-20",
            },
        )
        create_design_project(
            client,
            {
                "crm_project_id": "CRM-DATE-2",
                "project_name": "Booking Filter B",
                "booking_date": "2026-04-10",
                "event_start_date": "2026-04-22",
                "status": "in_progress",
            },
        )

        booking_filtered = client.get(
            "/api/v1/projects/designs/stats",
            params={"date_field": "booking", "start_date": "2026-04-08", "end_date": "2026-04-12"},
        )
        assert booking_filtered.status_code == 200
        assert booking_filtered.json()["total_brief"] == 1

        show_filtered = client.get(
            "/api/v1/projects/designs",
            params={"date_field": "show", "start_date": "2026-04-20", "end_date": "2026-04-30"},
        )
        assert show_filtered.status_code == 200
        show_rows = show_filtered.json()
        assert len(show_rows) == 1
        assert show_rows[0]["crm_project_id"] == "CRM-DATE-2"

    def test_project_links_crud_and_validation(self, client):
        project = create_design_project(
            client,
            {
                "crm_project_id": "CRM-LINK-1",
                "project_name": "Linked Design Project",
            },
        )

        create_link = client.post(
            f"/api/v1/projects/{project['id']}/links",
            json={
                "label": "Client Drive Folder",
                "link_type": "drive",
                "url": "https://drive.google.com/test-folder",
            },
        )
        assert create_link.status_code == 200, create_link.text
        created = create_link.json()
        assert created["label"] == "Client Drive Folder"
        assert created["link_type"] == "drive"

        duplicate_link = client.post(
            f"/api/v1/projects/{project['id']}/links",
            json={
                "label": "Duplicate Drive Folder",
                "link_type": "drive",
                "url": "https://drive.google.com/test-folder",
            },
        )
        assert duplicate_link.status_code == 400

        invalid_scheme = client.post(
            f"/api/v1/projects/{project['id']}/links",
            json={
                "label": "Unsafe Link",
                "link_type": "other",
                "url": "javascript:alert('xss')",
            },
        )
        assert invalid_scheme.status_code == 422

        update_link = client.put(
            f"/api/v1/projects/{project['id']}/links/{created['id']}",
            json={"label": "Client Drive Folder V2", "link_type": "render"},
        )
        assert update_link.status_code == 200
        assert update_link.json()["label"] == "Client Drive Folder V2"
        assert update_link.json()["link_type"] == "render"

        list_links = client.get(f"/api/v1/projects/{project['id']}/links")
        assert list_links.status_code == 200
        assert len(list_links.json()) == 1

        delete_link = client.delete(f"/api/v1/projects/{project['id']}/links/{created['id']}")
        assert delete_link.status_code == 200
        assert client.get(f"/api/v1/projects/{project['id']}/links").json() == []

    def test_shipments_require_project_and_project_shipments_endpoint(self, client):
        project = create_execution_project(
            client,
            {
                "crm_project_id": "CRM-SHIP-1",
                "project_name": "Shipment Mapped Project",
            },
        )

        missing_project = client.post(
            "/api/v1/shipments/track/888598190302",
            json={"exhibition_name": "Shipment Mapped Project"},
        )
        assert missing_project.status_code == 400
        assert "project_id is required" in missing_project.text

        linked_shipment = client.post(
            "/api/v1/shipments/track/888598190303",
            json={
                "project_id": project["id"],
                "exhibition_name": "Shipment Mapped Project",
            },
        )
        assert linked_shipment.status_code == 201, linked_shipment.text

        project_shipments = client.get(f"/api/v1/shipments/project/{project['id']}")
        assert project_shipments.status_code == 200
        rows = project_shipments.json()
        assert len(rows) == 1
        assert rows[0]["project_id"] == project["id"]
        assert rows[0]["project_name"] == "Shipment Mapped Project"


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
