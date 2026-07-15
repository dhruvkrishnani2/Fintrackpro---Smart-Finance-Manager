"""
LLM-backed finance assistant, powered by Gemini. Uses Gemini's function-calling
to understand free-text questions, but every number in its answer comes from
`finance_data.py` querying the user's real transactions/budgets/goals — the
model can only relay what a tool call actually returned, never invent figures.

Falls back to the offline rule-based chatbot (see chatbot.py) if no
GEMINI_API_KEY is configured, or if the API call fails for any reason,
so the feature degrades gracefully rather than breaking the assistant.
"""
import logging
from typing import List

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app import models, finance_data as fd
from app.config import settings

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_MESSAGES = 10

SYSTEM_PROMPT = (
    "You are the finance assistant built into FinTrack Pro, a personal finance app. "
    "Answer the user's question about their own finances by calling the provided tools "
    "to fetch real data — never invent or estimate a number yourself. "
    "If a tool returns no data or an error, say so plainly instead of guessing. "
    "Keep replies short and conversational (2-4 sentences), use ₹ for currency, "
    "round amounts to whole numbers, and don't use markdown formatting like asterisks "
    "or bullet points — plain sentences only. You can call more than one tool if the "
    "question needs it (e.g. comparing two periods or categories)."
)

TOOLS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="get_balance",
        description="Get the user's all-time total balance (total income minus total expenses).",
        parameters={"type": "object", "properties": {}},
    ),
    types.FunctionDeclaration(
        name="get_period_summary",
        description="Get income, expenses, savings, savings rate, and top expense categories for a period.",
        parameters={
            "type": "object",
            "properties": {
                "period": {"type": "string", "enum": ["this_month", "last_month"], "description": "Defaults to this_month"},
            },
        },
    ),
    types.FunctionDeclaration(
        name="get_category_spend",
        description="Get how much the user spent in one specific category during a period.",
        parameters={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Category name, e.g. Food, Travel, Rent, Shopping"},
                "period": {"type": "string", "enum": ["this_month", "last_month"]},
            },
            "required": ["category", "period"],
        },
    ),
    types.FunctionDeclaration(
        name="get_budget_status",
        description="Get this month's budget limits vs. actual spend per category, and which are over budget.",
        parameters={"type": "object", "properties": {}},
    ),
    types.FunctionDeclaration(
        name="get_goals",
        description="Get the user's active savings goals with target/current amounts and progress.",
        parameters={"type": "object", "properties": {}},
    ),
    types.FunctionDeclaration(
        name="get_forecast",
        description="Get a linear-regression forecast of next month's net cash flow based on transaction history.",
        parameters={"type": "object", "properties": {}},
    ),
    types.FunctionDeclaration(
        name="get_recent_transactions",
        description="Get the user's most recent transactions.",
        parameters={
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "Number of transactions to return, default 5, max 20"}},
        },
    ),
    types.FunctionDeclaration(
        name="list_categories",
        description="List the user's available transaction category names. Useful if unsure what a category is called.",
        parameters={"type": "object", "properties": {}},
    ),
])


def _dispatch_tool(db: Session, user_id: str, name: str, tool_input: dict) -> dict:
    try:
        if name == "get_balance":
            return fd.get_balance(db, user_id)
        if name == "get_period_summary":
            return fd.get_period_summary(db, user_id, tool_input.get("period", "this_month"))
        if name == "get_category_spend":
            return fd.get_category_spend(db, user_id, tool_input.get("category", ""), tool_input.get("period", "this_month"))
        if name == "get_budget_status":
            return fd.get_budget_status(db, user_id)
        if name == "get_goals":
            return fd.get_goals(db, user_id)
        if name == "get_forecast":
            return fd.get_forecast(db, user_id)
        if name == "get_recent_transactions":
            return fd.get_recent_transactions(db, user_id, tool_input.get("limit", 5))
        if name == "list_categories":
            return fd.list_categories(db, user_id)
        return {"error": f"Unknown tool '{name}'"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Chatbot tool %s failed", name)
        return {"error": f"Couldn't fetch that: {exc}"}


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def _build_history(history: List[models.ChatMessage]) -> List[types.Content]:
    """Gemini requires role names 'user' and 'model' (not 'assistant'), and,
    like Anthropic, expects the conversation to alternate cleanly. We
    defensively re-derive a clean alternating sequence rather than trust the
    stored rows blindly."""
    recent = history[-MAX_HISTORY_MESSAGES:]
    cleaned: List[types.Content] = []
    expected = "user"
    for msg in recent:
        role = msg.role.value if hasattr(msg.role, "value") else msg.role
        if role != expected:
            continue
        gemini_role = "model" if role == "assistant" else "user"
        cleaned.append(types.Content(role=gemini_role, parts=[types.Part(text=msg.content)]))
        expected = "assistant" if expected == "user" else "user"
    if cleaned and cleaned[-1].role != "model":
        cleaned.pop()
    return cleaned


def answer(db: Session, user: models.User, message: str, history: List[models.ChatMessage]) -> str:
    client = genai.Client(api_key=settings.gemini_api_key)
    contents = _build_history(history) + [types.Content(role="user", parts=[types.Part(text=message)])]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[TOOLS],
    )

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config=config,
        )

        candidate = response.candidates[0]
        parts = candidate.content.parts or []
        function_calls = [p for p in parts if p.function_call]

        if not function_calls:
            text = "".join(p.text for p in parts if p.text).strip()
            return text or "I couldn't come up with an answer to that — could you try rephrasing?"

        contents.append(candidate.content)

        response_parts = []
        for part in function_calls:
            result = _dispatch_tool(db, user.id, part.function_call.name, dict(part.function_call.args or {}))
            response_parts.append(
                types.Part.from_function_response(name=part.function_call.name, response={"result": result})
            )
        contents.append(types.Content(role="user", parts=response_parts))

    return "That question needed more digging than I could manage — try asking something more specific."