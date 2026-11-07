/* =====================================================================
   MEMBRES — page d'administration (visible par l'administrateur seul)
   ---------------------------------------------------------------------
   Inscriptions à valider, appareils de chacun, demandes d'appareil en trop,
   blocage. Les règles Firestore refusent ces actions à tout autre compte.
   ===================================================================== */

import { esc, toast } from '../utils.js';
import { icone } from '../icones.js';
import { listerMembres, majMembre, champSupprime, estAdmin, nomComplet, idAppareil, utilisateur, publierContenu } from '../compte.js';

const date = (t) => (t ? new Date(t).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const STATUTS = { attente: ['En attente', 'mid'], accepte: ['Accepté', 'ok'], bloque: ['Bloqué', 'ko'] };
const ORDRE = { attente: 0, accepte: 1, bloque: 2 };

/** Signaux d'un possible partage d'identifiants. */
function alertes(m) {
  const a = []; const app = Object.values(m.appareils || {});
  if (Object.keys(m.demandes || {}).length) a.push('demande un appareil en plus');
  const recents = app.filter((x) => Date.now() - (x.premier || 0) < 7 * 864e5).length;
  if (recents >= 2 && app.length >= 2) a.push(`${recents} appareils ajoutés cette semaine`);
  const actifs = app.filter((x) => Date.now() - (x.dernier || 0) < 864e5).length;
  if (actifs >= 2) a.push(`${actifs} appareils utilisés dans les dernières 24 h`);
  return a;
}

export async function vueMembres(el) {
  if (!estAdmin()) { el.innerHTML = '<div class="error-box">Page réservée à l\'administrateur.</div>'; return null; }
  el.innerHTML = '<div class="loading">Chargement des membres…</div>';
  let liste;
  try { liste = await listerMembres(); } catch (e) { el.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return null; }
  const filtre = el.dataset.filtre || 'tous';
  liste.sort((a, b) => (ORDRE[a.statut] ?? 3) - (ORDRE[b.statut] ?? 3) || (Object.keys(b.demandes || {}).length - Object.keys(a.demandes || {}).length) || nomComplet(a).localeCompare(nomComplet(b)));
  const nb = (s) => liste.filter((m) => m.statut === s).length;
  const nbDem = liste.filter((m) => Object.keys(m.demandes || {}).length).length;
  const garde = (m) => ({ attente: m.statut === 'attente', demandes: Object.keys(m.demandes || {}).length > 0, bloque: m.statut === 'bloque' }[filtre] ?? true);
  const moi = utilisateur()?.uid; const monApp = idAppareil();

  const carte = (m) => {
    const [st, cl] = STATUTS[m.statut] || [m.statut, ''];
    const apps = Object.entries(m.appareils || {}).sort((a, b) => (b[1].dernier || 0) - (a[1].dernier || 0));
    const dem = Object.entries(m.demandes || {});
    const al = alertes(m); const max = m.maxApp || 2;
    return `<div class="panel mb-carte" data-uid="${esc(m.uid)}">
      <div class="mb-tete"><div><b>${esc(nomComplet(m))}</b>${m.uid === moi ? ' <span class="badge">toi</span>' : ''}<br><span class="muted">${esc(m.email)} · inscrit le ${date(m.cree)} · ${m.cgu ? `conditions acceptées le ${date(m.cgu.t)}` : 'conditions pas encore acceptées'}</span></div>
        <span class="badge ex-${cl}">${st}</span></div>
      ${al.length && m.uid !== moi ? `<p class="mb-alerte">${icone('ampoule')} ${al.map(esc).join(' · ')}</p>` : ''}
      <div class="mb-l"><b>Appareils ${apps.length} / ${max}</b>
        ${m.uid !== moi ? `<span class="mb-max">limite : <button class="chip-b ${max === 2 ? 'actif' : ''}" data-max="2">2</button><button class="chip-b ${max === 3 ? 'actif' : ''}" data-max="3">3</button></span>` : ''}</div>
      <ul class="mb-apps">${apps.map(([id, a]) => `<li><span>${esc(a.nom || 'Appareil')}${m.session === id ? ' <span class="badge ex-ok">connecté</span>' : ''}${m.uid === moi && id === monApp ? ' <span class="badge">cet appareil</span>' : ''}<br>
        <span class="muted">depuis le ${date(a.premier)} · vu le ${date(a.dernier)}</span></span>
        ${m.uid === moi && id === monApp ? '' : `<button class="btn icon" data-retirer="${esc(id)}" title="Retirer cet appareil">${icone('croix')}</button>`}</li>`).join('') || '<li class="muted">Aucun</li>'}</ul>
      ${dem.length ? `<div class="mb-dem"><b>Demande${dem.length > 1 ? 's' : ''} d'appareil en plus</b>${dem.map(([id, a]) => `<div class="mb-dem-l">
        <span>${esc(a.nom || 'Appareil')}<br><span class="muted">demandé le ${date(a.premier)}</span></span>
        <span class="mb-dem-b">${apps.length < 3 ? `<button class="btn primary" data-ajouter="${esc(id)}">Accepter en plus (${apps.length + 1} appareils)</button>` : ''}
          ${apps.map(([aid, x]) => `<button class="btn" data-remplacer="${esc(id)}" data-ancien="${esc(aid)}">Remplacer « ${esc(x.nom || 'appareil')} »</button>`).join('')}
          <button class="btn bad" data-refuser="${esc(id)}">Refuser</button></span></div>`).join('')}</div>` : ''}
      ${m.uid !== moi ? `<div class="mb-actions">
        ${m.statut !== 'accepte' ? `<button class="btn primary" data-statut="accepte">${icone('check')} ${m.statut === 'bloque' ? 'Débloquer' : 'Accepter'}</button>` : ''}
        ${m.statut !== 'bloque' ? `<button class="btn bad" data-statut="bloque">${icone('croix')} ${m.statut === 'attente' ? 'Refuser' : 'Bloquer'}</button>` : ''}
      </div>` : ''}
    </div>`;
  };

  el.innerHTML = `
    <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><span>Membres</span></div>
    <div class="page-head"><div><h1>Membres</h1><p class="muted">Inscriptions, appareils et accès. Un compte bloqué ou un appareil retiré perd l'accès à sa prochaine connexion à Internet.</p></div></div>
    <div class="at-stats">
      <div class="panel"><div class="big">${liste.length}</div>comptes</div>
      <div class="panel"><div class="big ${nb('attente') ? 'mid' : ''}">${nb('attente')}</div>en attente</div>
      <div class="panel"><div class="big ${nbDem ? 'mid' : ''}">${nbDem}</div>demandes d'appareil</div>
      <div class="panel"><div class="big">${nb('bloque')}</div>bloqués</div>
    </div>
    <div class="at-barre"><div class="at-filtres" role="radiogroup">
      ${[['tous', 'Tous'], ['attente', 'En attente'], ['demandes', 'Demandes d\'appareil'], ['bloque', 'Bloqués']].map(([v, l]) => `<label class="chip"><input type="radio" name="mbf" value="${v}" ${v === filtre ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      <button class="btn" data-a="actualiser">${icone('recommencer')} Actualiser</button>
      <button class="btn" data-a="excel">${icone('telecharger')} Exporter en Excel</button>
    </div></div>
    <div class="mb-liste">${liste.filter(garde).map(carte).join('') || '<p class="muted">Personne ici.</p>'}</div>
    <details class="panel mb-contenu"><summary><b>${icone('page')} Contenu des cours</b> <span class="muted">(mise à jour des synthèses et exercices)</span></summary>
      <p class="muted">Le contenu n'est plus publié sur le site : il est rangé dans Firebase, lisible seulement par les comptes acceptés.
      Pour le mettre à jour, choisis le dossier <code>content</code> de l'appli (sur ton PC) : tous les fichiers JSON sont envoyés.</p>
      <div class="set-row"><label class="btn primary">${icone('telecharger')} Envoyer le dossier content
        <input type="file" webkitdirectory multiple hidden data-a="dossier"></label>
        <button class="btn" data-a="site">Copier depuis l'ancien site</button></div>
      <p class="muted mb-journal"></p></details>`;

  const refaire = () => vueMembres(el);
  const journal = el.querySelector('.mb-journal');
  const envoyer = async (fichiers) => {   // [[chemin « content/… », texte]]
    let n = 0, err = [];
    for (const [chemin, texte] of fichiers) {
      try { await publierContenu(chemin, texte); n++; journal.textContent = `${n} / ${fichiers.length} fichiers envoyés…`; }
      catch (e) { err.push(`${chemin} : ${e.message}`); }
    }
    journal.innerHTML = `${n} fichier(s) publié(s).${err.length ? `<br>Erreurs :<br>${err.map(esc).join('<br>')}` : ''}`;
    toast(err.length ? 'Contenu publié avec des erreurs' : 'Contenu publié');
  };
  el.querySelector('[data-a=dossier]').addEventListener('change', async (e) => {
    const f = [...e.target.files].filter((x) => x.name.endsWith('.json'));
    const liste = [];
    for (const x of f) {
      const rel = (x.webkitRelativePath || x.name).replace(/\\/g, '/');
      const i = rel.indexOf('content/');
      liste.push([i >= 0 ? rel.slice(i) : `content/${rel.split('/').slice(1).join('/')}`, await x.text()]);
    }
    if (!liste.length) { toast('Aucun fichier JSON dans ce dossier'); return; }
    if (confirm(`Publier ${liste.length} fichier(s) de contenu ?\n${liste.slice(0, 8).map((l) => l[0]).join('\n')}${liste.length > 8 ? '\n…' : ''}`)) envoyer(liste);
  });
  el.querySelector('[data-a=site]').addEventListener('click', async () => {
    journal.textContent = 'Lecture du contenu publié sur le site…';
    for (const base of ['content/', '../content/']) {
      try {
        const idx = await fetch(base + 'index.json', { cache: 'no-store' });
        if (!idx.ok) continue;
        const texteIdx = await idx.text(); const index = JSON.parse(texteIdx);
        const chemins = [...new Set((index.matieres || []).flatMap((m) => [...(m.chapitres || []).map((c) => c.fichier), ...(m.schemas ? [m.schemas.fichier] : [])]))];
        const liste = [['content/index.json', texteIdx]];
        for (const c of chemins) { const r = await fetch(base + c, { cache: 'no-store' }); if (r.ok) liste.push([`content/${c}`, await r.text()]); }
        if (confirm(`Copier ${liste.length} fichier(s) dans Firebase ?`)) envoyer(liste);
        return;
      } catch { /* essai suivant */ }
    }
    journal.textContent = 'Aucun contenu trouvé sur le site.';
  });
  el.querySelector('.at-filtres').addEventListener('change', (e) => { el.dataset.filtre = e.target.value; refaire(); });
  el.querySelector('[data-a=actualiser]').addEventListener('click', refaire);
  el.querySelector('[data-a=excel]').addEventListener('click', () => {   // CSV lisible par Excel (séparateur « ; », accents conservés)
    const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const d = (t) => (t ? new Date(t).toLocaleString('fr-BE') : '');
    const lignes = [['Prénom', 'Nom', 'E-mail', 'Statut', 'Inscrit le', 'Conditions acceptées le', 'Appareils', 'Limite', 'Détail des appareils', 'Demandes en attente']];
    for (const m of liste) {
      const apps = Object.values(m.appareils || {});
      lignes.push([m.prenom, m.nom, m.email, (STATUTS[m.statut] || [m.statut])[0], d(m.cree), d(m.cgu?.t), apps.length, m.maxApp || 2,
        apps.map((a) => `${a.nom} (vu le ${d(a.dernier)})`).join(' | '), Object.keys(m.demandes || {}).length]);
    }
    const blob = new Blob(['\ufeff' + lignes.map((l) => l.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `membres-revisions-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  el.querySelector('.mb-liste').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); const c = e.target.closest('[data-uid]'); if (!b || !c) return;
    const m = liste.find((x) => x.uid === c.dataset.uid); const n = nomComplet(m);
    let champs = null, ok = '';
    if (b.dataset.statut) {
      const s = b.dataset.statut;
      if (s === 'bloque' && !confirm(`${m.statut === 'attente' ? 'Refuser' : 'Bloquer'} l'accès de ${n} ?`)) return;
      champs = { statut: s }; ok = s === 'accepte' ? `${n} : accès accepté` : `${n} : accès bloqué`;
    } else if (b.dataset.max) {
      const max = +b.dataset.max;
      if (Object.keys(m.appareils || {}).length > max) { toast(`Retire d'abord un appareil (il en a ${Object.keys(m.appareils).length}).`, 4000); return; }
      champs = { maxApp: max }; ok = `${n} : ${max} appareils autorisés`;
    } else if (b.dataset.retirer) {
      if (!confirm(`Retirer l'appareil « ${m.appareils[b.dataset.retirer]?.nom} » de ${n} ? Il sera déconnecté.`)) return;
      champs = { [`appareils.${b.dataset.retirer}`]: champSupprime() }; ok = 'Appareil retiré';
    } else if (b.dataset.ajouter) {
      const id = b.dataset.ajouter; const nbApp = Object.keys(m.appareils || {}).length + 1;
      champs = { [`appareils.${id}`]: { ...m.demandes[id], dernier: Date.now() }, [`demandes.${id}`]: champSupprime(), maxApp: Math.max(m.maxApp || 2, nbApp) };
      ok = `Appareil accepté (${nbApp} appareils)`;
    } else if (b.dataset.remplacer) {
      const id = b.dataset.remplacer;
      champs = { [`appareils.${id}`]: { ...m.demandes[id], dernier: Date.now() }, [`demandes.${id}`]: champSupprime(), [`appareils.${b.dataset.ancien}`]: champSupprime() };
      ok = 'Appareil remplacé';
    } else if (b.dataset.refuser) {
      champs = { [`demandes.${b.dataset.refuser}`]: champSupprime() }; ok = 'Demande refusée';
    }
    if (!champs) return;
    b.disabled = true;
    try { await majMembre(m.uid, champs); toast(ok); refaire(); } catch (er) { toast(`Échec : ${er.message}`, 5000); b.disabled = false; }
  });
  return null;
}
