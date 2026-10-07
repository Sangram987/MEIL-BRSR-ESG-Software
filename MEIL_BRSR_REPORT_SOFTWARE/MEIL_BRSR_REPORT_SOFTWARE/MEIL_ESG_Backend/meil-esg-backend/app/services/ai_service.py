"""
AIProvider abstraction so swapping Gemini <-> OpenAI <-> "no key configured yet" is a config
change (AI_PROVIDER env var), not a rewrite. Every provider implements the same three methods;
callers (routes/ai.py, tasks/ai.py) never import google-generativeai or openai directly.

Critically: nothing in this module is allowed to set a submission's status, an assessment
opinion, or a risk's `include_in_brsr` flag. It only ever writes to `ai_insights`-style output or
returns text — a human still has to act on it, exactly as the frontend's design already assumed
("Human review remains necessary").
"""
import json
from flask import current_app


class AIProvider:
    def chat(self, message, context):
        raise NotImplementedError

    def explain_anomaly(self, context):
        raise NotImplementedError

    def forecast_narrative(self, series, forecast):
        raise NotImplementedError


class RuleBasedProvider(AIProvider):
    """No external API key required — same knowledge-base approach as the frontend's BRSR
    Copilot, so behaviour is identical before an LLM key is ever configured."""
    KB = [
        (("core", "assurance"), "BRSR Core is the subset of 9 ESG attributes SEBI requires an assessment or assurance opinion on. Site data only becomes assurable once the BU Manager has approved it."),
        (("scope 1", "scope 2", "emission"), "Scope 1 covers diesel/petrol burned on site; Scope 2 is purchased grid electricity. Figures are computed from raw activity data (litres, kWh) and a configurable emission-factor table — never enter a pre-computed tCO2e value."),
        (("boundary", "standalone", "consolidated"), "BRSR requires the reporting boundary (Standalone or Consolidated, with/without JVs) to be stated and applied consistently. Switch it from the hierarchy filter; entities outside the boundary are excluded from every total."),
        (("workflow", "approve", "correction"), "Flow: Site Operator submits with evidence -> BU Manager reviews (Approve / Request correction / Reject) -> approved data rolls up Project -> BU -> Subsidiary -> Group automatically. Assessment/assurance is a separate step after approval."),
        (("vendor", "scope 3", "value chain"), "Vendors receive a request, submit ESG data with evidence, and a reviewer accepts it. Accepted data is allocated to MEIL by revenue share as an internal Scope 3 estimate — the methodology is configurable, not fixed."),
    ]

    def chat(self, message, context=None):
        m = (message or "").lower()
        for keywords, answer in self.KB:
            if any(k in m for k in keywords):
                return answer
        return ("I can explain BRSR Core, Scope 1/2/3, reporting boundary, the approval workflow, "
                "vendors/value-chain, and assessment vs. assurance. Try asking about one of those.")

    def explain_anomaly(self, context):
        metric = context.get("metric", "this metric")
        delta = context.get("deltaPct")
        return f"{metric} moved {delta:+.0f}% versus its recent average. Common causes: a genuine operational change (more machinery hours, new sub-contractor mobilised), a data-entry error, or a missing/duplicated evidence upload. Compare against the attached bill or log before approving."

    def forecast_narrative(self, series, forecast):
        direction = "rising" if forecast and series and forecast[-1] > series[-1] else "flat or declining"
        return f"Based on the recent trend, the metric looks {direction} over the next period. This is a statistical trend projection, not a certainty — treat it as a planning input."


class GeminiProvider(AIProvider):
    def __init__(self, api_key):
        self.api_key = api_key

    def _call(self, prompt):
        # Thin wrapper kept separate from the rest of the class so it's the only place a real
        # HTTP call to Gemini is made — easy to mock in tests.
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        return model.generate_content(prompt).text

    def chat(self, message, context=None):
        prompt = f"You are the MEIL ESG BRSR assistant. Context: {json.dumps(context or {})}\nQuestion: {message}"
        return self._call(prompt)

    def explain_anomaly(self, context):
        return self._call(f"Explain this ESG data anomaly in 2-3 sentences for a non-technical reviewer: {json.dumps(context)}")

    def forecast_narrative(self, series, forecast):
        return self._call(f"In 2 sentences, describe this trend: history={series}, forecast={forecast}")


class OpenAIProvider(AIProvider):
    def __init__(self, api_key):
        self.api_key = api_key

    def _call(self, prompt):
        from openai import OpenAI
        client = OpenAI(api_key=self.api_key)
        resp = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}])
        return resp.choices[0].message.content

    def chat(self, message, context=None):
        prompt = f"You are the MEIL ESG BRSR assistant. Context: {json.dumps(context or {})}\nQuestion: {message}"
        return self._call(prompt)

    def explain_anomaly(self, context):
        return self._call(f"Explain this ESG data anomaly in 2-3 sentences for a non-technical reviewer: {json.dumps(context)}")

    def forecast_narrative(self, series, forecast):
        return self._call(f"In 2 sentences, describe this trend: history={series}, forecast={forecast}")


def get_provider() -> AIProvider:
    provider = current_app.config.get("AI_PROVIDER", "rule_based")
    if provider == "gemini" and current_app.config.get("GEMINI_API_KEY"):
        return GeminiProvider(current_app.config["GEMINI_API_KEY"])
    if provider == "openai" and current_app.config.get("OPENAI_API_KEY"):
        return OpenAIProvider(current_app.config["OPENAI_API_KEY"])
    return RuleBasedProvider()


# --- Statistical helpers (no LLM call needed — same "rules + stats before AI" approach the
# frontend used for its forecast chart) ---

def linear_forecast(series: list, ahead: int = 3) -> list:
    n = len(series)
    if n < 4:
        return []
    xs = list(range(n))
    mean_x = (n - 1) / 2
    mean_y = sum(series) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, series))
    den = sum((x - mean_x) ** 2 for x in xs) or 1
    slope = num / den
    return [max(0.0, mean_y + slope * (n + k - mean_x)) for k in range(ahead)]


def detect_spike(current, history_avg, up_threshold=40, down_threshold=-60):
    if not history_avg:
        return None
    delta_pct = ((current - history_avg) / history_avg) * 100
    if delta_pct > up_threshold:
        return {"kind": "spike", "deltaPct": delta_pct}
    if delta_pct < down_threshold:
        return {"kind": "drop", "deltaPct": delta_pct}
    return None
