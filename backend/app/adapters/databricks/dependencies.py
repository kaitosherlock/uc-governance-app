"""A downstream impact inventory is not supplied by table metadata alone."""
from app.domain.models import DependenciesData
from app.errors import NotImplementedYet


class DependenciesAdapter:
    def dependencies(self, securable_type: str, full_name: str) -> DependenciesData:
        raise NotImplementedYet('Connected downstream dependency discovery is not implemented. Missing dependency information is not proof that deletion is safe.')
