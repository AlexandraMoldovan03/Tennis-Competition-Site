// src/admin.js
import { supabase } from './lib/supabase.js';

// ─────────────────────────────────────────────
// SLUG DIN URL PENTRU CATEGORII
// /admin.html        -> suntennis-2025
// /admin.html?cat=2  -> suntennis-2025-2
const BASE_SLUG = 'suntennis-2025';
const params = new URLSearchParams(window.location.search);
const CURRENT_CAT = params.get('cat') || '1';

const SLUG = CURRENT_CAT === '1'
  ? BASE_SLUG
  : `${BASE_SLUG}-${CURRENT_CAT}`;


let tournament = null;
let teams = [];      // toate echipele turneului (grupele + eliminatoriu)

// ─────────────────────────────────────────────
// helper pentru text sigur în HTML
function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// numele afișat al unei echipe
function teamLabel(t) {
  if (!t) return 'TBD';
  if (t.player1 && t.player2) return `${t.player1} & ${t.player2}`;
  return t.player1 || t.player2 || 'TBD';
}

// ==================== AUTH ADMIN ====================
async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('role,email')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error(error);
    alert('Nu pot citi profilul utilizatorului.');
    return false;
  }

  if (prof?.role !== 'admin') {
    alert('Nu ai drepturi de admin.');
    window.location.href = '/';
    return false;
  }

  const note = document.querySelector('#roleNote');
  if (note) {
    const cat = new URLSearchParams(window.location.search).get('cat') || '1';
    note.textContent = `Autentificat ca ${prof.email} • rol: ${prof.role} • Categorie ${cat}`;
  }
  return true;
}

// ==================== LOAD TURNEU ====================
async function loadTournament() {
  // încercăm să găsim turneul după SLUG
  let { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', SLUG)
    .single();

  const catLabel = CURRENT_CAT === '1' ? 'Categorie 1' : `Categorie ${CURRENT_CAT}`;

  // dacă nu există, îl creăm
  if ((error && error.code === 'PGRST116') || (!error && !data)) {
    const { data: created, error: insErr } = await supabase
      .from('tournaments')
      .insert({
        slug: SLUG,
        name: `SunTennis Open 2025 — ${catLabel}`,
        format: 'elimination',
        bracket_size: 16,
        group_count: 2,
        group_size: 4
      })
      .select('*')
      .single();

    if (insErr) {
      console.error(insErr);
      alert('Nu pot crea turneul pentru ' + catLabel);
      return;
    }
    data = created;
  } else if (error) {
    console.error(error);
    alert('Nu găsesc turneul (slug: ' + SLUG + ').');
    return;
  }

  tournament = data;

  document.querySelector('#format').value     = tournament.format       || 'elimination';
  document.querySelector('#bracket').value    = tournament.bracket_size || 8;
  document.querySelector('#groupCount').value = tournament.group_count  || 2;
  document.querySelector('#groupSize').value  = tournament.group_size   || 4;

  toggleModeUI();
}


// afișează / ascunde părțile de UI în funcție de format
function toggleModeUI() {
  const format = document.querySelector('#format').value;

  const showGroups = format === 'groups';
  const showElim   = format === 'elimination';

  // câmpuri pentru grupe
  ['groupCount', 'groupSize'].forEach(id => {
    const el = document.querySelector('#' + id)?.parentElement;
    if (el) el.style.display = showGroups ? '' : 'none';
  });

  // card editor grupe
  const groupsEditorCard = document.querySelector('#groupsEditorCard');
  if (groupsEditorCard) groupsEditorCard.style.display = showGroups ? '' : 'none';

  // card editor tablou eliminatoriu
  const elimEditorCard = document.querySelector('#elimEditorCard');
  if (elimEditorCard) elimEditorCard.style.display = showElim ? '' : 'none';

  // lista simplă de echipe (dacă o vei folosi în viitor)
  const teamsSection = document.querySelector('#teamsSection');
  if (teamsSection) teamsSection.style.display = showGroups ? 'none' : '';
}

// ==================== ECHIPE (comune) ====================
async function loadTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_name', { ascending: true, nullsFirst: true })
    .order('group_index', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    alert('Nu pot citi echipele.');
    return;
  }
  teams = data || [];
  renderTeamsList();
  fillTeamSelects();
  renderGroupsEditor();
  renderElimBracketEditor();

}

// listă simplă – doar pentru vizualizare / eliminatoriu
function renderTeamsList() {
  const box = document.querySelector('#teamsList');
  if (!box) return;

  if (!teams.length) {
    box.innerHTML = '<p>Nu sunt echipe încă.</p>';
    return;
  }

  box.innerHTML = teams.map(t => `
    <div style="display:flex;gap:8px;border-top:1px solid var(--border);padding-top:8px;margin-top:8px;align-items:center">
      <strong>${escapeHtml(teamLabel(t))}</strong>
      ${t.group_name ? `<span style="color:#aeb3bd">• Grupa ${escapeHtml(t.group_name)}</span>` : ''}
      ${!t.group_name && t.group_index ? `<span style="color:#aeb3bd">• Seed ${t.group_index}</span>` : ''}
    </div>
  `).join('');
}

function fillTeamSelects() {
  const opts = ['<option value="">— alege —</option>']
    .concat(teams.map(t => `<option value="${t.id}">${escapeHtml(teamLabel(t))}</option>`))
    .join('');

  const s1 = document.querySelector('#matchTeam1');
  const s2 = document.querySelector('#matchTeam2');
  if (s1) s1.innerHTML = opts;
  if (s2) s2.innerHTML = opts;
}

async function handleAddTeam() {
  const p1El = document.querySelector('#p1');
  const p2El = document.querySelector('#p2');
  const p1 = p1El.value.trim();
  const p2 = p2El.value.trim();

  if (!p1 && !p2) {
    alert('Completează cel puțin un nume.');
    return;
  }

  const { error } = await supabase.from('teams').insert({
    tournament_id: tournament.id,
    player1: p1,
    player2: p2
  });

  if (error) {
    console.error(error);
    alert('Nu am putut adăuga echipa: ' + error.message);
    return;
  }

  p1El.value = '';
  p2El.value = '';
  await loadTeams();
}

// ==================== TABLOU GRUPE ====================
async function handleGenerateGroupSlots() {
  const groupCount = parseInt(document.querySelector('#groupCount').value || '0', 10);
  const groupSize  = parseInt(document.querySelector('#groupSize').value || '0', 10);

  if (groupCount < 1 || groupSize < 2) {
    alert('Setări invalide pentru grupe.');
    return;
  }

  const ok = confirm(
    'Vrei să regenerezi grupele? Toate echipele care au deja grupă (A, B, C...) vor fi șterse.'
  );
  if (!ok) return;

  // ștergem echipele care au group_name (grupele)
  const { error: delErr } = await supabase
    .from('teams')
    .delete()
    .eq('tournament_id', tournament.id)
    .not('group_name', 'is', null);

  if (delErr) {
    console.error(delErr);
    alert('Nu am putut curăța grupele existente: ' + delErr.message);
    return;
  }

  // creăm sloturi goale pentru grupe
  const payload = [];
  for (let g = 0; g < groupCount; g++) {
    const gName = String.fromCharCode(65 + g); // A, B, C...
    for (let i = 0; i < groupSize; i++) {
      payload.push({
        tournament_id: tournament.id,
        group_name: gName,
        group_index: i + 1,
        player1: '',   // numele va fi completat de admin
        player2: ''
      });
    }
  }

  if (payload.length) {
    const { error: insErr } = await supabase.from('teams').insert(payload);
    if (insErr) {
      console.error(insErr);
      alert('Nu am putut genera grilele: ' + insErr.message);
      return;
    }
  }

  await loadTeams();
  alert('Grilele de grupe au fost generate. Completează numele în tabel.');
}

function renderGroupsEditor() {
  const wrap = document.querySelector('#groupsEditor');
  if (!wrap) return;

  const groupTeams = teams.filter(t => t.group_name);
  if (!groupTeams.length) {
    wrap.innerHTML = '<p style="color:#aeb3bd">Nu există grile de grupe. Setează formatul "Grupe" și apasă "Generează grile goale".</p>';
    return;
  }

  const groups = {};
  groupTeams.forEach(t => {
    if (!groups[t.group_name]) groups[t.group_name] = [];
    groups[t.group_name].push(t);
  });

  Object.values(groups).forEach(list => {
    list.sort((a, b) => (a.group_index || 0) - (b.group_index || 0));
  });

  wrap.innerHTML = Object.entries(groups).map(([gName, list]) => {
    const headerCells = list.map(t => `
      <th>${escapeHtml(t.player1 || '')}</th>
    `).join('');

    const bodyRows = list.map((rowTeam, rIdx) => {
      const rowCells = list.map((colTeam, cIdx) => {
        if (rIdx === cIdx) return '<td class="diag"></td>';
        if (cIdx < rIdx)  return '<td class="empty"></td>';
        return '<td></td>';
      }).join('');

      return `
        <tr data-team-id="${rowTeam.id}">
          <td>
            <input class="group-team-name"
                   value="${escapeHtml(rowTeam.player1 || '')}"
                   placeholder="Nume echipă" />
          </td>
          ${rowCells}
          <td class="wins">—</td>
          <td class="rank">—</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="group-block" style="margin-bottom:16px">
        <h4 style="margin-bottom:6px">GRUPA ${escapeHtml(gName)}</h4>
        <table class="group-table" style="border-collapse:collapse;width:100%;max-width:600px">
          <thead>
            <tr>
              <th>Nume</th>
              ${headerCells}
              <th>Nr victorii</th>
              <th>Loc ocupat</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </section>
    `;
  }).join('');

  wrap.querySelectorAll('.group-team-name').forEach(input => {
    input.addEventListener('change', async () => {
      const tr = input.closest('tr');
      const id = tr.getAttribute('data-team-id');
      const name = input.value.trim();

      const { error } = await supabase
        .from('teams')
        .update({ player1: name })
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('Nu am putut salva numele echipei: ' + error.message);
      } else {
        await loadTeams();
      }
    });
  });
}

// generează meciurile de grupe (fiecare cu fiecare)
async function handleGenerateGroupMatches() {
  const ok = confirm(
    'Vrei să generez automat TOATE meciurile de grupe (fiecare cu fiecare)? ' +
    'Meciurile de grupe existente vor fi șterse.'
  );
  if (!ok) return;

  const groupTeams = teams.filter(t => t.group_name);
  if (!groupTeams.length) {
    alert('Nu există echipe împărțite pe grupe.');
    return;
  }

  // ștergem meciurile de grupe
  const { error: delErr } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournament.id)
    .not('group_name', 'is', null);

  if (delErr) {
    console.error(delErr);
    alert('Nu am putut șterge meciurile de grupe existente: ' + delErr.message);
    return;
  }

  const byGroup = {};
  groupTeams.forEach(t => {
    if (!byGroup[t.group_name]) byGroup[t.group_name] = [];
    byGroup[t.group_name].push(t);
  });

  const inserts = [];
  let pos = 1;

  Object.entries(byGroup).forEach(([gName, list]) => {
    list.sort((a, b) => (a.group_index || 0) - (b.group_index || 0));

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        inserts.push({
          tournament_id: tournament.id,
          group_name: gName,
          round: 1,
          position: pos++,
          team1_id: list[i].id,
          team2_id: list[j].id,
          scheduled_at: null,
          court: null,
          score: null,
          winner_id: null
        });
      }
    }
  });

  if (!inserts.length) {
    alert('Nu am putut genera meciuri – probabil sunt prea puține echipe în grupe.');
    return;
  }

  const { error: insErr } = await supabase.from('matches').insert(inserts);
  if (insErr) {
    console.error(insErr);
    alert('Nu am putut insera meciurile: ' + insErr.message);
    return;
  }

  await loadMatches();
  alert('Meciurile de grupe au fost generate automat.');
}

// ==================== TABLOU ELIMINATORIU ====================
// Folosim teams cu group_name == null, iar în group_index salvăm Seed-ul.

async function handleGenerateElimSlots() {
  const bracketSize = parseInt(document.querySelector('#bracket').value || '8', 10);
  if (bracketSize < 2 || (bracketSize & (bracketSize - 1)) !== 0) {
    alert('Tabloul trebuie să fie o putere a lui 2 (ex: 4, 8, 16).');
    return;
  }

  const ok = confirm(
    'Vrei să regenerezi tabloul eliminatoriu? ' +
    'Toate echipele de eliminatoriu (seed) și meciurile eliminatorii vor fi șterse.'
  );
  if (!ok) return;

  // ștergem echipele de eliminatoriu (fără group_name)
  const { error: delTeamsErr } = await supabase
    .from('teams')
    .delete()
    .eq('tournament_id', tournament.id)
    .is('group_name', null);

  if (delTeamsErr) {
    console.error(delTeamsErr);
    alert('Nu am putut șterge echipele de eliminatoriu: ' + delTeamsErr.message);
    return;
  }

  // ștergem meciurile de eliminatoriu (group_name IS NULL)
  const { error: delMatchesErr } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournament.id)
    .is('group_name', null);

  if (delMatchesErr) {
    console.error(delMatchesErr);
    alert('Nu am putut șterge meciurile de eliminatoriu: ' + delMatchesErr.message);
    return;
  }

  const payload = [];
  for (let seed = 1; seed <= bracketSize; seed++) {
    payload.push({
      tournament_id: tournament.id,
      group_name: null,
      group_index: seed, // aici folosim group_index ca "Seed"
      player1: '',
      player2: ''
    });
  }

  const { error: insErr } = await supabase.from('teams').insert(payload);
  if (insErr) {
    console.error(insErr);
    alert('Nu am putut genera sloturile de tablou: ' + insErr.message);
    return;
  }

  await loadTeams();
  alert('Sloturile pentru tablou eliminatoriu au fost generate. Completează numele pe Seed-uri.');
}

function renderElimBracketEditor() {
  const wrap = document.querySelector('#elimBracketEditor');
  if (!wrap) return;

  // echipe de eliminatoriu = group_name null, ordonate după seed
  const elimTeams = teams
    .filter(t => !t.group_name)
    .slice()
    .sort((a, b) => (a.group_index || 0) - (b.group_index || 0));

  if (!elimTeams.length) {
    wrap.innerHTML = '<p style="color:#aeb3bd">Nu există încă sloturi de tablou. Apasă „Generează sloturi tablou”.</p>';
    return;
  }

  // facem perechi 1–2, 3–4, 5–6, ...
  const pairs = [];
  for (let i = 0; i < elimTeams.length; i += 2) {
    pairs.push([elimTeams[i], elimTeams[i + 1] || null]);
  }

  wrap.innerHTML = `
    <div class="elim-bracket">
      ${pairs.map((pair, idx) => {
        const [t1, t2] = pair;
        const seed1 = t1?.group_index ?? (idx * 2 + 1);
        const seed2 = t2?.group_index ?? (idx * 2 + 2);

        return `
          <div class="elim-row">
            <!-- coloana stângă: meciul (2 casete) -->
            <div class="elim-match-box">
              <div class="elim-player">
                <span class="elim-seed">#${seed1}</span>
                <input
                  class="elim-team-name"
                  data-team-id="${t1 ? t1.id : ''}"
                  placeholder="Seed ${seed1} – nume echipă"
                  value="${t1 ? escapeHtml(t1.player1 || '') : ''}" />
              </div>
              <div class="elim-player">
                <span class="elim-seed">#${seed2}</span>
                <input
                  class="elim-team-name"
                  data-team-id="${t2 ? t2.id : ''}"
                  placeholder="Seed ${seed2} – nume echipă sau BYE"
                  value="${t2 ? escapeHtml(t2.player1 || '') : ''}" />
              </div>
            </div>

            <!-- coloana dreaptă: caseta pentru runda următoare (doar desen) -->
            <div class="elim-next-box">
              <div class="elim-next-slot"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // când adminul schimbă un nume, îl salvăm în DB
  wrap.querySelectorAll('.elim-team-name').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-team-id');
      const name = input.value.trim();

      if (!id) {
        alert('Slotul nu are încă un ID de echipă. Generează sloturile tablou mai întâi.');
        return;
      }

      const { error } = await supabase
        .from('teams')
        .update({ player1: name })
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('Nu am putut salva numele echipei: ' + error.message);
      } else {
        await loadTeams(); // actualizează select-urile din Program & scoruri
      }
    });
  });
}


// generează meciurile din primul tur pe baza Seed-urilor
// generează toate meciurile eliminatorii (toate rundele)
async function handleGenerateElimMatches() {
  const elimTeams = teams
    .filter(t => !t.group_name)
    .slice()
    .sort((a, b) => (a.group_index || 0) - (b.group_index || 0));

  if (!elimTeams.length) {
    alert('Nu există echipe de eliminatoriu. Generează sloturile și completează numele.');
    return;
  }

  const ok = confirm(
    'Vrei să generez toate meciurile eliminatorii (toate rundele)? ' +
    'Meciurile eliminatorii existente vor fi șterse.'
  );
  if (!ok) return;

  // ștergem meciurile de eliminatoriu (group_name IS NULL)
  const { error: delMatchesErr } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournament.id)
    .is('group_name', null);

  if (delMatchesErr) {
    console.error(delMatchesErr);
    alert('Nu am putut șterge meciurile de eliminatoriu existente: ' + delMatchesErr.message);
    return;
  }

  const bracketSize = elimTeams.length;
  const totalRounds = Math.log2(bracketSize);

  if (!Number.isInteger(totalRounds)) {
    alert('Numărul de echipe de eliminatoriu trebuie să fie o putere a lui 2 (4, 8, 16...).');
    return;
  }

  const inserts = [];
  let pos = 1;

  // Runda 1 – folosim seed-urile (1 vs 2, 3 vs 4, ...)
  for (let i = 0; i < elimTeams.length; i += 2) {
    const t1 = elimTeams[i];
    const t2 = elimTeams[i + 1]; // poate fi null => BYE

    inserts.push({
      tournament_id: tournament.id,
      group_name: null,
      round: 1,
      position: pos++,
      team1_id: t1 ? t1.id : null,
      team2_id: t2 ? t2.id : null,
      scheduled_at: null,
      court: null,
      score: null,
      winner_id: null
    });
  }

  // Rundele următoare (sferturi, semifinale, finală) – doar schelet, fără echipe
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let position = 1; position <= matchesInRound; position++) {
      inserts.push({
        tournament_id: tournament.id,
        group_name: null,
        round,
        position,
        team1_id: null,
        team2_id: null,
        scheduled_at: null,
        court: null,
        score: null,
        winner_id: null
      });
    }
  }

  const { error: insErr } = await supabase.from('matches').insert(inserts);
  if (insErr) {
    console.error(insErr);
    alert('Nu am putut insera meciurile de eliminatoriu: ' + insErr.message);
    return;
  }

  await loadMatches();
  alert('Meciurile pentru toate rundele au fost generate.');
}

// ==================== MECIURI (program & scoruri) ====================
async function loadMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_name', { ascending: true, nullsFirst: true })
    .order('round', { ascending: true })
    .order('position', { ascending: true });

  if (error) {
    console.error(error);
    alert('Nu pot citi meciurile.');
    return;
  }
  renderMatches(data || []);
}


function toLocalInputValue(ts) {
  if (!ts) return '';
  const d = new Date(ts);                       // interpretează ts ca UTC
  const tzOff = d.getTimezoneOffset();         // minute
  const local = new Date(d.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 16);     // YYYY-MM-DDTHH:MM
}

function renderMatches(matches) {
  const wrap = document.querySelector('#matchesList');
  if (!wrap) return;

  if (!matches.length) {
    wrap.innerHTML = '<p>Nu există meciuri încă.</p>';
    return;
  }

  const teamOptions = (selectedId) =>
    ['<option value="">— alege —</option>']
      .concat(teams.map(t => `
        <option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>
          ${escapeHtml(teamLabel(t))}
        </option>
      `))
      .join('');

  wrap.innerHTML = matches.map(m => {
    const tag = m.group_name
      ? `Grupa ${m.group_name}`
      : `Rundă ${m.round || 1}`;

    return `
      <div class="card" style="gap:6px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><strong>${tag}</strong> • poziție ${m.position || '-'}</div>
          <button class="btn btn--ghost btn--danger" data-del="${m.id}">
            Șterge
          </button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Echipa 1</span>
            <select data-id="${m.id}" data-k="team1_id">
              ${teamOptions(m.team1_id)}
            </select>
          </label>

          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Echipa 2</span>
            <select data-id="${m.id}" data-k="team2_id">
              ${teamOptions(m.team2_id)}
            </select>
          </label>

          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Data/Ora</span>
            <input
              data-id="${m.id}"
              data-k="scheduled_at"
              type="datetime-local"
              value="${toLocalInputValue(m.scheduled_at)}">
          </label>

          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Teren</span>
            <input
              data-id="${m.id}"
              data-k="court"
              placeholder="Teren"
              value="${m.court || ''}">
          </label>

          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Scor</span>
            <input
              data-id="${m.id}"
              data-k="score"
              placeholder="Scor ex: 6-3 6-2"
              value="${m.score || ''}">
          </label>

          <label>
            <span style="font-size:0.8rem;color:#aeb3bd">Câștigător</span>
            <select data-id="${m.id}" data-k="winner_id">
              <option value="">— câștigător —</option>
              ${teamOptions(m.winner_id)}
            </select>
          </label>

          <button class="btn btn--primary"
                  data-save="${m.id}"
                  data-round="${m.round || 1}"
                  data-pos="${m.position || 1}">
            Salvează
          </button>
        </div>
      </div>
    `;
  }).join('');

  // SAVE
  wrap.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id       = btn.getAttribute('data-save');
      const round    = parseInt(btn.getAttribute('data-round') || '1', 10);
      const position = parseInt(btn.getAttribute('data-pos')   || '1', 10);

      const inputs = wrap.querySelectorAll(`[data-id="${id}"]`);
      const patch = {};

      inputs.forEach(i => {
        const key = i.getAttribute('data-k');
        let val = i.value || null;

        if (key === 'scheduled_at' && val) {
          // din local → UTC pentru timestamptz
          val = new Date(val).toISOString();
        }

        if (key === 'team1_id' || key === 'team2_id' || key === 'winner_id') {
          val = val || null;
        }

        patch[key] = val;
      });

      const { error } = await supabase.from('matches').update(patch).eq('id', id);
      if (error) {
        console.error(error);
        alert('Nu am putut salva meciul: ' + error.message);
        return;
      }

      if (patch.winner_id) {
        await propagateWinner(round, position, patch.winner_id);
      }

      await loadMatches();
    });
  });

  // DELETE (rămâne la fel ca înainte)
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del');
      const ok = confirm('Sigur vrei să ștergi acest meci?');
      if (!ok) return;

      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('Nu am putut șterge meciul: ' + error.message);
        return;
      }
      await loadMatches();
    });
  });
}

async function handleAddMatch() {
  const roundEl = document.querySelector('#matchRound');
  const groupEl = document.querySelector('#matchGroup');
  const t1El    = document.querySelector('#matchTeam1');
  const t2El    = document.querySelector('#matchTeam2');
  const dateEl  = document.querySelector('#matchDate');
  const courtEl = document.querySelector('#matchCourt');

  const round = parseInt(roundEl.value || '0', 10);
  const group = groupEl.value.trim() || null;
  const t1    = t1El.value || null;
  const t2    = t2El.value || null;
  const when  = dateEl.value;
  const court = courtEl.value.trim() || null;

  if (!t1 || !t2 || t1 === t2) {
    alert('Alege două echipe diferite.');
    return;
  }



  //let scheduled_at = when || null;   

 let scheduled_at = null;
if (when) {
  scheduled_at = new Date(when).toISOString();
}


  const { data: existing } = await supabase
    .from('matches')
    .select('position')
    .eq('tournament_id', tournament.id);

  const nextPos = (existing || []).length + 1;

  const { error } = await supabase.from('matches').insert({
    tournament_id: tournament.id,
    round,
    group_name: group,
    position: nextPos,
    team1_id: t1,
    team2_id: t2,
    scheduled_at,
    court
  });

  if (error) {
    console.error(error);
    alert('Nu am putut adăuga meciul: ' + error.message);
    return;
  }

  dateEl.value  = '';
  courtEl.value = '';

  await loadMatches();
}

// ==================== SETĂRI TURNEU ====================
async function handleSaveTournament() {
  const format     = document.querySelector('#format').value;
  const bracket    = parseInt(document.querySelector('#bracket').value || '8', 10);
  const groupCount = parseInt(document.querySelector('#groupCount').value || '2', 10);
  const groupSize  = parseInt(document.querySelector('#groupSize').value || '4', 10);

  const { error } = await supabase
    .from('tournaments')
    .update({
      format,
      bracket_size: bracket,
      group_count: groupCount,
      group_size: groupSize
    })
    .eq('id', tournament.id);

  if (error) {
    console.error(error);
    alert('Nu am putut salva setările: ' + error.message);
    return;
  }
  alert('Setări salvate.');
}

async function handleDeleteAllMatches() {
  const ok = confirm('Ești sigur(ă) că vrei să ștergi TOATE meciurile din acest turneu (grupe + eliminatoriu)?');
  if (!ok) return;

  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournament.id);

  if (error) {
    console.error(error);
    alert('Nu am putut șterge toate meciurile: ' + error.message);
    return;
  }
  await loadMatches();
}

// ==================== INIT ====================
async function initAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  document.querySelector('#format')?.addEventListener('change', toggleModeUI);
  document.querySelector('#saveTournament')?.addEventListener('click', handleSaveTournament);

  document.querySelector('#addTeam')?.addEventListener('click', handleAddTeam);

  // Grupe
  document.querySelector('#genGroupSlots')?.addEventListener('click', handleGenerateGroupSlots);
  document.querySelector('#autoGroupMatches')?.addEventListener('click', handleGenerateGroupMatches);

  // Eliminatoriu
  document.querySelector('#genElimSlots')?.addEventListener('click', handleGenerateElimSlots);
  document.querySelector('#autoElimMatches')?.addEventListener('click', handleGenerateElimMatches);

  // Program general
  document.querySelector('#addMatch')?.addEventListener('click', handleAddMatch);
  document.querySelector('#deleteAllMatches')?.addEventListener('click', handleDeleteAllMatches);



  await loadTournament();
  await loadTeams();
  await loadMatches();


  markActiveCategory();
}


initAdmin();



function markActiveCategory() {
  const cat = CURRENT_CAT;
  const b1 = document.querySelector('#cat1Btn');
  const b2 = document.querySelector('#cat2Btn');

  if (b1 && b2) {
    if (cat === '2') {
      b2.classList.add('btn--primary');
    } else {
      b1.classList.add('btn--primary');
    }
  }
}
