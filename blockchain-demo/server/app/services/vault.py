"""The key vault: the server keeps every party's signing key (as the design proposes)."""
from dataclasses import dataclass
from typing import Optional

from app.chain.signing import new_account
from app.constants import Role


class UnknownPartyError(KeyError):
    """No party with this address exists in the vault."""


@dataclass
class Party:
    address: str
    name: str
    role: Role
    private_key: str

    def public(self) -> dict[str, str]:
        return {"address": self.address, "name": self.name, "role": self.role.value}


class KeyVault:
    def __init__(self) -> None:
        self._parties: dict[str, Party] = {}

    def create(self, name: str, role: Role) -> Party:
        address, key = new_account()
        party = Party(address=address, name=name, role=role, private_key=key)
        self._parties[address] = party
        return party

    def get(self, address: str) -> Party:
        try:
            return self._parties[address.lower()]
        except KeyError as exc:
            raise UnknownPartyError(address) from exc

    def list(self, role: Optional[Role] = None) -> list[Party]:
        return [p for p in self._parties.values() if role is None or p.role == role]

    def name_of(self, address: str) -> Optional[str]:
        party = self._parties.get(address)
        return party.name if party else None
