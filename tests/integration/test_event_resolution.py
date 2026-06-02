import pytest

from models.event import Event

pytestmark = pytest.mark.integration


def _event_body(device_id: int):
    return {
        "event_type": "disk_usage",
        "severity": "high",
        "message": "Disk usage above 90%",
        "device_id": device_id,
    }


def test_technician_can_resolve_event(client, make_user, auth_header, db_session):
    admin = make_user(username="admin", role="admin")
    tech = make_user(username="tech", role="technician")

    # Create device as admin (tech cannot create devices)
    device_id = client.post(
        "/devices",
        json={
            "hostname": "srv-01",
            "ip_address": "10.0.0.10",
            "operating_system": "Ubuntu 22.04",
            "status": "active",
            "department": None,
            "owner_id": admin.id,
        },
        headers=auth_header(admin.username),
    ).json()["id"]

    event_id = client.post(
        "/events",
        json=_event_body(device_id),
        headers=auth_header(tech.username),
    ).json()["id"]

    resp = client.post(f"/events/{event_id}/resolve", headers=auth_header(tech.username))
    assert resp.status_code == 200
    body = resp.json()
    assert body["resolved_at"] is not None
    assert body["resolved_by"] == tech.id

    row = db_session.query(Event).filter(Event.id == event_id).one()
    assert row.resolved_at is not None
    assert row.resolved_by == tech.id


def test_viewer_cannot_resolve_event(client, make_user, auth_header, db_session):
    admin = make_user(username="admin", role="admin")
    tech = make_user(username="tech", role="technician")
    viewer = make_user(username="viewer", role="viewer")

    device_id = client.post(
        "/devices",
        json={
            "hostname": "srv-02",
            "ip_address": "10.0.0.11",
            "operating_system": "Ubuntu 22.04",
            "status": "active",
            "department": None,
            "owner_id": admin.id,
        },
        headers=auth_header(admin.username),
    ).json()["id"]

    event_id = client.post(
        "/events",
        json=_event_body(device_id),
        headers=auth_header(tech.username),
    ).json()["id"]

    resp = client.post(f"/events/{event_id}/resolve", headers=auth_header(viewer.username))
    assert resp.status_code == 403

