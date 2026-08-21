"""AI Assistant router endpoint for natural language query processing."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id
from app.db.session import get_db
from app.models import Flat, FlatOwnership
from app.schemas import AIAssistantRequest, AIAssistantResponse, ErrorResponse
from app.services import ai_service

router = APIRouter(tags=["AI Assistant"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
}


@router.post(
    "/ai/assistant",
    response_model=AIAssistantResponse,
    status_code=status.HTTP_200_OK,
    summary="Process natural language text prompt with Gemini AI",
    responses={
        **AUTH_ERRORS,
        422: {"model": ErrorResponse, "description": "Prompt validation failed"},
    },
)
def process_ai_prompt(
    payload: AIAssistantRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> AIAssistantResponse:
    """Accept natural language text from user, process via Gemini API (or fallback), and return reply + action card."""
    flat_label = ""
    # Lookup flat associated with user if available
    link = db.scalar(
        select(FlatOwnership).where(FlatOwnership.user_id == user.id)
    )
    if link and link.flat_id:
        flat = db.get(Flat, link.flat_id)
        if flat:
            flat_label = flat.label


    result = ai_service.query_gemini_api(
        prompt=payload.prompt,
        user_role=user.role,
        user_name=user.full_name,
        flat_info=flat_label,
    )

    return AIAssistantResponse(
        reply=result["reply"],
        card_type=result.get("card_type"),
        action_data=result.get("action_data"),
        provider=result.get("provider", "gemini"),
    )
