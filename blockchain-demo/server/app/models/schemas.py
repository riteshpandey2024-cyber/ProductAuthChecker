"""Request bodies for the HTTP API."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.constants import NodeMode
from app.contract.rules import TagData


class PartyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    role: Literal["producer", "participant", "customer"]


class ProductCreate(BaseModel):
    producer: str
    name: str = Field(min_length=1, max_length=80)
    details: dict[str, Any] = Field(default_factory=dict)


class HandoverRequest(BaseModel):
    actor: str
    to: str


class SellRequest(BaseModel):
    actor: str
    buyer: str


class ScanRequest(BaseModel):
    tag: TagData
    node_id: Optional[str] = None
    trust_database: bool = True


class NodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)


class NodeModeRequest(BaseModel):
    mode: NodeMode


class PartitionRequest(BaseModel):
    groups: list[list[str]]


class ResetRequest(BaseModel):
    nodes: int = Field(default=4, ge=1, le=9)


class LatencyRequest(BaseModel):
    ticks: int = Field(ge=0, le=10)


class ToleranceRequest(BaseModel):
    value: int = Field(ge=0, le=50)


class TamperRequest(BaseModel):
    product_id: str
    field: str = Field(min_length=1, max_length=40)
    value: Any
