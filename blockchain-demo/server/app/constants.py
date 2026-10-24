"""Shared enums and constants for the authenticity demo."""
from enum import Enum

# The simulated contract's address. Signed tag messages include it so a signature
# made for this contract cannot be replayed against another one.
CONTRACT_ADDRESS = "0x00000000000000000000000000000000000c0de1"
ZERO_HASH = "0x" + "00" * 32

# Consensus timing, measured in network ticks (one tick is one simulation step).
BLOCK_PERIOD_TICKS = 2          # minimum gap between blocks
OUT_OF_TURN_STEP_TICKS = 2      # extra wait per rank for a PoA out-of-turn proposer
IDLE_HEARTBEAT_TICKS = 15       # produce an empty block this often so liveness is visible
HEAD_ANNOUNCE_EVERY_TICKS = 3   # nodes tell peers their head so lagging nodes can sync
MAX_TXS_PER_BLOCK = 20
DEFAULT_LATENCY_TICKS = 1
DEFAULT_READ_TOLERANCE = 2      # how far a tag's read counter may run ahead of the record (0 = must match exactly)
EVENT_LOG_LIMIT = 600


class TxType(str, Enum):
    REGISTER_VALIDATOR = "REGISTER_VALIDATOR"
    REGISTER_PRODUCER = "REGISTER_PRODUCER"
    REGISTER_PARTICIPANT = "REGISTER_PARTICIPANT"
    CREATE_PRODUCT = "CREATE_PRODUCT"
    TRANSFER = "TRANSFER"
    SELL = "SELL"
    BUMP_READ = "BUMP_READ"
    LOG_FAILURE = "LOG_FAILURE"
    SET_TOLERANCE = "SET_TOLERANCE"


class NodeMode(str, Enum):
    HONEST = "honest"
    OFFLINE = "offline"        # hears and sends nothing
    EQUIVOCATE = "equivocate"  # proposes two different blocks for the same slot
    TAMPER = "tamper"          # proposes a block with a falsified state root


class ConsensusKind(str, Enum):
    POA = "poa"


class ProductStatus(str, Enum):
    REGISTERED = "registered"
    SOLD = "sold"


class Role(str, Enum):
    ADMIN = "admin"
    VALIDATOR = "validator"
    PRODUCER = "producer"
    PARTICIPANT = "participant"
    CUSTOMER = "customer"


class AttackKind(str, Enum):
    """Error classes named by the dNAS paper."""
    MODIFICATION = "modification"
    REAPPLICATION = "reapplication"
    CLONING = "cloning"
    RECORD_MISMATCH = "record_mismatch"
    NONE = "none"


class EventType(str, Enum):
    TX_SUBMITTED = "tx_submitted"
    TX_REJECTED = "tx_rejected"
    TX_DROPPED = "tx_dropped"
    TX_FINAL = "tx_final"
    BLOCK_PROPOSED = "block_proposed"
    BLOCK_ACCEPTED = "block_accepted"
    BLOCK_REJECTED = "block_rejected"
    REORG = "reorg"
    SYNC = "sync"
    NODE_ADDED = "node_added"
    NODE_MODE = "node_mode"
    PARTITION = "partition"
    HEAL = "heal"
    NETWORK = "network"
    SCAN = "scan"
