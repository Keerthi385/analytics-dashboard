from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import psycopg2
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Chat with Data API (schema-aware)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Request model ===
class ChatRequest(BaseModel):
    query: str

# === Groq LLM helper ===
class GroqLLM:
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Use a supported model — change if Groq updates the recommended model
        self.model = "llama-3.3-70b-versatile"

    def generate_sql(self, question: str, schema_text: str) -> str:
        """
        Prompt the LLM with an explicit schema (exact table names).
        Instruct it to use only these tables and to return ONLY a SELECT query (no markdown).
        """
        prompt = f"""
You are an expert PostgreSQL SQL generator.

IMPORTANT:
- The database uses *case-sensitive* table names (e.g., Customer, Invoice, Payment).
- Therefore, **always wrap every table name and column name in double quotes** ("TableName", "columnName").
- Only use the following tables/columns exactly as shown.
- Do NOT invent any new tables or columns.
- Always return a valid PostgreSQL SELECT query (no markdown, no explanations).

Available tables and columns:
{schema_text}

User question:
{question}

Rules:
- Only return a SELECT statement.
- Use double quotes for all identifiers.
- Do not use markdown, comments, or extra formatting.
- If the query cannot be answered, return exactly: UNABLE_TO_ANSWER
"""

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful SQL assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.0,
            "max_tokens": 800,
        }

        r = requests.post(url, headers=headers, json=body, timeout=30)
        if r.status_code != 200:
            raise Exception(f"Groq API Error: {r.status_code} {r.text}")
        data = r.json()
        # defensive access
        sql_raw = data["choices"][0]["message"]["content"]
        sql = sql_raw.strip()
        # strip markdown fences if any (robust)
        if sql.startswith("```"):
            # remove code fences and optional language tag
            sql = sql.split("```", 2)[-1].strip()
            if sql.lower().startswith("sql"):
                sql = sql.split("\n", 1)[1].strip()
        # final strip
        return sql.strip()


# === DB config (use .env values if provided) ===
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", 5432)),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "Teddy"),
    "database": os.getenv("POSTGRES_DB", "analytics_db"),
}

groq_key = os.getenv("GROQ_API_KEY")
if not groq_key:
    raise ValueError("Missing GROQ_API_KEY in environment")

llm = GroqLLM(api_key=groq_key)

# ===========================
# Utility: Inspect DB schema
# ===========================
def fetch_schema_dataframe():
    conn = psycopg2.connect(**DB_CONFIG)
    query = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def build_schema_text(df: pd.DataFrame) -> str:
    """
    Build a compact but exact listing of table names and columns
    that we will pass to the LLM. This uses the exact table_name strings
    returned by Postgres, so the LLM will see the real names.
    """
    if df.empty:
        return "No tables found in public schema."
    parts = []
    for table in df["table_name"].unique():
        cols = df[df["table_name"] == table]
        col_lines = ", ".join([f"{r['column_name']} {r['data_type']}" for _, r in cols.iterrows()])
        parts.append(f"Table {table} ({col_lines})")
    return "\n".join(parts)

# Helper: list available table names
def available_tables() -> list:
    df = fetch_schema_dataframe()
    return df["table_name"].unique().tolist()

# ===========================
# Helper route to inspect schema
# ===========================
@app.get("/inspect-schema")
def inspect_schema():
    """
    Returns the schema_text the server will pass to the LLM.
    Use this to confirm what table/column names the backend sees.
    """
    df = fetch_schema_dataframe()
    schema_text = build_schema_text(df)
    return {"tables": available_tables(), "schema_text": schema_text}

# ===========================
# Endpoint: chat-with-data
# ===========================
@app.post("/chat-with-data")
async def chat_with_data(body: ChatRequest):
    """
    Body: { "query": "..." }
    1) fetch schema from DB
    2) ask LLM to generate SQL using exact table names
    3) verify generated SQL references only existing tables
    4) execute (SELECT only) and return results
    """
    question = body.query.strip()
    if not question:
        return {"error": "query is required"}

    # 1) get schema
    df = fetch_schema_dataframe()
    schema_text = build_schema_text(df)
    tables = set(df["table_name"].unique().tolist())

    # 2) generate SQL
    try:
        sql = llm.generate_sql(question, schema_text)
    except Exception as e:
        return {"detail": f"LLM error: {str(e)}"}

    # 3) post-process SQL: remove fences and whitespace already done, ensure lowercase check
    sql_clean = sql.strip()
    # If the LLM answered UNABLE_TO_ANSWER
    if sql_clean.upper() == "UNABLE_TO_ANSWER":
        return {
            "error": "LLM could not form a SQL query using the available tables",
            "available_tables": list(tables),
        }

    # 4) quick safety: ensure it's a SELECT
    if not sql_clean.lower().lstrip().startswith("select"):
        return {"error": "Only SELECT queries are allowed.", "generated_sql": sql_clean}

    # 5) verify that SQL references only tables that exist (simple heuristic)
    #    We will look for table names (exact names from DB) in the SQL string.
    missing_tables = []
    sql_lower = sql_clean.lower()
    for t in tables:
        # check presence; compare lower-case to be case-insensitive
        pass
    # Instead of complex SQL parsing, check that at least one known table is present
    found_known_table = any(t.lower() in sql_lower for t in tables)
    if not found_known_table:
        return {
            "error": "Generated SQL does not reference any available tables.",
            "generated_sql": sql_clean,
            "available_tables": list(tables),
        }

    # 6) Execute and return
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        df_res = pd.read_sql_query(sql_clean, conn)
        conn.close()
    except Exception as e:
        # return helpful error including available tables
        return {
            "error": f"Execution failed: {str(e)}",
            "generated_sql": sql_clean,
            "available_tables": list(tables)
        }

    return {
        "query": question,
        "generated_sql": sql_clean,
        "rows": len(df_res),
        "columns": list(df_res.columns),
        "results": df_res.to_dict(orient="records"),
    }

# Simple health check
@app.get("/")
def root():
    return {"status": "Chat-with-data API running"}
