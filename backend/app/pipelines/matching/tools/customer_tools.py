import json
from uuid import UUID

from langchain.tools import tool
from langchain_core.tools import BaseTool
from pydantic import TypeAdapter
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.customers import Customer
from app.models.jobs.matching import MatchFeedback
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository

CUSTOMER_SEARCH_FIELDS = {
    "id",
    "customer_number",
    "matchcode",
    "name",
    "name_addition",
    "postal_code",
    "city",
    "country_code",
    "vat_id",
    "is_active",
    "delivery_blocked",
}


def create_customer_tools(
    sessions: async_sessionmaker[AsyncSession],
    memory: MatchingMemoryRepository,
    candidates: dict[str, Customer],
) -> list[BaseTool]:
    @tool
    async def search_customers(query: str) -> str:
        """Suche Kunden im lokalen Stamm über Nummer, Name, Matchcode, Ort, Postleitzahl oder USt-ID. Liefert Kurzdaten; alle Felder mit get_customer_details."""
        async with sessions() as session:
            records = await CustomerRepository(session).search(query)
        candidates.update({str(record.id): record for record in records})
        # Compact rows keep token use low; get_customer_details returns all fields.
        return json.dumps(
            [
                record.model_dump(mode="json", include=CUSTOMER_SEARCH_FIELDS)
                for record in records
            ],
            ensure_ascii=False,
        )

    @tool
    async def get_customer_by_number(customer_number: str) -> str:
        """Lies Kundenstammdaten über die exakte Kundennummer, etwa D30269 für Divers."""
        async with sessions() as session:
            record = await CustomerRepository(session).get_customer_by_number(
                customer_number
            )
        if record is None:
            return "null"
        candidates[str(record.id)] = record
        return record.model_dump_json()

    @tool
    async def get_customer_details(customer_id: UUID) -> str:
        """Lies die vollständigen Kundenstammdaten zu einer exakten Kunden-UUID."""
        async with sessions() as session:
            record = await CustomerRepository(session).get_customer(customer_id)
        if record is None:
            return "null"
        candidates[str(record.id)] = record
        return record.model_dump_json()

    @tool
    async def get_customer_feedback(query: str) -> str:
        """Suche bestätigtes, wiederverwendbares Kundenfeedback anhand von Suchbegriffen oder Aliasnamen."""
        records = await memory.search("customer", query)
        return TypeAdapter(list[MatchFeedback]).dump_json(records).decode()

    return [
        search_customers,
        get_customer_by_number,
        get_customer_details,
        get_customer_feedback,
    ]
