import type { Room, RoomKind } from '../../types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { DataGrid } from '../../components/DataGrid';
import type { GridColumn } from '../../components/DataGrid';
import { EmptyState } from '../../components/EmptyState';
import { TagInput } from '../../components/TagInput';
import { useToast } from '../../components/Toast';
import { newId } from '../../lib/ids';
import { buildingFromRoomName } from '../../lib/rooms';
import { ROOM_KINDS, ROOM_KIND_ICON, ROOM_KIND_LABEL } from '../../lib/labels';
import { parseNumber } from '../../lib/paste';
import type { StepProps } from './stepTypes';

const TAG_SUGGESTIONS = ['computers', 'electronics', 'proiector', 'fizica', 'chimie'];

function roomColumns(allTags: string[]): GridColumn<Room>[] {
  return [
    {
      key: 'name',
      header: 'Sala',
      placeholder: '3-611',
      hint: 'Codul sălii. Din „3-611” deducem blocul 3.',
      type: 'text',
      get: (r) => r.name,
      set: (r, v) => {
        const name = String(v);
        const autoBuilding = !r.building || r.building === buildingFromRoomName(r.name);
        return { ...r, name, building: autoBuilding ? buildingFromRoomName(name) : r.building };
      },
      validate: (r) => (r.name.trim() ? null : 'Numele lipsește.'),
    },
    { key: 'building', header: 'Bloc', placeholder: '3', type: 'text', width: '90px', get: (r) => r.building, set: (r, v) => ({ ...r, building: String(v) }), paste: (r, raw) => (raw.trim() ? { ...r, building: raw.trim() } : r) },
    {
      key: 'capacity',
      header: 'Locuri',
      type: 'number',
      width: '90px',
      get: (r) => r.capacity,
      set: (r, v) => {
        const n = Math.round(parseNumber(String(v)));
        return Number.isFinite(n) ? { ...r, capacity: Math.min(2000, Math.max(1, n)) } : r;
      },
    },
    {
      key: 'kind',
      header: 'Tip',
      hint: 'Cursurile merg în aule, seminarele în săli de seminar, laboratoarele în laboratoare. „Universală” primește orice.',
      type: 'select',
      options: ROOM_KINDS.map((k) => ({ value: k, label: `${ROOM_KIND_ICON[k]} ${ROOM_KIND_LABEL[k]}` })),
      get: (r) => r.kind,
      set: (r, v) => ({ ...r, kind: String(v) as RoomKind }),
      paste: (r, raw) => {
        const n = raw.trim().toLowerCase();
        const map: Record<string, RoomKind> = { curs: 'lecture', aula: 'lecture', aulă: 'lecture', lecture: 'lecture', seminar: 'seminar', lab: 'lab', laborator: 'lab', sport: 'sport', universala: 'any', universală: 'any', any: 'any' };
        const hit = map[n] ?? ROOM_KINDS.find((k) => ROOM_KIND_LABEL[k].toLowerCase().includes(n));
        return hit ? { ...r, kind: hit } : r;
      },
    },
    {
      key: 'tags',
      header: 'Etichete',
      hint: 'Ex.: computers — laboratoarele care cer calculatoare vor primi doar săli cu această etichetă.',
      type: 'custom',
      width: '260px',
      get: (r) => r.tags.join(', '),
      set: (r) => r,
      render: (r, onChange) => <TagInput value={r.tags} onChange={(tags) => onChange({ ...r, tags })} suggestions={allTags} placeholder="+ etichetă" />,
      paste: (r, raw) => ({ ...r, tags: raw.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean) }),
    },
  ];
}

export function StepRooms({ setup, update }: StepProps) {
  const toast = useToast();
  const setRooms = (rooms: Room[]) => update((s) => ({ ...s, rooms }));
  const allTags = [...new Set([...TAG_SUGGESTIONS, ...setup.rooms.flatMap((r) => r.tags), ...setup.subjects.map((s) => s.lab_room_tag ?? '').filter(Boolean)])];

  const makeRoom = (_: number, current: Room[]): Room => {
    const last = current[current.length - 1];
    return {
      id: newId('r', '', current.map((r) => r.id)),
      name: '',
      building: last?.building ?? '',
      capacity: last?.capacity ?? 30,
      kind: last?.kind ?? 'seminar',
      tags: [],
    };
  };

  const byKind = ROOM_KINDS.map((k) => ({ k, n: setup.rooms.filter((r) => r.kind === k).length })).filter((x) => x.n > 0);

  return (
    <Card>
      <CardHeader
        title="Săli"
        description="Orice sală în care se pot ține perechi. Capacitatea contează: o serie de 4 grupe are nevoie de o aulă mare."
        actions={byKind.map(({ k, n }) => (
          <Badge key={k}>
            {ROOM_KIND_ICON[k]} {n}
          </Badge>
        ))}
      />
      <CardBody>
        <DataGrid
          rows={setup.rooms}
          columns={roomColumns(allTags)}
          onChange={setRooms}
          rowKey={(r) => r.id}
          addLabel="Adaugă sală"
          makeRow={makeRoom}
          onPasted={(a, u) => toast.success(`Lipire reușită: ${a} săli noi${u ? `, ${u} actualizate` : ''}.`)}
          pasteHint="Coloane: Sala · Bloc · Locuri · Tip (curs/seminar/laborator/sport/universală) · Etichete (separate prin virgulă)"
          empty={
            <EmptyState
              icon="🏫"
              title="Nicio sală încă"
              description="Lipește lista sălilor din Excel sau adaugă-le una câte una. Ex.: 3-611 · bloc 3 · 150 locuri · Aulă."
              actions={<Button variant="primary" onClick={() => setRooms([makeRoom(0, [])])}>Adaugă prima sală</Button>}
            />
          }
        />
      </CardBody>
    </Card>
  );
}
