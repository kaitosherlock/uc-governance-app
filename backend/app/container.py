"""Application-owned dependencies; fixture datasets are isolated per app instance."""

import json
from pathlib import Path

from app.config.settings import Mode, Settings
from app.domain.reads import Readers
from app.mutations.core import MutationEngine, PlanKindRegistry
from app.mutations.plan_kinds import (
    register_connected_readonly_plan_kinds,
    register_fixture_plan_kinds,
)


class Container:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.fixture_readers: Readers | None = None
        from app.adapters.databricks.common import CursorStore

        self.cursors = CursorStore()
        if settings.mode == Mode.FIXTURE:
            from app.adapters.fixtures.readers import FixtureReaders

            adapter = FixtureReaders()
            path = Path(__file__).parent / "fixtures_data" / "privilege_codes.json"
            values = json.loads(path.read_text(encoding="utf-8"))
            self.fixture_readers = Readers(
                catalogs=adapter,
                schemas=adapter,
                objects=adapter,
                assets=adapter,
                grants=adapter,
                principals=adapter,
                dependencies=adapter,
                privilege_codes=tuple(str(v) for v in values),
            )
            registry = PlanKindRegistry()
            for fixture_handler in register_fixture_plan_kinds(
                adapter, self.fixture_readers.privilege_codes
            ):
                registry.register(fixture_handler)
            self.mutation_engine = MutationEngine(settings, registry)
        else:
            # Connected read-only must resolve these kinds before the engine's mode guard.
            registry = PlanKindRegistry()
            for handler in register_connected_readonly_plan_kinds():
                registry.register(handler)
            self.mutation_engine = MutationEngine(settings, registry)

    def readers_for(self, access_token: str) -> Readers:
        if self.fixture_readers is not None:
            return self.fixture_readers
        from app.adapters.databricks.factory import sdk_readers

        return sdk_readers(self.settings, access_token, self.cursors)
