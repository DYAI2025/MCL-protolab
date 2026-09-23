import type { RunView, SelectionResult } from '../../../src/core/generative-world/director-session.ts';

/**
 * Technical harness panel for the director slice (MCL-85) — a design
 * instrument, not game UI. Shows the triggering run, every proposal with its
 * gate verdict, and the applied diff. Rejected proposals render a disabled
 * button; text is set via textContent only.
 */

export interface DirectorPanel {
  showIdle(): void;
  showRunning(): void;
  showRun(run: RunView): void;
  showResult(result: SelectionResult): void;
  destroy(): void;
}

const PANEL_STYLE = 'background:rgba(13,17,23,0.82);padding:10px 14px;margin:0 10px 10px;border-radius:8px;font-size:12px;min-width:230px;max-width:280px;';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string, style = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (style) node.style.cssText = style;
  return node;
};

export function mountDirectorPanel(host: HTMLElement, onSelect: (proposalId: string) => void): DirectorPanel {
  const panel = element('div', '', PANEL_STYLE);
  panel.dataset['directorPanel'] = '';
  const heading = element('h2', 'DIRECTOR · FAKE PROVIDER', 'margin:0 0 4px;font-size:11px;letter-spacing:0.08em;opacity:0.6;');
  const status = element('div', '', 'opacity:0.85;');
  status.dataset['directorStatus'] = '';
  const list = element('ol', '', 'margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px;');
  const result = element('div', '', 'margin-top:6px;font-variant-numeric:tabular-nums;');
  result.dataset['directorResult'] = '';
  const note = element('div', 'Proposals are prototype hypotheses (DERIVED) — never canon.', 'margin-top:6px;opacity:0.5;font-size:11px;');
  panel.append(heading, status, list, result, note);
  host.append(panel);

  const clearList = (): void => {
    while (list.firstChild) list.firstChild.remove();
  };

  return {
    showIdle() {
      status.textContent = 'waiting for a network alert';
      clearList();
      result.textContent = '';
    },

    showRunning() {
      status.textContent = 'director run in progress…';
    },

    showRun(run: RunView) {
      const accepted = run.proposals.filter((view) => view.gate.status === 'accepted').length;
      status.textContent = `${run.run_id} · ${run.status} · ${accepted}/${run.proposals.length} accepted`;
      if (run.error) status.textContent += ` · ${run.error}`;
      clearList();
      for (const view of run.proposals) {
        const item = element('li', '');
        item.dataset['directorProposal'] = view.proposal.proposal_id;
        item.dataset['intent'] = view.proposal.transition_intent.join(' ');
        item.dataset['gateStatus'] = view.gate.status;
        const verdict = view.gate.status === 'accepted'
          ? `${view.proposal.design_status} · ${view.proposal.source_refs.join(', ')}`
          : `rejected: ${view.gate.reasons.join(', ')}`;
        const button = element('button', view.gate.status === 'accepted' ? 'Choose' : 'Blocked', 'margin-top:2px;font-size:11px;');
        button.disabled = view.gate.status !== 'accepted' || run.resolved;
        if (run.selected_proposal_id === view.proposal.proposal_id) button.textContent = 'Applied';
        button.addEventListener('click', () => onSelect(view.proposal.proposal_id));
        item.append(
          element('div', view.proposal.summary),
          element('div', verdict, `opacity:0.6;font-size:11px;${view.gate.status === 'rejected' ? 'color:#ff8a8a;' : ''}`),
          button,
        );
        list.append(item);
      }
    },

    showResult(selection: SelectionResult) {
      if (!selection.ok) {
        result.textContent = `refused: ${selection.reason}`;
        return;
      }
      const changes = selection.diff
        .map((entry) => `${entry.path.join('.')} ${String(entry.before)} → ${String(entry.after)}`)
        .join(' · ');
      result.textContent = `applied: ${changes}`;
    },

    destroy() {
      panel.remove();
    },
  };
}
