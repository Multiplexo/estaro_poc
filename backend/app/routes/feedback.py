from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.config import SettingsDep
from app.dependencies import CurrentUserDep, SessionDep, require_admin
from app.models.domain.feedback import Feedback, FeedbackCreate
from app.persistence.domain.feedback.feedback_repository import FeedbackRepository
from app.services.domain.feedback import forward_feedback

router = APIRouter()


async def get_feedback_repository(session: SessionDep) -> FeedbackRepository:
    return FeedbackRepository(session)


RepositoryDep = Annotated[FeedbackRepository, Depends(get_feedback_repository)]


@router.post("", status_code=status.HTTP_201_CREATED, operation_id="create_feedback")
async def create_feedback(
    data: FeedbackCreate,
    user: CurrentUserDep,
    repository: RepositoryDep,
    settings: SettingsDep,
) -> Feedback:
    feedback = await repository.create(data, user)
    if settings.FEEDBACK_WEBHOOK_URL and await forward_feedback(
        feedback, settings.FEEDBACK_WEBHOOK_URL, settings.MS_FRONTEND_URL
    ):
        return await repository.mark_forwarded(feedback.id) or feedback
    return feedback


@router.get("", operation_id="list_feedback", dependencies=[Depends(require_admin)])
async def list_feedback(repository: RepositoryDep) -> list[Feedback]:
    return await repository.list_recent()
