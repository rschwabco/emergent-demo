#!/usr/bin/env python3
"""
Export Cursor agent transcripts into a single JSONL file suitable for
chunking and uploading to Pinecone.

Each conversation becomes one document with:
  - id: the conversation UUID
  - title: derived from the first user message
  - text: the full conversation as clean Markdown
  - metadata: role counts, word count, timestamp
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

TRANSCRIPTS_DIR = Path(
    os.environ.get(
        "TRANSCRIPTS_DIR",
        os.path.expanduser(
            "~/.cursor/projects/Users-roie-dev-emergent-demo/agent-transcripts"
        ),
    )
)
OUTPUT_FILE = Path(
    os.environ.get("OUTPUT_FILE", "transcripts_export.jsonl")
)


def strip_xml_tags(text: str) -> str:
    """Remove wrapper XML tags like <user_query>, <system_reminder>, etc."""
    text = re.sub(r"<user_query>\s*", "", text)
    text = re.sub(r"\s*</user_query>", "", text)
    text = re.sub(r"<system_reminder>.*?</system_reminder>", "", text, flags=re.DOTALL)
    text = re.sub(
        r"<open_and_recently_viewed_files>.*?</open_and_recently_viewed_files>",
        "",
        text,
        flags=re.DOTALL,
    )
    text = re.sub(r"<user_info>.*?</user_info>", "", text, flags=re.DOTALL)
    text = re.sub(
        r"<agent_transcripts>.*?</agent_transcripts>", "", text, flags=re.DOTALL
    )
    text = re.sub(r"<agent_skills>.*?</agent_skills>", "", text, flags=re.DOTALL)
    text = re.sub(
        r"<available_skills.*?>.*?</available_skills>", "", text, flags=re.DOTALL
    )
    return text.strip()


def extract_text(content_blocks: list) -> str:
    """Pull plain text from message content blocks."""
    parts = []
    for block in content_blocks:
        if block.get("type") == "text":
            cleaned = strip_xml_tags(block["text"])
            if cleaned:
                parts.append(cleaned)
    return "\n".join(parts)


def derive_title(text: str, max_len: int = 80) -> str:
    first_line = text.split("\n")[0].strip()
    if len(first_line) > max_len:
        return first_line[:max_len] + "…"
    return first_line


def load_conversation(jsonl_path: Path) -> list[dict]:
    """Load a JSONL transcript into a list of turns."""
    turns = []
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                role = obj.get("role", "unknown")
                content = obj.get("message", {}).get("content", [])
                text = extract_text(content)
                if text:
                    turns.append({"role": role, "text": text})
            except json.JSONDecodeError:
                continue
    return turns


def format_conversation(turns: list[dict]) -> str:
    """Render turns into readable Markdown-ish text."""
    lines = []
    for turn in turns:
        label = "User" if turn["role"] == "user" else "Assistant"
        lines.append(f"### {label}\n")
        lines.append(turn["text"])
        lines.append("")
    return "\n".join(lines)


def process_all():
    if not TRANSCRIPTS_DIR.is_dir():
        print(f"Transcripts directory not found: {TRANSCRIPTS_DIR}", file=sys.stderr)
        sys.exit(1)

    docs = []

    for conv_dir in sorted(TRANSCRIPTS_DIR.iterdir()):
        if not conv_dir.is_dir():
            continue
        conv_id = conv_dir.name
        main_jsonl = conv_dir / f"{conv_id}.jsonl"
        if not main_jsonl.exists():
            continue

        turns = load_conversation(main_jsonl)

        subagents_dir = conv_dir / "subagents"
        if subagents_dir.is_dir():
            for sub_jsonl in sorted(subagents_dir.glob("*.jsonl")):
                sub_turns = load_conversation(sub_jsonl)
                if sub_turns:
                    turns.append({"role": "assistant", "text": "--- Subagent Task ---"})
                    turns.extend(sub_turns)
                    turns.append({"role": "assistant", "text": "--- End Subagent ---"})

        if not turns:
            continue

        first_user = next((t["text"] for t in turns if t["role"] == "user"), "")
        title = derive_title(first_user)
        full_text = format_conversation(turns)
        mod_time = datetime.fromtimestamp(main_jsonl.stat().st_mtime).isoformat()

        user_turns = sum(1 for t in turns if t["role"] == "user")
        assistant_turns = sum(1 for t in turns if t["role"] == "assistant")
        word_count = len(full_text.split())

        doc = {
            "id": conv_id,
            "title": title,
            "text": full_text,
            "metadata": {
                "conversation_id": conv_id,
                "title": title,
                "user_turns": user_turns,
                "assistant_turns": assistant_turns,
                "word_count": word_count,
                "last_modified": mod_time,
                "source": "cursor_agent_transcript",
            },
        }
        docs.append(doc)

    with open(OUTPUT_FILE, "w") as f:
        for doc in docs:
            f.write(json.dumps(doc) + "\n")

    print(f"Exported {len(docs)} conversations to {OUTPUT_FILE}")
    total_words = sum(d["metadata"]["word_count"] for d in docs)
    print(f"Total words: {total_words:,}")
    print(f"Total turns: {sum(d['metadata']['user_turns'] + d['metadata']['assistant_turns'] for d in docs)}")


if __name__ == "__main__":
    process_all()
