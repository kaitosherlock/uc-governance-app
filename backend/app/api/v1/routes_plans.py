"""Frozen plan and operation routes; individual plan kinds register separately."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.v1 import models as w
from app.api.v1.routes_context import CurrentIdentity
from app.config.settings import Mode
from app.container import Container
from app.correlation import correlation_id
from app.mutations.core import MutationEngine

router = APIRouter(tags=["plans"])


def responses(*statuses: int) -> dict[int | str, dict[str, object]]:
    return {value: {"model": w.ErrorResponse} for value in statuses}


def engine(request: Request) -> MutationEngine:
    container: Container = request.app.state.container
    return container.mutation_engine


Engine = Annotated[MutationEngine, Depends(engine)]


def meta(request: Request) -> w.Meta:
    settings = request.app.state.settings
    return w.Meta(
        source=w.DataSource.FIXTURE if settings.mode == Mode.FIXTURE else w.DataSource.APPLICATION,
        observed_at=datetime.now(UTC),
        completeness=w.Completeness.COMPLETE,
        limitations=(
            ["All data is synthetic; fixture operations are isolated in memory."]
            if settings.mode == Mode.FIXTURE
            else ["Operations use the configured execution identity."]
        ),
        correlation_id=correlation_id.get(),
    )


@router.post(
    "/plans",
    response_model=w.PlanResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createPlan",
    responses=responses(400, 401, 403, 404, 429, 500, 501, 503),
)
def create_plan(
    request: Request,
    body: w.PlanCreateRequest,
    identity: CurrentIdentity,
    lifecycle: Engine,
) -> w.PlanResponse:
    return w.PlanResponse(success=True, data=lifecycle.build(body, identity), meta=meta(request))


@router.get(
    "/plans/{plan_id}",
    response_model=w.PlanResponse,
    operation_id="getPlan",
    responses=responses(401, 403, 404, 500),
)
def get_plan(
    plan_id: str,
    request: Request,
    identity: CurrentIdentity,
    lifecycle: Engine,
) -> w.PlanResponse:
    return w.PlanResponse(
        success=True, data=lifecycle.get_plan(plan_id, identity), meta=meta(request)
    )


@router.post(
    "/plans/{plan_id}/execute",
    response_model=w.OperationResponse,
    operation_id="executePlan",
    responses={
        202: {"model": w.OperationResponse},
        **responses(400, 401, 403, 404, 409, 429, 500, 503),
    },
)
def execute_plan(
    plan_id: str,
    request: Request,
    response: Response,
    body: w.PlanExecuteRequest,
    identity: CurrentIdentity,
    lifecycle: Engine,
) -> w.OperationResponse:
    operation = lifecycle.execute(plan_id, body, identity, correlation_id.get())
    # 202 is reserved for an ambiguity after a mutation attempt.
    response.status_code = (
        status.HTTP_202_ACCEPTED
        if operation.status == w.OperationStatus.UNKNOWN
        else status.HTTP_200_OK
    )
    return w.OperationResponse(success=True, data=operation, meta=meta(request))


@router.get(
    "/operations/{operation_id}",
    response_model=w.OperationResponse,
    operation_id="getOperation",
    responses=responses(401, 403, 404, 500),
)
def get_operation(
    operation_id: str,
    request: Request,
    identity: CurrentIdentity,
    lifecycle: Engine,
) -> w.OperationResponse:
    return w.OperationResponse(
        success=True, data=lifecycle.get_operation(operation_id, identity), meta=meta(request)
    )


@router.post(
    "/operations/{operation_id}/reconcile",
    response_model=w.OperationResponse,
    operation_id="reconcileOperation",
    responses=responses(401, 403, 404, 500, 503),
)
def reconcile_operation(
    operation_id: str,
    request: Request,
    identity: CurrentIdentity,
    lifecycle: Engine,
) -> w.OperationResponse:
    return w.OperationResponse(
        success=True, data=lifecycle.reconcile(operation_id, identity), meta=meta(request)
    )
