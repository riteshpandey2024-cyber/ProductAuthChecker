"""Key generation, signing and signer recovery (secp256k1, Ethereum style)."""
from typing import Optional

from eth_account import Account
from eth_account.messages import encode_defunct


def new_account() -> tuple[str, str]:
    """Return (address, private_key). Addresses are stored lower-case everywhere."""
    acct = Account.create()
    key = acct.key.hex()
    return acct.address.lower(), key if key.startswith("0x") else "0x" + key


def sign_digest(private_key: str, digest_hex: str) -> str:
    message = encode_defunct(hexstr=digest_hex)
    signed = Account.sign_message(message, private_key=private_key)
    sig = signed.signature.hex()
    return sig if sig.startswith("0x") else "0x" + sig


def recover_signer(digest_hex: str, signature: str) -> Optional[str]:
    """Work out which address made `signature` over `digest_hex`; None if malformed."""
    try:
        message = encode_defunct(hexstr=digest_hex)
        return Account.recover_message(message, signature=signature).lower()
    except Exception:  # eth-account raises several unrelated types for bad input
        return None
