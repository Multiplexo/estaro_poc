import structlog
from sqlalchemy import case, delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence.domain.outlook.schema.mailbox import OutlookMailbox

logger = structlog.get_logger(__name__)


class OutlookRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def connect(self, account_id: str, refresh_token: str) -> None:
        statement = insert(OutlookMailbox).values(
            id=1, account_id=account_id, refresh_token=refresh_token
        )
        statement = statement.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "account_id": account_id,
                "refresh_token": refresh_token,
                "delta_link": case(
                    (
                        col(OutlookMailbox.account_id) == account_id,
                        col(OutlookMailbox.delta_link),
                    ),
                    else_=None,
                ),
            },
        )
        try:
            await self.session.execute(statement)
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("outlook_connection_connect_failed")
            raise

    async def is_connected(self) -> bool:
        try:
            statement = select(OutlookMailbox.id).where(OutlookMailbox.id == 1)
            return (await self.session.exec(statement)).one_or_none() is not None
        except SQLAlchemyError:
            logger.exception("outlook_connection_lookup_failed")
            raise

    async def disconnect(self) -> None:
        try:
            await self.session.execute(
                delete(OutlookMailbox).where(col(OutlookMailbox.id) == 1)
            )
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("outlook_disconnect_failed")
            raise

    async def lock_connection(self) -> OutlookMailbox | None:
        statement = (
            select(OutlookMailbox)
            .where(OutlookMailbox.id == 1)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        try:
            return (await self.session.exec(statement)).one_or_none()
        except SQLAlchemyError:
            logger.exception("outlook_connection_lock_failed")
            raise

    async def save(self, connection: OutlookMailbox) -> None:
        try:
            self.session.add(connection)
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("outlook_connection_save_failed")
            raise
