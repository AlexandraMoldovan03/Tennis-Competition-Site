import { supabase } from './lib/supabase.js';

const BASE_SLUG = 'suntennis-2025';
const params = new URLSearchParams(window.location.search);
const CURRENT_CAT = params.get('cat') || '1';

const SLUG = CURRENT_CAT === '1'
  ? BASE_SLUG
  : `${BASE_SLUG}-${CURRENT_CAT}`;

const teamLabel = (t) => {
  if (!t) return 'TBD';
  if (t.player1 && t.player2) return `${t.player1} & ${t.player2}`;
  return t.player1 || t.player2 || 'TBD';
};

// ───────────────────────────────────────────────────────
// MAIN LOAD

async function loadTournament() {
  // turneu
  const { data: t, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', SLUG)
    .single();

  if (error || !t) {
    console.error(error);
    document.querySelector('#tName').textContent = 'Turneul nu există.';
    return;
  }

 const catLabel = CURRENT_CAT === '1' ? 'Nivel 8' : 'Nivel 6';

document.querySelector('#tName').textContent =
  (t.name || 'Tenis Club Sun ') + ' — ' + catLabel;


  document.querySelector('#tMeta').textContent =
    `${t.location || ''} ${t.start_date || ''} ${t.end_date || ''}`.trim();

  const fmtLabel =
    t.format === 'groups' ? 'Format: Grupe (șah)' : 'Format: Eliminatoriu';
  const fmtEl = document.querySelector('#tFormat');
  if (fmtEl) fmtEl.textContent = fmtLabel;

  // echipe + meciuri
  const { data: teams = [] } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', t.id);

  const { data: matches = [] } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', t.id);

  const bracketEl  = document.querySelector('#bracket');
  const scheduleEl = document.querySelector('#schedule');

  if (t.format === 'groups') {
    renderGroupsBracket(bracketEl, teams, matches);
  } else {
    renderKnockoutBracket(bracketEl, teams, matches);
  }

  renderSchedule(scheduleEl, teams, matches);
}

// ───────────────────────────────────────────────────────
// GRUPE – CARDURI GEN ITF

function renderGroupsBracket(container, teams, matches) {
  if (!container) return;

  // grupăm meciurile după group_name
  const groups = {};
  (matches || []).forEach((m) => {
    if (!m.group_name) return;
    const g = m.group_name;
    if (!groups[g]) groups[g] = { matches: [], teamIds: new Set() };
    groups[g].matches.push(m);
    if (m.team1_id) groups[g].teamIds.add(m.team1_id);
    if (m.team2_id) groups[g].teamIds.add(m.team2_id);
  });

  const entries = Object.entries(groups).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (!entries.length) {
    container.innerHTML =
      '<p style="color:#aeb3bd">Grupele nu au fost încă setate.</p>';
    return;
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));

  container.innerHTML = `
    <div class="group-grid">
      ${entries
        .map(([gName, data]) =>
          renderSingleGroupCard(gName, data, teamById)
        )
        .join('')}
    </div>
  `;
}

function renderSingleGroupCard(groupName, data, teamById) {
  const groupTeams = Array.from(data.teamIds)
    .map((id) => teamById.get(id))
    .filter(Boolean);

  // număr victorii pe echipă
  const wins = {};
  (data.matches || []).forEach((m) => {
    if (m.winner_id) {
      wins[m.winner_id] = (wins[m.winner_id] || 0) + 1;
    }
  });

  // clasament simplu după nr. de victorii
  const withWins = groupTeams
    .map((t) => ({
      team: t,
      wins: wins[t.id] || 0,
    }))
    .sort((a, b) => b.wins - a.wins);

  const rankMap = {};
  withWins.forEach((x, idx) => {
    rankMap[x.team.id] = idx + 1;
  });

  const playersHtml = withWins
    .map(({ team, wins }) => {
      const r = rankMap[team.id] ?? '';
      return `
        <div class="group-player-row">
          <div class="group-player-rank">${r}</div>
          <div class="group-player-name">${escapeHtml(teamLabel(team))}</div>
          <div class="group-player-stats">${wins} vict.</div>
        </div>
      `;
    })
    .join('');

const fmtDate = (d) =>
  d ? d.replace('T', ' ').slice(0, 16) : '—';   // 2025-11-21 10:00

  const matchesHtml = (data.matches || [])
    .map((m) => {
      const t1 = teamById.get(m.team1_id);
      const t2 = teamById.get(m.team2_id);
      const winner = m.winner_id ? teamById.get(m.winner_id) : null;

      return `
        <div class="group-match">
          <div class="group-match__teams">
            <span>${escapeHtml(teamLabel(t1))}</span>
            <span>${escapeHtml(teamLabel(t2))}</span>
          </div>
          <div class="group-match__meta">
            ${fmtDate(m.scheduled_at)} • Teren ${escapeHtml(m.court || 'TBD')}
            ${m.score ? ` • Scor: ${escapeHtml(m.score)}` : ''}
            ${winner ? ` • 🏆 ${escapeHtml(teamLabel(winner))}` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <article class="group-card">
      <header class="group-card__header">
        <div>
          <div class="group-card__title">Grupa ${escapeHtml(groupName)}</div>
          <div class="group-card__subtitle">
            ${groupTeams.length} echipe • ${data.matches.length} meciuri
          </div>
        </div>
      </header>

      <div class="group-players">
        ${playersHtml}
      </div>

      <div class="group-matches">
        ${matchesHtml || '<p class="group-card__subtitle">Nu sunt meciuri înregistrate.</p>'}
      </div>
    </article>
  `;
}

// ───────────────────────────────────────────────────────
// ELIMINATORIU – COLUMNE PE RUNDE

function renderKnockoutBracket(container, teams, matches) {
  if (!container) return;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const rounds = {};

  (matches || []).forEach((m) => {
    if (m.group_name) return; 
    const r = m.round || 1;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(m);
  });

  const entries = Object.entries(rounds).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );

  if (!entries.length) {
    container.innerHTML =
      '<p style="color:#aeb3bd">Tabloul eliminatoriu nu a fost încă setat.</p>';
    return;
  }

  container.innerHTML = `
    <div class="ko-bracket">
      ${entries
        .map(([round, list]) =>
          renderRoundColumn(round, list, teamById)
        )
        .join('')}
    </div>
  `;
}

function renderRoundColumn(round, matches, teamById) {
  const label = getRoundLabel(Number(round), matches.length);

  const matchesHtml = matches
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((m) => {
      const t1 = teamById.get(m.team1_id);
      const t2 = teamById.get(m.team2_id);
      const winner = m.winner_id ? teamById.get(m.winner_id) : null;

      const isT1Winner = winner && winner.id === m.team1_id;
      const isT2Winner = winner && winner.id === m.team2_id;

      return `
        <div class="ko-match">
          <div class="ko-match__player ${
            isT1Winner ? 'ko-match__player--winner' : ''
          }">
            <span>${escapeHtml(teamLabel(t1))}</span>
          </div>
          <div class="ko-match__player ${
            isT2Winner ? 'ko-match__player--winner' : ''
          }">
            <span>${escapeHtml(teamLabel(t2))}</span>
          </div>
          <div class="ko-match__score">
            ${escapeHtml(m.score || 'Scor TBD')}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="ko-round">
      <div class="ko-round__title">${escapeHtml(label)}</div>
      <div class="ko-matches">
        ${matchesHtml}
      </div>
    </section>
  `;
}

function getRoundLabel(roundNumber, matchesInRound) {
  if (matchesInRound === 1 && roundNumber > 1) return 'Finală';
  if (matchesInRound === 2) return 'Semifinale';
  if (matchesInRound === 4) return 'Sferturi';
  return `Runda ${roundNumber}`;
}

// ───────────────────────────────────────────────────────
// PROGRAM MECIURI

function renderSchedule(container, teams, matches) {
  if (!container) return;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const ordered = (matches || []).slice().sort((a, b) => {
    const da = a.scheduled_at || '';
    const db = b.scheduled_at || '';
    return da.localeCompare(db);
  });

  if (!ordered.length) {
    container.innerHTML =
      '<p style="color:#aeb3bd">Programul nu a fost încă publicat.</p>';
    return;
  }

  container.innerHTML = ordered
    .map((m) => {
      const t1 = teamById.get(m.team1_id);
      const t2 = teamById.get(m.team2_id);

      const tag = m.group_name
        ? `Grupa ${m.group_name}`
        : m.round
        ? `Runda ${m.round}`
        : 'Meci';

      return `
        <article class="schedule-card">
          <h4>${escapeHtml(teamLabel(t1))} vs ${escapeHtml(teamLabel(t2))}</h4>
          <p>${tag} • Teren ${escapeHtml(m.court || 'TBD')}</p>
          <p>${fmtDate(m.scheduled_at)}</p>
          <p style="color:#aeb3bd">
            Scor: ${escapeHtml(m.score || '—')}
          </p>
        </article>
      `;
    })
    .join('');
}

// ───────────────────────────────────────────────────────
// HELPER

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markTournamentCategory() {
  const b1 = document.querySelector('#tCat1Btn');
  const b2 = document.querySelector('#tCat2Btn');
  if (!b1 || !b2) return;

  if (CURRENT_CAT === '2') {
    b2.classList.add('btn--primary');
  } else {
    b1.classList.add('btn--primary');
  }
}

// ───────────────────────────────────────────────────────
(async () => {
  await loadTournament();
  markTournamentCategory();
})();

