import { supabase } from './lib/supabase.js';


function teamLabel(t) {
  if (!t) return 'TBD';
  if (t.player1 && t.player2) return `${t.player1} & ${t.player2}`;
  return t.player1 || t.player2 || 'TBD';
}

const CATEGORY_SLUGS = [
  { slug: 'suntennis-2025',   label: 'Grupe 8' },
  { slug: 'suntennis-2025-2', label: 'Eliminatoriu 8' },
];

function formatDateTime(iso) {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return d.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadProgram() {
  const wrap = document.querySelector('#programList');
  if (!wrap) return;


  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id, slug, name')
    .in('slug', CATEGORY_SLUGS.map(c => c.slug));

  if (tErr) {
    console.error(tErr);
    wrap.innerHTML = '<p>Eroare la citirea turneelor.</p>';
    return;
  }

  const tournamentById = {};
  const ids = [];

  tournaments.forEach(t => {
    tournamentById[t.id] = t;
    ids.push(t.id);
  });

  if (!ids.length) {
    wrap.innerHTML = '<p>Nu există turnee definite pentru aceste categorii.</p>';
    return;
  }


  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('*')
    .in('tournament_id', ids);

  if (teamsErr) {
    console.error(teamsErr);
    wrap.innerHTML = '<p>Eroare la citirea echipelor.</p>';
    return;
  }

  const teamById = {};
  teams.forEach(t => { teamById[t.id] = t; });


  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .in('tournament_id', ids)
    .order('scheduled_at', { ascending: true, nullsFirst: true });

  if (mErr) {
    console.error(mErr);
    wrap.innerHTML = '<p>Eroare la citirea meciurilor.</p>';
    return;
  }

  if (!matches.length) {
    wrap.innerHTML = '<p>Nu există meciuri programate încă.</p>';
    return;
  }

  const slugLabel = {};
  CATEGORY_SLUGS.forEach(c => { slugLabel[c.slug] = c.label; });

  wrap.innerHTML = matches.map(m => {
    const t = tournamentById[m.tournament_id];
    const catName = t ? (slugLabel[t.slug] || t.name) : 'Categorie';
    const t1 = teamById[m.team1_id];
    const t2 = teamById[m.team2_id];

    const name1 = t1 ? (t1.player1 && t1.player2 ? `${t1.player1} & ${t1.player2}` : (t1.player1 || t1.player2 || 'TBD')) : 'TBD';
    const name2 = t2 ? (t2.player1 && t2.player2 ? `${t2.player1} & ${t2.player2}` : (t2.player1 || t2.player2 || 'TBD')) : 'TBD';

    const when = formatDateTime(m.scheduled_at);
    const court = m.court || 'TBA';
    const roundLabel = m.group_name
      ? `Grupe ${m.group_name}`
      : `Runda ${m.round || 1}`;

    return `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <strong>${catName}</strong> • ${roundLabel}
          </div>
          <div style="font-size:0.85rem;color:#aeb3bd">
            ${when} • ${court}
          </div>
        </div>
        <div style="margin-top:6px">
          ${name1} <span style="color:#aeb3bd">vs</span> ${name2}
        </div>
        ${m.score ? `<div style="margin-top:4px;font-size:0.9rem">Scor: <strong>${m.score}</strong></div>` : ''}
      </div>
    `;
  }).join('');
}

loadProgram();
