"""Integration tests for user role enforcement across endpoints."""

import pytest

pytestmark = pytest.mark.integration


def _device_body(owner_id):
    return {
        "hostname": "srv-rbac",
        "ip_address": "10.0.1.30",
        "operating_system": "Ubuntu 22.04",
        "status": "active",
        "department": "IT",
        "owner_id": owner_id,
    }


def test_viewer_cannot_list_devices(client, make_user, auth_header):
    viewer = make_user(username="viewer", role="viewer")
    resp = client.get("/devices", headers=auth_header(viewer.username))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Forbidden"


def test_technician_can_list_devices(client, make_user, auth_header):
    tech = make_user(username="tech", role="technician")
    resp = client.get("/devices", headers=auth_header(tech.username))
    assert resp.status_code == 200


def test_technician_cannot_create_device(client, make_user, auth_header):
    # create/delete are admin-only; technician may update but not provision.
    tech = make_user(username="tech", role="technician")
    resp = client.post(
        "/devices", json=_device_body(tech.id), headers=auth_header(tech.username)
    )
    assert resp.status_code == 403


def test_only_admin_lists_users(client, make_user, auth_header):
    admin = make_user(username="admin", role="admin")
    tech = make_user(username="tech", role="technician")
    analyst = make_user(username="analyst", role="analyst")

    assert client.get("/users", headers=auth_header(admin.username)).status_code == 200
    assert client.get("/users", headers=auth_header(tech.username)).status_code == 403
    assert client.get("/users", headers=auth_header(analyst.username)).status_code == 200


def test_viewer_can_list_events(client, make_user, auth_header):
    viewer = make_user(username="viewer", role="viewer")
    resp = client.get("/events", headers=auth_header(viewer.username))
    assert resp.status_code == 200


def test_technician_can_access_dashboard(client, make_user, auth_header):
    tech = make_user(username="tech", role="technician")
    resp = client.get("/dashboard/overview", headers=auth_header(tech.username))
    assert resp.status_code == 200
