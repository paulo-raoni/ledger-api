import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp, generateRunEmail } from '../contexts/AppContext';
import { demoFlow } from '../flows/demoFlow';
import type { StepResult, StepStatus, FlowContext } from '../flows/demoFlow';
import { StepCard } from '../components/StepCard';
import { ProgressBar } from '../components/ProgressBar';
import { BottomBar } from '../components/BottomBar';
import { Spinner } from '../components/Spinner';

const STEP_DELAY = 2000;
const ERROR_PAUSE = 4000;
const IDENTITY_BASE = 'http://localhost:3002';
const LEDGER_BASE = 'http://localhost:3001';

async function runStep(stepIndex: number, ctx: FlowContext): Promise<StepResult> {
  const step = demoFlow[stepIndex];
  const base = step.service === 'identity' ? IDENTITY_BASE : LEDGER_BASE;
  const resolvedPath = step.getResolvedPath ? step.getResolvedPath(ctx) : step.path;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const extraHeaders = step.getHeaders ? step.getHeaders(ctx) : {};
  Object.assign(headers, extraHeaders);
  const body = step.getBody ? step.getBody(ctx) : undefined;

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let responseStatus = 0;
  let responseBody: unknown = null;

  try {
    const res = await fetch(`${base}${resolvedPath}`, {
      method: step.method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    responseStatus = res.status;
    responseBody = await res.json().catch(() => null);
  } catch {
    clearTimeout(timeout);
    throw new Error('Cannot reach service');
  }

  const latencyMs = Date.now() - start;
  const isExpectedError =
    step.expectedErrorStatus !== undefined && responseStatus === step.expectedErrorStatus;
  const isUnexpectedError =
    !isExpectedError && (responseStatus < 200 || responseStatus >= 300);

  let status: StepStatus = 'completed';
  if (isExpectedError) status = 'error-expected';
  else if (isUnexpectedError) status = 'error-unexpected';

  return {
    stepId: step.id,
    status,
    requestBody: body,
    requestHeaders: extraHeaders,
    resolvedPath,
    responseStatus,
    responseBody,
    latencyMs,
    timestamp: new Date(),
  };
}

export function Autoplay() {
  const { token, userId, setToken, setUserId, addHistory, setRunEmail, runEmail } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<(StepResult | undefined)[]>(demoFlow.map(() => undefined));
  const [statuses, setStatuses] = useState<StepStatus[]>(demoFlow.map(() => 'pending'));
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);

  const ctxRef = useRef<FlowContext>({ token, userId, runEmail });
  const pausedRef = useRef(paused);
  const cancelRef = useRef(false);

  useEffect(() => {
    ctxRef.current = { token, userId, runEmail };
  }, [token, userId, runEmail]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const runFrom = useCallback(
    async (startIndex: number, ctx: FlowContext) => {
      cancelRef.current = false;
      setRunning(true);
      setFinished(false);

      for (let i = startIndex; i < demoFlow.length; i++) {
        if (cancelRef.current) break;

        while (pausedRef.current && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (cancelRef.current) break;

        setCurrentStep(i);
        setStatuses((prev) => {
          const next = [...prev];
          next[i] = 'active';
          return next;
        });
        setActiveLoading(true);

        let result: StepResult;
        try {
          result = await runStep(i, ctx);
        } catch {
          const step = demoFlow[i];
          result = {
            stepId: step.id,
            status: 'error-unexpected',
            requestBody: step.getBody ? step.getBody(ctx) : undefined,
            requestHeaders: step.getHeaders ? step.getHeaders(ctx) : {},
            resolvedPath: step.getResolvedPath ? step.getResolvedPath(ctx) : step.path,
            responseStatus: 0,
            responseBody: { error: 'Cannot reach service' },
            latencyMs: 0,
            timestamp: new Date(),
          };
        }

        setActiveLoading(false);
        setResults((prev) => {
          const next = [...prev];
          next[i] = result;
          return next;
        });
        setStatuses((prev) => {
          const next = [...prev];
          next[i] = result.status;
          return next;
        });

        if (i === 0 && result.status === 'completed') {
          const body = result.responseBody as Record<string, unknown>;
          if (body?.id) {
            ctx.userId = body.id as string;
            setUserId(body.id as string);
          }
        }
        if (i === 1 && result.status === 'completed') {
          const body = result.responseBody as Record<string, unknown>;
          if (body?.access_token) {
            ctx.token = body.access_token as string;
            setToken(body.access_token as string);
          }
        }

        addHistory({
          method: demoFlow[i].method,
          path: result.resolvedPath,
          status: result.responseStatus,
          latencyMs: result.latencyMs,
          requestBody: result.requestBody,
          requestHeaders: result.requestHeaders,
          responseBody: result.responseBody,
          timestamp: result.timestamp,
        });

        if (result.status === 'error-unexpected') {
          setRunning(false);
          return;
        }

        if (cancelRef.current) break;

        const delay = result.status === 'error-expected' ? ERROR_PAUSE : STEP_DELAY;
        await new Promise((r) => setTimeout(r, delay));
      }

      if (!cancelRef.current) {
        setFinished(true);
      }
      setRunning(false);
    },
    [addHistory, setToken, setUserId],
  );

  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      runFrom(0, ctxRef.current);
    }
  }, [runFrom]);

  const handlePause = () => setPaused((p) => !p);

  const handleRestart = useCallback(() => {
    cancelRef.current = true;
    const newEmail = generateRunEmail();
    const newCtx: FlowContext = { token: null, userId: null, runEmail: newEmail };
    ctxRef.current = newCtx;
    setRunEmail(newEmail);
    setToken(null);
    setUserId(null);
    setCurrentStep(0);
    setResults(demoFlow.map(() => undefined));
    setStatuses(demoFlow.map(() => 'pending'));
    setPaused(false);
    setFinished(false);
    setActiveLoading(false);
    setTimeout(() => {
      cancelRef.current = false;
      runFrom(0, newCtx);
    }, 100);
  }, [setRunEmail, setToken, setUserId, runFrom]);

  const handleRetry = useCallback(() => {
    const failedStep = currentStep;
    setStatuses((prev) => {
      const next = [...prev];
      next[failedStep] = 'pending';
      return next;
    });
    setResults((prev) => {
      const next = [...prev];
      next[failedStep] = undefined;
      return next;
    });
    setTimeout(() => runFrom(failedStep, ctxRef.current), 50);
  }, [currentStep, runFrom]);

  const step = demoFlow[currentStep];
  const result = results[currentStep];
  const status = statuses[currentStep];
  const displayStatus: StepStatus = activeLoading ? 'active' : status;
  const displayResult = activeLoading ? undefined : result;
  const isErrorUnexpected = !activeLoading && status === 'error-unexpected';

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar current={currentStep + 1} total={demoFlow.length} service={step?.service} />

      <StepCard
        step={step}
        result={displayResult}
        status={displayStatus}
        showDescription={false}
      />

      {finished && (
        <div
          className="rounded-lg p-4 text-center text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--success)', color: 'var(--success)' }}
        >
          Flow complete — all 13 steps passed.
        </div>
      )}

      <BottomBar>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {finished ? 'Done' : paused ? 'Paused' : running ? 'Running...' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isErrorUnexpected && (
            <button
              data-testid="autoplay-retry"
              onClick={handleRetry}
              className="px-3 py-1.5 text-xs rounded font-semibold"
              style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
            >
              Retry
            </button>
          )}
          {!finished && !isErrorUnexpected && (
            <button
              data-testid="autoplay-pause"
              onClick={handlePause}
              className="px-3 py-1.5 text-xs rounded font-semibold"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
          <button
            data-testid="autoplay-restart"
            onClick={handleRestart}
            className="px-3 py-1.5 text-xs rounded font-semibold"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Restart
          </button>
          {running && !paused && <Spinner />}
        </div>
      </BottomBar>
    </div>
  );
}
