import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPoll } from "../services/api.js";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

function emptyOptions(count = MIN_OPTIONS) {
  return Array.from({ length: count }, () => "");
}

export default function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(emptyOptions);
  const [leavingIndex, setLeavingIndex] = useState(null);
  const [expiresInMinutes, setExpiresInMinutes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const optionRefs = useRef([]);

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options.length]);

  function focusOption(index) {
    requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }

  function addOption(autoFocus = true) {
    if (options.length >= MAX_OPTIONS) {
      return;
    }
    setOptions((prev) => [...prev, ""]);
    if (autoFocus) {
      focusOption(options.length);
    }
  }

  function removeOption(index) {
    if (options.length <= MIN_OPTIONS) {
      return;
    }
    setLeavingIndex(index);
    window.setTimeout(() => {
      setOptions((prev) => prev.filter((_, i) => i !== index));
      setLeavingIndex(null);
    }, 170);
  }

  function updateOption(index, value) {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function handleOptionKeyDown(event, index) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (options.length < MAX_OPTIONS && index === options.length - 1) {
      addOption(true);
      return;
    }
    if (index < options.length - 1) {
      focusOption(index + 1);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const cleanedQuestion = question.trim();
    const cleanedOptions = options.map((item) => item.trim());

    if (!cleanedQuestion) {
      setError("Add a question before creating the poll.");
      return;
    }
    if (cleanedOptions.some((item) => !item)) {
      setError("Fill in every option, or remove unused rows.");
      return;
    }
    if (cleanedOptions.length < MIN_OPTIONS || cleanedOptions.length > MAX_OPTIONS) {
      setError("Polls need between 2 and 5 options.");
      return;
    }

    setSubmitting(true);
    try {
      const poll = await createPoll(
        cleanedQuestion,
        cleanedOptions,
        expiresInMinutes ? Number(expiresInMinutes) : null
      );
      navigate(`/poll/${poll.id}`);
    } catch (err) {
      setError(err.message || "Could not create poll.");
    } finally {
      setSubmitting(false);
    }
  }

  const filledCount = options.filter((item) => item.trim()).length;

  return (
    <section className="glass-card rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
        Instant room
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        Ask anything. Share the link. Watch votes land.
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        No accounts. Create a poll, copy the URL, and let the room decide.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Question</span>
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="Who should pick the playlist tonight?"
            className="focus-ring mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-base font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400"
          />
        </label>

        <div>
          <div className="mb-2">
            <span className="text-sm font-semibold text-slate-800">Options</span>
          </div>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div
                key={`option-${index}`}
                className={
                  leavingIndex === index ? "option-row-leave" : "option-row-enter"
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="text"
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    placeholder={`Option ${index + 1}`}
                    className="focus-ring w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                  />
                  {options.length > MIN_OPTIONS ? (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="focus-ring shrink-0 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition-colors hover:text-rose-600"
                      aria-label={`Remove option ${index + 1}`}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => addOption(true)}
              disabled={options.length >= MAX_OPTIONS}
              className="focus-ring rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:translate-y-0"
            >
              + Add option
            </button>
            <span className="text-xs font-medium tabular-nums text-slate-500">
              {options.length}/5 Options
              <span className="ml-2 text-slate-400">{filledCount} filled</span>
            </span>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Poll Expiration</span>
          <select
            value={expiresInMinutes}
            onChange={(e) => setExpiresInMinutes(e.target.value)}
            className="focus-ring mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"
          >
            <option value="">Never expire</option>
            <option value="60">1 Hour</option>
            <option value="1440">24 Hours</option>
            <option value="10080">7 Days</option>
          </select>
        </label>

        {error ? (
          <p className="rounded-xl bg-rose-50/80 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? "Creating…" : "Create Poll"}
        </button>
      </form>
    </section>
  );
}
