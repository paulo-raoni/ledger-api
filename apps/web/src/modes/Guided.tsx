import { useRef, useCallback, useState, useEffect } from 'react';
import { useApp, generateRunEmail } from '../contexts/AppContext';
import { demoFlow } from '../flows/demoFlow';
import type { StepResult, StepStatus, FlowContext } from '../flows/demoFlow';
import { StepCard } from '../components/StepCard';
import { ProgressBar } from '../components/ProgressBar';
import { BottomBar } from '../components/BottomBar';
import { Spinner } from '../components/Spinner';
import { DbInspector } from '../components/DbInspector/DbInspector';

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
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    throw new Error(isTimeout ? 'Service unavailable' : 'Cannot reach service');
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

export function Guided() {
  const { token, userId, setToken, setUserId, addHistory, setRunEmail, runEmail } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<(StepResult | undefined)[]>(demoFlow.map(() => undefined));
  const [statuses, setStatuses] = useState<StepStatus[]>(demoFlow.map(() => 'pending'));
  const [loading, setLoading] = useState(true); // true from mount: auto-execute fires immediately
  const [executed, setExecuted] = useState(false); // has current step been executed?
  const [dbOpen, setDbOpen] = useState(false);

  const ctxRef = useRef<FlowContext>({ token, userId, runEmail });

  const executeCurrentStep = useCallback(async () => {
    const i = currentStep;
    const ctx = ctxRef.current;

    setStatuses((prev) => {
      const next = [...prev];
      next[i] = 'active';
      return next;
    });
    setLoading(true);

    let result: StepResult;
    try {
      result = await runStep(i, ctx);
    } catch (err) {
      const step = demoFlow[i];
      const errMsg = err instanceof Error ? err.message : 'Cannot reach service';
      result = {
        stepId: step.id,
        status: 'error-unexpected',
        requestBody: step.getBody ? step.getBody(ctx) : undefined,
        requestHeaders: step.getHeaders ? step.getHeaders(ctx) : {},
        resolvedPath: step.getResolvedPath ? step.getResolvedPath(ctx) : step.path,
        responseStatus: 0,
        responseBody: { error: errMsg },
        latencyMs: 0,
        timestamp: new Date(),
      };
    }

    setLoading(false);
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
    setExecuted(true);

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
  }, [currentStep, addHistory, setToken, setUserId]);

  // Auto-execute step 1 on mount
  const hasAutoExecuted = useRef(false);
  useEffect(() => {
    if (!hasAutoExecuted.current) {
      hasAutoExecuted.current = true;
      executeCurrentStep();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = useCallback(async () => {
    if (!executed) {
      await executeCurrentStep();
      return;
    }
    // advance to next step
    if (currentStep < demoFlow.length - 1) {
      setCurrentStep((s) => s + 1);
      setExecuted(false);
    }
  }, [executed, executeCurrentStep, currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setExecuted(results[currentStep - 1] !== undefined);
    }
  }, [currentStep, results]);

  const handleRestart = useCallback(() => {
    const newEmail = generateRunEmail();
    const newCtx: FlowContext = { token: null, userId: null, runEmail: newEmail };
    ctxRef.current = newCtx;
    setRunEmail(newEmail);
    setToken(null);
    setUserId(null);
    setCurrentStep(0);
    setResults(demoFlow.map(() => undefined));
    setStatuses(demoFlow.map(() => 'pending'));
    setLoading(false);
    setExecuted(false);
    setDbOpen(false);
  }, [setRunEmail, setToken, setUserId]);

  const step = demoFlow[currentStep];
  const result = results[currentStep];
  const status = statuses[currentStep];
  const displayStatus: StepStatus = loading ? 'active' : (executed ? status : 'pending');
  const displayResult = loading ? undefined : result;
  const isLast = currentStep === demoFlow.length - 1;
  const isFirst = currentStep === 0;
  const nextDisabled = loading || (executed && isLast);

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar current={currentStep + 1} total={demoFlow.length} service={step?.service} />

      <StepCard
        step={step}
        result={displayResult}
        status={displayStatus}
        showDescription={true}
      />

      <BottomBar>
        <button
          data-testid="btn-db-inspector"
          onClick={() => setDbOpen(true)}
          className="px-3 py-1.5 text-xs rounded font-semibold"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          🗄 DB
        </button>

        {!isFirst && (
          <button
            data-testid="btn-back"
            onClick={handleBack}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded font-semibold disabled:opacity-40"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            ← Back
          </button>
        )}

        <button
          data-testid="btn-restart"
          onClick={handleRestart}
          className="px-3 py-1.5 text-xs rounded font-semibold"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Restart
        </button>

        <button
          data-testid="btn-next"
          onClick={handleNext}
          disabled={nextDisabled}
          className="px-3 py-1.5 text-xs rounded font-semibold flex items-center gap-1.5 disabled:opacity-40"
          style={{ backgroundColor: 'var(--identity)', color: '#fff' }}
        >
          {loading && <Spinner />}
          {executed ? (isLast ? 'Done' : 'Next →') : 'Run →'}
        </button>
      </BottomBar>

      {dbOpen && <DbInspector onClose={() => setDbOpen(false)} />}
    </div>
  );
}
