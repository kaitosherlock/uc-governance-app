"""Request-local read scenarios; mutation scenarios belong to the plan lifecycle."""
from app.api.v1.models import ErrorCode
from app.errors import AppError, NotConfigured, RateLimited, UpstreamUnavailable, ValidationFailed

SCENARIOS = {'success', 'partial', 'forbidden', 'not_configured', 'unknown', 'rate_limited'}


def check_scenario(scenario: str) -> None:
    if scenario not in SCENARIOS:
        raise ValidationFailed('Unknown fixture read scenario.')
    if scenario == 'forbidden':
        raise AppError(ErrorCode.INSUFFICIENT_PRIVILEGES, 'The synthetic executor cannot read this resource.', 403)
    if scenario == 'not_configured':
        raise NotConfigured('The synthetic resource is not configured.')
    if scenario == 'unknown':
        raise UpstreamUnavailable('The synthetic upstream service is unavailable.')
    if scenario == 'rate_limited':
        raise RateLimited()
