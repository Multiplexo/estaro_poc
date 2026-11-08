from collections.abc import Callable
from unittest.mock import AsyncMock

OverrideDependency = Callable[..., AsyncMock]
