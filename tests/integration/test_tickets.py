"""Integration tests for ticket API: RBAC, visibility, assignment, status."""

from __future__ import annotations

import pytest


def _create_ticket(client, headers, **overrides):
    payload = {
        "title": "Laptop not booting",
        "description": "Device powers on but shows black screen.",
        "category": "Hardware",
        "priority": "High",
        **overrides,
    }
    return client.post("/tickets", json=payload, headers=headers)


@pytest.fixture
def viewer_user(make_user, auth_header):
    user = make_user(username="viewer1", role="viewer")
    return user, auth_header("viewer1")


@pytest.fixture
def tech_user(make_user, auth_header):
    user = make_user(username="tech1", role="technician")
    return user, auth_header("tech1")


@pytest.fixture
def admin_user(make_user, auth_header):
    user = make_user(username="admin1", role="admin")
    return user, auth_header("admin1")


@pytest.fixture
def other_viewer(make_user, auth_header):
    user = make_user(username="viewer2", role="viewer")
    return user, auth_header("viewer2")


def test_viewer_can_create_ticket(client, viewer_user):
    _, headers = viewer_user
    resp = _create_ticket(client, headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Laptop not booting"
    assert data["ticket_number"].startswith("TKT-")
    assert data["status"] == "Open"


def test_viewer_sees_only_own_tickets(client, viewer_user, other_viewer, tech_user):
    v1, h1 = viewer_user
    v2, h2 = other_viewer
    _, h_tech = tech_user

    _create_ticket(client, h1, title="Viewer A ticket")
    _create_ticket(client, h2, title="Viewer B ticket")
    _create_ticket(client, h_tech, title="Tech ticket")

    list_a = client.get("/tickets", headers=h1)
    assert list_a.status_code == 200
    ids_a = {t["id"] for t in list_a.json()["data"]}
    assert all(t["created_by"] == v1.id for t in list_a.json()["data"])
    assert len(ids_a) == 1

    list_b = client.get("/tickets", headers=h2)
    assert len(list_b.json()["data"]) == 1
    assert list_b.json()["data"][0]["created_by"] == v2.id

    list_tech = client.get("/tickets", headers=h_tech)
    assert len(list_tech.json()["data"]) >= 3


def test_viewer_cannot_get_other_users_ticket(client, viewer_user, other_viewer):
    _, h1 = viewer_user
    v2, h2 = other_viewer

    created = _create_ticket(client, h2, title="Private ticket")
    ticket_id = created.json()["id"]

    denied = client.get(f"/tickets/{ticket_id}", headers=h1)
    assert denied.status_code == 403

    ok = client.get(f"/tickets/{ticket_id}", headers=h2)
    assert ok.status_code == 200
    assert ok.json()["id"] == ticket_id


def test_viewer_cannot_change_status(client, viewer_user):
    v, headers = viewer_user
    created = _create_ticket(client, headers)
    ticket_id = created.json()["id"]

    resp = client.patch(
        f"/tickets/{ticket_id}/status",
        json={"status": "In Progress"},
        headers=headers,
    )
    assert resp.status_code == 403


def test_technician_can_assign_to_self_and_update_status(client, viewer_user, tech_user):
    _, h_viewer = viewer_user
    tech, h_tech = tech_user

    created = _create_ticket(client, h_viewer, title="Need VPN access")
    ticket_id = created.json()["id"]

    assign = client.post(f"/tickets/{ticket_id}/assign/me", headers=h_tech)
    assert assign.status_code == 200
    assert assign.json()["assigned_to"] == tech.id

    status = client.patch(
        f"/tickets/{ticket_id}/status",
        json={"status": "In Progress", "resolution_notes": None},
        headers=h_tech,
    )
    assert status.status_code == 200
    assert status.json()["status"] == "In Progress"

    closed = client.patch(
        f"/tickets/{ticket_id}/status",
        json={"status": "Closed", "resolution_notes": "VPN configured."},
        headers=h_tech,
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "Closed"


def test_viewer_cannot_assign(client, viewer_user):
    _, headers = viewer_user
    created = _create_ticket(client, headers)
    ticket_id = created.json()["id"]

    resp = client.post(f"/tickets/{ticket_id}/assign/me", headers=headers)
    assert resp.status_code == 403


def test_admin_can_delete_ticket(client, viewer_user, admin_user):
    _, h_viewer = viewer_user
    _, h_admin = admin_user

    created = _create_ticket(client, h_viewer)
    ticket_id = created.json()["id"]

    denied = client.delete(f"/tickets/{ticket_id}", headers=h_viewer)
    assert denied.status_code == 403

    ok = client.delete(f"/tickets/{ticket_id}", headers=h_admin)
    assert ok.status_code == 204

    missing = client.get(f"/tickets/{ticket_id}", headers=h_admin)
    assert missing.status_code == 404


def test_technician_cannot_delete_ticket(client, viewer_user, tech_user):
    _, h_viewer = viewer_user
    _, h_tech = tech_user

    created = _create_ticket(client, h_viewer)
    ticket_id = created.json()["id"]

    resp = client.delete(f"/tickets/{ticket_id}", headers=h_tech)
    assert resp.status_code == 403
