"""Official Python SDK for the Gapwise Public Campus API."""

from .client import (
    AsyncGapwise,
    Gapwise,
    GapwiseAPIError,
    GapwiseError,
    GapwiseResponseError,
    GapwiseTransportError,
)
from .types import (
    ApiInfo,
    Building,
    CampusInfo,
    CampusPlace,
    CampusSummary,
    Page,
    RouteResult,
    UniversityInfo,
)

__all__ = [
    "ApiInfo",
    "AsyncGapwise",
    "Building",
    "CampusInfo",
    "CampusPlace",
    "CampusSummary",
    "Gapwise",
    "GapwiseAPIError",
    "GapwiseError",
    "GapwiseResponseError",
    "GapwiseTransportError",
    "Page",
    "RouteResult",
    "UniversityInfo",
]
