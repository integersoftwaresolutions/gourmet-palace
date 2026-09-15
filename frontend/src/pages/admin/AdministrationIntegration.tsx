import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { AdminTabs } from "../../components/layout/SectionTabs";
import {
  QueryError,
  QueryState,
  DualPanelSkeleton,
} from "../../components/query";
import { Button, Card, Pill, Select } from "../../components/ui";
import { integrationsApi, type ConnectionRecord } from "../../lib/api";
import { asyncMessage } from "../../lib/asyncError";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useAppState } from "../../context/useAppState";
import { dateRange } from "../../lib/format";

type SyncResult = {
  id: string;
  location: string;
  status: "Waiting" | "Syncing" | "Success" | "Partial" | "Error";
  range?: string;
  details: Array<{ label: string; message: string; failed?: boolean }>;
};
function syncResult(
  id: string,
  location: string,
  data: {
    range: { from: string; to: string };
    errors: Record<string, string>;
    sources: Record<
      string,
      { status: string; daysImported?: number; reviewsImported?: number }
    >;
  },
): SyncResult {
  const sources = Object.entries(data.sources);
  const imported = sources.filter(
    ([, result]) => result.status === "IMPORTED",
  ).length;
  const failures = Object.keys(data.errors).length;
  return {
    id,
    location,
    range: dateRange(data.range.from, data.range.to),
    status:
      sources.length > 0 && imported === sources.length && !failures
        ? "Success"
        : failures && !imported
          ? "Error"
          : "Partial",
    details: sources.map(([source, result]) => ({
      label: source === "reviews" ? "Reviews" : source.toUpperCase(),
      failed: !!data.errors[source] || result.status === "ERROR",
      message:
        data.errors[source] ||
        (result.status === "IMPORTED"
          ? source === "reviews"
            ? `${result.reviewsImported ?? 0} reviews processed`
            : `${result.daysImported ?? 0} days imported`
          : result.status === "UNMAPPED"
            ? "Not mapped"
            : result.status === "NO_DATA"
              ? "No data returned"
              : result.status === "PARTIAL"
                ? "Partially synced; more data remains"
                : result.status === "ERROR"
                  ? "Sync failed"
                  : result.status),
    })),
  };
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function AdministrationIntegration() {
  const { locations, selectedLocationId } = useAppState();
  const [searchParams] = useSearchParams();
  const {
    data: rows,
    error,
    isLoading,
    isRefreshing,
    reload,
  } = useAsyncResource(
    () => integrationsApi.list().then((r) => r.data.connections),
    [],
    { fallbackError: "Unable to load connections" },
  );
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [googleSyncBusy, setGoogleSyncBusy] = useState(false);
  const [allSyncBusy, setAllSyncBusy] = useState(false);
  const [googleHistoryLoc, setGoogleHistoryLoc] = useState("");
  const [googleHistoryFrom, setGoogleHistoryFrom] = useState("");
  const [googleHistoryTo, setGoogleHistoryTo] = useState("");
  const [googleHistoryBusy, setGoogleHistoryBusy] = useState(false);
  const [toastLoc, setToastLoc] = useState("");
  const [backfillLoc, setBackfillLoc] = useState("");
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillTo, setBackfillTo] = useState("");
  const [backfillBusy, setBackfillBusy] = useState(false);

  const oauthError = searchParams.get("error");
  const displayError = actionError || oauthError;

  const by = useMemo(
    () =>
      Object.fromEntries((rows || []).map((x) => [x.provider, x])) as Record<
        string,
        ConnectionRecord
      >,
    [rows],
  );

  const connect = async (provider: "square" | "google") => {
    try {
      setActionError("");
      const r = await integrationsApi.connect(provider);
      window.location.assign(r.data.url);
    } catch (e) {
      setActionError(asyncMessage(e, "Unable to start OAuth"));
    }
  };
  const discover = async (provider: "square" | "google") => {
    try {
      setActionError("");
      await integrationsApi.discover(provider);
      reload();
    } catch (e) {
      setActionError(asyncMessage(e, "Discovery failed"));
    }
  };
  const saveGoogle = async (
    locationId: string,
    patch: Record<string, string>,
  ) => {
    try {
      const current = (by.google?.mappings || {}) as Record<string, unknown>;
      const locs = {
        ...((current.locations || {}) as Record<
          string,
          Record<string, string>
        >),
      };
      const next = { ...(locs[locationId] || {}), ...patch };
      for (const [key, value] of Object.entries(next)) {
        if (!value) delete next[key];
      }
      if (Object.keys(next).length) locs[locationId] = next;
      else delete locs[locationId];
      await integrationsApi.setMappings("google", {
        ...current,
        locations: locs,
      });
      reload();
    } catch (e) {
      setActionError(asyncMessage(e, "Google mapping failed"));
    }
  };
  const saveSquare = async (locationId: string, squareLocationId: string) => {
    try {
      const current = (by.square?.mappings || {}) as Record<string, unknown>;
      const locs = {
        ...((current.locations || {}) as Record<string, unknown>),
      };
      if (squareLocationId) locs[locationId] = { squareLocationId };
      else delete locs[locationId];
      await integrationsApi.setMappings("square", {
        ...current,
        locations: locs,
      });
      reload();
    } catch (e) {
      setActionError(asyncMessage(e, "Square mapping failed"));
    }
  };
  const runBackfill = async () => {
    if (!backfillLoc || !backfillFrom || !backfillTo) return;
    setBackfillBusy(true);
    setActionError("");
    setNotice("Running bounded Square historical backfill…");
    try {
      const r = await integrationsApi.squareBackfill(
        backfillLoc,
        backfillFrom,
        backfillTo,
      );
      setNotice(
        `Square backfill finished: ${r.data.complete} complete, ${r.data.partial} partial, ${r.data.failed} failed across ${r.data.days} day(s). Re-running the same range safely resumes incomplete days.`,
      );
      reload();
    } catch (e) {
      setActionError(asyncMessage(e, "Square backfill failed"));
    } finally {
      setBackfillBusy(false);
    }
  };
  const toast = async (fileList: FileList | File[] | null) => {
    const selected = fileList ? Array.from(fileList as FileList) : [];
    if (!selected.length || !toastLoc) return;
    setNotice(`Importing ${selected.length} Toast export file(s)…`);
    setActionError("");
    try {
      const files = [];
      for (const file of selected) {
        files.push({
          fileName: file.name,
          base64: await toBase64(file),
        });
      }
      const r = await integrationsApi.toastImport({
        locationId: toastLoc,
        files,
        mapping: {},
      });
      const formats = Array.isArray(r.data.formats)
        ? (r.data.formats as Array<Record<string, unknown>>)
            .map((f) => String(f.kind || ""))
            .filter(Boolean)
            .join(", ")
        : "";
      const warnCount = Array.isArray(r.data.warnings)
        ? (r.data.warnings as unknown[]).length
        : 0;
      setNotice(
        `Toast history imported: ${String(r.data.imported || 0)} order/day row(s) across ${String(r.data.dates || 0)} day(s)` +
          (r.data.dateFrom && r.data.dateTo
            ? ` (${String(r.data.dateFrom)} → ${String(r.data.dateTo)})`
            : "") +
          (r.data.skippedSquare
            ? `; skipped ${String(r.data.skippedSquare)} Square-owned day row(s)`
            : "") +
          (formats ? `; formats: ${formats}` : "") +
          (warnCount ? `; ${warnCount} note(s)` : "") +
          ". Original archive retained privately.",
      );
      reload();
    } catch (e) {
      setActionError(asyncMessage(e, "Toast import failed"));
    }
  };

  const square = by.square;
  const google = by.google;
  const sqMeta = (square?.metadata || {}) as Record<string, unknown>;
  const gMeta = (google?.metadata || {}) as Record<string, unknown>;
  const sqLocations = Array.isArray(sqMeta.providerLocations)
    ? (sqMeta.providerLocations as Array<Record<string, unknown>>)
    : [];
  const ga4Properties = Array.isArray(gMeta.ga4Properties)
    ? (gMeta.ga4Properties as Array<Record<string, unknown>>)
    : [];
  const gscSites = Array.isArray(gMeta.gscSites)
    ? (gMeta.gscSites as Array<Record<string, unknown>>)
    : [];
  const gbpLocations = Array.isArray(gMeta.gbpLocations)
    ? (gMeta.gbpLocations as Array<Record<string, unknown>>)
    : [];
  const syncAllNow = async () => {
    if (allSyncBusy || googleSyncBusy || googleHistoryBusy) return;
    const targets = locations.filter(
      (l) =>
        l.status === "active" &&
        (selectedLocationId === "all" || l.id === selectedLocationId),
    );
    if (!targets.length) {
      setActionError("No active locations in the selected scope.");
      return;
    }
    setAllSyncBusy(true);
    setActionError("");
    setNotice(
      `Refreshing Square, Google, reviews and alerts for ${targets.length} location${targets.length === 1 ? "" : "s"}…`,
    );
    try {
      const settled = await Promise.all(
        targets.map(async (loc) => {
          try {
            const { data } = await integrationsApi.syncNow(loc.id);
            return {
              name: loc.name,
              status: data.status,
              errors: Object.values(data.errors || {}),
            };
          } catch (e) {
            return {
              name: loc.name,
              status: "FAILED",
              errors: [asyncMessage(e, "Manual sync failed")],
            };
          }
        }),
      );
      const complete = settled.filter(
        (row) => row.status === "COMPLETE",
      ).length;
      const partial = settled.filter((row) => row.status === "PARTIAL").length;
      const failed = settled.filter((row) => row.status === "FAILED").length;
      const unavailable = settled.filter(
        (row) => row.status === "UNAVAILABLE",
      ).length;
      const details = settled
        .filter((row) => row.errors.length)
        .map((row) => `${row.name}: ${row.errors.join("; ")}`)
        .join("\n");
      setNotice(
        `Manual refresh finished: ${complete} complete, ${partial} partial, ${failed} failed, ${unavailable} unavailable.${details ? `\n${details}` : ""}`,
      );
      reload();
    } finally {
      setAllSyncBusy(false);
    }
  };

  const googleSyncNow = async () => {
    if (googleSyncBusy || googleHistoryBusy) return;
    const targets = locations.filter(
      (l) =>
        l.status === "active" &&
        (selectedLocationId === "all" || l.id === selectedLocationId),
    );
    if (!targets.length) {
      setActionError("No active locations in the selected scope.");
      return;
    }
    setGoogleSyncBusy(true);
    setActionError("");
    setNotice("");
    setSyncResults(
      targets.map((loc) => ({
        id: loc.id,
        location: loc.name,
        status: "Waiting",
        details: [],
      })),
    );
    const updateResult = (result: SyncResult) =>
      setSyncResults((current) =>
        current.map((row) => (row.id === result.id ? result : row)),
      );
    try {
      for (const loc of targets) {
        updateResult({
          id: loc.id,
          location: loc.name,
          status: "Syncing",
          details: [],
        });
        try {
          const { data } = await integrationsApi.googleSync(loc.id);
          updateResult(syncResult(loc.id, loc.name, data));
        } catch (e) {
          updateResult({
            id: loc.id,
            location: loc.name,
            status: "Error",
            details: [
              {
                label: "Google",
                message: asyncMessage(e, "Google sync failed"),
                failed: true,
              },
            ],
          });
        }
      }
      reload();
    } finally {
      setGoogleSyncBusy(false);
    }
  };

  const runGoogleHistory = async () => {
    if (
      googleHistoryBusy ||
      googleSyncBusy ||
      !googleHistoryLoc ||
      !googleHistoryFrom ||
      !googleHistoryTo
    )
      return;
    setGoogleHistoryBusy(true);
    setActionError("");
    setNotice("");
    const location =
      locations.find((loc) => loc.id === googleHistoryLoc)?.name ||
      "Selected location";
    setSyncResults([
      { id: googleHistoryLoc, location, status: "Syncing", details: [] },
    ]);
    try {
      const { data } = await integrationsApi.googleBackfill(
        googleHistoryLoc,
        googleHistoryFrom,
        googleHistoryTo,
      );
      setSyncResults([syncResult(googleHistoryLoc, location, data)]);
      reload();
    } catch (e) {
      setSyncResults([
        {
          id: googleHistoryLoc,
          location,
          status: "Error",
          details: [
            {
              label: "Google",
              message: asyncMessage(e, "Google historical refresh failed"),
              failed: true,
            },
          ],
        },
      ]);
    } finally {
      setGoogleHistoryBusy(false);
    }
  };

  return (
    <AppShell
      title="Integrations"
      subtitle="Square live POS, Google (GA4 / Search Console / Business Profile), Toast historical-only import, and location mappings"
      activeNav="admin"
    >
      <AdminTabs value="integrations" />
      {displayError && <QueryError message={displayError} className="mt-5" />}
      {notice && !displayError && (
        <Card accentBorder="accent" className="mt-4">
          <p className="whitespace-pre-line text-sm text-card-text-muted">
            {notice}
          </p>
        </Card>
      )}
      {syncResults.length > 0 && (
        <section
          className="mt-5 overflow-hidden rounded-xl border border-card-border bg-card"
          aria-label="Google sync results"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border p-4">
            <div>
              <h2 className="font-semibold text-card-text">
                Google sync results
              </h2>
              <p role="status" className="mt-1 text-xs text-card-text-muted">
                {syncResults.filter((row) => row.status === "Success").length}{" "}
                successful ?{" "}
                {syncResults.filter((row) => row.status === "Partial").length}{" "}
                partial ?{" "}
                {syncResults.filter((row) => row.status === "Error").length}{" "}
                failed
                {syncResults.some((row) =>
                  ["Waiting", "Syncing"].includes(row.status),
                ) && " ? In progress"}
              </p>
            </div>
            {!googleSyncBusy && !googleHistoryBusy && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSyncResults([])}
              >
                Dismiss
              </Button>
            )}
          </div>
          <div className="divide-y divide-card-border">
            {syncResults.map((result) => (
              <div key={result.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-card-text">
                    {result.location}
                  </h3>
                  <Pill
                    size="sm"
                    variant="outline"
                    tone={
                      result.status === "Success"
                        ? "success"
                        : result.status === "Error"
                          ? "danger"
                          : result.status === "Partial"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {result.status}
                  </Pill>
                </div>
                {result.range && (
                  <p className="mt-1 text-xs text-card-text-muted">
                    {result.range}
                  </p>
                )}
                <dl className="mt-3 space-y-2">
                  {result.details.map((detail) => (
                    <div
                      key={detail.label}
                      className="grid gap-1 text-sm sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3"
                    >
                      <dt className="font-medium text-card-text-muted">
                        {detail.label}
                      </dt>
                      <dd
                        className={
                          detail.failed
                            ? "min-w-0 break-words text-danger-subtle-text"
                            : "min-w-0 break-words text-card-text-muted"
                        }
                      >
                        {detail.message}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
      <QueryState
        data={rows}
        error={error}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRetry={reload}
        loader={<DualPanelSkeleton />}
      >
        {() => (
          <div className="space-y-5">
            <Card
              title="Square · live V1 POS"
              action={
                <Pill
                  tone={
                    square?.status === "READY"
                      ? "success"
                      : square?.status === "PARTIAL"
                        ? "warning"
                        : square?.status === "ERROR"
                          ? "danger"
                          : "neutral"
                  }
                  variant="outline"
                >
                  {square?.status || "UNAVAILABLE"}
                </Pill>
              }
            >
              <p className="text-sm text-card-text-muted">
                Connect Square to import live orders and sales, then link each
                restaurant to its Square location.
              </p>
              {square?.lastError && (
                <p className="mt-2 text-xs text-danger-subtle-text">
                  {square.lastError}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                {!square ? (
                  <Button size="sm" onClick={() => void connect("square")}>
                    Connect with OAuth
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void discover("square")}
                    >
                      Refresh resources
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void connect("square")}
                    >
                      Reconnect
                    </Button>
                  </>
                )}
              </div>
            </Card>

            <Card
              title="Google · GA4 / Search Console / Business Profile"
              action={
                <Pill
                  tone={
                    google?.status === "READY"
                      ? "success"
                      : google?.status === "PARTIAL"
                        ? "warning"
                        : google?.status === "ERROR"
                          ? "danger"
                          : "neutral"
                  }
                  variant="outline"
                >
                  {google?.status || "UNAVAILABLE"}
                </Pill>
              }
            >
              <p className="text-sm text-card-text-muted">
                Automatic schedule: one Vercel-only daily run at 5:00 AM Pacific
                refreshes Square plus rolling 7-day GA4, Search Console, GBP
                performance and reviews, then evaluates alerts and publishes the
                Morning Brief. Google Sync now refreshes the latest 3 completed
                days plus reviews and is limited to once every 15 minutes per
                location.
              </p>
              {google?.lastError && (
                <p className="mt-2 text-xs text-danger-subtle-text">
                  {google.lastError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!google ? (
                  <Button size="sm" onClick={() => void connect("google")}>
                    Connect with OAuth
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void discover("google")}
                    >
                      Refresh resources
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void connect("google")}
                    >
                      Reconnect
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={googleSyncBusy || googleHistoryBusy}
                      onClick={() => void googleSyncNow()}
                    >
                      {googleSyncBusy ? "Syncing..." : "Sync now"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
            <Card title="Canonical location mappings">
              <div className="space-y-5">
                {locations
                  .filter((l) => l.status === "active")
                  .map((l) => {
                    const sm = ((
                      (by.square?.mappings || {}) as Record<string, unknown>
                    ).locations || {}) as Record<
                      string,
                      Record<string, string>
                    >;
                    const gm = ((
                      (by.google?.mappings || {}) as Record<string, unknown>
                    ).locations || {}) as Record<
                      string,
                      Record<string, string>
                    >;
                    return (
                      <div
                        key={l.id}
                        className="rounded-lg border border-card-border p-4"
                      >
                        <h3 className="font-semibold text-card-text">
                          {l.name}
                        </h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs text-card-text-muted">
                              Square restaurant
                            </p>
                            <Select
                              value={sm[l.id]?.squareLocationId || ""}
                              onChange={(v) => void saveSquare(l.id, v)}
                              placeholder="Map Square location"
                              options={[
                                { value: "", label: "Keep unmapped" },
                                ...sqLocations.map((x) => ({
                                  value: String(x.id),
                                  label: String(x.name || x.id),
                                })),
                              ]}
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs text-card-text-muted">
                              GA4 property
                            </p>
                            <Select
                              value={gm[l.id]?.ga4PropertyId || ""}
                              onChange={(v) =>
                                void saveGoogle(l.id, { ga4PropertyId: v })
                              }
                              placeholder="Map GA4 property"
                              options={[
                                { value: "", label: "Keep unmapped" },
                                ...ga4Properties.map((x) => ({
                                  value: String(x.id),
                                  label: String(x.displayName || x.id),
                                })),
                              ]}
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs text-card-text-muted">
                              Search Console site
                            </p>
                            <Select
                              value={gm[l.id]?.gscSiteUrl || ""}
                              onChange={(v) =>
                                void saveGoogle(l.id, { gscSiteUrl: v })
                              }
                              placeholder="Map Search Console site"
                              options={[
                                { value: "", label: "Keep unmapped" },
                                ...gscSites.map((x) => ({
                                  value: String(x.siteUrl),
                                  label: String(x.siteUrl),
                                })),
                              ]}
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs text-card-text-muted">
                              Google Business Profile
                            </p>
                            <Select
                              value={gm[l.id]?.gbpLocationName || ""}
                              onChange={(v) => {
                                const loc = gbpLocations.find(
                                  (x) => String(x.name) === v,
                                );
                                void saveGoogle(l.id, {
                                  gbpLocationName: v,
                                  gbpAccountName: v
                                    ? String(loc?.accountName || "")
                                    : "",
                                });
                              }}
                              placeholder="Map GBP listing"
                              options={[
                                { value: "", label: "Keep unmapped" },
                                ...gbpLocations.map((x) => ({
                                  value: String(x.name),
                                  label: String(x.title || x.name),
                                })),
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
            <Card title="Manual data refresh · no cron required">
              <p className="text-sm text-card-text-muted">
                Refresh Square, Google analytics, Search Console, Business
                Profile performance, reviews and alerts for the currently
                selected location scope. Each source is isolated, so a provider
                failure is reported without discarding successful data.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={allSyncBusy || googleSyncBusy || googleHistoryBusy}
                  onClick={() => void syncAllNow()}
                >
                  {allSyncBusy ? "Syncing all data…" : "Sync selected data now"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-card-text-faint">
                Use this whenever you need fresher data between daily 5 AM runs.
                Manual provider locks/cooldowns prevent accidental overlap or
                API hammering.
              </p>
            </Card>

            <Card title="Google historical refresh · manual only">
              <p className="text-sm text-card-text-muted">
                Use this only when an admin intentionally needs to repair or
                backfill GA4, Search Console or GBP performance history. It
                never runs automatically and does not re-download reviews.
                Maximum 90 days per request.
              </p>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[16rem_1fr_1fr_auto]">
                <div>
                  <p className="mb-1 text-xs text-card-text-muted">Location</p>
                  <Select
                    value={googleHistoryLoc}
                    onChange={setGoogleHistoryLoc}
                    placeholder="Select location"
                    options={locations
                      .filter((l) => l.status === "active")
                      .map((l) => ({ value: l.id, label: l.name }))}
                  />
                </div>
                <label className="text-xs text-card-text-muted">
                  From
                  <input
                    type="date"
                    value={googleHistoryFrom}
                    onChange={(e) => setGoogleHistoryFrom(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text"
                  />
                </label>
                <label className="text-xs text-card-text-muted">
                  To
                  <input
                    type="date"
                    value={googleHistoryTo}
                    onChange={(e) => setGoogleHistoryTo(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    disabled={
                      googleHistoryBusy ||
                      googleSyncBusy ||
                      !googleHistoryLoc ||
                      !googleHistoryFrom ||
                      !googleHistoryTo
                    }
                    onClick={() => void runGoogleHistory()}
                  >
                    {googleHistoryBusy ? "Refreshing…" : "Refresh history"}
                  </Button>
                </div>
              </div>
            </Card>
            <Card title="Square historical backfill · bounded and resumable">
              <p className="text-sm text-card-text-muted">
                Import a client-approved historical window one business day at a
                time through the same canonical/reconciliation path as live
                sync. Complete dates are skipped on rerun; Partial/Failed dates
                can safely resume without duplicate provider orders.
              </p>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[16rem_1fr_1fr_auto]">
                <div>
                  <p className="mb-1 text-xs text-card-text-muted">Location</p>
                  <Select
                    value={backfillLoc}
                    onChange={setBackfillLoc}
                    placeholder="Select location"
                    options={locations
                      .filter((l) => l.status === "active")
                      .map((l) => ({ value: l.id, label: l.name }))}
                  />
                </div>
                <label className="text-xs text-card-text-muted">
                  From
                  <input
                    type="date"
                    value={backfillFrom}
                    onChange={(e) => setBackfillFrom(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text"
                  />
                </label>
                <label className="text-xs text-card-text-muted">
                  To
                  <input
                    type="date"
                    value={backfillTo}
                    onChange={(e) => setBackfillTo(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    disabled={
                      backfillBusy ||
                      !backfillLoc ||
                      !backfillFrom ||
                      !backfillTo
                    }
                    onClick={() => void runBackfill()}
                  >
                    {backfillBusy ? "Backfilling…" : "Run backfill"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-card-text-faint">
                Maximum 370 business dates per request. Live acceptance still
                requires reconciliation against the client-owned Square account.
              </p>
            </Card>

            <Card title="Toast historical export · one-time only">
              <p className="text-sm text-card-text-muted">
                Toast is not a live V1 connector. Upload the client&apos;s Toast
                exports once; originals are retained in private storage and mapped
                into canonical history. Square remains authoritative on overlapping
                business dates.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-64">
                  <p className="mb-1 text-xs text-card-text-muted">
                    Canonical location
                  </p>
                  <Select
                    value={toastLoc}
                    onChange={setToastLoc}
                    options={locations
                      .filter((l) => l.status === "active")
                      .map((l) => ({ value: l.id, label: l.name }))}
                  />
                </div>
                <a
                  href="/toast-historical-import-sample.csv"
                  download="toast-historical-import-sample.csv"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-border px-4 text-sm font-semibold text-neutral-subtle-text hover:bg-card-hover"
                >
                  Download sample CSV
                </a>
                <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-text">
                  Upload Toast export(s)
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.zip,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void toast(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-1 text-xs text-card-text-faint">
                <p>
                  Accepted Toast standards (auto-detected):{" "}
                  <span className="text-card-text-muted">
                    Sales Summary .xlsx / Sales by day.csv (and zip of CSVs);
                    OrderDetails.csv; ItemSelectionDetails.csv; PaymentDetails.csv;
                    or the app sample order CSV.
                  </span>
                </p>
                <p>
                  Best completeness: upload{" "}
                  <span className="text-card-text-muted">
                    OrderDetails + ItemSelectionDetails
                  </span>{" "}
                  together. Sales Summary alone imports daily net sales, orders, and
                  guests (item/channel charts stay empty for those days).
                </p>
              </div>
            </Card>
          </div>
        )}
      </QueryState>
    </AppShell>
  );
}
