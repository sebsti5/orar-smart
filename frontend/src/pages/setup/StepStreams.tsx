import type { Stream } from '../../types';
import { Badge, Chip } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Select, TextInput } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { orderGroups } from '../../lib/grid';
import { newId } from '../../lib/ids';
import { groupsWithoutStream, streamMixWarning, streamName, suggestStreams } from '../../lib/streams';
import type { StepProps } from './stepTypes';

export function StepStreams({ setup, update, goTo }: StepProps) {
  const toast = useToast();
  const suggestions = suggestStreams(setup.groups, setup.programs, setup.streams);
  const setStreams = (streams: Stream[]) => update((s) => ({ ...s, streams }));
  const setOne = (id: string, patch: Partial<Stream>) => setStreams(setup.streams.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const groupName = (id: string) => setup.groups.find((g) => g.id === id)?.name ?? '?';
  const loose = groupsWithoutStream(setup.groups, setup.streams);
  const ordered = orderGroups(setup.groups, setup.programs);

  if (setup.groups.length === 0) {
    return (
      <EmptyState
        icon="🔗"
        title="Nu există grupe"
        description="Seriile unesc grupe care ascultă cursurile împreună. Adaugă întâi grupele."
        actions={<Button variant="primary" onClick={() => goTo(2)}>Mergi la Grupe</Button>}
      />
    );
  }

  const accept = () => {
    setStreams([...setup.streams, ...suggestions]);
    toast.success(`Am creat ${suggestions.length} serii.`);
  };

  return (
    <div className="grid gap-6">
      {suggestions.length > 0 && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-white">
          <CardBody className="flex flex-wrap items-center gap-4">
            <div className="text-2xl">💡</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">Am găsit {suggestions.length} serii potrivite</p>
              <p className="mt-0.5 text-sm text-slate-600">Grupele aceluiași program și an ascultă de obicei cursurile împreună:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <Badge key={s.id} className="bg-white text-indigo-700 ring-1 ring-indigo-100">
                    {s.name}: {s.group_ids.map(groupName).join(', ')}
                  </Badge>
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={accept}>Acceptă sugestiile</Button>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Serii"
          description="La curs, toate grupele unei serii stau în aceeași aulă. În orar, cursul apare ca o singură celulă întinsă peste coloanele lor."
          actions={
            <Button size="sm" variant="soft" onClick={() => setStreams([...setup.streams, { id: newId('s', '', setup.streams.map((s) => s.id)), name: 'Serie nouă', group_ids: [] }])}>
              ＋ Serie nouă
            </Button>
          }
        />
        <CardBody>
          {setup.streams.length === 0 ? (
            <EmptyState icon="🔗" title="Nicio serie încă" description="Fără serii, fiecare grupă își are cursurile separat. Acceptă sugestiile de mai sus sau creează o serie manual." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {setup.streams.map((s) => {
                const warn = streamMixWarning(s, setup.groups);
                const members = setup.groups.filter((g) => s.group_ids.includes(g.id));
                const seats = members.reduce((n, g) => n + g.students, 0);
                const candidates = ordered.filter((g) => !s.group_ids.includes(g.id));
                return (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <TextInput className="h-9 flex-1 font-medium" value={s.name} onChange={(e) => setOne(s.id, { name: e.target.value })} aria-label="Numele seriei" />
                      <Button size="sm" variant="ghost" title="Nume automat" onClick={() => setOne(s.id, { name: streamName(members, setup.programs) })}>
                        ↻
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => setStreams(setup.streams.filter((x) => x.id !== s.id))} aria-label="Șterge seria">
                        🗑
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {s.group_ids.map((id) => (
                        <Chip key={id} className="border-indigo-200 bg-indigo-50 font-medium text-indigo-700" onRemove={() => setOne(s.id, { group_ids: s.group_ids.filter((x) => x !== id) })}>
                          {groupName(id)}
                        </Chip>
                      ))}
                      <Select
                        className="h-7 w-36 rounded-lg px-2 text-xs"
                        value=""
                        onChange={(e) => e.target.value && setOne(s.id, { group_ids: [...s.group_ids, e.target.value] })}
                        aria-label="Adaugă grupă"
                      >
                        <option value="">＋ grupă…</option>
                        {candidates.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </Select>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {members.length} grupe · {seats} studenți — are nevoie de o aulă cu cel puțin {seats} locuri.
                    </p>
                    {warn && <p className="mt-1 text-xs text-amber-700">⚠️ {warn}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {loose.length > 0 && setup.streams.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Grupe fără serie (vor avea cursurile separat): {loose.map((g) => g.name).join(', ')}.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
