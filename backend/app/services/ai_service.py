"""Gemini AI Assistant Service.

Uses Google Gemini API to parse natural language prompts, generate conversational AI replies,
and extract structured actions for Meridian Society OS. Falls back gracefully to local rule-based
NLP when GEMINI_API_KEY is not configured or network requests fail.
"""

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Valid UI card types supported by the frontend
CARD_TYPES = {
    "booking",
    "complaint",
    "guestpass",
    "announcements",
    "dues",
    "sos",
    "mybookings",
    "residentDirectory",
    "complaintTriage",
    "announcementCompose",
    "bookingsSchedule",
    "propertyStatus",
    "verifyPass",
    "sosInbox",
    "staffTasks",
}


def _local_fallback_parse(prompt: str, user_role: str, user_name: str) -> dict[str, Any]:
    """Local intent parsing fallback when Gemini API is unavailable or unconfigured."""
    text = prompt.strip().lower()

    # Help / Menu
    if "help" in text or "menu" in text or "options" in text:
        return {
            "reply": f"Hello {user_name}! I can assist you with booking facilities, raising complaints, generating guest passes, viewing announcements, and checking dues. How can I help you today?",
            "card_type": None,
            "action_data": None,
        }

    # Role-based intent matching
    if user_role == "SOCIETY_OFFICIAL":
        if any(w in text for w in ["directory", "resident", "occupant", "owner"]):
            return {
                "reply": "Opening the central resident directory records for administrative review.",
                "card_type": "residentDirectory",
                "action_data": {},
            }
        elif any(w in text for w in ["triage", "open complaint", "tickets", "issues"]):
            return {
                "reply": "Retrieving active complaint tickets for official triage.",
                "card_type": "complaintTriage",
                "action_data": {},
            }
        elif any(w in text for w in ["announcement", "notice", "broadcast", "post", "compose"]):
            return {
                "reply": "Initializing society notice draft composer.",
                "card_type": "announcementCompose",
                "action_data": {},
            }
        elif any(w in text for w in ["schedule", "reservations", "bookings"]):
            return {
                "reply": "Fetching central society facility booking schedule.",
                "card_type": "bookingsSchedule",
                "action_data": {},
            }

    elif user_role == "SECURITY_GUARD":
        if any(w in text for w in ["verify", "pass", "check-in", "visitor", "gate"]):
            return {
                "reply": "Opening visitor pass verification gate console.",
                "card_type": "verifyPass",
                "action_data": {},
            }
        elif any(w in text for w in ["sos", "alert", "alarm", "emergency"]):
            return {
                "reply": "Retrieving active emergency SOS dispatch alerts inbox.",
                "card_type": "sosInbox",
                "action_data": {},
            }

    elif user_role == "MAINTENANCE_STAFF":
        if any(w in text for w in ["task", "queue", "work order", "job", "assigned"]):
            return {
                "reply": "Opening your assigned maintenance work order queue.",
                "card_type": "staffTasks",
                "action_data": {},
            }

    elif user_role == "NON_RESIDENT_OWNER":
        if any(w in text for w in ["status", "occupancy", "property", "tenant"]):
            return {
                "reply": "Displaying remote property specification & tenant status.",
                "card_type": "propertyStatus",
                "action_data": {},
            }

    # General / Resident intents
    if "cancel" in text or "my booking" in text or "show booking" in text:
        return {
            "reply": "Retrieving your active facility bookings and upcoming reservations.",
            "card_type": "mybookings",
            "action_data": {},
        }
    elif any(w in text for w in ["book", "clubhouse", "gym", "tennis", "pool", "hall", "facility", "slot"]):
        return {
            "reply": "Opening facility slot scheduler widget. Select facility, date, and time slot below.",
            "card_type": "booking",
            "action_data": {},
        }
    elif any(w in text for w in ["complaint", "report", "issue", "leak", "broken", "repair", "ticket"]):
        return {
            "reply": "Initializing maintenance ticket draft. Please confirm the details below.",
            "card_type": "complaint",
            "action_data": {},
        }
    elif any(w in text for w in ["guest", "visitor", "pass", "invite", "digipass"]):
        return {
            "reply": "Preparing digital visitor pass generation card.",
            "card_type": "guestpass",
            "action_data": {},
        }
    elif any(w in text for w in ["announcement", "notice", "news", "update", "feed"]):
        return {
            "reply": "Fetching latest society announcements feed.",
            "card_type": "announcements",
            "action_data": {},
        }
    elif any(w in text for w in ["due", "bill", "invoice", "pay", "fee", "maintenance"]):
        return {
            "reply": "Fetching your outstanding maintenance bills and invoices.",
            "card_type": "dues",
            "action_data": {},
        }
    elif any(w in text for w in ["sos", "emergency", "help guard", "alarm"]):
        return {
            "reply": "WARNING: Triggering emergency security SOS alert for your unit.",
            "card_type": "sos",
            "action_data": {},
        }

    return {
        "reply": f"I received: '{prompt}'. How would you like me to assist you with Meridian Society OS?",
        "card_type": None,
        "action_data": None,
    }


def query_gemini_api(prompt: str, user_role: str, user_name: str, flat_info: str = "") -> dict[str, Any]:
    """Call Google Gemini API to interpret user prompt and extract structured action intent."""
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY is not set. Using local fallback NLP.")
        result = _local_fallback_parse(prompt, user_role, user_name)
        result["provider"] = "fallback"
        return result

    model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"

    system_instruction = f"""
You are the AI Assistant for Meridian Society OS, an Apartment Complex Management System.
Current authenticated user:
Name: {user_name}
Role: {user_role}
Unit/Flat: {flat_info or 'N/A'}

Supported action card types (card_type):
- "booking": User wants to book an amenity (e.g. Clubhouse, Gym, Tennis Court, Swimming Pool).
- "complaint": User wants to raise a complaint or report a maintenance issue (e.g. plumbing leak, electrical issue).
- "guestpass": User wants to generate a visitor pass for a guest.
- "announcements": User wants to see notices or announcements.
- "dues": User wants to see pending maintenance bills or pay invoices.
- "sos": User wants to trigger an emergency SOS alert.
- "mybookings": User wants to view or cancel their active reservations.
- "residentDirectory": Official user wants to search or view the resident directory.
- "complaintTriage": Official user wants to manage or triage open complaints.
- "announcementCompose": Official user wants to write/broadcast a new notice.
- "bookingsSchedule": Official user wants to see all society facility bookings.
- "propertyStatus": Non-resident owner wants to see tenant/property status.
- "verifyPass": Security guard wants to verify a visitor pass.
- "sosInbox": Security guard wants to view emergency alerts.
- "staffTasks": Maintenance staff wants to view assigned work tasks.

Return JSON strictly matching this schema:
{{
  "reply": "<friendly concise natural language response to the user>",
  "card_type": "<one of the valid card_type strings above, or null if no UI action card is needed>",
  "action_data": {{}}
}}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_instruction}\n\nUser text prompt: {prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code != 200:
                logger.warning(f"Gemini API call failed with status {resp.status_code}: {resp.text}")
                result = _local_fallback_parse(prompt, user_role, user_name)
                result["provider"] = "fallback"
                return result

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                result = _local_fallback_parse(prompt, user_role, user_name)
                result["provider"] = "fallback"
                return result

            content_parts = candidates[0].get("content", {}).get("parts", [])
            if not content_parts:
                result = _local_fallback_parse(prompt, user_role, user_name)
                result["provider"] = "fallback"
                return result

            raw_text = content_parts[0].get("text", "")
            # Clean possible markdown block markers
            cleaned = re.sub(r"^```json\s*", "", raw_text.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned)

            parsed = json.loads(cleaned)
            card_type = parsed.get("card_type")
            if card_type and card_type not in CARD_TYPES:
                card_type = None

            return {
                "reply": parsed.get("reply", f"Processed query: {prompt}"),
                "card_type": card_type,
                "action_data": parsed.get("action_data") or {},
                "provider": "gemini",
            }
    except Exception as exc:
        logger.error(f"Error calling Gemini API: {exc}")
        result = _local_fallback_parse(prompt, user_role, user_name)
        result["provider"] = "fallback"
        return result
