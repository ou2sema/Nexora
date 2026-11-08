#!/usr/bin/env node
// The dashboard is bound to loopback, so a hosted runner cannot post there.
// This runs on the host instead: it reads the public Actions API, finds the
// suite steps of finished main-branch runs, and marks each one on the
// dashboard. A run is recorded once, so polling never draws a marker twice.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.GITHUB_REPOSITORY ?? 'ou2sema/Nexora';
const branch = process.env.CI_BRANCH ?? 'main';
const runLimit = Number(process.env.CI_RUN_LIMIT ?? 10);
const maxAgeHours = Number(process.env.CI_MAX_AGE_HOURS ?? 72);
const grafanaUrl = process.env.GRAFANA_URL ?? 'http://localhost:3001';
const stateFile = process.env.CI_SYNC_STATE ?? join(here, '..', '.state', 'ci-annotations.json');

// Job name -> the step that runs the suite. The step's span is the annotation,
// so the marker covers the tests rather than checkout and install.
const suites = new Map([
  [
    'Lint, types, unit tests, build',
    { suite: 'api', tag: 'api-tests', step: 'Unit and integration tests' },
  ],
  ['Playwright E2E', { suite: 'e2e desktop+mobile', tag: 'e2e-tests', step: 'Run E2E suite' }],
  [
    'Playwright local stack',
    {
      suite: 'e2e local stack desktop+mobile',
      tag: 'e2e-tests',
      step: 'Run local-stack E2E suite',
    },
  ],
]);

function say(message) {
  process.stdout.write(`${message}\n`);
}

function formatDuration(milliseconds) {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function grafanaAuthorization() {
  if (process.env.GRAFANA_TOKEN) {
    return `Bearer ${process.env.GRAFANA_TOKEN}`;
  }

  const user = process.env.GRAFANA_USER ?? 'admin';
  const password = process.env.GRAFANA_PASSWORD ?? (await passwordFromEnvFile());
  if (!password) {
    throw new Error('Set GRAFANA_TOKEN, or GRAFANA_PASSWORD, or infra/observability/.env.');
  }
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

async function passwordFromEnvFile() {
  try {
    const text = await readFile(join(here, '..', '.env'), 'utf8');
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith('GRAFANA_ADMIN_PASSWORD='));
    return line?.slice('GRAFANA_ADMIN_PASSWORD='.length).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function github(path) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'nexora-ci-annotations',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path} answered ${response.status}.`);
  }
  return response.json();
}

async function loadState() {
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    return { recordedRuns: Array.isArray(state.recordedRuns) ? state.recordedRuns : [] };
  } catch {
    return { recordedRuns: [] };
  }
}

async function saveState(state) {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function annotationFor(job, run) {
  const mapped = suites.get(job.name);
  if (!mapped) return undefined;

  const step = job.steps?.find((entry) => entry.name === mapped.step);
  if (step?.started_at && step.completed_at) {
    const status = step.conclusion === 'success' ? 'passed' : 'failed';
    const length = Date.parse(step.completed_at) - Date.parse(step.started_at);
    return {
      text: `${mapped.suite} ${run.head_sha.slice(0, 7)} ${status} in ${formatDuration(length)}`,
      tags: [mapped.tag, status],
      time: Date.parse(step.started_at),
      timeEnd: Date.parse(step.completed_at),
    };
  }

  // A job that died before its suite step started still leaves a verdict.
  if (job.started_at && job.completed_at) {
    const status = job.conclusion === 'success' ? 'passed' : 'failed';
    const length = Date.parse(job.completed_at) - Date.parse(job.started_at);
    return {
      text: `${mapped.suite} ${run.head_sha.slice(0, 7)} ${status} in ${formatDuration(length)}`,
      tags: [mapped.tag, status],
      time: Date.parse(job.started_at),
      timeEnd: Date.parse(job.completed_at),
    };
  }

  return undefined;
}

async function main() {
  const state = await loadState();
  const authorization = await grafanaAuthorization();

  const runs = (
    await github(`/repos/${repo}/actions/runs?branch=${branch}&per_page=${runLimit}`)
  ).workflow_runs
    .filter((run) => run.event === 'push' && run.status === 'completed')
    .filter((run) => Date.now() - Date.parse(run.updated_at) < maxAgeHours * 3_600_000);

  const window = new Set(runs.map((run) => run.id));
  let posted = 0;

  for (const run of runs) {
    if (state.recordedRuns.includes(run.id)) continue;

    const jobs = (await github(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=30`)).jobs;
    const annotations = jobs
      .map((job) => annotationFor(job, run))
      .filter((annotation) => annotation !== undefined);

    for (const annotation of annotations) {
      const response = await fetch(`${grafanaUrl}/api/annotations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization },
        body: JSON.stringify(annotation),
      });
      if (!response.ok) {
        // Leave the run unrecorded so the next poll retries it.
        throw new Error(`Grafana answered ${response.status}: ${await response.text()}`);
      }
      posted += 1;
      say(`posted: ${annotation.text}`);
    }

    if (annotations.length > 0) {
      state.recordedRuns.push(run.id);
      await saveState(state);
    } else {
      say(`no suite jobs in run ${run.id}; leaving it unrecorded.`);
    }
  }

  state.recordedRuns = state.recordedRuns.filter((id) => window.has(id) || !runs.length);
  await saveState(state);
  say(`${posted} annotation(s) posted; ${state.recordedRuns.length} run(s) recorded.`);
}

main().catch((error) => {
  console.error(`ci annotations: ${error.message}`);
  process.exitCode = 1;
});
