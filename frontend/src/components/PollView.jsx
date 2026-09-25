import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPoll, getPollStreamUrl, voteOnPoll } from "../services/api.js";

const POLL_INTERVAL_MS = 3000;

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" className="fill-violet-600" />
      <path
        d="M6.2 10.3 8.7 12.8 13.8 7.4"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PollView() {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [userVotedId, setUserVotedId] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [barsReady, setBarsReady] = useState(false);

  const storageKey = `quick_poll_voted_${id}`;

  const loadPoll = useCallback(async () => {
    const data = await getPoll(id);
    setPoll(data);
    return data;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError("");

    const savedVote = localStorage.getItem(storageKey);
    if (savedVote) {
      const parsedId = Number(savedVote);
      setSelectedId(parsedId);
      setUserVotedId(parsedId);
    }

    loadPoll()
      .then((data) => {
        if (!cancelled) {
          if (data.is_expired || savedVote) {
            setPhase("results");
          } else {
            setPhase("voting");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Poll not found");
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadPoll, storageKey]);

  useEffect(() => {
    if (!id || phase === "loading" || phase === "error") {
      return undefined;
    }

    let eventSource = null;
    try {
      const streamUrl = getPollStreamUrl(id);
      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (event) => {
        try {
          const updated = JSON.parse(event.data);
          setPoll(updated);
          if (updated.is_expired) {
            setPhase("results");
          }
        } catch {
          // ignore parse error
        }
      };
    } catch {
      // EventSource fallback
    }

    const timer = window.setInterval(() => {
      loadPoll().catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      window.clearInterval(timer);
    };
  }, [id, phase, loadPoll]);

  useEffect(() => {
    if (phase !== "results") {
      setBarsReady(false);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => setBarsReady(true));
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [phase]);

  const totals = useMemo(() => {
    const totalVotes = poll?.options?.reduce((sum, option) => sum + option.votes, 0) ?? 0;
    return { totalVotes };
  }, [poll]);

  async function handleVote() {
    if (!selectedId || submitting || userVotedId || poll?.is_expired) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      setPhase("transition");
      const updated = await voteOnPoll(id, selectedId);
      try {
        localStorage.setItem(storageKey, String(selectedId));
        setUserVotedId(selectedId);
      } catch {
        // LocalStorage fallback
      }
      window.setTimeout(() => {
        setPoll(updated);
        setPhase("results");
        setSubmitting(false);
      }, 420);
    } catch (err) {
      setPhase("voting");
      setError(err.message || "Vote failed");
      setSubmitting(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this poll link", url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "loading") {
    return (
      <section className="glass-card rounded-3xl p-8 text-center text-sm font-medium text-slate-500">
        Opening the room…
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="glass-card rounded-3xl p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">This poll drifted away</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <Link
          to="/"
          className="focus-ring mt-6 inline-flex rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-1 hover:shadow-lg"
        >
          Create a new poll
        </Link>
      </section>
    );
  }

  const showingResults = phase === "results";

  return (
    <section className="glass-card rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
            Live room · {id}
          </p>
          {poll.is_expired ? (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Expired
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="focus-ring rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-all hover:-translate-y-0.5"
        >
          {copied ? "Link Copied! ✅" : "Share"}
        </button>
      </div>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        {poll.question}
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        {showingResults
          ? `${totals.totalVotes} vote${totals.totalVotes === 1 ? "" : "s"} so far`
          : "Pick one option. Your vote is counted immediately."}
      </p>

      {poll.is_expired ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-800">
          ⏳ Voting for this poll has closed.
        </div>
      ) : userVotedId && showingResults ? (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs font-semibold text-violet-800">
          ✓ You have voted in this poll. Live tallies update automatically.
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {poll.options.map((option) => {
          const isSelected = selectedId === option.id;
          const isUserVote = userVotedId === option.id;
          const fading = phase === "transition" && !isSelected;
          const morphing = phase === "transition" && isSelected;
          const percent =
            totals.totalVotes === 0 ? 0 : Math.round((option.votes / totals.totalVotes) * 100);

          if (showingResults) {
            return (
              <li key={option.id}>
                <div
                  className={`relative overflow-hidden rounded-2xl border bg-white/55 px-4 py-4 ${
                    isUserVote ? "border-violet-500 ring-2 ring-violet-500/20" : "border-slate-200/70"
                  }`}
                >
                  <div
                    className="result-bar-fill absolute inset-y-0 left-0 bg-violet-500/15"
                    style={{ width: barsReady ? `${percent}%` : "0%" }}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isUserVote ? <CheckIcon /> : null}
                      <span className="text-sm font-semibold text-slate-800">{option.text}</span>
                      {isUserVote ? (
                        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          Your vote
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-violet-700">{percent}%</span>
                  </div>
                  <p className="relative mt-1 text-xs text-slate-500">
                    {option.votes} vote{option.votes === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            );
          }

          return (
            <li
              key={option.id}
              className={fading ? "pointer-events-none opacity-0 transition-opacity duration-500" : "transition-opacity duration-300"}
            >
              <button
                type="button"
                onClick={() => setSelectedId(option.id)}
                className={[
                  "focus-ring w-full rounded-2xl border bg-white/65 px-4 py-4 text-left transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-[0_12px_30px_-16px_rgb(124_58_237_/_0.7)]",
                  isSelected
                    ? "scale-[1.01] border-2 border-violet-600 shadow-[0_0_0_4px_rgb(139_92_246_/_0.18)]"
                    : "border-slate-200/80",
                  morphing ? "border-2 border-violet-600" : "",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">{option.text}</span>
                  {isSelected ? <CheckIcon /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && phase === "voting" ? (
        <p className="mt-4 rounded-xl bg-rose-50/80 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {!showingResults ? (
        <button
          type="button"
          onClick={handleVote}
          disabled={!selectedId || submitting || phase === "transition" || poll?.is_expired}
          className="focus-ring mt-6 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {phase === "transition" ? "Locking in your vote…" : "Submit vote"}
        </button>
      ) : (
        <Link
          to="/"
          className="focus-ring mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-1 hover:shadow-lg"
        >
          Create another poll
        </Link>
      )}
    </section>
  );
}

