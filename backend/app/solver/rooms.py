"""Room eligibility rules and the Hall-condition room sets used by the time model."""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas import Room

from .common import KIND_PLURAL, SetupIndex
from .sessions import Session


def room_problems(room: Room, kinds: tuple[str, ...], tag: str | None, seats: int) -> list[str]:
    """Violation codes explaining why the room cannot host the lesson (empty = fits)."""
    out = []
    if room.kind not in kinds or (tag and tag not in room.tags):
        out.append("room_wrong_kind")
    if room.capacity < seats:
        out.append("room_too_small")
    return out


def eligible_rooms(session: Session, rooms: list[Room]) -> frozenset[str]:
    return frozenset(
        r.id for r in rooms
        if not room_problems(r, session.room_kinds, session.room_tag, session.seats)
    )


@dataclass(frozen=True)
class RoomSet:
    """A set R of rooms and the sessions that can ONLY use rooms of R.

    Hall's condition: in every (day, slot, parity) the number of those sessions
    must not exceed the rooms of R that are free then.
    """

    rooms: frozenset[str]
    members: tuple[int, ...]  # indices into the session list
    label: str


def describe_requirement(session: Session) -> str:
    what = KIND_PLURAL[session.kind]
    tag = f" în sală cu eticheta «{session.room_tag}»" if session.room_tag else ""
    return f"{what}{tag} cu cel puțin {session.seats} locuri"


def room_sets(sessions: list[Session], rooms: list[Room]) -> tuple[list[RoomSet], list[int]]:
    """Distinct eligible-room sets (candidate Hall sets) and sessions with no room at all."""
    elig = [eligible_rooms(s, rooms) for s in sessions]
    homeless = [i for i, e in enumerate(elig) if not e]
    # label each set by the smallest-seat session whose eligible set is exactly it
    by_set: dict[frozenset[str], int] = {}
    for i, e in enumerate(elig):
        if e and (e not in by_set or sessions[i].seats < sessions[by_set[e]].seats):
            by_set[e] = i
    out: list[RoomSet] = []
    for rset, rep in by_set.items():
        members = tuple(i for i, e in enumerate(elig) if e and e <= rset)
        out.append(RoomSet(rooms=rset, members=members, label=describe_requirement(sessions[rep])))
    return out, homeless


def weekly_room_capacity(idx: SetupIndex, rset: frozenset[str]) -> int:
    return sum(idx.free_rooms(rset, d, s) for d, s in idx.slots_grid())
